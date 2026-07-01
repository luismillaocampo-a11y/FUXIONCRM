import { createClient } from '@supabase/supabase-js';

const whatsappJsonReplacer = (_k: any, value: any) => {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
    return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') };
  }
  return value;
};

const whatsappJsonReviver = (_key: any, value: any) => {
  if (typeof value === 'object' && value !== null && value.type === 'Buffer' && typeof value.data === 'string') {
    return Buffer.from(value.data, 'base64');
  }
  return value;
};

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window === 'undefined') {
  console.log(
    "DB Config - URL:", supabaseUrl,
    "Anon Key length:", supabaseAnonKey ? supabaseAnonKey.length : 0,
    "Anon Key ends with:", supabaseAnonKey ? supabaseAnonKey.slice(-8) : "none"
  );
}

// Determine if we should use Supabase
// Force Supabase in production (Vercel/Lambda) to prevent read-only SQLite filesystem writes
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || Boolean(process.env.LAMBDA_TASK_ROOT);
let useSupabase = isProduction || Boolean(supabaseUrl && supabaseAnonKey);

let sqliteDb: any = null;
let DatabaseClass: any = null;

// Initialize SQLite Fallback Database
function getSqliteDb() {
  if (sqliteDb) return sqliteDb;

  if (!DatabaseClass) {
    DatabaseClass = require('better-sqlite3');
  }

  const path = require('path');
  const dbPath = path.join(/* turbopackIgnore: true */ process.cwd(), 'db.sqlite');
  sqliteDb = new DatabaseClass(dbPath);

  // Initialize tables in SQLite if they don't exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE NOT NULL,
      whatsapp_lid TEXT,
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
  `);

  try {
    sqliteDb.exec('ALTER TABLE chat_messages ADD COLUMN is_read INTEGER DEFAULT 0;');
  } catch (e) {}

  try {
    sqliteDb.exec('ALTER TABLE leads ADD COLUMN whatsapp_lid TEXT;');
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

  // Insert default leads if empty
  const leadCount = sqliteDb.prepare('SELECT count(*) as count FROM leads').get() as { count: number };
  if (leadCount.count === 0) {
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

// Helper to run Supabase queries and gracefully fallback to SQLite on auth errors
async function runSupabaseQuery(action: (c: any) => Promise<any>) {
  if (!useSupabase || !supabase) return null;
  try {
    const res = await action(supabase);
    // Supabase returns { data, error, status }
    if (res && res.error) {
      const msg = res.error?.message || String(res.error);
      if (msg.toLowerCase().includes('invalid api key') || res.status === 401) {
        console.warn('Supabase auth failure detected, switching to SQLite fallback:', msg);
        // disable Supabase for the rest of the runtime
        // eslint-disable-next-line no-global-assign
        (global as any).USE_SUPABASE = false;
        (global as any).SUPABASE_DISABLED_REASON = msg;
        // update local flags so subsequent calls use SQLite
        // Note: mutate module-level vars
        // @ts-ignore
        useSupabase = false;
        supabase = null;
        return null;
      }
    }
    return res;
  } catch (e: any) {
    console.warn('Supabase query exception, disabling Supabase fallback:', e?.message || e);
    // @ts-ignore
    useSupabase = false;
    supabase = null;
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

async function getWhatsappSession(sessionId: string = 'default') {
  if (useSupabase) {
    const res = await runSupabaseQuery((c) => c.from('whatsapp_sessions').select('*').eq('id', sessionId).maybeSingle());
    if (res && !res.error && res.data) {
      return parseWhatsappSessionRow(res.data);
    }
  }
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM whatsapp_sessions WHERE id = ?').get(sessionId);
  return parseWhatsappSessionRow(row);
}

async function saveWhatsappSession(sessionId: string = 'default', creds?: any, keys?: any) {
  const existing = await getWhatsappSession(sessionId);
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
  }

  const db = getSqliteDb();
  if (existing) {
    db.prepare('UPDATE whatsapp_sessions SET creds = ?, keys = ?, updated_at = ? WHERE id = ?')
      .run(sqlitePayload.creds, sqlitePayload.keys, new Date().toISOString(), sessionId);
  } else {
    db.prepare('INSERT INTO whatsapp_sessions (id, creds, keys, updated_at) VALUES (?, ?, ?, ?)')
      .run(sessionId, sqlitePayload.creds, sqlitePayload.keys, new Date().toISOString());
  }
  return getWhatsappSession(sessionId);
}

async function clearWhatsappSession(sessionId: string = 'default') {
  if (useSupabase) {
    await runSupabaseQuery((c) => c.from('whatsapp_sessions').delete().eq('id', sessionId));
  }
  const db = getSqliteDb();
  db.prepare('DELETE FROM whatsapp_sessions WHERE id = ?').run(sessionId);
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

// Unified database operations API
export const db = {
  // --- LEADS ---
  async getLeads(): Promise<any[]> {
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => 
        c.from('leads')
         .select('*')
         .order('created_at', { ascending: false })
      );
      if (res && !res.error) {
        const leads = res.data || [];
        const { data: unreadData, error: unreadError } = await getSupabase()
          .from('chat_messages')
          .select('lead_id')
          .eq('sender', 'customer')
          .eq('is_read', false);
        
        const counts: { [key: string]: number } = {};
        if (!unreadError && unreadData) {
          for (const msg of unreadData) {
            counts[msg.lead_id] = (counts[msg.lead_id] || 0) + 1;
          }
        }
        return leads.map((l: any) => ({
          ...l,
          unread_count: counts[l.id] || 0
        }));
      }
      // fall through to sqlite fallback
    }
    {
      const db = getSqliteDb();
      const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
      const unreadData = db.prepare("SELECT lead_id FROM chat_messages WHERE sender = 'customer' AND is_read = 0").all() as any[];
      const counts: { [key: string]: number } = {};
      for (const msg of unreadData) {
        counts[msg.lead_id] = (counts[msg.lead_id] || 0) + 1;
      }
      return leads.map((l: any) => ({
        ...l,
        tags: JSON.parse(l.tags),
        bot_active: Boolean(l.bot_active),
        unread_count: counts[l.id] || 0
      }));
    }
  },

  async getLeadById(id: string): Promise<any> {
    const realId = await this.normalizeLeadId(id);
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').select('*').eq('id', realId).single());
      if (res && !res.error) return res.data;
      // fall through to sqlite fallback
    }
    {
      const db = getSqliteDb();
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(realId) as any;
      if (!lead) return null;
      return {
        ...lead,
        tags: JSON.parse(lead.tags),
        bot_active: Boolean(lead.bot_active)
      };
    }
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
      return null;
    }
    const db = getSqliteDb();
    const row = db.prepare('SELECT id FROM leads WHERE whatsapp_lid = ?').get(lid) as any;
    return row ? row.id : null;
  },

  async upsertLead(lead: { id: string; name: string; phone: string; whatsapp_lid?: string | null; status?: string; tags?: string[]; bot_active?: boolean }): Promise<any> {
    // Normalizar ID del lead de entrada para evitar duplicidad de registros LID/Teléfono
    const normalizedId = await this.normalizeLeadId(lead.id);
    lead.id = normalizedId;

    const existing = await this.getLeadById(lead.id);
    
    // Merge existing values to prevent losing them on simple upserts
    const whatsappLid = lead.whatsapp_lid || existing?.whatsapp_lid || null;
    const status = lead.status || existing?.status || 'New';
    const tags = lead.tags || (existing?.tags ? (typeof existing.tags === 'string' ? JSON.parse(existing.tags) : existing.tags) : []);
    const botActive = lead.bot_active !== undefined ? lead.bot_active : (existing?.bot_active !== undefined ? existing.bot_active : true);

    const tagsStr = JSON.stringify(tags);
    const botActiveVal = botActive ? 1 : 0;

    let result;
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => c.from('leads').upsert({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        whatsapp_lid: whatsappLid,
        status,
        tags,
        bot_active: botActive
      }).select().single());
      if (res && !res.error) result = res.data;
    }
    if (!result) {
      const db = getSqliteDb();
      db.prepare(`
        INSERT INTO leads (id, name, phone, whatsapp_lid, status, tags, bot_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          whatsapp_lid = excluded.whatsapp_lid,
          status = excluded.status,
          tags = excluded.tags,
          bot_active = excluded.bot_active,
          updated_at = CURRENT_TIMESTAMP
      `).run(lead.id, lead.name, lead.phone, whatsappLid, status, tagsStr, botActiveVal);
      result = await this.getLeadById(lead.id);
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
    const tagsStr = JSON.stringify(tags);
    if (useSupabase) {
      const query = getSupabase().from('leads').update({ tags, updated_at: new Date().toISOString() });
      const { error } = isUuid ? query.eq('id', id) : query.eq('phone', id);
      if (error) throw error;
    } else {
      const db = getSqliteDb();
      const dbId = isUuid ? id : await this.normalizeLeadId(id);
      db.prepare('UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(tagsStr, dbId);
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
      const db = getSqliteDb();
      const dbId = isUuid ? id : await this.normalizeLeadId(id);
      db.prepare('UPDATE leads SET bot_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(activeVal, dbId);
    }
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
        nodes: JSON.parse(f.nodes),
        edges: JSON.parse(f.edges),
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
        nodes: JSON.parse(flow.nodes),
        edges: JSON.parse(flow.edges),
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
      db.prepare('UPDATE flows SET is_active = 0').run();
      db.prepare('UPDATE flows SET is_active = 1 WHERE id = ?').run(id);
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
        nodes: JSON.parse(flow.nodes),
        edges: JSON.parse(flow.edges),
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

    const clean = leadId.replace(/\D/g, '');
    
    if (useSupabase) {
      const res = await runSupabaseQuery((c) => 
        c.from('leads')
         .select('id')
         .or(`phone.eq.${leadId},whatsapp_lid.eq.${leadId},phone.eq.${clean},whatsapp_lid.eq.${clean}`)
         .maybeSingle()
      );
      if (res && !res.error && res.data) return res.data.id;
    }
    
    const db = getSqliteDb();
    const row = db.prepare('SELECT id FROM leads WHERE id = ? OR phone = ? OR whatsapp_lid = ? OR phone = ? OR whatsapp_lid = ?')
      .get(leadId, leadId, leadId, clean, clean) as any;
    if (row) return row.id;

    return leadId;
  },

  async unifyDuplicateLeads(): Promise<void> {
    try {
      console.log('[db.unifyDuplicateLeads] Iniciando escaneo de leads duplicados...');
      let leads: any[] = [];
      if (useSupabase) {
        const { data, error } = await getSupabase().from('leads').select('*');
        if (!error && data) leads = data;
      } else {
        const db = getSqliteDb();
        leads = db.prepare('SELECT * FROM leads').all();
      }

      for (const lead of leads) {
        const isLid = lead.id.startsWith('1415') || (lead.phone && lead.phone.startsWith('1415'));
        if (isLid) {
          const cleanId = lead.id.replace(/\D/g, '');
          const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
          
          const realLead = leads.find((l: any) => 
            !l.id.startsWith('1415') && 
            !l.phone.startsWith('1415') && 
            (l.whatsapp_lid === cleanId || l.whatsapp_lid === cleanPhone || l.phone === cleanId || l.id === cleanId)
          );

          if (realLead) {
            console.log(`[db.unifyDuplicateLeads] Duplicado detectado! Fusionando lead LID ${lead.id} con lead real ${realLead.id}`);
            
            if (useSupabase) {
              const { error: msgErr } = await getSupabase().from('chat_messages').update({ lead_id: realLead.id }).eq('lead_id', lead.id);
              if (msgErr) console.error('Error fusionando mensajes en Supabase:', msgErr);

              const { error: gapErr } = await getSupabase().from('knowledge_gaps').update({ lead_id: realLead.id }).eq('lead_id', lead.id);
              if (gapErr) console.error('Error fusionando dudas en Supabase:', gapErr);

              const { error: delErr } = await getSupabase().from('leads').delete().eq('id', lead.id);
              if (delErr) console.error('Error eliminando lead duplicado en Supabase:', delErr);

              if (!realLead.whatsapp_lid) {
                await getSupabase().from('leads').update({ whatsapp_lid: cleanId }).eq('id', realLead.id);
              }
            } else {
              const db = getSqliteDb();
              db.prepare('UPDATE chat_messages SET lead_id = ? WHERE lead_id = ?').run(realLead.id, lead.id);
              db.prepare('UPDATE knowledge_gaps SET lead_id = ? WHERE lead_id = ?').run(realLead.id, lead.id);
              db.prepare('DELETE FROM leads WHERE id = ?').run(lead.id);
              if (!realLead.whatsapp_lid) {
                db.prepare('UPDATE leads SET whatsapp_lid = ? WHERE id = ?').run(cleanId, realLead.id);
              }
            }
          }
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
    ids.add(leadId);
    try {
      const staticEquivalents = this.IDENTITY_MAPPING[leadId] || this.IDENTITY_MAPPING[leadId.replace(/\D/g, '')];
      if (staticEquivalents) {
        staticEquivalents.forEach(id => ids.add(id));
      }

      let lead = await this.getLeadById(leadId);
      if (!lead) {
        if (useSupabase) {
          const res = await runSupabaseQuery((c) => 
            c.from('leads')
             .select('*')
             .or(`phone.eq.${leadId},whatsapp_lid.eq.${leadId}`)
             .maybeSingle()
          );
          if (res && !res.error && res.data) lead = res.data;
        } else {
          const sDb = getSqliteDb();
          lead = sDb.prepare('SELECT * FROM leads WHERE phone = ? OR whatsapp_lid = ?').get(leadId, leadId);
          if (lead) {
            lead = {
              ...lead,
              tags: typeof lead.tags === 'string' ? JSON.parse(lead.tags) : lead.tags,
              bot_active: Boolean(lead.bot_active)
            };
          }
        }
      }
      if (lead) {
        if (lead.id) ids.add(lead.id);
        if (lead.phone) ids.add(lead.phone);
        if (lead.whatsapp_lid) ids.add(lead.whatsapp_lid);

        const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
        if (cleanPhone) {
          ids.add(cleanPhone);
          const nineDigits = cleanPhone.startsWith('51') && cleanPhone.length > 2 ? cleanPhone.substring(2) : cleanPhone;
          if (nineDigits.length === 9) {
            ids.add(nineDigits);
            ids.add('51' + nineDigits);
          }
        }
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
      const db = getSqliteDb();
      const placeholders = ids.map(() => '?').join(',');
      messages = db.prepare(`SELECT * FROM chat_messages WHERE lead_id IN (${placeholders}) ORDER BY created_at ASC`).all(...ids);
    }
    console.log(`[db.getMessages] Búsqueda de mensajes para leadId: ${leadId} (normalizado: ${normalizedId}). IDs asociados: ${JSON.stringify(ids)}. Mensajes encontrados: ${messages.length}`);
    return messages;
  },

  async addMessage(leadId: string, sender: string, message: string, customId?: string): Promise<any> {
    const normalizedId = await this.normalizeLeadId(leadId);
    const id = customId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (useSupabase) {
      const { data, error } = await getSupabase().from('chat_messages').upsert({
        id,
        lead_id: normalizedId,
        sender,
        message,
        is_read: false
      }, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = getSqliteDb();
      db.prepare(`
        INSERT OR IGNORE INTO chat_messages (id, lead_id, sender, message, is_read)
        VALUES (?, ?, ?, ?, 0)
      `).run(id, normalizedId, sender, message);
      return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
    }
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
      const db = getSqliteDb();
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
      const db = getSqliteDb();
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM chat_messages WHERE lead_id IN (${placeholders})`).run(...ids);
    }
  },

  async deleteLead(leadId: string): Promise<void> {
    if (!leadId) {
      throw new Error('Missing leadId');
    }

    if (useSupabase) {
      const { error: msgError } = await getSupabase().from('chat_messages').delete().eq('lead_id', leadId);
      if (msgError) throw msgError;

      const { error: leadError } = await getSupabase().from('leads').delete().eq('id', leadId);
      if (leadError) throw leadError;
    } else {
      const db = getSqliteDb();
      db.prepare('DELETE FROM chat_messages WHERE lead_id = ?').run(leadId);
      db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);
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
  }
};
