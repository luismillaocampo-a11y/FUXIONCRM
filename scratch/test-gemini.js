const { queryKnowledgeBase } = require('../lib/gemini');
const { db } = require('../lib/db');
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

async function test() {
  const leadId = '51955252932';
  const historyMessages = await db.getMessages(leadId);
  const history = historyMessages.slice(-10).map((m) => ({
    sender: m.sender,
    message: m.message
  }));

  console.log('History in test-gemini:', history);
  
  // Call queryKnowledgeBase with the last customer message before the bot broke,
  // or a new message "hola" with the history
  console.log('\n--- Querying with "hola" ---');
  try {
    const reply = await queryKnowledgeBase('hola', history);
    console.log('Reply:', reply);
  } catch (err) {
    console.error('Error in test:', err);
  }
}

test();
