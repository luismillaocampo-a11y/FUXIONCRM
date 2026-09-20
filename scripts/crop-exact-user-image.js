const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/media__1785092365837.png';
const previewPng = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/final_icon_preview.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processExactUserImage() {
  const meta = await sharp(src).metadata();
  const width = meta.width;
  const height = meta.height;

  // Crop slightly inside to capture precisely the dark tile and its rounded corners
  const cropLeft = Math.floor(width * 0.03);
  const cropTop = Math.floor(height * 0.03);
  const cropSize = Math.floor(width * 0.94);

  const targetSize = 256;
  const rx = 46;

  // Mask SVG for precise rounded corners
  const maskSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <rect x="0" y="0" width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#ffffff" shape-rendering="geometricPrecision"/>
  </svg>`);

  const processed = await sharp(src)
    .extract({ left: cropLeft, top: cropTop, width: cropSize, height: cropSize })
    .resize(targetSize, targetSize, { kernel: sharp.kernel.lanczos3 })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(previewPng, processed);
  fs.writeFileSync(iconPng, processed);
  fs.writeFileSync(logoAv, processed);

  console.log('✅ Exact user image processed and saved cleanly without extra borders!');
}

processExactUserImage().catch(err => {
  console.error('Error processing exact user image:', err);
  process.exit(1);
});
