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
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Find lead whose messages contain 'Comas'
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('lead_id, message, created_at')
      .ilike('message', '%Comas%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    console.log('Messages with "Comas":', messages);
    if (messages.length > 0) {
      const leadId = messages[0].lead_id;
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
      console.log('Lead info:', lead);
      
      const { data: history } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(30);
      
      console.log('Recent 30 messages in reverse order:');
      history.forEach(h => {
        console.log(`[${h.created_at}] ${h.sender}: ${h.message}`);
      });
    }
  }
}

checkDb();
