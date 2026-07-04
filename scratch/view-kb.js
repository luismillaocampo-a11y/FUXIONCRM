const { createClient } = require('@supabase/supabase-js');
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

async function checkKb() {
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.from('knowledge_base').select('*');
    if (error) {
      console.error(error);
    } else {
      console.log('KB Items:');
      data.forEach(item => {
        console.log(`- Title: ${item.title}, Type: ${item.file_type}`);
        console.log(`  Content snippet: ${item.content ? item.content.slice(0, 300) : 'null'}`);
      });
    }
  }
}

checkKb();
