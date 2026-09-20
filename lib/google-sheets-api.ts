import { google } from 'googleapis';
import { db } from './db';

export const SHEETS_HEADER = [
  'ID',
  'Nombre',
  'Teléfono',
  'Estado',
  'Bot IA',
  'Etiquetas',
  'Fecha registro',
  'Última interacción',
  'Canal',
  'Cantidad',
  'Producto',
  'Total S/',
];

// Ancho de columnas sincronizadas (A-L). Tu hoja conserva sus encabezados si ya existen.
const SHEETS_WIDTH = 'A:L';

export type SheetsSyncResult = { created: number; updated: number };

class SheetsConfigError extends Error {}

/** Lee la service account sin exponerla nunca en logs ni respuestas. */
function loadServiceAccount(): { client_email: string; private_key: string } {
  let raw: string | null = null;
  try {
    // getSystemSetting es async en algunas ramas; aquí solo lectura sync vía env + cache.
    raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null;
  } catch {
    raw = null;
  }
  // Nota: la lectura desde BD se hace en resolveSheetCredentials (async).
  if (!raw) {
    throw new SheetsConfigError(
      'Falta la cuenta de servicio. Pega el JSON en Configuración → Google Sheets o define GOOGLE_SERVICE_ACCOUNT_JSON.'
    );
  }
  return parseServiceAccount(raw);
}

function parseServiceAccount(raw: string): { client_email: string; private_key: string } {
  let text = raw.trim();
  // Acepta ruta de archivo o JSON crudo
  if (!text.startsWith('{')) {
    try {
      const req = eval('require') as NodeRequire;
      text = req('fs').readFileSync(text, 'utf8');
    } catch {
      throw new SheetsConfigError('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido ni una ruta legible.');
    }
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SheetsConfigError('El JSON de la cuenta de servicio no es válido.');
  }
  const client_email = typeof parsed.client_email === 'string' ? parsed.client_email : '';
  let private_key = typeof parsed.private_key === 'string' ? parsed.private_key : '';
  // Claves pegadas con \n literales
  if (private_key.includes('\\n')) private_key = private_key.replace(/\\n/g, '\n');
  if (!client_email || !private_key.includes('BEGIN PRIVATE KEY')) {
    throw new SheetsConfigError('El JSON no contiene client_email / private_key válidos.');
  }
  return { client_email, private_key };
}

/** Resuelve credenciales: env primero, luego BD (sin loguear el secreto). */
async function resolveCredentials(): Promise<{ client_email: string; private_key: string }> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return loadServiceAccount();
  }
  let fromDb: string | null = null;
  try {
    fromDb = await db.getSystemSetting('google_service_account');
  } catch {
    fromDb = null;
  }
  if (!fromDb || !fromDb.trim()) {
    throw new SheetsConfigError(
      'Falta la cuenta de servicio. Pega el JSON en Configuración → Google Sheets o define GOOGLE_SERVICE_ACCOUNT_JSON.'
    );
  }
  return parseServiceAccount(fromDb);
}

/** Extrae el ID desde un ID crudo o una URL docs.google.com/.../d/<id>/... */
export function extractSheetId(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const v = input.trim();
  const m = v.match(/\/d\/([a-zA-Z0-9-_]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{15,}$/.test(v)) return v;
  return null;
}

async function resolveSheetId(): Promise<string> {
  let configured: string | null = null;
  try {
    configured = await db.getSystemSetting('google_sheet_id');
  } catch {
    configured = null;
  }
  // Compatibilidad: si pegó la URL del documento en el campo ID
  if (!extractSheetId(configured)) {
    try {
      const maybeUrl = await db.getSystemSetting('google_sheets_url');
      const fromUrl = extractSheetId(maybeUrl);
      if (fromUrl) return fromUrl;
    } catch {
      /* ignore */
    }
  }
  const id = extractSheetId(configured);
  if (!id) {
    throw new SheetsConfigError(
      'Falta el ID de la hoja. Pégalo en Configuración → Google Sheets (son los caracteres entre /d/ y /edit de la URL) y comparte la hoja con el email de la cuenta de servicio.'
    );
  }
  return id;
}

/**
 * Sincroniza filas A-L por API oficial con upsert por ID (columna A, primera pestaña).
 */
export async function syncRowsToSheet(
  rows: string[][],
  opts: { rebuild?: boolean } = {}
): Promise<SheetsSyncResult> {
  const { client_email, private_key } = await resolveCredentials();
  const spreadsheetId = await resolveSheetId();

  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  if (opts.rebuild) {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'A2:L' });
  }

  // Asegurar encabezado
  try {
    const head = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:L1' });
    if (!head.data.values || head.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1:L1',
        valueInputOption: 'RAW',
        requestBody: { values: [SHEETS_HEADER] },
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo leer la hoja (¿compartida con ${client_email}?): ${msg}`);
  }

  // Mapa ID -> fila
  const idToRow = new Map<string, number>();
  try {
    const col = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A2:A' });
    (col.data.values || []).forEach((r, i) => {
      const id = String(r[0] ?? '');
      if (id) idToRow.set(id, i + 2);
    });
  } catch {
    /* hoja vacía: todo es nuevo */
  }

  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][] = [];
  for (const row of rows) {
    const id = String(row[0] ?? '');
    if (!id) continue;
    const at = idToRow.get(id);
    if (at) updates.push({ range: `A${at}:L${at}`, values: [row] });
    else appends.push(row);
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
    });
  }
  if (appends.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEETS_WIDTH,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: appends },
    });
  }

  return { created: appends.length, updated: updates.length };
}

export function isSheetsConfigError(e: unknown): boolean {
  return e instanceof SheetsConfigError;
}
