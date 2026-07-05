import * as path from 'path';
import * as fs from 'fs';

// Load env FIRST
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

async function run() {
  // Dynamically import AFTER env is loaded
  const { whatsappService } = await import('../lib/whatsapp-service');
  const { db } = await import('../lib/db');

  const leadId = '51955252932';
  const text = '1';
  const phone = '51955252932';
  
  // Set flowState manually to "3" (Buttons node)
  whatsappService.flowState.set(leadId, '3');
  console.log('Flow State set to node "3"');
  
  const mockContext = { overrideText: null };
  
  const mockSendMessage = async (ph: string, tx: string) => {
    console.log(`[Mock Send] To: ${ph}, Msg:\n${tx}`);
    return { key: { id: 'mock-id' } };
  };
  
  try {
    console.log('Executing active flow...');
    const result = await whatsappService.executeActiveFlow(leadId, text, phone, mockContext, mockSendMessage);
    console.log('Execution result:', result);
    console.log('New Flow State:', whatsappService.flowState.get(leadId));
  } catch (err) {
    console.error('Error during flow execution:', err);
  }
}

run();
