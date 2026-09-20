const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/selected_bottom_left_icon.png';
const previewPng = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/final_icon_preview.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processMatteIcon() {
  // 1. Crop center region containing the WhatsApp green speech bubble & silver bot face
  const meta = await sharp(src).metadata();
  const width = meta.width || 512;
  const height = meta.height || 512;

  const cropSize = Math.floor(width * 0.76);
  const left = Math.floor((width - cropSize) / 2);
  const top = Math.floor((height - cropSize) / 2) - 15; // slightly higher to center the bubble

  const bubbleBuffer = await sharp(src)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 2. Create clean matte dark obsidian container with neon green border (NO mirror/glossy glare)
  const targetSize = 256;
  const rx = 52;

  const containerSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="2" y="2" width="${targetSize - 4}" height="${targetSize - 4}" rx="${rx}" ry="${rx}" fill="#0b0e19"/>
    <rect x="5" y="5" width="${targetSize - 10}" height="${targetSize - 10}" rx="${rx - 3}" ry="${rx - 3}" fill="none" stroke="#10b981" stroke-width="4.5" stroke-opacity="0.9"/>
  </svg>`);

  // 3. Composite the large green WhatsApp speech bubble & bot face onto the matte neon tile
  const finalIcon = await sharp(containerSvg)
    .composite([{ input: bubbleBuffer, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(previewPng, finalIcon);
  fs.writeFileSync(iconPng, finalIcon);
  fs.writeFileSync(logoAv, finalIcon);

  console.log('✅ Clean matte icon with neon green border created at public/icon.png');
}

processMatteIcon().catch(err => {
  console.error('Error creating matte icon:', err);
  process.exit(1);
});
