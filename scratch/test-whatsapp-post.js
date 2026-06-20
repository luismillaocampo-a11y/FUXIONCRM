const url = 'http://localhost:3000/api/whatsapp';

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' })
    });
    console.log('POST status', res.status);
    console.log('POST body', await res.text());

    const get = await fetch(url);
    console.log('GET status', get.status);
    console.log('GET body', await get.text());
  } catch (err) {
    console.error(err);
  }
})();
