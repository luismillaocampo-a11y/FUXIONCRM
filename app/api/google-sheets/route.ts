import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { syncRowsToSheet, isSheetsConfigError } from '@/lib/google-sheets-api';

export const dynamic = 'force-dynamic';

const LAST_SYNC_KEY = 'google_sheets_last_sync';

function parseDbDate(value: unknown): number {
  if (!value) return 0;
  let s = String(value);
  if (!s.includes('T')) s = s.replace(' ', 'T');
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function translateStatus(status: string): string {
  switch (status) {
    case 'New':
      return 'Nuevo Prospecto';
    case 'Engaged':
      return 'Interactuando';
    case 'Pending Verification':
      return 'Verificación Pendiente';
    case 'Por Registrar en Web':
      return 'Por Registrar en Web';
    case 'Converted':
      return 'Venta Confirmada';
    case 'Archived':
      return 'Archivado';
    default:
      return status || 'Nuevo Prospecto';
  }
}

function translateChannel(channel: unknown): string {
  const c = typeof channel === 'string' ? channel.toLowerCase() : '';
  if (c === 'instagram') return 'Instagram';
  if (c === 'facebook') return 'Facebook';
  return 'WhatsApp';
}

/**
 * POST /api/google-sheets
 * Body opcional: { mode: 'full' | 'delta' | 'rebuild' }
 * - full: envía todos los leads (comportamiento clásico).
 * - delta: solo leads modificados desde la última sincronización exitosa.
 * - rebuild: como full + indica al script que limpie la hoja antes (requiere
 *   soporte `rebuild` en el Apps Script; si no lo tiene, actúa como full).
 */
export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    let mode: string = 'full';
    try {
      const raw = await request.text();
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.mode === 'string') mode = parsed.mode;
      }
    } catch {
      /* cuerpo vacío o inválido: modo full por compatibilidad */
    }
    if (!['full', 'delta', 'rebuild'].includes(mode)) {
      return NextResponse.json({ success: false, error: 'Modo inválido (full, delta, rebuild)' }, { status: 400 });
    }

    let googleSheetsUrl = await db.getSystemSetting('google_sheets_url');
    googleSheetsUrl = googleSheetsUrl?.trim() || null;

    // Obtener los leads de la base de datos
    const allLeads = await db.getLeads();
    let leads = allLeads;
    let lastSync: string | null = null;
    try {
      lastSync = await db.getSystemSetting(LAST_SYNC_KEY);
    } catch {
      lastSync = null;
    }

    if (mode === 'delta' && lastSync) {
      const since = parseDbDate(lastSync);
      if (since > 0) {
        leads = allLeads.filter((l: any) => parseDbDate(l.updated_at) > since || parseDbDate(l.created_at) > since);
      }
      if (leads.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Sin cambios desde la última sincronización. La hoja ya está al día.',
          synced_count: 0,
          created: 0,
          updated: 0,
          mode,
          last_sync: lastSync,
        });
      }
    }

    const entries = leads.map((lead: any) => {
      // ID estable (clave de sincronización): puede ser LID temporal
      const rawId = (lead.id || '').toString().replace(/\D/g, '') || lead.id;
      // Celular real: el número que te escribió (real_phone) antes que el LID.
      // LID = match con whatsapp_lid o 14+ dígitos (móviles AR de 13 son reales).
      const lidD = (lead.whatsapp_lid || '').toString().replace(/\D/g, '');
      const lidEvidence = lidD.length >= 14 ? lidD : '';
      const isLidD = (d: string) => !!d && ((lidEvidence !== '' && d === lidEvidence) || d.length >= 14);
      const shortDigits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
      const realDigits = shortDigits(lead.real_phone);
      const phoneDigits = shortDigits(lead.phone);
      // Respaldo: el id suele ser el número cuando phone viene vacío (nunca fb_/ig_ cortos)
      const idDigits = shortDigits(lead.id);
      const idFallback = idDigits.length >= 7 && !isLidD(idDigits) ? idDigits : '';
      const celularDigits =
        (realDigits && !isLidD(realDigits) ? realDigits : '') ||
        (phoneDigits && !isLidD(phoneDigits) ? phoneDigits : '') ||
        idFallback;
      const formattedPhone = celularDigits ? `+${celularDigits}` : '';
      const tagsStr = Array.isArray(lead.tags) ? lead.tags.join(', ') : (lead.tags || '');

      const fechaReg = lead.created_at ? new Date(lead.created_at).toLocaleString('es-PE') : new Date().toLocaleString('es-PE');
      const ultInt = lead.updated_at ? new Date(lead.updated_at).toLocaleString('es-PE') : new Date().toLocaleString('es-PE');
      const botStatus = lead.bot_active ? 'IA Automática' : 'Atención Manual';
      const estadoComercial = translateStatus(lead.status);
      const leadName = lead.name || 'Cliente WhatsApp';
      const canal = translateChannel(lead.channel);
      const qty = typeof lead.last_order_qty === 'number' ? lead.last_order_qty : null;
      const total = typeof lead.last_order_total === 'number' ? lead.last_order_total : null;
      const producto = typeof lead.last_product === 'string' ? lead.last_product.slice(0, 120) : '';

      return {
        id: rawId,
        nombre: leadName,
        telefono: formattedPhone,
        estado: estadoComercial,
        bot_ia: botStatus,
        etiquetas: tagsStr,
        fecha_registro: fechaReg,
        ultima_interaccion: ultInt,
        canal,
        cantidad: qty,
        producto,
        total,
        // Orden A a L exacto (J = cantidad pedida, L = total S/)
        row: [
          rawId,
          leadName,
          formattedPhone,
          estadoComercial,
          botStatus,
          tagsStr,
          fechaReg,
          ultInt,
          canal,
          qty === null ? '' : qty,
          producto,
          total === null ? '' : total
        ]
      };
    });

    // Vía preferida: API oficial (cuenta de servicio). Si no está configurada,
    // se usa el webhook de Apps Script como respaldo.
    let via: 'api' | 'webhook' = 'api';
    try {
      const apiResult = await syncRowsToSheet(
        entries.map((e: { row: string[] }) => e.row),
        { rebuild: mode === 'rebuild' }
      );
      return await finishSync(apiResult.created, apiResult.updated, via, mode, leads.length);
    } catch (apiErr: unknown) {
      if (!isSheetsConfigError(apiErr)) {
        console.error('[GoogleSheets API] Error de API oficial:', apiErr instanceof Error ? apiErr.message : apiErr);
        return NextResponse.json({
          success: false,
          error: apiErr instanceof Error ? apiErr.message : 'Error de la API de Google Sheets.'
        }, { status: 502 });
      }
      if (!googleSheetsUrl) {
        return NextResponse.json({
          success: false,
          error: 'Configura la API oficial (ID de hoja + cuenta de servicio) o la URL del webhook en Configuración -> Automatización & API.'
        }, { status: 400 });
      }
      console.log('[GoogleSheets API] API oficial no configurada, usando webhook. Motivo:', apiErr instanceof Error ? apiErr.message : apiErr);
      via = 'webhook';
    }

    const formattedPayload = {
      action: 'sync_leads',
      source: 'NutraFlow CRM',
      timestamp: new Date().toISOString(),
      mode,
      rebuild: mode === 'rebuild',
      total_count: leads.length,
      leads: entries
    };

    console.log(`[GoogleSheets API] Enviando ${leads.length} registros a: ${googleSheetsUrl}`);

    // Realizar la petición HTTP POST al Webhook de Google Apps Script
    const response = await fetch(googleSheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedPayload),
      redirect: 'follow'
    });

    if (!response.ok && response.status !== 302 && response.status !== 301) {
      const errorText = await response.text();
      console.error('[GoogleSheets API] Respuesta de error de Google:', response.status, errorText);
      return NextResponse.json({
        success: false,
        error: `Google Sheets respondió con código de estado HTTP ${response.status}. Revisa que la URL tenga acceso público.`
      }, { status: 502 });
    }

    // Leer el resultado del script (created/updated) en vez de asumir éxito ciego
    let created = 0;
    let updated = 0;
    try {
      const resultText = await response.text();
      const result = resultText ? JSON.parse(resultText) : null;
      if (result && typeof result === 'object') {
        if (typeof result.created === 'number') created = result.created;
        if (typeof result.updated === 'number') updated = result.updated;
        if (result.success === false) {
          throw new Error(result.error || 'El script de Google Sheets reportó un error.');
        }
      }
    } catch (parseErr: any) {
      if (parseErr?.message?.startsWith('El script')) throw parseErr;
      // Respuesta no-JSON (redirecciones Apps Script): se asume éxito por HTTP ok
      console.warn('[GoogleSheets API] Respuesta no-JSON del script, se asume éxito por HTTP:', parseErr?.message);
    }

    return finishSync(created, updated, via, mode, leads.length);

  } catch (err: any) {
    console.error('[GoogleSheets API] Error inesperado:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al conectar con Google Sheets.'
    }, { status: 500 });
  }
}

