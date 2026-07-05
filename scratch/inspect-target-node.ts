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
      const targetNode = flow.nodes.find((n: any) => n.id === 'node-1782265570702');
      console.log('Target Node details:', JSON.stringify(targetNode, null, 2));
      
      console.log('Edges from Target Node:');
      const outEdges = flow.edges.filter((e: any) => e.source === 'node-1782265570702');
      console.log(JSON.stringify(outEdges, null, 2));
    }
  }
}

check();
