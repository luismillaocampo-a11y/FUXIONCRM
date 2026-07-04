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

async function test() {
  const { queryKnowledgeBase } = await import('../lib/gemini');
  const { db } = await import('../lib/db');

  const leadId = '51955252932';
  const historyMessages = await db.getMessages(leadId);
  const history = historyMessages.slice(-10).map((m: any) => ({
    sender: m.sender,
    message: m.message
  }));

  console.log('Testing Smart Mock paths...\n');
  
  // Test case 1: Greeting
  console.log('--- Test Case 1: Greeting ("hola") ---');
  const greetingReply = await queryKnowledgeBase('hola', history);
  console.log('Reply:', greetingReply);
  console.log();

  // Test case 2: Product query ("prunex")
  console.log('--- Test Case 2: Product query ("prunex") ---');
  const productReply = await queryKnowledgeBase('prunex', history);
  console.log('Reply:', productReply);
  console.log();

  // Test case 3: Short positive answer ("Si")
  // We need to inject a history ending with a bot question to test this
  console.log('--- Test Case 3: Short positive response ("Si") with buying question in history ---');
  const historyWithQuestion = [
    { sender: 'customer', message: 'Prunex' },
    { sender: 'bot', message: 'Excelente, Deseas Programar la Compra?\n\n¿Te gustaría solicitarlo hoy mismo? 😊' }
  ];
  const confirmationReply = await queryKnowledgeBase('Si', historyWithQuestion);
  console.log('Reply:', confirmationReply);
  console.log();
}

test();
