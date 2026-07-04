import { POST } from '../app/api/webhook/whatsapp/route';
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

// Fallback to anon key for local simulation
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// Mock request
async function simulate() {
  const payload = {
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: '51955252932@s.whatsapp.net',
        fromMe: false,
        id: 'mock-msg-' + Date.now()
      },
      message: {
        conversation: 'Luis\nComas\n99999999'
      },
      pushName: 'Luiz Milla'
    }
  };

  const req = new Request('http://localhost:3000/api/webhook/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('Simulating webhook POST for customer registration details...');
  try {
    const response = await POST(req);
    console.log('Response Status:', response.status);
    const body = await response.json();
    console.log('Response Body:', body);
  } catch (err) {
    console.error('Error during webhook simulation:', err);
  }
}

simulate();
