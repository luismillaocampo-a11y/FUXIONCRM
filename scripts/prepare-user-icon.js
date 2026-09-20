const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/selected_bottom_left_icon.png';
const previewPng = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/final_icon_preview.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processIcon() {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  const rgbaBuffer = Buffer.alloc(width * height * 4);

  // Replace outer white/grey background pixels with 100% true transparency
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    rgbaBuffer[i * 4] = r;
    rgbaBuffer[i * 4 + 1] = g;
    rgbaBuffer[i * 4 + 2] = b;

    // Check if pixel belongs to the outer white/light background
    if (r > 200 && g > 200 && b > 200) {
      rgbaBuffer[i * 4 + 3] = 0; // 100% Transparent
    } else {
      rgbaBuffer[i * 4 + 3] = 255;
    }
  }

  const transparentImage = sharp(rgbaBuffer, {
    raw: { width, height, channels: 4 }
  });

  // Apply smooth rounded corner mask to the icon button
  const targetSize = 256;
  const rx = 50;

  const maskSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="0" y="0" width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#ffffff" />
  </svg>`);

  const finalIcon = await transparentImage
    .trim()
    .resize(targetSize, targetSize, { fit: 'cover' })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(previewPng, finalIcon);
  fs.writeFileSync(iconPng, finalIcon);
  fs.writeFileSync(logoAv, finalIcon);

  console.log('✅ Final user icon processed and saved to preview & public folder.');
}

processIcon().catch(err => {
  console.error('Error processing icon:', err);
  process.exit(1);
});
