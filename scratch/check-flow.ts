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
    const { data: flows, error } = await supabase
      .from('flows')
      .select('*');
      
    if (error) {
      console.error('Error fetching flows:', error);
    } else {
      console.log('Flows count:', flows?.length);
      flows?.forEach(f => {
        console.log(`Flow ID: ${f.id}, Name: ${f.name}, Active: ${f.is_active}`);
        console.log('Type of nodes:', typeof f.nodes, Array.isArray(f.nodes) ? 'Array' : 'Not Array');
        console.log('Type of edges:', typeof f.edges, Array.isArray(f.edges) ? 'Array' : 'Not Array');
        console.log('Nodes sample:', JSON.stringify(f.nodes).slice(0, 150));
      });
    }
  } else {
    console.error('Supabase config missing');
  }
}

check();
