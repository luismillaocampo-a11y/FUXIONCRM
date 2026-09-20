const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/asistente_virtual_whatsapp_icon_1785086756100.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processIcon() {
  // Bounding box of the dark rounded button inside the 1024x1024 source image
  // The dark button spans from (left: 236, top: 120) with width 552 x height 552
  const cropLeft = 236;
  const cropTop = 120;
  const cropSize = 552;

  const targetSize = 256;
  const rx = 48; // Smooth rounded corners matching the button's exact border radius

  // Create smooth rounded rectangle mask for alpha transparency
  const maskSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="0" y="0" width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#ffffff" />
  </svg>`);

  const processed = await sharp(src)
    .extract({ left: cropLeft, top: cropTop, width: cropSize, height: cropSize })
    .resize(targetSize, targetSize)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(iconPng, processed);
  fs.writeFileSync(logoAv, processed);
  console.log('✅ Exact dark button logo extracted with 100% true transparent background!');
}

processIcon().catch(err => {
  console.error('Error processing icon:', err);
  process.exit(1);
});
