import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

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
    const { data: flow, error } = await supabase
      .from('flows')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
      
    if (error) {
      console.error(error);
    } else if (flow) {
      console.log('Flow name:', flow.name);
      console.log('Flow is_active:', flow.is_active);
      const trigger = flow.nodes.find((n: any) => n.type === 'trigger');
      console.log('Trigger Node keyword data:', JSON.stringify(trigger?.data));
    } else {
      console.log('No active flow found in Supabase');
    }
  } else {
    console.error('Supabase config missing');
  }
}

check();
