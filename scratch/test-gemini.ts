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

// Now verify we have the key
console.log('Env GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);

async function test() {
  // Dynamically import libraries so they read the updated process.env
  const { queryKnowledgeBase } = await import('../lib/gemini');
  const { db } = await import('../lib/db');

  const leadId = '51955252932';
  const historyMessages = await db.getMessages(leadId);
  const history = historyMessages.slice(-10).map((m: any) => ({
    sender: m.sender,
    message: m.message
  }));

  console.log('History in test-gemini:', history);
  
  console.log('\n--- Querying with "hola" ---');
  try {
    const reply = await queryKnowledgeBase('hola', history);
    console.log('Reply:', reply);
  } catch (err) {
    console.error('Error in test:', err);
  }
}

test();
