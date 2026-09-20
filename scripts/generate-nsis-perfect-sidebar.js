const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Jimp } = require('jimp');

async function generatePerfectNSISGraphics() {
  console.log('=== GENERATING STUNNING 24-BIT RGB NSIS INSTALLER SIDEBAR & HEADER ===');

  const publicDir = path.join(process.cwd(), 'public');
  const iconPath = path.join(publicDir, 'final_icon.png');
  const sidebarBmp = path.join(publicDir, 'installerSidebar.bmp');
  const headerBmp = path.join(publicDir, 'installerHeader.bmp');
  const tempPngSidebar = path.join(publicDir, 'temp_sidebar.png');
  const tempPngHeader = path.join(publicDir, 'temp_header.png');

  // 1. Create 164x314 px stunning sidebar SVG
  const sidebarSvg = `
  <svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#061210" />
        <stop offset="40%" stop-color="#0a1c18" />
        <stop offset="100%" stop-color="#040a09" />
      </linearGradient>
      
      <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00e676" />
        <stop offset="100%" stop-color="#05cd99" />
      </linearGradient>

      <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#112923" />
        <stop offset="100%" stop-color="#081411" />
      </linearGradient>
    </defs>

    <!-- Main Solid Background -->
    <rect width="164" height="314" fill="url(#bg)" />

    <!-- Outer Neon Top & Bottom Accents -->
    <rect x="0" y="0" width="164" height="5" fill="url(#neonGlow)" />
    <rect x="0" y="309" width="164" height="5" fill="url(#neonGlow)" />

    <!-- Cybernetic grid patterns -->
    <circle cx="82" cy="130" r="65" stroke="#00e676" stroke-width="1" stroke-dasharray="3,3" opacity="0.4" />
    <circle cx="82" cy="130" r="75" stroke="#05cd99" stroke-width="1" fill="none" opacity="0.25" />

    <!-- Center Card Frame -->
    <rect x="12" y="16" width="140" height="282" rx="10" fill="url(#cardBg)" stroke="#00e676" stroke-width="1.5" />

    <!-- Inner Glow Ring -->
    <circle cx="82" cy="125" r="48" fill="#00e676" opacity="0.15" />

    <!-- Text Branding -->
    <text x="82" y="225" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#00e676" text-anchor="middle" letter-spacing="1">ASISTENTE</text>
    <text x="82" y="242" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1">VIRTUAL</text>
    <text x="82" y="260" font-family="Arial, Helvetica, sans-serif" font-weight="normal" font-size="9" fill="#05cd99" text-anchor="middle">IA &amp; CRM WhatsApp</text>
    
    <rect x="42" y="272" width="80" height="2" rx="1" fill="url(#neonGlow)" />
  </svg>
  `;

  let sidebarBase = await sharp(Buffer.from(sidebarSvg))
    .resize(164, 314)
    .flatten({ background: { r: 6, g: 18, b: 16 } })
    .toBuffer();

  if (fs.existsSync(iconPath)) {
    const iconResized = await sharp(iconPath).resize(72, 72).toBuffer();
    sidebarBase = await sharp(sidebarBase)
      .composite([{ input: iconResized, top: 89, left: 46 }])
      .flatten({ background: { r: 6, g: 18, b: 16 } })
      .toBuffer();
  }

  await sharp(sidebarBase).png().toFile(tempPngSidebar);

  // Read PNG with Jimp and save as BMP
  const imgSidebar = await Jimp.read(tempPngSidebar);
  await imgSidebar.write(sidebarBmp);
  if (fs.existsSync(tempPngSidebar)) fs.unlinkSync(tempPngSidebar);
  console.log('✅ Generated 24-bit BMP installerSidebar.bmp (164x314)');

  // 2. Create Header Image (150x57 px)
  const headerSvg = `
  <svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
    <rect width="150" height="57" fill="#061210" />
    <rect x="0" y="54" width="150" height="3" fill="#00e676" />
    <text x="85" y="32" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="#00e676" text-anchor="middle">ASISTENTE VIRTUAL</text>
  </svg>
  `;

  let headerBase = await sharp(Buffer.from(headerSvg))
    .resize(150, 57)
    .flatten({ background: { r: 6, g: 18, b: 16 } })
    .toBuffer();

  if (fs.existsSync(iconPath)) {
    const iconHeader = await sharp(iconPath).resize(38, 38).toBuffer();
    headerBase = await sharp(headerBase)
      .composite([{ input: iconHeader, top: 9, left: 10 }])
      .flatten({ background: { r: 6, g: 18, b: 16 } })
      .toBuffer();
  }

  await sharp(headerBase).png().toFile(tempPngHeader);
  const imgHeader = await Jimp.read(tempPngHeader);
  await imgHeader.write(headerBmp);
  if (fs.existsSync(tempPngHeader)) fs.unlinkSync(tempPngHeader);

  console.log('✅ Generated 24-bit BMP installerHeader.bmp (150x57)');
}

generatePerfectNSISGraphics().catch(console.error);
