const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sjbhbsrihslwpyxjndwr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYmhic3JpaHNsd3B5eGpuZHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzMxNTMsImV4cCI6MjA5NzQwOTE1M30.iLV7MgKojDWYYGMpSPgubE3LtoJFtxJ8iPx2etZ1NrQ';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  console.log('=== LIMPIEZA DE LEADS Y CHATS ANTIGUOS EN SUPABASE ===');
  
  // 1. Conteo de registros actuales
  const countTable = async (table) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
        headers: { ...headers, 'Range': '0-0', 'Prefer': 'count=exact' }
      });
      const cr = res.headers.get('content-range');
      if (cr) {
        const parts = cr.split('/');
        return parseInt(parts[1], 10) || 0;
      }
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch (e) {
      return -1;
    }
  };

  const tablesToClean = ['chat_messages', 'lead_notes', 'reminders', 'knowledge_gaps', 'leads'];
  console.log('\nRegistros encontrados a limpiar:');
  for (const t of tablesToClean) {
    const c = await countTable(t);
    console.log(`  ${t}: ${c}`);
  }

  const preserveTables = ['knowledge_base', 'ai_rules', 'system_settings', 'flows', 'whatsapp_sessions', 'users'];
  console.log('\nTablas protegidas (NO se tocan):');
  for (const t of preserveTables) {
    const c = await countTable(t);
    console.log(`  ${t}: ${c}`);
  }

  if (!execute) {
    console.log('\n[DRY-RUN] Modo de prueba. No se ha borrado nada.');
    console.log('Para ejecutar el borrado real, corre con --execute:');
    console.log('node scripts/clean-supabase-leads.js --execute');
    return;
  }

  // 2. Backup de leads a JSON por seguridad
  console.log('\nGenerando backup de seguridad en scratch...');
  const resLeads = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*`, { headers });
  const allLeads = await resLeads.json();
  const backupPath = path.join(__dirname, '..', 'scratch_leads_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(allLeads, null, 2));
  console.log(`✅ Backup guardado (${allLeads.length} leads) en: ${backupPath}`);

  // 3. Borrado en cascada
  console.log('\nBorrando datos antiguos en Supabase...');
  for (const t of tablesToClean) {
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/${t}?id=neq.null`, {
      method: 'DELETE',
      headers: { ...headers, 'Prefer': 'return=representation' }
    });
    console.log(`  Limpiado ${t}: status ${delRes.status}`);
  }

  console.log('\n✅ Limpieza completada exitosamente.');
  console.log('Ahora el CRM está completamente limpio de contactos personales y listo para el nuevo número.');
}

main().catch(console.error);
