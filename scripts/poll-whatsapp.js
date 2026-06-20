const fetch = globalThis.fetch || require('node-fetch');
const url = 'http://localhost:3000/api/whatsapp';

(async () => {
  console.log('Polling', url, 'every 2s. Press Ctrl+C to stop.');
  while (true) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      const now = new Date().toISOString();
      const status = json?.status ?? 'no-status';
      const hasQr = !!json?.qrcode;
      const qrLen = hasQr ? json.qrcode.length : 0;
      console.log(`${now} | status=${status} | qr=${hasQr ? 'yes' : 'no'} | qrcode.len=${qrLen}`);
      if (status === 'connected' || status === 'open') {
        console.log('Session connected!');
        process.exit(0);
      }
    } catch (err) {
      console.error('Poll error:', err?.message || err);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
})();
