const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  const url = 'http://localhost:3000/api/whatsapp';
  console.log('POST refresh');
  const refresh = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
  console.log('status', refresh.status);
  console.log(await refresh.text());
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const res = await fetch(url);
    const text = await res.text();
    console.log('GET', i, res.status, text);
  }
})();
