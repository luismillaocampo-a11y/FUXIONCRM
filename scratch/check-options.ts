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
      const n2 = flow.nodes.find((n: any) => n.id === '2');
      const n3 = flow.nodes.find((n: any) => n.id === '3');
      console.log('Node 2:', JSON.stringify(n2, null, 2));
      console.log('Node 3:', JSON.stringify(n3, null, 2));
      
      console.log('Edges from Node 3:');
      const edges = flow.edges.filter((e: any) => e.source === '3');
      console.log(JSON.stringify(edges, null, 2));
    }
  }
}

check();
