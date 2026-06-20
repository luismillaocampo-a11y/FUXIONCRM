const path = require('path');
const fs = require('fs');
const authDir = path.join(process.cwd(), 'whatsapp_auth');
const baileys = require('@whiskeysockets/baileys');
(async () => {
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await baileys.useMultiFileAuthState(authDir);
  const sock = baileys.makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['NutraflowCRM', 'Desktop', '1.0'],
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    console.log('CONN UPDATE', JSON.stringify(update));
    if (update.qr) {
      console.log('QR TEXT LENGTH', update.qr.length);
    }
  });
  sock.ev.on('connection.open', () => {
    console.log('OPENED');
  });
})();
