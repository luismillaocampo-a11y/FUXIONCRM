const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: missing Supabase env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: leads, error } = await supabase.from('leads').select('*');
  if (error) {
    console.error('Error fetching leads:', error);
  } else {
    console.log('--- LEADS ---');
    console.log(JSON.stringify(leads, null, 2));
  }

  const { data: messages, error: msgError } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(20);
  if (msgError) {
    console.error('Error fetching messages:', msgError);
  } else {
    console.log('--- LATEST MESSAGES ---');
    console.log(JSON.stringify(messages, null, 2));
  }
}

main();
