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

  const historyWithPayment = [
    { sender: 'customer', message: 'quiero comprar prunex' },
    { sender: 'bot', message: '¡Excelente elección! Para programar tu entrega de inmediato, por favor envíame en un solo mensaje: 📍 Ciudad/Distrito, 📍 Dirección exacta y 📍 Referencia de ubicación.' },
    { sender: 'customer', message: 'Lima, Santiago de Surco, Av Primavera 123 Dpto 301' },
    { sender: 'bot', message: '¡Genial! Puedes realizar el pago mediante Yape, Plin o transferencia bancaria al celular 955252932 (Luis Milla). Una vez realizado, me envías la captura de tu comprobante por aquí para agendar tu entrega. ¡Muchas gracias!' }
  ];

  console.log('Testing AI anti-loop for payment confirmation...\n');
  
  // Directly import queryKnowledgeBase from gemini.ts and check prompt
  const kbItems = await db.getKBItems();
  const contextBlock = "mock fuxion products"; // mock to keep it simple

  const formattedHistory = historyWithPayment
    .slice(-8)
    .map((c) => `${c.sender.toUpperCase()}: ${c.message}`)
    .join('\n');

  console.log('--- FORMATTED HISTORY SEND TO LLM ---');
  console.log(formattedHistory);
  console.log();

  const antiLoopReply = await queryKnowledgeBase('Si ahora', historyWithPayment);
  console.log('Reply:', antiLoopReply);
}

test();
