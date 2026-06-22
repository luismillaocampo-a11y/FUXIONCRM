const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// SQLite check
try {
  const db = new Database(path.join(__dirname, '../db.sqlite'));
  const info = db.prepare('PRAGMA table_info(chat_messages)').all();
  console.log('--- SQLite Columns ---');
  console.log(info);
} catch (e) {
  console.error('SQLite check error:', e);
}

// Supabase check
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabase.from('chat_messages').select('*').limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('Supabase error:', error);
      } else {
        console.log('--- Supabase Sample Row ---');
        console.log(data);
      }
    });
} else {
  console.log('Supabase env vars not configured');
}
