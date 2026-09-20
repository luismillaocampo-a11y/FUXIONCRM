import { createClient } from '@supabase/supabase-js';

const whatsappJsonReplacer = (_k: any, value: any) => {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
    return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') };
  }
  return value;
};

const whatsappJsonReviver = (_key: any, value: any) => {
  if (typeof value === 'object' && value !== null && (value.type === 'Buffer' || value.buffer === true) && typeof value.data === 'string') {
    return Buffer.from(value.data, 'base64');
  }
  return value;
};

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = (typeof window === 'undefined' ? process.env.SUPABASE_SERVICE_KEY : null) || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window === 'undefined') {
  console.log(
    "DB Config - URL:", supabaseUrl,
    "Anon Key length:", supabaseAnonKey ? supabaseAnonKey.length : 0,
    "Anon Key ends with:", supabaseAnonKey ? supabaseAnonKey.slice(-8) : "none"
  );
}

// Local-first: SQLite by default. Supabase only when explicitly enabled or on cloud deploy.
const isCloudDeploy = Boolean(process.env.VERCEL) || Boolean(process.env.K_SERVICE) || Boolean(process.env.LAMBDA_TASK_ROOT) || process.env.PORT === '8080';
let useSupabase = isCloudDeploy || process.env.USE_SUPABASE === 'true' || Boolean(supabaseUrl && supabaseAnonKey);

/** Persistent app data directory (%APPDATA%\\NutraFlow CRM on Windows). */
export function getAppDataStorageDir(): string {
  const pathMod = require('path');
  const fs = require('fs');
  const baseDir = process.env.APPDATA || process.env.HOME || process.cwd();
  const dir = pathMod.join(baseDir, 'NutraFlow CRM');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSqliteDbPath(): string {
  const pathMod = require('path');
  if (process.env.APPDATA) {
    return pathMod.join(getAppDataStorageDir(), 'db.sqlite');
  }
  return pathMod.join(process.cwd(), 'db.sqlite');
}

let sqliteDb: any = null;
let DatabaseClass: any = null;
let sqliteDbFailed = false;
let sqliteLoadError = '';
let lastUnifyRun = 0;

// Initialize SQLite Fallback Database (nullable: devuelve null si el módulo nativo no carga)
function getSqliteDbOrNull() {
  if (sqliteDb) return sqliteDb;
  if (sqliteDbFailed) return null;

  try {
    if (!DatabaseClass) {
      const req = eval('require');
      DatabaseClass = req('better-sqlite3');
    }

    const dbPath = getSqliteDbPath();
    sqliteDb = new DatabaseClass(dbPath);
    console.log('[DB] SQLite initialized at:', dbPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    sqliteLoadError = msg;
    console.warn('[DB] Native better-sqlite3 module unavailable:', msg);
    console.warn('[DB] Solución: ejecuta "npm rebuild better-sqlite3" con el mismo Node que corre Next.js (verifica con "node --version"). Si cambiaste de versión de Node, el binario nativo debe recompilarse.');
    sqliteDbFailed = true;
    sqliteDb = null;
    return null;
  }

  try {
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('synchronous = NORMAL');
    // Hacer cumplir las FKs (los ON DELETE CASCADE/SET NULL son no-ops sin esto)
    try { sqliteDb.pragma('foreign_keys = ON'); } catch { /* ignore */ }
  } catch (pErr) {
    // Ignore pragma warning if WAL is restricted
  }

  // Initialize tables in SQLite if they don't exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE NOT NULL,
      whatsapp_lid TEXT,
      real_phone TEXT,
      last_product TEXT,
      last_order_qty INTEGER,
      last_order_total REAL,
      last_order_at TEXT,
      channel TEXT DEFAULT 'whatsapp',
      avatar_url TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      tags TEXT NOT NULL DEFAULT '[]',
      bot_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_type TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      file_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      question TEXT NOT NULL,
      context TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      answer TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id TEXT PRIMARY KEY,
      creds TEXT,
      keys TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lead_notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
  `);

  try {
    sqliteDb.exec('ALTER TABLE chat_messages ADD COLUMN is_read INTEGER DEFAULT 0;');
  } catch (e) {}

  try {
    sqliteDb.exec('ALTER TABLE leads ADD COLUMN whatsapp_lid TEXT;');
  } catch (e) {}

  try {
    sqliteDb.exec('ALTER TABLE leads ADD COLUMN real_phone TEXT;');
  } catch (e) {}

  try {
    sqliteDb.exec('ALTER TABLE leads ADD COLUMN last_product TEXT;');
  } catch (e) {}

  for (const col of [
    'ALTER TABLE leads ADD COLUMN last_order_qty INTEGER;',
    'ALTER TABLE leads ADD COLUMN last_order_total REAL;',
    'ALTER TABLE leads ADD COLUMN last_order_at TEXT;',
  ]) {
    try {
      sqliteDb.exec(col);
    } catch (e) {}
  }

  try {
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS lead_notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
  } catch (e) {}

  try {
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
  } catch (e) {}

  try {
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
  } catch (e) {}

  try {
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      targets TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
  } catch (e) {}

    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
    try {
      sqliteDb.exec("ALTER TABLE leads ADD COLUMN channel TEXT DEFAULT 'whatsapp';");
    } catch (e) {}
    try {
      sqliteDb.exec("ALTER TABLE leads ADD COLUMN avatar_url TEXT;");
    } catch (e) {}

    try {
      sqliteDb.exec('ALTER TABLE users ADD COLUMN name TEXT DEFAULT "";');
    } catch (e) {}
    try {
      sqliteDb.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT "";');
    } catch (e) {}

    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS ai_rules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      instruction TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);

    try {
      sqliteDb.exec(`CREATE TABLE IF NOT EXISTS whatsapp_status_library (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        product_name TEXT,
        category TEXT,
        tags TEXT DEFAULT '[]',
        media_url TEXT NOT NULL,
        media_type TEXT DEFAULT 'image',
        caption TEXT,
        internal_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);
    } catch (e) {}

    try {
      sqliteDb.exec(`CREATE TABLE IF NOT EXISTS whatsapp_status_schedules (
        id TEXT PRIMARY KEY,
        library_id TEXT,
        media_url TEXT NOT NULL,
        media_type TEXT DEFAULT 'image',
        caption TEXT,
        scheduled_at TEXT,
        recurrence_type TEXT DEFAULT 'none',
        recurrence_days TEXT DEFAULT '[]',
        status TEXT DEFAULT 'pending',
        published_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`);
    } catch (e) {}

    try {
      sqliteDb.exec("ALTER TABLE whatsapp_status_schedules ADD COLUMN recurrence_type TEXT DEFAULT 'none';");
    } catch (e) {}
    try {
      sqliteDb.exec("ALTER TABLE whatsapp_status_schedules ADD COLUMN recurrence_days TEXT DEFAULT '[]';");
    } catch (e) {}

    const rulesCount = sqliteDb.prepare('SELECT count(*) as count FROM ai_rules').get() as { count: number };
    if (rulesCount.count === 0) {
      const defaultRules = [
        {
          id: 'rule-1',
          title: 'Concisión Extrema (Máximo 35 palabras)',
          instruction: 'Responde en un solo párrafo corto de máximo 35 palabras, optimizado para ser leído al instante en celular.',
          category: 'Tono y Estilo'
        },
        {
          id: 'rule-2',
          title: 'Cierre con 1 Solo Producto',
          instruction: 'Jamás abrumes recomendando múltiples productos de golpe. Recomienda 1 solo producto estrella según la necesidad expresada.',
          category: 'Reglas de Venta'
        },
        {
          id: 'rule-3',
          title: 'Lenguaje Médico y Legal Seguro',
          instruction: 'Prohibido diagnosticar o decir que un producto "cura" enfermedades. Usa conectores seguros como "apoya a", "ayuda a", "contribuye a".',
          category: 'Restricciones'
        },
        {
          id: 'rule-4',
          title: 'Promoción 4x1 Únicamente a Petición',
          instruction: 'NO menciones puntos ni promociones por iniciativa propia. Solo si el cliente pregunta por ofertas, menciona que por la compra de 4 cajas regalamos 1 caja GRATIS.',
          category: 'Promociones'
        },
        {
          id: 'rule-5',
          title: 'Canales de Pago Autorizados',
          instruction: 'Los métodos de pago habilitados son Yape, Plin y Transferencia bancaria. (Modifica esta regla en Configuración para indicar tu número y titular).',
          category: 'Logística y Pagos'
        }
      ];

      const stmt = sqliteDb.prepare('INSERT INTO ai_rules (id, title, instruction, category, is_active) VALUES (?, ?, ?, ?, 1)');
      for (const r of defaultRules) {
        stmt.run(r.id, r.title, r.instruction, r.category);
      }
    }

    try {
      sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);');
      sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_lead ON chat_messages(lead_id);');
      sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);');
      sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_ai_rules_active ON ai_rules(is_active);');
    } catch (idxErr) {
      console.warn('SQLite Index Init Warning:', idxErr);
    }

    try {
      const setSettingStmt = sqliteDb.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
      setSettingStmt.run('client_company_name', '');
      setSettingStmt.run('vendor_brand_credit', 'Desarrollado por L. Milla');
      setSettingStmt.run('client_logo_url', '');
      // Desbloqueado por defecto: se sella al registrar la empresa en la pantalla de licencia
      setSettingStmt.run('company_name_locked', 'false');
    } catch (e) {}


  // Insert default flows if empty
  const flowCount = sqliteDb.prepare('SELECT count(*) as count FROM flows').get() as { count: number };
  if (flowCount.count === 0) {
    const defaultFlowId = 'default-welcome';
    const defaultNodes = JSON.stringify([
      { id: '1', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Disparador Iniciar', triggerType: 'keyword', keyword: 'hola, empezar, inicio, menú' } },
      { id: '2', type: 'message', position: { x: 250, y: 180 }, data: { label: 'Mensaje de Bienvenida', message: '¡Hola! Bienvenido a Fuxion Flow. ¿En qué te puedo ayudar hoy?' } },
      { id: '3', type: 'buttons', position: { x: 250, y: 310 }, data: { label: 'Botones Interactivos', buttons: ['Información de Productos', 'Tiempos de Envío', 'Hablar con Asesor'] } }
    ]);
    const defaultEdges = JSON.stringify([
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ]);
    sqliteDb.prepare('INSERT INTO flows (id, name, nodes, edges, is_active) VALUES (?, ?, ?, ?, 1)')
      .run(defaultFlowId, 'Flujo de Bienvenida', defaultNodes, defaultEdges);
  }

  // Contactos demo solo si se pide explícito (SEED_DEMO_DATA=true).
  // En distribución van apagados: un cliente nuevo arranca con bandeja vacía.
  const wantDemo = process.env.SEED_DEMO_DATA === 'true';
  // Insert default leads if empty
  const leadCount = sqliteDb.prepare('SELECT count(*) as count FROM leads').get() as { count: number };
  if (wantDemo && leadCount.count === 0) {
    sqliteDb.prepare(`
      INSERT INTO leads (id, name, phone, status, tags, bot_active)
      VALUES 
      ('lead-1', 'Juan Perez', '+51987654321', 'New', '["interested"]', 1),
      ('lead-2', 'Maria Gomez', '+51912345678', 'Engaged', '["hot-lead"]', 1),
      ('lead-3', 'Carlos Silva', '+51933445566', 'Pending Verification', '["ready-to-buy"]', 1)
    `).run();

    sqliteDb.prepare(`
      INSERT INTO chat_messages (id, lead_id, sender, message)
      VALUES
      ('m-1', 'lead-1', 'customer', 'Hola, me gustaría saber más sobre sus productos'),
      ('m-2', 'lead-1', 'bot', '¡Hola! Bienvenido a Fuxion Flow. ¿En qué te puedo ayudar hoy?'),
      ('m-3', 'lead-2', 'customer', '¿Hacen envíos a Lima?'),
      ('m-4', 'lead-2', 'bot', '¡Sí! Enviamos a todo el país en un plazo de 24 a 48 horas.'),
      ('m-5', 'lead-3', 'customer', 'Quiero confirmar mi pedido ahora mismo.')
    `).run();
  }

  // Insert sample knowledge base if empty
  const kbCount = sqliteDb.prepare('SELECT count(*) as count FROM knowledge_base').get() as { count: number };
  if (kbCount.count === 0) {
    sqliteDb.prepare(`
      INSERT INTO knowledge_base (id, title, file_type, content, summary)
      VALUES 
      ('kb-1', 'Preguntas Frecuentes de Productos', 'txt', 
       'Nuestro producto estrella es NutraSlim - suplemento orgánico para perder peso. Instrucciones de uso: 2 cápsulas diarias antes del desayuno. Precio: $49.99. Ingredientes: Extracto de té verde, Garcinia cambogia. Efectos secundarios: Ninguno reportado.', 
       'Preguntas frecuentes del catálogo de productos, incluye el precio ($49.99) e instrucciones de NutraSlim.'),
      ('kb-2', 'Guía de Políticas de Envío', 'txt',
       'Realizamos envíos a todo el Perú. Envío estándar: de 24 a 48 horas. Envío express: el mismo día en Lima. Opciones de pago: Pago contra entrega (efectivo), Transferencia bancaria (BCP, Interbank), Yape, Plin.',
       'Políticas de envío que detallan la entrega en 24-48 horas y las opciones de pago disponibles (Yape, Plin, Pago contra entrega).')
    `).run();
  }

  return sqliteDb;
}

