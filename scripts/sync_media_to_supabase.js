const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync('e:\\NUTRAFLOW CRM\\.env.local', 'utf8').split(/\r?\n/).forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  jfif: 'image/jpeg',
  mp4: 'video/mp4'
};

async function syncFolder(dirPath, prefix = '') {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await syncFolder(fullPath, `${prefix}${entry.name}/`);
    } else {
      const ext = path.extname(entry.name).toLowerCase().replace('.', '');
      if (!MIME_MAP[ext]) continue;

      const fileBuffer = fs.readFileSync(fullPath);
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      const dataUri = `data:${mime};base64,${fileBuffer.toString('base64')}`;

      const relKey = `media:${prefix}${entry.name}`;
      const directKey = `media:${entry.name}`;

      console.log(`Subiendo a Supabase: ${relKey} (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

      await supabase.from('system_settings').upsert([
        { key: relKey, value: dataUri, updated_at: new Date().toISOString() },
        { key: directKey, value: dataUri, updated_at: new Date().toISOString() }
      ]);
    }
  }
}

async function main() {
  console.log('Iniciando sincronización de multimedia local a Supabase...');
  await syncFolder('e:\\NUTRAFLOW CRM\\public\\uploads\\status', 'status/');
  console.log('✅ Sincronización completada con éxito.');
}

main().catch(console.error);
