const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/pure_clean_whatsapp_ai_icon_1785090209333.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function createPristineIcon() {
  // Read raw RGBA pixels
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  const rgbaBuffer = Buffer.alloc(width * height * 4);

  // Turn plain white/light background into 100% TRUE ALPHA TRANSPARENCY
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    rgbaBuffer[i * 4] = r;
    rgbaBuffer[i * 4 + 1] = g;
    rgbaBuffer[i * 4 + 2] = b;

    // Check if pixel belongs to the light white background
    if (r > 215 && g > 215 && b > 215) {
      rgbaBuffer[i * 4 + 3] = 0; // 100% Transparent
    } else {
      rgbaBuffer[i * 4 + 3] = 255; // Opaque logo pixel
    }
  }

  // Create clean image with transparent background
  const transparentLogo = sharp(rgbaBuffer, {
    raw: { width, height, channels: 4 }
  });

  // Trim transparent padding and resize to 256x256
  const finalBuffer = await transparentLogo
    .trim()
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // Save clean PNG icon
  fs.writeFileSync(iconPng, finalBuffer);
  fs.writeFileSync(logoAv, finalBuffer);

  console.log('✅ Pristine 3D logo created with 100% true transparent background (No square, No text, No grid)');
}

createPristineIcon().catch(err => {
  console.error('Error creating pristine icon:', err);
  process.exit(1);
});
