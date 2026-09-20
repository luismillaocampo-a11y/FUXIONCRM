const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPng = path.join(process.cwd(), 'public/icon.png');
const outputIco = path.join(process.cwd(), 'public/icon.ico');

pngToIco(inputPng)
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('✅ Binary ICO generated cleanly:', outputIco, 'Size:', buf.length);
  })
  .catch(err => {
    console.error('Error generating ICO:', err);
    process.exit(1);
  });
