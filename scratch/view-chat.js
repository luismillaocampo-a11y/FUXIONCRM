const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Simple env file parser
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

async function checkDb() {
  console.log('Searching in Supabase...');
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Search messages containing 'Comas'
    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('*, leads(name, phone, status, bot_active)')
      .ilike('message', '%Comas%')
      .limit(10);
    
    if (msgErr) {
      console.error('Supabase msg search error:', msgErr);
    } else {
      console.log('Found messages with "Comas":');
      console.log(messages);
      
      // Let's also print the last 20 messages for the leads of these messages
      const leadIds = [...new Set(messages.map(m => m.lead_id))];
      for (const leadId of leadIds) {
        console.log(`\n--- Full chat history for Lead ${leadId} ---`);
        const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
        console.log('Lead Details:', lead);
        const { data: history } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true });
        console.log('History:');
        console.log(history);
      }
    }
  } else {
    console.log('Supabase config missing.');
  }
}

checkDb();
