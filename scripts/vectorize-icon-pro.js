const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/selected_bottom_left_icon.png';
const previewPng = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/final_icon_preview.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processVectorizedIcon() {
  // 1. Load high-res 1024x1024 source image
  const highResSize = 1024;
  const highResRx = 200;

  // Render high-precision vector SVG mask with subpixel anti-aliasing
  const maskSvg = Buffer.from(`<svg width="${highResSize}" height="${highResSize}" viewBox="0 0 ${highResSize} ${highResSize}">
    <rect x="2" y="2" width="${highResSize - 4}" height="${highResSize - 4}" rx="${highResRx}" ry="${highResRx}" fill="#ffffff" shape-rendering="geometricPrecision"/>
  </svg>`);

  // 2. High-precision 4x supersampling crop & anti-aliased mask blending
  const supersampledBuffer = await sharp(src)
    .resize(highResSize, highResSize, { fit: 'cover' })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 3. High quality Lanczos3 kernel downscaling to 256x256 (eliminates all aliasing & jagged edges)
  const final256Buffer = await sharp(supersampledBuffer)
    .resize(256, 256, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  fs.writeFileSync(previewPng, final256Buffer);
  fs.writeFileSync(iconPng, final256Buffer);
  fs.writeFileSync(logoAv, final256Buffer);

  console.log('✅ Anti-aliased vector supersampled icon created with Lanczos3 precision at public/icon.png');
}

processVectorizedIcon().catch(err => {
  console.error('Error vectorizing icon:', err);
  process.exit(1);
});
