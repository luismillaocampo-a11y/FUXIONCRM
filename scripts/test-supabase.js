const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local if process.env doesn't have the keys
const envPath = path.join(process.cwd(), '.env.local');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [k, ...rest] = line.split('=');
      if (!k) return;
      const v = rest.join('=').trim();
      if (!process.env[k.trim()]) process.env[k.trim()] = v;
    });
  } catch (e) {
    // ignore
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
  process.exit(1);
}

const supabase = createClient(url, key, { global: { headers: { 'x-my-test': '1' } } });

(async () => {
  try {
    console.log('Testing Supabase URL:', url);
    const { data, error, status } = await supabase.from('leads').select('*').limit(1);
    console.log('Status:', status);
    if (error) {
      console.error('Error object:', error);
      if (error.details) console.error('Details:', error.details);
      if (error.hint) console.error('Hint:', error.hint);
      if (error.code) console.error('Code:', error.code);
      process.exit(1);
    }
    console.log('Data:', data);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(1);
  }
})();