// Supabase Client instance (initialize conditionally to prevent build-time crashes when variables are not configured yet)
export let supabase: any = (useSupabase && supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept-Charset': 'utf-8'
        }
      }
    }) 
  : null;

// Helper to run Supabase queries safely
async function runSupabaseQuery(action: (c: any) => Promise<any>) {
  if (!useSupabase || !supabase) return null;
  try {
    const res = await action(supabase);
    if (res && res.error) {
      console.warn('[Supabase Error]:', res.error?.message || res.error);
      if (!isCloudDeploy) {
        const msg = res.error?.message || String(res.error);
        if (msg.toLowerCase().includes('invalid api key') || res.status === 401) {
          console.warn('Supabase auth failure detected, switching to SQLite fallback:', msg);
          (global as any).USE_SUPABASE = false;
          useSupabase = false;
          supabase = null;
          return null;
        }
      }
    }
    return res;
  } catch (e: any) {
    console.warn('[Supabase Exception]:', e?.message || e);
    return null;
  }
}

// Helper to get client or throw descriptive error
function getSupabase() {
  if (!supabase) {
    throw new Error("Las variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY) no están configuradas en Vercel. Por favor, añádelas en la configuración del proyecto y vuelve a desplegar.");
  }
  return supabase;
}

function parseJsonField(field: any) {
  if (field == null) return null;
  if (typeof field === 'string') {
    return JSON.parse(field, whatsappJsonReviver);
  }
  if (typeof field === 'object') {
    return JSON.parse(JSON.stringify(field), whatsappJsonReviver);
  }
  return field;
}

function parseWhatsappSessionRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    creds: parseJsonField(row.creds),
    keys: parseJsonField(row.keys) || {},
    updated_at: row.updated_at
  };
}

function cleanLeadTags(lead: any): any {
  if (!lead) return lead;
  let rawTags = lead.tags;
  if (typeof rawTags === 'string') {
    try {
      rawTags = JSON.parse(rawTags);
    } catch (e) {
      rawTags = [];
    }
  }
  if (Array.isArray(rawTags)) {
    lead.tags = rawTags.filter((t: string) => !t.startsWith('flowState:'));
  } else {
    lead.tags = [];
  }
  return lead;
}

async function getWhatsappSession(sessionId: string = 'default') {
  if (useSupabase) {
    const res = await runSupabaseQuery((c) => c.from('whatsapp_sessions').select('*').eq('id', sessionId).maybeSingle());
    if (res && !res.error && res.data) {
      return parseWhatsappSessionRow(res.data);
    }
    if (isCloudDeploy) {
      return null;
    }
  }
  const db = getSqliteDbOrNull();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM whatsapp_sessions WHERE id = ?').get(sessionId);
  return parseWhatsappSessionRow(row);
}

async function saveWhatsappSession(sessionId: string = 'default', creds?: any, keys?: any) {
  let existing: any = null;
  if (creds === undefined || keys === undefined) {
    existing = await getWhatsappSession(sessionId);
  }
  const data = {
    id: sessionId,
    creds: creds !== undefined ? creds : existing?.creds || null,
    keys: keys !== undefined ? keys : existing?.keys || {}
  };

  const sqlitePayload = {
    id: data.id,
    creds: data.creds !== null ? JSON.stringify(data.creds, whatsappJsonReplacer) : null,
    keys: data.keys ? JSON.stringify(data.keys, whatsappJsonReplacer) : JSON.stringify({})
  };

  if (useSupabase) {
    const res = await runSupabaseQuery((c) => c.from('whatsapp_sessions').upsert({
      id: data.id,
      creds: data.creds !== null ? JSON.parse(JSON.stringify(data.creds, whatsappJsonReplacer)) : null,
      keys: data.keys ? JSON.parse(JSON.stringify(data.keys, whatsappJsonReplacer)) : {} ,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' }).select().single());
    if (res && !res.error && res.data) {
      return parseWhatsappSessionRow(res.data);
    }
    if (isCloudDeploy) {
      return { id: sessionId, creds: data.creds, keys: data.keys, updated_at: new Date().toISOString() };
    }
  }

  const db = getSqliteDbOrNull();
  if (db) {
    if (existing) {
      db.prepare('UPDATE whatsapp_sessions SET creds = ?, keys = ?, updated_at = ? WHERE id = ?')
        .run(sqlitePayload.creds, sqlitePayload.keys, new Date().toISOString(), sessionId);
    } else {
      db.prepare('INSERT INTO whatsapp_sessions (id, creds, keys, updated_at) VALUES (?, ?, ?, ?)')
        .run(sessionId, sqlitePayload.creds, sqlitePayload.keys, new Date().toISOString());
    }
  }
  return getWhatsappSession(sessionId);
}

async function clearWhatsappSession(sessionId: string = 'default') {
  if (useSupabase) {
    await runSupabaseQuery((c) => c.from('whatsapp_sessions').delete().eq('id', sessionId));
  }
  const db = getSqliteDbOrNull();
  if (db) {
    db.prepare('DELETE FROM whatsapp_sessions WHERE id = ?').run(sessionId);
  }
}

// Helper to extract core words from a question to check for similarity
function getCoreWords(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡]/g, "") // remove punctuation
    .split(/\s+/);
  
  const stopWords = new Set([
    'hola', 'quiero', 'como', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'que', 'en', 'y', 'a', 'me', 'te', 'le', 'nos', 'os', 'se',
    'por', 'para', 'con', 'sin', 'sobre', 'mi', 'su', 'sus', 'tu', 'tus', 'al', 'lo',
    'o', 'u', 'es', 'son', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
    'aqui', 'alla', 'alli', 'buenos', 'dias', 'tardes', 'noches', 'favor', 'porfavor',
    'mas', 'menos', 'cual', 'cuales', 'quien', 'quienes', 'donde', 'cuando', 'porque',
    'saber', 'gustaria', 'info', 'informacion', 'precio', 'precios', 'costo', 'costos',
    'venden', 'vende', 'tiene', 'tienen', 'hay', 'quisiera', 'necesito', 'comprar', 'adquirir'
  ]);

  return normalized.filter(w => w && !stopWords.has(w));
}

// Genera todas las variantes posibles de formato telefónico (9 dígitos, 11 dígitos con 51, signo +)
function getPhoneVariants(input: string): string[] {
  if (!input || typeof input !== 'string') return [];
  const variants = new Set<string>();
  variants.add(input);
  
  const clean = input.replace(/\D/g, '');
  if (clean) {
    variants.add(clean);
    let nineDigits = clean;
    if (clean.startsWith('51') && clean.length >= 11) {
      nineDigits = clean.substring(2);
    }
    if (nineDigits.length === 9) {
      variants.add(nineDigits);
      variants.add('51' + nineDigits);
      variants.add('+51' + nineDigits);
      variants.add('+51 ' + nineDigits);
    }
  }
  return Array.from(variants);
}

// Determines if two questions are similar enough to be considered duplicates
function areQuestionsSimilar(q1: string, q2: string): boolean {
  const core1 = getCoreWords(q1);
  const core2 = getCoreWords(q2);

  // If we have core words, check for overlap
  if (core1.length > 0 && core2.length > 0) {
    const set1 = new Set(core1);
    const set2 = new Set(core2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    if (intersection.size > 0) {
      return true;
    }
  }

  // Fallback to normalized exact match or inclusion
  const norm1 = q1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡\s]/g, "");
  const norm2 = q2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿¡\s]/g, "");
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
}

const dummyDb: any = {
  prepare: () => ({
    run: () => ({ changes: 0, lastInsertRowid: 0 }),
    get: () => null,
    all: () => [],
  }),
  transaction: (fn: any) => fn,
  pragma: () => null,
  exec: () => null,
};

/** Lanza un error legible si SQLite no está disponible (en vez del críptico "Cannot read properties of null"). */
function requireSqliteDb(context: string) {
  const sDb = getSqliteDbOrNull();
  if (!sDb) {
    if (useSupabase || isCloudDeploy) {
      console.warn(`[DB] SQLite no disponible en ${context}, utilizando fallback seguro para Cloud/Supabase.`);
      return dummyDb;
    }
    throw new Error(
      `Base de datos local no disponible en ${context}. ` +
        (sqliteLoadError ? `Detalle: ${sqliteLoadError}. ` : '') +
        'Solución: ejecuta "npm rebuild better-sqlite3" y reinicia la app.'
    );
  }
  return sDb;
}

