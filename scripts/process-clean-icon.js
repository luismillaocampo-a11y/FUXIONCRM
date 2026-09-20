const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/LUIZ/.gemini/antigravity-ide/brain/fa733ada-7011-45cd-91c4-ae361812da3a/pure_clean_whatsapp_ai_icon_1785090209333.png';
const iconPng = path.join(process.cwd(), 'public/icon.png');
const logoAv = path.join(process.cwd(), 'public/logo-av.png');

async function processIcon() {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 4 channels RGBA

  const rgbaBuffer = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    rgbaBuffer[i * 4] = r;
    rgbaBuffer[i * 4 + 1] = g;
    rgbaBuffer[i * 4 + 2] = b;

    // Convert plain white background into 100% transparent alpha
    if (r > 230 && g > 230 && b > 230) {
      rgbaBuffer[i * 4 + 3] = 0; // Transparent
    } else {
      rgbaBuffer[i * 4 + 3] = 255; // Opaque
    }
  }

  // Create clean sharp image from RGBA buffer
  const cleanImage = sharp(rgbaBuffer, {
    raw: { width, height, channels: 4 }
  });

  // Trim empty transparent space around the icon
  const trimmedBuffer = await cleanImage.trim().png().toBuffer();

  // Composite on a dark sleek rounded square app container (256x256)
  const targetSize = 256;
  const rx = 52;

  // Dark obsidian rounded tile background with subtle emerald glowing border
  const containerSvg = Buffer.from(`<svg width="${targetSize}" height="${targetSize}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0c101d"/>
        <stop offset="100%" stop-color="#060913"/>
      </linearGradient>
      <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="${targetSize - 4}" height="${targetSize - 4}" rx="${rx}" ry="${rx}" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="3.5"/>
  </svg>`);

  const innerIconResized = await sharp(trimmedBuffer)
    .resize(185, 185, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const finalIcon = await sharp(containerSvg)
    .composite([{ input: innerIconResized, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(iconPng, finalIcon);
  fs.writeFileSync(logoAv, finalIcon);
  console.log('✅ Created pristine high-res icon at public/icon.png and public/logo-av.png');
}

processIcon().catch(err => {
  console.error('Error processing icon:', err);
  process.exit(1);
});
