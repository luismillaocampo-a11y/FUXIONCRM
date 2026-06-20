const fs = require('fs');
const lines = fs.readFileSync('lib/db.ts', 'utf8').split('\n');
lines.forEach((line, idx) => {
  if (line.includes('getWhatsappSession') || line.includes('saveWhatsappSession') || line.includes('clearWhatsappSession') || line.includes('export const db')) {
    console.log((idx + 1) + ': ' + line);
  }
});
