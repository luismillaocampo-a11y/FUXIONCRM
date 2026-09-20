const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/media__1785092365837.png';
const previewPng = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/final_icon_preview.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processSymmetricalIcon() {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  // Find exact min/max bounds of green neon stroke
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (g > 120 && g > r * 1.15 && g > b * 1.15) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const strokeWidth = maxX - minX;
  const strokeHeight = maxY - minY;
  const centerX = Math.floor((minX + maxX) / 2);
  const centerY = Math.floor((minY + maxY) / 2);

  // Determine maximum square size centered at (centerX, centerY) that fits inside the image
  const maxRadius = Math.min(centerX, centerY, width - centerX, height - centerY);
  const strokeRadius = Math.max(strokeWidth, strokeHeight) / 2;
  const targetRadius = Math.min(maxRadius, strokeRadius * 1.07);

  const cropSize = Math.floor(targetRadius * 2);
  const left = Math.floor(centerX - targetRadius);
  const top = Math.floor(centerY - targetRadius);

  const targetSize = 256;
  const rx = 44; // Symmetrical smooth corner radius

  const maskSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="0" y="0" width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#ffffff" shape-rendering="geometricPrecision"/>
  </svg>`);

  const processed = await sharp(src)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(targetSize, targetSize, { kernel: sharp.kernel.lanczos3 })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(previewPng, processed);
  fs.writeFileSync(iconPng, processed);
  fs.writeFileSync(logoAv, processed);

  console.log(`✅ Perfectly symmetrical crop complete. Center: (${centerX}, ${centerY}), Crop size: ${cropSize}`);
}

processSymmetricalIcon().catch(err => {
  console.error('Error cropping symmetrical icon:', err);
  process.exit(1);
});