/** Acceso estricto a SQLite para los ~40 call sites que no verifican null. */
function getSqliteDb() {
  return requireSqliteDb('db');
}

/** Parseo JSON genérico seguro con fallback (flows corruptos no tumban el endpoint). */
function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return (raw as T) ?? fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Parseo seguro de tags: una fila corrupta no debe tumbar todo el endpoint. */
function safeParseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t) => typeof t === 'string');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Estados válidos del pipeline. Todo estado fuera de esta lista se rechaza/normaliza. */
export const LEAD_STATUSES = [
  'New',
  'Engaged',
  'Pending Verification',
  'Por Registrar en Web',
  'Converted',
  'Archived',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isValidLeadStatus(status: unknown): status is LeadStatus {
  return typeof status === 'string' && (LEAD_STATUSES as readonly string[]).includes(status);
}

/** Diagnóstico del estado de la BD para la UI y logs. */
export function getDatabaseStatus(): { sqliteOk: boolean; sqliteError: string; useSupabase: boolean } {
  return { sqliteOk: !sqliteDbFailed, sqliteError: sqliteLoadError, useSupabase };
}

/**
 * Respaldo en caliente de SQLite (online backup, seguro con WAL y escritura
 * concurrente). Guarda en %APPDATA%/NutraFlow CRM/backups/db-YYYYMMDD-HHmm.sqlite
 * y conserva las últimas `keep` copias. Devuelve la ruta o null si no hay SQLite local.
 */
export async function backupSqliteDb(keep = 7): Promise<string | null> {
  const src = getSqliteDbOrNull();
  if (!src) {
    console.warn('[DB] Backup omitido: SQLite no disponible.');
    return null;
  }
  const pathMod = require('path');
  const fs = require('fs');
  const dir = pathMod.join(getAppDataStorageDir(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const dest = pathMod.join(dir, `db-${stamp}.sqlite`);
  await src.backup(dest);
  // Rotación: conservar las últimas `keep`
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f: string) => /^db-\d+\.sqlite$/.test(f))
      .sort();
    while (files.length > keep) {
      const old = files.shift()!;
      try {
        fs.unlinkSync(pathMod.join(dir, old));
      } catch {}
    }
  } catch {}
  console.log('[DB] ✅ Respaldo creado:', dest);
  return dest;
}

