const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const url = 'http://localhost:3000/api/whatsapp';

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' })
    });
    console.log('POST status', res.status, await res.text());

    for (let i = 0; i < 10; i += 1) {
      await wait(1000);
      const get = await fetch(url);
      const body = await get.json();
      console.log('poll', i + 1, get.status, body);
    }
  } catch (err) {
    console.error(err);
  }
})();
