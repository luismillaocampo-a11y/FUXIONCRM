/**
 * Limpieza segura para cambio de número de WhatsApp.
 *
 * BORRA (datos personales del número anterior):
 *  - leads, chat_messages, lead_notes, reminders, knowledge_gaps
 *
 * PRESERVA (lo que te interesa que se quede):
 *  - knowledge_base (28 RAGs Fuxion)
 *  - ai_rules (rule-1..5 + personalizadas)
 *  - system_settings (ai_api_keys, SMTP, Yape, Sheets, branding, etc.)
 *  - flows, broadcasts, whatsapp_status_library, whatsapp_status_schedules, users
 *  - whatsapp_sessions (sesión actual, ya desconectada)
 *
 * Uso:
 *  node scripts/clean-contacts-new-number.js            -> dry-run (solo muestra conteos)
 *  node scripts/clean-contacts-new-number.js --execute  -> backup + borrado real
 *  node scripts/clean-contacts-new-number.js --execute --include-uploads -> además vacía public/uploads (comprobantes)
 *
 * La BD activa en Windows es %APPDATA%/NutraFlow CRM/db.sqlite (no ./db.sqlite del repo).
 */

const fs = require('fs');
const path = require('path');

const DELETE_TABLES = ['chat_messages', 'lead_notes', 'reminders', 'knowledge_gaps', 'leads'];
const PRESERVE_TABLES = [
  'knowledge_base',
  'ai_rules',
  'system_settings',
  'flows',
  'broadcasts',
  'whatsapp_status_library',
  'whatsapp_status_schedules',
  'users',
  'whatsapp_sessions',
];

function getActiveDbPath() {
  if (process.env.APPDATA) {
    const p = path.join(process.env.APPDATA, 'NutraFlow CRM', 'db.sqlite');
    if (fs.existsSync(p)) return p;
  }
  const local = path.join(process.cwd(), 'db.sqlite');
  return local;
}

function getCounts(db) {
  const out = {};
  const all = [...DELETE_TABLES, ...PRESERVE_TABLES];
  for (const t of all) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get();
      out[t] = row.c;
    } catch {
      out[t] = -1; // tabla no existe en este esquema
    }
  }
  return out;
}

function printCounts(title, counts) {
  console.log(`\n=== ${title} ===`);
  console.log('--- SE BORRARÁ ---');
  for (const t of DELETE_TABLES) console.log(`  ${t}: ${counts[t]}`);
  console.log('--- SE PRESERVA ---');
  for (const t of PRESERVE_TABLES) console.log(`  ${t}: ${counts[t]}`);
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const includeUploads = args.includes('--include-uploads');

  const dbPath = getActiveDbPath();
  console.log('[clean] BD activa:', dbPath);
  if (!fs.existsSync(dbPath)) {
    console.error('[clean] ❌ No existe la BD. ¿Ya iniciaste la app una vez?');
    process.exit(1);
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('[clean] ❌ better-sqlite3 no cargó. Ejecuta: npm rebuild better-sqlite3');
    process.exit(1);
  }

  const db = new Database(dbPath);
  try { db.pragma('foreign_keys = OFF'); } catch {}

  const before = getCounts(db);
  printCounts(execute ? 'ANTES (se va a borrar)' : 'DRY-RUN (sin cambios)', before);

  if (!execute) {
    console.log('\n[clean] Dry-run OK. Nada borrado.');
    console.log('[clean] Para ejecutar real: node scripts/clean-contacts-new-number.js --execute');
    console.log('[clean] Se preservan RAGs, AI rules, Sheets config, flows, masivos y estados.');
    db.close();
    return;
  }

  // 1. Backup en caliente
  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupPath = path.join(backupsDir, `db-before-clean-${stamp}.sqlite`);
  try {
    await db.backup(backupPath);
    console.log('[clean] ✅ Backup creado:', backupPath);
  } catch (e) {
    // Fallback a copia archivo si backup online falla (app abierta con WAL)
    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log('[clean] ✅ Backup por copia creado:', backupPath);
    } catch (copyErr) {
      console.error('[clean] ❌ No se pudo crear backup, ABORTO por seguridad:', copyErr.message);
      db.close();
      process.exit(1);
    }
  }

  // 2. Borrado en transacción
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM chat_messages').run();
    try { db.prepare('DELETE FROM lead_notes').run(); } catch {}
    try { db.prepare('DELETE FROM reminders').run(); } catch {}
    try { db.prepare('DELETE FROM knowledge_gaps').run(); } catch {}
    db.prepare('DELETE FROM leads').run();
  });
  tx();
  try { db.exec('VACUUM;'); } catch {}

  const after = getCounts(db);
  printCounts('DESPUÉS', after);
  db.close();

  // 3. Uploads opcionales (comprobantes/fotos del número anterior)
  if (includeUploads) {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.gitkeep'));
      for (const f of files) {
        try {
          const full = path.join(uploadsDir, f);
          fs.rmSync(full, { recursive: true, force: true });
        } catch {}
      }
      console.log(`[clean] 🧹 uploads vaciado (${files.length} entradas).`);
    }
  } else {
    console.log('[clean] uploads intacto. Para vaciarlo añade --include-uploads');
  }

  console.log('\n[clean] ✅ Listo. Reinicia la app (npm run dev) para limpiar cachés LID en memoria.');
  console.log('[clean] Pasos siguientes:');
  console.log('  1. Sidebar: deja IA en OFF antes de vincular.');
  console.log('  2. Conexión WhatsApp: escanea QR con el NUEVO número.');
  console.log('  3. Actualiza tu número en lib/lead-utils.ts IDENTITY_MAPPING.');
  console.log('  4. Prueba con 1 mensaje tuyo en modo Manual, luego activa IA.');
}

main().catch((e) => {
  console.error('[clean] ❌ Error:', e);
  process.exit(1);
});