async function finishSync(
  created: number,
  updated: number,
  via: 'api' | 'webhook',
  mode: string,
  total: number
) {
  // Guardar marca de sincronización exitosa (base para el modo delta)
  const nowIso = new Date().toISOString();
  try {
    await db.setSystemSetting(LAST_SYNC_KEY, nowIso);
  } catch (e) {
    console.warn('[GoogleSheets API] No se pudo guardar last_sync:', e);
  }

  const parts: string[] = [];
  if (created > 0) parts.push(`${created} nuevos`);
  if (updated > 0) parts.push(`${updated} actualizados`);
  if (parts.length === 0) parts.push(`${total} enviados`);
  const viaLabel = via === 'api' ? 'vía API oficial' : 'vía webhook';

  return NextResponse.json({
    success: true,
    message: `¡Sincronización ${mode === 'delta' ? 'de cambios' : mode === 'rebuild' ? 'con reconstrucción' : 'completa'} exitosa ${viaLabel}! ${parts.join(' · ')}.`,
    synced_count: total,
    created,
    updated,
    mode,
    via,
    last_sync: nowIso,
  });
}

/**
 * GET /api/google-sheets
 * Retorna la URL actual configurada para Google Sheets + última sincronización.
 */
export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const url = await db.getSystemSetting('google_sheets_url') || '';
    let lastSync: string | null = null;
    try {
      lastSync = await db.getSystemSetting(LAST_SYNC_KEY);
    } catch {
      lastSync = null;
    }
    return NextResponse.json({ success: true, google_sheets_url: url, last_sync: lastSync });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
