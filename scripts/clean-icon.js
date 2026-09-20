const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/asistente_virtual_whatsapp_icon_1785086756100.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processIcon() {
  // Crop tightly ONLY to the inner dark button, ignoring all outer painted checkerboard pixels
  const extractWidth = 480;
  const extractHeight = 480;
  const left = 272;
  const top = 145;

  const targetSize = 256;
  const rx = 52; // smooth rounded corners for Windows icon

  const maskSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="0" y="0" width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#ffffff" />
  </svg>`);

  const processed = await sharp(src)
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .resize(targetSize, targetSize)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(iconPng, processed);
  fs.writeFileSync(logoAv, processed);
  console.log('✅ Cleaned tight icon created without any checkerboard pixels at public/icon.png');
}

processIcon().catch(err => {
  console.error('Error processing icon:', err);
  process.exit(1);
});