// Unified database operations API
export const db = {
  // --- LEADS ---
  async getLeads(): Promise<any[]> {
    let leads: any[] = [];
    let unreadCounts: { [key: string]: number } = {};
    let lastActivityMap: { [key: string]: string } = {};
    // Solo caer a SQLite si Supabase no se intentó o falló. Un 0 legítimo en nube
    // no debe mezclarse con datos locales viejos.
    let supabaseOk = false;

    if (useSupabase) {
      const res = await runSupabaseQuery((c) => 
        c.from('leads')
         .select('*')
      );
      if (res && !res.error) {
        supabaseOk = true;
        leads = res.data || [];
        
        const { data: messagesData } = await getSupabase()
          .from('chat_messages')
          .select('lead_id, sender, is_read, created_at');
        
        if (messagesData) {
          for (const msg of messagesData) {
            if (msg.sender === 'customer' && !msg.is_read) {
              unreadCounts[msg.lead_id] = (unreadCounts[msg.lead_id] || 0) + 1;
            }
            if (msg.created_at) {
              const prevMax = lastActivityMap[msg.lead_id];
              if (!prevMax || new Date(msg.created_at).getTime() > new Date(prevMax).getTime()) {
                lastActivityMap[msg.lead_id] = msg.created_at;
              }
            }
          }
        }
      }
    }
    
    if (!supabaseOk && leads.length === 0) {
      const sDb = getSqliteDbOrNull();
      if (sDb) {
        leads = sDb.prepare("SELECT * FROM leads").all();
        const unreadData = sDb.prepare("SELECT lead_id FROM chat_messages WHERE sender = 'customer' AND is_read = 0").all() as any[];
        for (const msg of unreadData) {
          unreadCounts[msg.lead_id] = (unreadCounts[msg.lead_id] || 0) + 1;
        }
        const recentMsgs = sDb.prepare("SELECT lead_id, created_at FROM chat_messages").all() as any[];
        for (const msg of recentMsgs) {
          if (msg.created_at) {
            const prevMax = lastActivityMap[msg.lead_id];
            if (!prevMax || new Date(msg.created_at).getTime() > new Date(prevMax).getTime()) {
              lastActivityMap[msg.lead_id] = msg.created_at;
            }
          }
        }
      }
    }

    const processedLeads = leads.map((l: any) => {
      const rawTags = safeParseTags(l.tags);
      const associatedIds = [l.id, l.phone, l.whatsapp_lid].filter(Boolean);
      
      let maxActivity = l.updated_at || l.created_at || new Date(0).toISOString();
      for (const id of associatedIds) {
        const msgActivity = lastActivityMap[id];
        if (msgActivity && new Date(msgActivity).getTime() > new Date(maxActivity).getTime()) {
          maxActivity = msgActivity;
        }
      }
      
      let unreadCount = 0;
      for (const id of associatedIds) {
        if (unreadCounts[id]) unreadCount += unreadCounts[id];
      }

      return cleanLeadTags({
        ...l,
        tags: rawTags,
        bot_active: Boolean(l.bot_active),
        unread_count: unreadCount,
        last_activity: maxActivity
      });
    });

    // Ordenar de forma absoluta por la fecha del mensaje o actividad más reciente (PRIMERO EL MÁS RECIENTE)
    return processedLeads.sort((a, b) => {
      const timeA = new Date(a.last_activity || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_activity || b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  },

  async getLeadById(id: string): Promise<any> {
    const realId = await this.normalizeLeadId(id);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').select('*').eq('id', realId).maybeSingle());
      if (res && !res.error) {
        return res.data ? cleanLeadTags(res.data) : null;
      }
      if (isCloudDeploy) {
        return null;
      }
    }
    const db = getSqliteDbOrNull();
    if (!db) return null;
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(realId) as any;
    if (!lead) return null;
    return cleanLeadTags({
      ...lead,
      tags: safeParseTags(lead.tags),
      bot_active: Boolean(lead.bot_active)
    });
  },

  async getLeadIdByWhatsappLid(lid: string): Promise<string | null> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => 
        c.from('leads')
         .select('id')
         .eq('whatsapp_lid', lid)
         .maybeSingle()
      );
      if (res && !res.error && res.data) return res.data.id;
    }
    const db = getSqliteDbOrNull();
    if (!db) return null;
    const row = db.prepare('SELECT id FROM leads WHERE whatsapp_lid = ?').get(lid) as any;
    return row ? row.id : null;
  },

  async upsertLead(lead: { id: string; name: string; phone: string; whatsapp_lid?: string | null; real_phone?: string | null; last_product?: string | null; last_order_qty?: number | null; last_order_total?: number | null; last_order_at?: string | null; status?: string; tags?: string[]; bot_active?: boolean; channel?: string | null }): Promise<any> {
    // Normalizar ID del lead de entrada para evitar duplicidad de registros LID/Teléfono
    const normalizedId = await this.normalizeLeadId(lead.id);
    lead.id = normalizedId;

    const existing = await this.getLeadById(lead.id);
    
    // Merge existing values to prevent losing them on simple upserts
    const whatsappLid = lead.whatsapp_lid || existing?.whatsapp_lid || null;
    const realPhone = lead.real_phone || existing?.real_phone || null;
    const lastProduct = lead.last_product || existing?.last_product || null;
    const lastOrderQty = lead.last_order_qty ?? existing?.last_order_qty ?? null;
    const lastOrderTotal = lead.last_order_total ?? existing?.last_order_total ?? null;
    const lastOrderAt = lead.last_order_at || existing?.last_order_at || null;
    // Solo persisten estados válidos; un typo no debe contaminar el pipeline
    const status = isValidLeadStatus(lead.status)
      ? lead.status
      : isValidLeadStatus(existing?.status)
        ? existing.status
        : 'New';
    const tags = lead.tags || safeParseTags(existing?.tags);
    const botActive = lead.bot_active !== undefined ? lead.bot_active : (existing?.bot_active !== undefined ? existing.bot_active : true);
    const channel = typeof lead.channel === 'string' && lead.channel
      ? lead.channel
      : (typeof existing?.channel === 'string' && existing.channel ? existing.channel : 'whatsapp');

    const tagsStr = JSON.stringify(tags);
    const botActiveVal = botActive ? 1 : 0;

    let result;
    if (useSupabase) {
      const supabasePayload: any = {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        status,
        tags,
        bot_active: botActive,
        updated_at: new Date().toISOString()
      };
      if (whatsappLid) {
        supabasePayload.whatsapp_lid = whatsappLid;
      }
      const res = await runSupabaseQuery((c) => c.from('leads').upsert(supabasePayload, { onConflict: 'id' }).select().single());
      if (res && !res.error && res.data) {
        result = cleanLeadTags(res.data);
      }
    }
    if (!result) {
      const db = getSqliteDbOrNull();
      if (db) {
        db.prepare(`
          INSERT INTO leads (id, name, phone, whatsapp_lid, real_phone, last_product, last_order_qty, last_order_total, last_order_at, status, tags, bot_active, channel)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            whatsapp_lid = excluded.whatsapp_lid,
            real_phone = excluded.real_phone,
            last_product = excluded.last_product,
            last_order_qty = excluded.last_order_qty,
            last_order_total = excluded.last_order_total,
            last_order_at = excluded.last_order_at,
            status = excluded.status,
            tags = excluded.tags,
            bot_active = excluded.bot_active,
            channel = excluded.channel,
            updated_at = CURRENT_TIMESTAMP
        `).run(lead.id, lead.name, lead.phone, whatsappLid, realPhone, lastProduct, lastOrderQty, lastOrderTotal, lastOrderAt, status, tagsStr, botActiveVal, channel);
        result = await this.getLeadById(lead.id);
      } else {
        result = {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          whatsapp_lid: whatsappLid,
          real_phone: realPhone,
          status,
          tags,
          bot_active: botActive,
          updated_at: new Date().toISOString()
        };
      }
    }

    // Ejecutar unificación en segundo plano para limpiar cualquier duplicado preexistente
    this.unifyDuplicateLeads().catch(err => console.error('Error al unificar leads en segundo plano:', err));

    return result;
  },

  async updateLeadStatus(id: string, status: string): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (useSupabase) {
      const query = getSupabase().from('leads').update({ status, updated_at: new Date().toISOString() });
      const { error } = isUuid ? query.eq('id', id) : query.eq('phone', id);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      const dbId = isUuid ? id : await this.normalizeLeadId(id);
      db.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, dbId);
    }
  },

  async updateLeadTags(id: string, tags: string[]): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const existing = await this.getLeadById(id);
    let finalTags = [...tags];
    if (existing) {
      let dbTags: string[] = [];
      if (useSupabase) {
        const res = await runSupabaseQuery((c) => c.from('leads').select('tags').eq('id', existing.id).maybeSingle());
        if (res && !res.error && res.data) {
          dbTags = res.data.tags || [];
        }
      } else {
        const db = getSqliteDbOrNull();
        if (db) {
          const row = db.prepare('SELECT tags FROM leads WHERE id = ?').get(existing.id) as any;
          if (row?.tags) {
            try {
              dbTags = JSON.parse(row.tags);
            } catch(e){}
          }
        }
      }
      const flowStateTags = dbTags.filter((t: string) => t.startsWith('flowState:'));
      finalTags = [...finalTags, ...flowStateTags];
    }
    const tagsStr = JSON.stringify(finalTags);
    if (useSupabase) {
      const query = getSupabase().from('leads').update({ tags: finalTags, updated_at: new Date().toISOString() });
      const { error } = isUuid ? query.eq('id', id) : query.eq('phone', id);
      if (error) throw error;
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        const dbId = isUuid ? id : await this.normalizeLeadId(id);
        db.prepare('UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(tagsStr, dbId);
      }
    }
  },

  async updateLeadBotActive(id: string, botActive: boolean): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const activeVal = botActive ? 1 : 0;
    if (useSupabase) {
      const query = getSupabase().from('leads').update({ bot_active: botActive, updated_at: new Date().toISOString() });
      const { error } = isUuid ? query.eq('id', id) : query.eq('phone', id);
      if (error) throw error;
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        const dbId = isUuid ? id : await this.normalizeLeadId(id);
        db.prepare('UPDATE leads SET bot_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(activeVal, dbId);
      }
    }
  },

  async setLeadLastProduct(id: string, product: string): Promise<void> {
    const clean = (product || '').trim().slice(0, 120);
    if (!clean) return;
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('leads').update({ last_product: clean }).eq('id', id));
    } else {
      const db = getSqliteDbOrNull();
      if (db) db.prepare('UPDATE leads SET last_product = ? WHERE id = ?').run(clean, id);
    }
  },

  /** Guarda la foto del último pedido (Fase 2). No toca updated_at. */
  async setLeadLastOrder(id: string, qty: number, total: number): Promise<void> {
    const q = Math.floor(Number(qty));
    const t = Math.round(Number(total) * 100) / 100;
    if (!Number.isFinite(q) || q < 1 || q > 999 || !Number.isFinite(t) || t < 0) return;
    const nowIso = new Date().toISOString();
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('leads').update({ last_order_qty: q, last_order_total: t, last_order_at: nowIso }).eq('id', id));
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        db.prepare('UPDATE leads SET last_order_qty = ?, last_order_total = ?, last_order_at = ? WHERE id = ?').run(
          q,
          t,
          nowIso,
          id
        );
      }
    }
  },

  async getLeadFlowState(leadId: string): Promise<string | null> {
    const realId = await this.normalizeLeadId(leadId);
    let dbTags: string[] = [];
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').select('tags').eq('id', realId).maybeSingle());
      if (res && !res.error && res.data) {
        dbTags = res.data.tags || [];
      }
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        const row = db.prepare('SELECT tags FROM leads WHERE id = ?').get(realId) as any;
        if (row?.tags) {
          try {
            dbTags = JSON.parse(row.tags);
          } catch(e){}
        }
      }
    }
    const flowTag = dbTags.find((t: string) => t.startsWith('flowState:'));
    return flowTag ? flowTag.substring('flowState:'.length) : null;
  },

  async setLeadFlowState(leadId: string, nodeId: string | null): Promise<void> {
    const realId = await this.normalizeLeadId(leadId);
    let dbTags: string[] = [];
    let isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realId);
    
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').select('tags').eq('id', realId).maybeSingle());
      if (res && !res.error && res.data) {
        dbTags = res.data.tags || [];
      }
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        const row = db.prepare('SELECT tags FROM leads WHERE id = ?').get(realId) as any;
        if (row?.tags) {
          try {
            dbTags = JSON.parse(row.tags);
          } catch(e){}
        }
      }
    }
    
    let finalTags = dbTags.filter((t: string) => !t.startsWith('flowState:'));
    if (nodeId) {
      finalTags.push(`flowState:${nodeId}`);
    }
    
    const tagsStr = JSON.stringify(finalTags);
    if (useSupabase) {
      const query = getSupabase().from('leads').update({ tags: finalTags, updated_at: new Date().toISOString() });
      const { error } = isUuid ? query.eq('id', realId) : query.eq('phone', realId);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      const dbId = isUuid ? realId : await this.normalizeLeadId(realId);
      db.prepare('UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(tagsStr, dbId);
    }
  },

  async getAllFlowStates(): Promise<{ [leadId: string]: string }> {
    let leads: any[] = [];
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').select('id, tags'));
      if (res && !res.error) {
        leads = res.data || [];
      }
    } else {
      const db = getSqliteDb();
      try {
        leads = db.prepare('SELECT id, tags FROM leads').all() as any[];
      } catch (e) {
        leads = [];
      }
    }
    
    const states: { [leadId: string]: string } = {};
    for (const lead of leads) {
      let tags: string[] = [];
      if (typeof lead.tags === 'string') {
        try {
          tags = JSON.parse(lead.tags);
        } catch(e){}
      } else if (Array.isArray(lead.tags)) {
        tags = lead.tags;
      }
      
      const flowTag = tags.find((t: string) => t.startsWith('flowState:'));
      if (flowTag) {
        states[lead.id] = flowTag.substring('flowState:'.length);
      }
    }
    return states;
  },

  // --- FLOWS ---
  async getFlows(): Promise<any[]> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('flows').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const db = getSqliteDb();
      return db.prepare('SELECT * FROM flows ORDER BY updated_at DESC').all().map((f: any) => ({
        ...f,
        nodes: safeParseJson(f.nodes, []),
        edges: safeParseJson(f.edges, []),
        is_active: Boolean(f.is_active)
      }));
    }
  },

  async getFlowById(id: string): Promise<any> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('flows').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    } else {
      const db = getSqliteDb();
      const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(id) as any;
      if (!flow) return null;
      return {
        ...flow,
        nodes: safeParseJson(flow.nodes, []),
        edges: safeParseJson(flow.edges, []),
        is_active: Boolean(flow.is_active)
      };
    }
  },

  async saveFlow(id: string, name: string, nodes: any[], edges: any[]): Promise<any> {
    const nodesStr = JSON.stringify(nodes);
    const edgesStr = JSON.stringify(edges);

    if (useSupabase) {
      const { data, error } = await getSupabase().from('flows').upsert({
        id,
        name,
        nodes,
        edges,
        updated_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = getSqliteDb();
      db.prepare(`
        INSERT INTO flows (id, name, nodes, edges, is_active)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          nodes = excluded.nodes,
          edges = excluded.edges,
          updated_at = CURRENT_TIMESTAMP
      `).run(id, name, nodesStr, edgesStr);
      return this.getFlowById(id);
    }
  },

  async setActiveFlow(id: string): Promise<void> {
    if (useSupabase) {
      // Deactivate all flows
      await getSupabase().from('flows').update({ is_active: false });
      // Activate selected flow
      const { error } = await getSupabase().from('flows').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      const exists = db.prepare('SELECT 1 FROM flows WHERE id = ?').get(id);
      if (!exists) {
        throw new Error(`Flow no encontrado: ${id}`);
      }
      const activate = db.transaction(() => {
        db.prepare('UPDATE flows SET is_active = 0').run();
        db.prepare('UPDATE flows SET is_active = 1 WHERE id = ?').run(id);
      });
      activate();
    }
  },
  
  async deactivateFlow(id: string): Promise<void> {
    if (useSupabase) {
      const { error } = await getSupabase().from('flows').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      db.prepare('UPDATE flows SET is_active = 0 WHERE id = ?').run(id);
    }
  },

  async getActiveFlow(): Promise<any> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('flows').select('*').eq('is_active', true).maybeSingle();
      if (error) return null;
      return data;
    } else {
      const db = getSqliteDb();
      const flow = db.prepare('SELECT * FROM flows WHERE is_active = 1').get() as any;
      if (!flow) return null;
      return {
        ...flow,
        nodes: safeParseJson(flow.nodes, []),
        edges: safeParseJson(flow.edges, []),
        is_active: Boolean(flow.is_active)
      };
    }
  },

  // --- KNOWLEDGE BASE ---
  async getKBItems(): Promise<any[]> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('knowledge_base').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const db = getSqliteDb();
      return db.prepare('SELECT * FROM knowledge_base ORDER BY created_at DESC').all();
    }
  },

  async addKBItem(id: string, title: string, fileType: string, content: string, summary: string, filePath: string): Promise<any> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('knowledge_base').insert({
        id,
        title,
        file_type: fileType,
        content,
        summary,
        file_path: filePath
      }).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = getSqliteDb();
      db.prepare(`
        INSERT INTO knowledge_base (id, title, file_type, content, summary, file_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, title, fileType, content, summary, filePath);
      return db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id);
    }
  },

  async deleteKBItem(id: string): Promise<void> {
    if (useSupabase) {
      const { error } = await getSupabase().from('knowledge_base').delete().eq('id', id);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
    }
  },

  /**
   * Vacía la base de conocimiento (solo filas; los archivos físicos se conservan
   * para que Deshacer restaure perfecto). Devuelve cuántas filas borró.
   */
  async deleteAllKBItems(): Promise<number> {
    if (useSupabase) {
      const { error, count } = await getSupabase().from('knowledge_base').delete().neq('id', '__none__');
      if (error) throw error;
      return count || 0;
    } else {
      const db = getSqliteDb();
      const r = db.prepare('DELETE FROM knowledge_base').run();
      return Number(r.changes || 0);
    }
  },

  /**
   * Restaura filas previamente respaldadas (Deshacer del vaciado). Sin límite
   * práctico salvo topes del endpoint. Inserta u omite por id existente.
   */
  async restoreKBItems(items: Array<{ id: string; title: string; file_type?: string; content?: string; summary?: string; file_path?: string }>): Promise<number> {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let restored = 0;
    if (useSupabase) {
      for (const it of items.slice(0, 200)) {
        if (!it || typeof it.id !== 'string') continue;
        const { error } = await getSupabase().from('knowledge_base').upsert({
          id: it.id.slice(0, 128),
          title: String(it.title || 'Sin título').slice(0, 200),
          file_type: String(it.file_type || 'txt').slice(0, 20),
          content: String(it.content || '').slice(0, 200000),
          summary: String(it.summary || '').slice(0, 5000),
          file_path: typeof it.file_path === 'string' ? it.file_path.slice(0, 2048) : null,
        }, { onConflict: 'id' });
        if (!error) restored++;
      }
      return restored;
    } else {
      const db = getSqliteDb();
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO knowledge_base (id, title, file_type, content, summary, file_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction((list: typeof items) => {
        for (const it of list.slice(0, 200)) {
          if (!it || typeof it.id !== 'string') continue;
          stmt.run(
            it.id.slice(0, 128),
            String(it.title || 'Sin título').slice(0, 200),
            String(it.file_type || 'txt').slice(0, 20),
            String(it.content || '').slice(0, 200000),
            String(it.summary || '').slice(0, 5000),
            typeof it.file_path === 'string' ? it.file_path.slice(0, 2048) : null
          );
          restored++;
        }
      });
      tx(items);
      return restored;
    }
  },

  // --- KNOWLEDGE GAPS ---
  async getGaps(): Promise<any[]> {
    if (useSupabase) {
      const { data, error } = await getSupabase().from('knowledge_gaps').select('*, leads(name, phone)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      const db = getSqliteDb();
      // Emulate join for SQLite
      const gaps = db.prepare('SELECT * FROM knowledge_gaps ORDER BY created_at DESC').all();
      return gaps.map((gap: any) => {
        const lead = gap.lead_id ? db.prepare('SELECT name, phone FROM leads WHERE id = ?').get(gap.lead_id) : null;
        return {
          ...gap,
          leads: lead || null
        };
      });
    }
  },

  async addGap(id: string, leadId: string | null, question: string, context: string): Promise<any> {
    const realLeadId = leadId ? await this.normalizeLeadId(leadId) : null;

    // Evitar duplicados: obtener todas las dudas existentes
    try {
      const existingGaps = await this.getGaps();
      const pendingGaps = existingGaps.filter((g: any) => g.status === 'pending');
      const duplicate = pendingGaps.find((g: any) => areQuestionsSimilar(g.question, question));
      if (duplicate) {
        console.log(`[db.addGap] Ya existe una duda pendiente similar (ID: ${duplicate.id}). Omitiendo creación para: "${question}"`);
        return duplicate;
      }
    } catch (err) {
      console.error('Error al verificar duplicados de dudas en addGap:', err);
    }

    if (useSupabase) {
      const { data, error } = await getSupabase().from('knowledge_gaps').insert({
        id,
        lead_id: realLeadId,
        question,
        context,
        status: 'pending'
      }).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = getSqliteDb();
      db.prepare(`
        INSERT INTO knowledge_gaps (id, lead_id, question, context, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(id, realLeadId, question, context);
      return db.prepare('SELECT * FROM knowledge_gaps WHERE id = ?').get(id);
    }
  },

  async resolveGap(id: string, answer: string): Promise<void> {
    const kbId = `kb-gap-${id}`;
    const resolvedAt = new Date().toISOString();

    if (useSupabase) {
      // 1. Get the gap detail
      const { data: gap, error: getErr } = await getSupabase().from('knowledge_gaps').select('*').eq('id', id).single();
      if (getErr || !gap) throw new Error('Gap not found');

      // 2. Update gap to resolved
      const { error: updErr } = await getSupabase().from('knowledge_gaps').update({
        status: 'resolved',
        answer,
        resolved_at: resolvedAt
      }).eq('id', id);
      if (updErr) throw updErr;

      // 3. Add solved question-answer pair to knowledge base
      await getSupabase().from('knowledge_base').insert({
        id: kbId,
        title: `Resolved Gap: ${gap.question.slice(0, 40)}...`,
        file_type: 'txt',
        content: `Question: ${gap.question}\nAnswer: ${answer}`,
        summary: `Learned answer for: "${gap.question}"`
      });

      // 4. Reactivate bot for associated lead
      if (gap.lead_id) {
        await getSupabase().from('leads').update({ bot_active: true }).eq('id', gap.lead_id);
      }
    } else {
      const db = getSqliteDb();
      const gap = db.prepare('SELECT * FROM knowledge_gaps WHERE id = ?').get(id) as any;
      if (!gap) throw new Error('Gap not found');

      // Update gap to resolved
      db.prepare("UPDATE knowledge_gaps SET status = 'resolved', answer = ?, resolved_at = ? WHERE id = ?")
        .run(answer, resolvedAt, id);

      // Add to KB
      db.prepare(`
        INSERT INTO knowledge_base (id, title, file_type, content, summary)
        VALUES (?, ?, 'txt', ?, ?)
      `).run(
        kbId,
        `Resolved Gap: ${gap.question.slice(0, 40)}...`,
        `Question: ${gap.question}\nAnswer: ${answer}`,
        `Learned answer for: "${gap.question}"`
      );

      // Reactivate lead bot
      if (gap.lead_id) {
        db.prepare('UPDATE leads SET bot_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gap.lead_id);
      }
    }
  },

  async deleteGap(id: string): Promise<void> {
    if (useSupabase) {
      // 1. Obtener la duda para encontrar el lead_id y poder reactivar el bot
      const { data: gap } = await getSupabase().from('knowledge_gaps').select('lead_id').eq('id', id).maybeSingle();
      
      // 2. Eliminar la duda
      const { error } = await getSupabase().from('knowledge_gaps').delete().eq('id', id);
      if (error) throw error;

      // 3. Reactivar bot para el cliente asociado
      if (gap && gap.lead_id) {
        await getSupabase().from('leads').update({ bot_active: true }).eq('id', gap.lead_id);
      }
    } else {
      const db = getSqliteDb();
      const gap = db.prepare('SELECT lead_id FROM knowledge_gaps WHERE id = ?').get(id) as any;
      
      db.prepare('DELETE FROM knowledge_gaps WHERE id = ?').run(id);

      if (gap && gap.lead_id) {
        db.prepare('UPDATE leads SET bot_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(gap.lead_id);
      }
    }
  },

  // --- CHAT MESSAGES & IDENTITY NORMALIZATION ---
  async normalizeJid(jid: string): Promise<string> {
    if (!jid || typeof jid !== 'string') return jid;
    if (jid.endsWith('@lid')) {
      const lid = jid.split('@')[0];
      const mappedLeadId = await this.getLeadIdByWhatsappLid(lid);
      if (mappedLeadId) {
        console.log(`[db.normalizeJid] Resolviendo LID JID ${jid} a JID real: ${mappedLeadId}@s.whatsapp.net`);
        return `${mappedLeadId}@s.whatsapp.net`;
      }
    }
    return jid;
  },

  async normalizeLeadId(leadId: string): Promise<string> {
    if (!leadId || typeof leadId !== 'string') return leadId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
    if (isUuid) return leadId;

    const variants = getPhoneVariants(leadId);
    
    if (useSupabase) {
      const orClauses = variants.flatMap(v => [
        `id.eq.${v}`,
        `phone.eq.${v}`,
        `whatsapp_lid.eq.${v}`
      ]).join(',');

      const res = await runSupabaseQuery((c) => 
        c.from('leads')
         .select('id')
         .or(orClauses)
         .maybeSingle()
      );
      if (res && !res.error && res.data) return res.data.id;
    }
    
    const sDb = getSqliteDbOrNull();
    if (sDb) {
      for (const v of variants) {
        const row = sDb.prepare('SELECT id FROM leads WHERE id = ? OR phone = ? OR whatsapp_lid = ?').get(v, v, v) as any;
        if (row) return row.id;
      }
    }

    return leadId;
  },

  async mergeLeads(sourceLeadId: string, targetLeadId: string): Promise<void> {
    if (!sourceLeadId || !targetLeadId || sourceLeadId === targetLeadId) return;
    try {
      console.log(`[db.mergeLeads] Fusionando lead duplicado ${sourceLeadId} dentro de lead principal ${targetLeadId}...`);
      const sourceLead = await this.getLeadById(sourceLeadId);
      const targetLead = await this.getLeadById(targetLeadId);

      if (!targetLead) {
        console.warn(`[db.mergeLeads] Target lead ${targetLeadId} no encontrado, abortando fusión.`);
        return;
      }

      // Preservar el mejor nombre (evitar nombres genéricos 'WhatsApp 14...')
      let resolvedName = targetLead.name;
      if (
        (!resolvedName || resolvedName.startsWith('WhatsApp ') || resolvedName.length < 3) &&
        sourceLead?.name && !sourceLead.name.startsWith('WhatsApp ')
      ) {
        resolvedName = sourceLead.name;
      }

      // Resolver whatsapp_lid
      const resolvedLid = targetLead.whatsapp_lid || sourceLead?.whatsapp_lid || (sourceLeadId.length >= 13 ? sourceLeadId : null);

      // Resolver teléfono real: preferir el no-LID (match distinto de whatsapp_lid o <14 dígitos)
      const lidD = typeof targetLead.whatsapp_lid === 'string' ? targetLead.whatsapp_lid.replace(/\D/g, '') : '';
      const lidEvidence = lidD.length >= 14 ? lidD : '';
      const isShort = (v: unknown) => {
        if (typeof v !== 'string') return false;
        const d = v.replace(/\D/g, '');
        if (!d) return false;
        if (lidEvidence && d === lidEvidence) return false;
        return d.length < 14;
      };
      const resolvedRealPhone =
        (isShort(targetLead.real_phone) && targetLead.real_phone) ||
        (isShort(sourceLead?.real_phone) && sourceLead.real_phone) ||
        (isShort(targetLead.phone) && targetLead.phone) ||
        (isShort(sourceLead?.phone) && sourceLead.phone) ||
        null;

      // Combinar tags
      const targetTags: string[] = Array.isArray(targetLead.tags) ? targetLead.tags : [];
      const sourceTags: string[] = (sourceLead && Array.isArray(sourceLead.tags)) ? sourceLead.tags : [];
      const mergedTags = Array.from(new Set([...targetTags, ...sourceTags]));

      // Status más avanzado si aplica
      const statusPriority: { [key: string]: number } = {
        'New': 1,
        'Engaged': 2,
        'Pending Verification': 3,
        'Por Registrar en Web': 4,
        'Converted': 5,
        'Archived': 0
      };
      let resolvedStatus = targetLead.status || 'New';
      if (sourceLead?.status && (statusPriority[sourceLead.status] || 0) > (statusPriority[resolvedStatus] || 0)) {
        resolvedStatus = sourceLead.status;
      }

      // Producto: se conserva el más reciente (el target salvo que esté vacío)
      const resolvedProduct =
        (typeof targetLead.last_product === 'string' && targetLead.last_product.trim()
          ? targetLead.last_product
          : null) ||
        (sourceLead && typeof sourceLead.last_product === 'string' && sourceLead.last_product.trim()
          ? sourceLead.last_product
          : null);
      // Pedido: igual criterio (los tres campos viajan juntos)
      const resolvedOrderQty = targetLead.last_order_qty ?? sourceLead?.last_order_qty ?? null;
      const resolvedOrderTotal = targetLead.last_order_total ?? sourceLead?.last_order_total ?? null;
      const resolvedOrderAt = targetLead.last_order_at || sourceLead?.last_order_at || null;

      const nowIso = new Date().toISOString();

      if (useSupabase) {
        await runSupabaseQuery((c) => c.from('chat_messages').update({ lead_id: targetLeadId }).eq('lead_id', sourceLeadId));
        await runSupabaseQuery((c) => c.from('knowledge_gaps').update({ lead_id: targetLeadId }).eq('lead_id', sourceLeadId));
        await runSupabaseQuery((c) => c.from('lead_notes').update({ lead_id: targetLeadId }).eq('lead_id', sourceLeadId));
        await runSupabaseQuery((c) => c.from('reminders').update({ lead_id: targetLeadId }).eq('lead_id', sourceLeadId));
        await runSupabaseQuery((c) => c.from('leads').delete().eq('id', sourceLeadId));
        const updatePayload: any = {
          name: resolvedName,
          status: resolvedStatus,
          tags: mergedTags,
          updated_at: nowIso
        };
        if (resolvedLid) updatePayload.whatsapp_lid = resolvedLid;
        await runSupabaseQuery((c) => c.from('leads').update(updatePayload).eq('id', targetLeadId));
      } else {
        const db = getSqliteDbOrNull();
        if (db) {
          const merge = db.transaction(() => {
            db.prepare('UPDATE chat_messages SET lead_id = ? WHERE lead_id = ?').run(targetLeadId, sourceLeadId);
            db.prepare('UPDATE knowledge_gaps SET lead_id = ? WHERE lead_id = ?').run(targetLeadId, sourceLeadId);
            try { db.prepare('UPDATE lead_notes SET lead_id = ? WHERE lead_id = ?').run(targetLeadId, sourceLeadId); } catch (e) {}
            try { db.prepare('UPDATE reminders SET lead_id = ? WHERE lead_id = ?').run(targetLeadId, sourceLeadId); } catch (e) {}
            db.prepare('DELETE FROM leads WHERE id = ?').run(sourceLeadId);
            db.prepare(`
              UPDATE leads
              SET name = ?, whatsapp_lid = ?, real_phone = ?, last_product = ?, last_order_qty = ?, last_order_total = ?, last_order_at = ?, status = ?, tags = ?, updated_at = ?
              WHERE id = ?
            `).run(resolvedName, resolvedLid, resolvedRealPhone, resolvedProduct, resolvedOrderQty, resolvedOrderTotal, resolvedOrderAt, resolvedStatus, JSON.stringify(mergedTags), nowIso, targetLeadId);
          });
          merge();
        }
      }
      console.log(`[db.mergeLeads] ✅ Fusión completada con éxito. Lead ${targetLeadId} actualizado.`);
    } catch (e) {
      console.error('[db.mergeLeads] Error fusionando leads:', e);
    }
  },

  // Throttle best-effort en memoria (1 vez/min): el auto-merge es O(n) y
  // upsertLead lo dispara en segundo plano por cada mensaje.
  async unifyDuplicateLeads(): Promise<void> {
    try {
      const now = Date.now();
      if (now - lastUnifyRun < 60_000) return;
      lastUnifyRun = now;

      console.log('[db.unifyDuplicateLeads] Iniciando escaneo de leads duplicados...');
      let leads: any[] = [];
      if (useSupabase) {
        const { data, error } = await getSupabase().from('leads').select('*');
        if (!error && data) leads = data;
      } else {
        const db = getSqliteDbOrNull();
        if (db) leads = db.prepare('SELECT * FROM leads').all();
      }

      const digitsOf = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
      // Solo identificadores con longitud de teléfono/LID real (evita '123' de fb_/ig_).
      const usable = (d: string) => d.length >= 7;

      // Agrupar filas por cada identificador exacto (id, phone, real_phone, whatsapp_lid).
      // Solo coincidencias EXACTAS de dígitos fusionan. La vieja regla por substring
      // de nombre se eliminó: fusionaba clientes distintos (p. ej. "Luiz" en "Luiz Milla").
      const groups = new Map<string, Set<string>>();
      const byId = new Map<string, any>();
      for (const lead of leads) {
        if (!lead || !lead.id) continue;
        byId.set(lead.id, lead);
        const keys = new Set(
          [lead.id, lead.phone, lead.real_phone, lead.whatsapp_lid].map(digitsOf).filter(usable)
        );
        for (const k of keys) {
          if (!groups.has(k)) groups.set(k, new Set());
          groups.get(k)!.add(lead.id);
        }
      }

      const merged = new Set<string>();
      const shortPhoneOf = (l: any): string | null => {
        for (const v of [l.real_phone, l.phone]) {
          const d = digitsOf(v);
          if (d && d.length < 14) return d;
        }
        return null;
      };

      for (const [, ids] of groups) {
        const alive = [...ids].filter((id) => byId.has(id) && !merged.has(id));
        if (alive.length < 2) continue;
        // Target: el que tenga teléfono corto; desempate por antigüedad.
        alive.sort((a, b) => {
          const sa = shortPhoneOf(byId.get(a)) ? 0 : 1;
          const sb = shortPhoneOf(byId.get(b)) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          const ta = new Date(byId.get(a)?.created_at || 0).getTime();
          const tb = new Date(byId.get(b)?.created_at || 0).getTime();
          return ta - tb;
        });
        const target = alive[0];
        for (const source of alive.slice(1)) {
          if (merged.has(source)) continue;
          console.log(`[db.unifyDuplicateLeads] Duplicado exacto detectado. Fusionando ${source} en ${target}`);
          await this.mergeLeads(source, target);
          merged.add(source);
        }
      }
      console.log('[db.unifyDuplicateLeads] Escaneo e unificación finalizado.');
    } catch (e) {
      console.error('Error unificando leads duplicados:', e);
    }
  },

  IDENTITY_MAPPING: {
    '51955252932': ['51955252932', '955252932'],
    '955252932': ['51955252932', '955252932'],
    '51900401930': ['51900401930', '900401930'],
    '900401930': ['51900401930', '900401930']
  } as { [key: string]: string[] },

  async getAssociatedIds(leadId: string): Promise<string[]> {
    const ids = new Set<string>();
    if (leadId) ids.add(leadId);
    try {
      getPhoneVariants(leadId).forEach(v => ids.add(v));

      const staticEquivalents = this.IDENTITY_MAPPING[leadId] || this.IDENTITY_MAPPING[leadId.replace(/\D/g, '')];
      if (staticEquivalents) {
        staticEquivalents.forEach(id => ids.add(id));
      }

      let lead = await this.getLeadById(leadId);
      if (!lead) {
        const variants = getPhoneVariants(leadId);
        if (useSupabase) {
          const orClauses = variants.flatMap(v => [`phone.eq.${v}`, `whatsapp_lid.eq.${v}`]).join(',');
          const res = await runSupabaseQuery((c) => 
            c.from('leads')
             .select('*')
             .or(orClauses)
             .maybeSingle()
          );
          if (res && !res.error && res.data) lead = res.data;
        } else {
          const sDb = getSqliteDbOrNull();
          if (sDb) {
            for (const v of variants) {
              const row = sDb.prepare('SELECT * FROM leads WHERE phone = ? OR whatsapp_lid = ?').get(v, v);
              if (row) {
                lead = {
                  ...row,
                  tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
                  bot_active: Boolean(row.bot_active)
                };
                break;
              }
            }
          }
        }
      }
      if (lead) {
        if (lead.id) ids.add(lead.id);
        if (lead.phone) ids.add(lead.phone);
        if (lead.whatsapp_lid) ids.add(lead.whatsapp_lid);

        getPhoneVariants(lead.id).forEach(v => ids.add(v));
        if (lead.phone) getPhoneVariants(lead.phone).forEach(v => ids.add(v));
        if (lead.whatsapp_lid) getPhoneVariants(lead.whatsapp_lid).forEach(v => ids.add(v));
      }
    } catch (e) {
      console.error('Error finding associated IDs:', e);
    }
    return Array.from(ids);
  },

  async getMessages(leadId: string): Promise<any[]> {
    const normalizedId = await this.normalizeLeadId(leadId);
    const ids = await this.getAssociatedIds(normalizedId);
    let messages: any[] = [];
    if (useSupabase) {
      const { data, error } = await getSupabase().from('chat_messages').select('*').in('lead_id', ids).order('created_at', { ascending: true });
      if (error) throw error;
      messages = data || [];
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        const placeholders = ids.map(() => '?').join(',');
        messages = db.prepare(`SELECT * FROM chat_messages WHERE lead_id IN (${placeholders}) ORDER BY created_at ASC`).all(...ids);
      }
    }
    
    // Deduplicar mensajes por ID e ignorar mensajes idénticos duplicados por webhook/polling en ventana de 15s
    const seenIds = new Set<string>();
    const uniqueMessages: any[] = [];

    for (const msg of messages) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);

      const isDuplicateContent = uniqueMessages.some((prev) => {
        if (prev.sender !== msg.sender || prev.message !== msg.message) return false;
        const t1 = new Date(prev.created_at || 0).getTime();
        const t2 = new Date(msg.created_at || 0).getTime();
        return Math.abs(t1 - t2) <= 15000;
      });

      if (!isDuplicateContent) {
        uniqueMessages.push(msg);
      }
    }

    return uniqueMessages;
  },

  async getMessageById(messageId: string): Promise<any> {
    if (!messageId) return null;
    if (useSupabase) {
      const { data } = await getSupabase()
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();
      return data || null;
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) || null;
      }
      return null;
    }
  },

  async addMessage(leadId: string, sender: string, message: string, customId?: string): Promise<any> {
    const normalizedId = await this.normalizeLeadId(leadId);
    const id = customId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const nowIso = new Date().toISOString();
    
    // Filtro anti-duplicados en base de datos: prevenir inserción idéntica en ventana de 15 segundos
    if (!useSupabase) {
      const db = getSqliteDbOrNull();
      if (db) {
        const recent = db.prepare(`
          SELECT * FROM chat_messages 
          WHERE lead_id = ? AND sender = ? AND message = ? 
          ORDER BY created_at DESC LIMIT 1
        `).get(normalizedId, sender, message) as any;

        if (recent && recent.created_at) {
          let isoStr = recent.created_at;
          if (typeof isoStr === 'string') {
            if (!isoStr.includes('T')) isoStr = isoStr.replace(' ', 'T');
            if (!isoStr.endsWith('Z') && !isoStr.match(/[+-]\d{2}:?\d{2}$/)) isoStr += 'Z';
          }
          const diffSec = Math.abs(Date.now() - new Date(isoStr).getTime()) / 1000;
          if (diffSec <= 15) {
            console.log(`[db.addMessage] 🛡️ Mensaje duplicado interceptado y omitido (${diffSec.toFixed(1)}s): "${message.slice(0, 30)}"`);
            return recent;
          }
        }
      }
    }

    let insertedMsg: any = null;
    if (useSupabase) {
      const { data, error } = await getSupabase().from('chat_messages').upsert({
        id,
        lead_id: normalizedId,
        sender,
        message,
        is_read: false,
        created_at: nowIso
      }, { onConflict: 'id' }).select().single();
      if (error) throw error;
      insertedMsg = data;

      // Actualizar updated_at en Supabase para posicionar el lead arriba en la lista
      await runSupabaseQuery((c) => c.from('leads').update({ updated_at: nowIso }).eq('id', normalizedId));
    } else {
      const db = getSqliteDbOrNull();
      if (db) {
        db.prepare(`
          INSERT OR IGNORE INTO chat_messages (id, lead_id, sender, message, is_read, created_at)
          VALUES (?, ?, ?, ?, 0, ?)
        `).run(id, normalizedId, sender, message, nowIso);

        // Actualizar updated_at en SQLite
        db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(nowIso, normalizedId);
        insertedMsg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
      }
    }
    return insertedMsg;
  },

  async markMessagesAsRead(leadId: string): Promise<void> {
    const normalizedId = await this.normalizeLeadId(leadId);
    const ids = await this.getAssociatedIds(normalizedId);
    if (useSupabase) {
      const { error } = await getSupabase()
        .from('chat_messages')
        .update({ is_read: true })
        .in('lead_id', ids)
        .eq('sender', 'customer');
      if (error) throw error;
    } else {
      const db = requireSqliteDb('markMessagesAsRead');
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE chat_messages SET is_read = 1 WHERE lead_id IN (${placeholders}) AND sender = 'customer'`).run(...ids);
    }
  },

  async deleteChatMessages(leadId: string): Promise<void> {
    const normalizedId = await this.normalizeLeadId(leadId);
    const ids = await this.getAssociatedIds(normalizedId);
    if (useSupabase) {
      const { error } = await getSupabase().from('chat_messages').delete().in('lead_id', ids);
      if (error) throw error;
    } else {
      const db = requireSqliteDb('deleteChatMessages');
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM chat_messages WHERE lead_id IN (${placeholders})`).run(...ids);
    }
  },

  async deleteLead(leadId: string): Promise<void> {
    if (!leadId) {
      throw new Error('Missing leadId');
    }

    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('chat_messages').delete().eq('lead_id', leadId));
      await runSupabaseQuery((c) => c.from('knowledge_gaps').delete().eq('lead_id', leadId));
      await runSupabaseQuery((c) => c.from('lead_notes').delete().eq('lead_id', leadId));
      await runSupabaseQuery((c) => c.from('reminders').delete().eq('lead_id', leadId));
      const { error: leadError } = await getSupabase().from('leads').delete().eq('id', leadId);
      if (leadError) throw leadError;
    } else {
      const db = getSqliteDb();
      const remove = db.transaction(() => {
        db.prepare('DELETE FROM chat_messages WHERE lead_id = ?').run(leadId);
        try { db.prepare('DELETE FROM lead_notes WHERE lead_id = ?').run(leadId); } catch (e) {}
        try { db.prepare('DELETE FROM reminders WHERE lead_id = ?').run(leadId); } catch (e) {}
        db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);
      });
      remove();
    }
  },

  getWhatsappSession(sessionId: string = 'default'): Promise<any> {
    return getWhatsappSession(sessionId);
  },

  saveWhatsappSession(sessionId: string = 'default', creds?: any, keys?: any): Promise<any> {
    return saveWhatsappSession(sessionId, creds, keys);
  },

  clearWhatsappSession(sessionId: string = 'default'): Promise<void> {
    return clearWhatsappSession(sessionId);
  },

  // --- LEAD NOTES ---
  async getNotesByLead(leadId: string): Promise<any[]> {
    const normalizedId = await this.normalizeLeadId(leadId);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) =>
        c.from('lead_notes').select('*').eq('lead_id', normalizedId).order('created_at', { ascending: false })
      );
      if (res && !res.error) return res.data || [];
    }
    const db = getSqliteDb();
    return db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC').all(normalizedId);
  },

  async addNote(id: string, leadId: string, content: string): Promise<any> {
    const normalizedId = await this.normalizeLeadId(leadId);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) =>
        c.from('lead_notes').insert({ id, lead_id: normalizedId, content }).select().single()
      );
      if (res && !res.error) return res.data;
    }
    const db = getSqliteDb();
    db.prepare('INSERT INTO lead_notes (id, lead_id, content) VALUES (?, ?, ?)').run(id, normalizedId, content);
    return db.prepare('SELECT * FROM lead_notes WHERE id = ?').get(id);
  },

  async deleteNote(id: string): Promise<void> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('lead_notes').delete().eq('id', id));
    }
    const db = getSqliteDb();
    db.prepare('DELETE FROM lead_notes WHERE id = ?').run(id);
  },

  // --- REMINDERS ---
  async getRemindersByLead(leadId: string): Promise<any[]> {
    const normalizedId = await this.normalizeLeadId(leadId);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) =>
        c.from('reminders').select('*').eq('lead_id', normalizedId).order('scheduled_at', { ascending: true })
      );
      if (res && !res.error) return res.data || [];
    }
    const db = getSqliteDb();
    return db.prepare('SELECT * FROM reminders WHERE lead_id = ? ORDER BY scheduled_at ASC').all(normalizedId);
  },

  async addReminder(id: string, leadId: string, message: string, scheduledAt: string): Promise<any> {
    const normalizedId = await this.normalizeLeadId(leadId);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) =>
        c.from('reminders').insert({ id, lead_id: normalizedId, message, scheduled_at: scheduledAt, sent: false }).select().single()
      );
      if (res && !res.error) return res.data;
    }
    const db = getSqliteDb();
    db.prepare('INSERT INTO reminders (id, lead_id, message, scheduled_at, sent) VALUES (?, ?, ?, ?, 0)').run(id, normalizedId, message, scheduledAt);
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  },

  async getPendingReminders(): Promise<any[]> {
    const now = new Date().toISOString();
    if (useSupabase) {
      const res = await runSupabaseQuery((c) =>
        c.from('reminders').select('*, leads(id, name, phone)').eq('sent', false).lte('scheduled_at', now)
      );
      if (res && !res.error) return res.data || [];
    }
    const db = getSqliteDb();
    const rows = db.prepare("SELECT r.*, l.id as lead_id_real, l.name as lead_name, l.phone as lead_phone FROM reminders r LEFT JOIN leads l ON r.lead_id = l.id WHERE r.sent = 0 AND r.scheduled_at <= ?").all(now);
    return rows.map((r: any) => ({
      ...r,
      leads: { id: r.lead_id_real, name: r.lead_name, phone: r.lead_phone }
    }));
  },

  async markReminderSent(id: string): Promise<void> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('reminders').update({ sent: true }).eq('id', id));
    }
    const db = getSqliteDb();
    db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);
  },

  async deleteReminder(id: string): Promise<void> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('reminders').delete().eq('id', id));
    }
    const db = getSqliteDb();
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },

  async getLeadStats(): Promise<any> {
    const leads = await this.getLeads();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const total = leads.length;
    const newToday = leads.filter((l: any) => l.created_at && l.created_at >= todayIso).length;
    const inNegotiation = leads.filter((l: any) => l.status === 'Pending Verification').length;
    const converted = leads.filter((l: any) => l.status === 'Converted').length;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, newToday, inNegotiation, converted, conversionRate };
  },

  async getSystemSetting(key: string): Promise<string | null> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('system_settings').select('value').eq('key', key).maybeSingle());
      if (res && !res.error && res.data) return res.data.value;
    }
    const db = getSqliteDbOrNull();
    if (db) {
      try {
        const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as any;
        return row ? row.value : null;
      } catch (e) {}
    }
    return null;
  },

  async setSystemSetting(key: string, value: string): Promise<void> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('system_settings').upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' }));
    }
    const db = getSqliteDbOrNull();
    if (db) {
      try {
        db.prepare(`
          INSERT INTO system_settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `).run(key, value);
      } catch (e) {}
    }
  },

  async getBroadcasts(): Promise<any[]> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('broadcasts').select('*').order('created_at', { ascending: false }));
      if (res && !res.error) return res.data || [];
    }
    const db = getSqliteDb();
    const rows = db.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC').all();
    return rows.map((r: any) => ({
      ...r,
      targets: safeParseJson<string[]>(r.targets, [])
    }));
  },

  async getBroadcastById(id: string): Promise<any> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('broadcasts').select('*').eq('id', id).maybeSingle());
      if (res && !res.error) return res.data;
    }
    const db = getSqliteDb();
    const row = db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      targets: safeParseJson<string[]>(row.targets, [])
    };
  },

  async saveBroadcast(broadcast: { id: string; name: string; message: string; targets: string[]; status: string; sent_count?: number; failed_count?: number }): Promise<any> {
    const targetsStr = JSON.stringify(broadcast.targets);
    const sentCount = broadcast.sent_count ?? 0;
    const failedCount = broadcast.failed_count ?? 0;

    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('broadcasts').upsert({
        id: broadcast.id,
        name: broadcast.name,
        message: broadcast.message,
        targets: broadcast.targets,
        status: broadcast.status,
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO broadcasts (id, name, message, targets, status, sent_count, failed_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        message = excluded.message,
        targets = excluded.targets,
        status = excluded.status,
        sent_count = excluded.sent_count,
        failed_count = excluded.failed_count,
        updated_at = CURRENT_TIMESTAMP
    `).run(broadcast.id, broadcast.name, broadcast.message, targetsStr, broadcast.status, sentCount, failedCount);
    return this.getBroadcastById(broadcast.id);
  },

  async createUser(user: { id: string; email: string; passwordHash: string; name?: string }): Promise<any> {
    const fullName = user.name || '';
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('users').insert({
        id: user.id,
        email: user.email,
        password: user.passwordHash,
        name: fullName
      }).select().single());
      if (res && !res.error) return res.data;
      if (res && res.error) {
        throw new Error(`Fallo al registrar usuario en Supabase: ${res.error.message}`);
      }
    }

    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO users (id, email, password, name)
      VALUES (?, ?, ?, ?)
    `).run(user.id, user.email, user.passwordHash, fullName);
    return this.getUserByEmail(user.email);
  },

  async updateUserAvatar(email: string, avatarUrl: string): Promise<any> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('users').update({
        avatar_url: avatarUrl
      }).eq('email', email).select().maybeSingle());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDb();
    db.prepare('UPDATE users SET avatar_url = ? WHERE email = ?').run(avatarUrl, email);
    return this.getUserByEmail(email);
  },

  async getUserByEmail(email: string): Promise<any> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('users').select('*').eq('email', email).maybeSingle());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    return row || null;
  },

  async getAIRules(): Promise<any[]> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('ai_rules').select('*').order('created_at', { ascending: true }));
      if (res && !res.error && res.data) return res.data;
    }

    const db = getSqliteDb();
    const rows = db.prepare('SELECT * FROM ai_rules ORDER BY created_at ASC').all();
    return (rows || []).map((r: any) => ({
      ...r,
      is_active: Boolean(r.is_active)
    }));
  },

  async addAIRule(rule: { id?: string; title: string; instruction: string; category?: string; is_active?: boolean }): Promise<any> {
    const id = rule.id || `rule-${Date.now()}`;
    const category = rule.category || 'General';

    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('ai_rules').upsert({
        id,
        title: rule.title,
        instruction: rule.instruction,
        category,
        is_active: rule.is_active !== undefined ? rule.is_active : true
      }).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO ai_rules (id, title, instruction, category, is_active)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        instruction = excluded.instruction,
        category = excluded.category
    `).run(id, rule.title, rule.instruction, category, rule.is_active !== undefined ? (rule.is_active ? 1 : 0) : 1);
    return { id, title: rule.title, instruction: rule.instruction, category, is_active: true };
  },

  async toggleAIRule(id: string, isActive: boolean): Promise<any> {
    const activeVal = isActive ? 1 : 0;
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('ai_rules').update({ is_active: isActive }).eq('id', id).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDb();
    db.prepare('UPDATE ai_rules SET is_active = ? WHERE id = ?').run(activeVal, id);
    return { id, is_active: isActive };
  },

  async deleteAIRule(id: string): Promise<boolean> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('ai_rules').delete().eq('id', id));
    }

    const db = getSqliteDbOrNull();
    if (db) {
      try {
        db.prepare('DELETE FROM ai_rules WHERE id = ?').run(id);
      } catch (e) {}
    }
    return true;
  },

  async deleteFlow(id: string): Promise<void> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('flows').delete().eq('id', id));
    }
    const db = getSqliteDbOrNull();
    if (db) {
      try {
        db.prepare('DELETE FROM flows WHERE id = ?').run(id);
      } catch (e) {}
    }
  },

  // --- WHATSAPP STATUS / STORIES LIBRARY & SCHEDULES ---
  async getStatusLibraryItems(): Promise<any[]> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_library').select('*').order('created_at', { ascending: false }));
      if (res && !res.error && res.data) {
        return res.data.map((item: any) => ({
          ...item,
          tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : (item.tags || [])
        }));
      }
    }

    const db = getSqliteDbOrNull();
    if (!db) return [];
    try {
      const rows = db.prepare('SELECT * FROM whatsapp_status_library ORDER BY created_at DESC').all();
      return (rows || []).map((item: any) => ({
        ...item,
        tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : (item.tags || [])
      }));
    } catch (e) {
      return [];
    }
  },

  async createStatusLibraryItem(item: {
    id?: string;
    title: string;
    product_name?: string;
    category?: string;
    tags?: string[];
    media_url: string;
    media_type?: string;
    caption?: string;
    internal_notes?: string;
  }): Promise<any> {
    const id = item.id || `status-lib-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tagsArr = item.tags || [];
    const tagsStr = JSON.stringify(tagsArr);
    const mediaType = item.media_type || (item.media_url?.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image');
    const nowIso = new Date().toISOString();

    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_library').upsert({
        id,
        title: item.title,
        product_name: item.product_name || '',
        category: item.category || 'General',
        tags: tagsArr,
        media_url: item.media_url,
        media_type: mediaType,
        caption: item.caption || '',
        internal_notes: item.internal_notes || '',
        created_at: nowIso
      }).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDbOrNull();
    if (db) {
      db.prepare(`
        INSERT INTO whatsapp_status_library (id, title, product_name, category, tags, media_url, media_type, caption, internal_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          product_name = excluded.product_name,
          category = excluded.category,
          tags = excluded.tags,
          media_url = excluded.media_url,
          media_type = excluded.media_type,
          caption = excluded.caption,
          internal_notes = excluded.internal_notes
      `).run(
        id,
        item.title,
        item.product_name || '',
        item.category || 'General',
        tagsStr,
        item.media_url,
        mediaType,
        item.caption || '',
        item.internal_notes || '',
        nowIso
      );
      return { id, ...item, tags: tagsArr, media_type: mediaType, created_at: nowIso };
    }
    return { id, ...item, tags: tagsArr, media_type: mediaType, created_at: nowIso };
  },

  async deleteStatusLibraryItem(id: string): Promise<boolean> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('whatsapp_status_library').delete().eq('id', id));
    }
    const db = getSqliteDbOrNull();
    if (db) {
      try {
        db.prepare('DELETE FROM whatsapp_status_library WHERE id = ?').run(id);
      } catch (e) {}
    }
    return true;
  },

  async getStatusSchedules(): Promise<any[]> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_schedules').select('*').order('created_at', { ascending: false }));
      if (res && !res.error && res.data) return res.data;
    }

    const db = getSqliteDbOrNull();
    if (!db) return [];
    try {
      return db.prepare('SELECT * FROM whatsapp_status_schedules ORDER BY created_at DESC').all() || [];
    } catch (e) {
      return [];
    }
  },

  async createStatusSchedule(sched: {
    id?: string;
    library_id?: string;
    media_url: string;
    media_type?: string;
    caption?: string;
    scheduled_at?: string | null;
    recurrence_type?: string;
    recurrence_days?: string[] | string;
    status?: string;
    published_at?: string | null;
    error_message?: string | null;
  }): Promise<any> {
    const id = sched.id || `status-sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const mediaType = sched.media_type || (sched.media_url?.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image');
    const status = sched.status || (sched.scheduled_at ? 'pending' : 'published');
    const recurrenceType = sched.recurrence_type || 'none';
    const recurrenceDays = typeof sched.recurrence_days === 'string' ? sched.recurrence_days : JSON.stringify(sched.recurrence_days || []);
    const nowIso = new Date().toISOString();

    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_schedules').upsert({
        id,
        library_id: sched.library_id || null,
        media_url: sched.media_url,
        media_type: mediaType,
        caption: sched.caption || '',
        scheduled_at: sched.scheduled_at || null,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays,
        status,
        published_at: sched.published_at || (status === 'published' ? nowIso : null),
        error_message: sched.error_message || null,
        created_at: nowIso
      }).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDbOrNull();
    if (db) {
      db.prepare(`
        INSERT INTO whatsapp_status_schedules (id, library_id, media_url, media_type, caption, scheduled_at, recurrence_type, recurrence_days, status, published_at, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        sched.library_id || null,
        sched.media_url,
        mediaType,
        sched.caption || '',
        sched.scheduled_at || null,
        recurrenceType,
        recurrenceDays,
        status,
        sched.published_at || (status === 'published' ? nowIso : null),
        sched.error_message || null,
        nowIso
      );
      return { id, ...sched, media_type: mediaType, recurrence_type: recurrenceType, recurrence_days: recurrenceDays, status, created_at: nowIso };
    }
    return { id, ...sched, media_type: mediaType, recurrence_type: recurrenceType, recurrence_days: recurrenceDays, status, created_at: nowIso };
  },

  async updateStatusSchedule(id: string, updates: {
    status?: string;
    published_at?: string | null;
    error_message?: string | null;
    scheduled_at?: string | null;
    recurrence_type?: string;
    recurrence_days?: string;
    caption?: string;
  }): Promise<any> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_schedules').update(updates).eq('id', id).select().single());
      if (res && !res.error) return res.data;
    }

    const db = getSqliteDbOrNull();
    if (db) {
      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(updates)) {
        sets.push(`${k} = ?`);
        vals.push(v);
      }
      if (sets.length > 0) {
        vals.push(id);
        db.prepare(`UPDATE whatsapp_status_schedules SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      }
      return db.prepare('SELECT * FROM whatsapp_status_schedules WHERE id = ?').get(id);
    }
  },

  async deleteStatusSchedule(id: string): Promise<boolean> {
    if (useSupabase) {
      await runSupabaseQuery((c) => c.from('whatsapp_status_schedules').delete().eq('id', id));
    }
    const db = getSqliteDbOrNull();
    if (db) {
      try {
        db.prepare('DELETE FROM whatsapp_status_schedules WHERE id = ?').run(id);
      } catch (e) {}
    }
    return true;
  },

  async getPendingStatusSchedules(): Promise<any[]> {
    const nowIso = new Date().toISOString();
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => 
        c.from('whatsapp_status_schedules')
         .select('*')
         .eq('status', 'pending')
         .lte('scheduled_at', nowIso)
      );
      if (res && !res.error && res.data) return res.data;
    }

    const db = getSqliteDbOrNull();
    if (!db) return [];
    try {
      return db.prepare("SELECT * FROM whatsapp_status_schedules WHERE status = 'pending' AND scheduled_at <= ?").all(nowIso) || [];
    } catch (e) {
      return [];
    }
  },

  async markStatusSchedulePublished(id: string, error?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    if (error) {
      await this.updateStatusSchedule(id, {
        status: 'failed',
        error_message: error
      });
      return;
    }

    // Obtener el registro para verificar si tiene recurrencia
    let schedule: any = null;
    const db = getSqliteDbOrNull();
    if (db) {
      schedule = db.prepare('SELECT * FROM whatsapp_status_schedules WHERE id = ?').get(id);
    }
    if (!schedule && useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('whatsapp_status_schedules').select('*').eq('id', id).maybeSingle());
      if (res && res.data) schedule = res.data;
    }

    if (schedule && schedule.recurrence_type && schedule.recurrence_type !== 'none') {
      const baseDate = schedule.scheduled_at ? new Date(schedule.scheduled_at) : new Date();
      const nextDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000); // Siguiente día

      if (schedule.recurrence_type === 'weekdays') {
        const dayOfWeek = nextDate.getDay(); // 0 = Domingo, 6 = Sábado
        if (dayOfWeek === 6) { // Si cae sábado, mover al lunes (+2 días)
          nextDate.setDate(nextDate.getDate() + 2);
        } else if (dayOfWeek === 0) { // Si cae domingo, mover al lunes (+1 día)
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }

      console.log(`[Status DB] 🔁 Estado recurrente ${id} (${schedule.recurrence_type}) publicado. Próxima ejecución: ${nextDate.toISOString()}`);

      // Mantener en status 'pending' con la nueva fecha de ejecución agendada
      await this.updateStatusSchedule(id, {
        status: 'pending',
        scheduled_at: nextDate.toISOString(),
        published_at: nowIso,
        error_message: null
      });
    } else {
      // Publicación no recurrente
      await this.updateStatusSchedule(id, {
        status: 'published',
        published_at: nowIso,
        error_message: null
      });
    }
  }
};

