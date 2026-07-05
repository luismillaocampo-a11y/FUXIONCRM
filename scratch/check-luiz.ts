import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

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

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function check() {
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Check lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', '51955252932')
      .maybeSingle();
      
    if (leadError) {
      console.error('Error fetching lead:', leadError);
    } else {
      console.log('Lead Row from Supabase:', lead);
    }
    
    // Check last 5 messages
    const { data: messages, error: msgsError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('lead_id', '51955252932')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (msgsError) {
      console.error('Error fetching messages:', msgsError);
    } else {
      console.log('Last 5 Messages:', messages);
    }
  } else {
    console.error('Supabase config missing');
  }
}

check();
