const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createNSISGraphics() {
  console.log('=== GENERATING CUSTOM NSIS INSTALLER BRANDING GRAPHICS ===');

  const publicDir = path.join(process.cwd(), 'public');
  const iconPath = path.join(publicDir, 'final_icon.png');
  const sidebarPath = path.join(publicDir, 'installerSidebar.bmp');
  const headerPath = path.join(publicDir, 'installerHeader.bmp');

  // 1. Generate Sidebar Image (164x314 px)
  // High-tech dark emerald gradient (#061412 -> #0b1a17) with glowing green accents and centered 3D Bot Icon
  const sidebarSvg = `
  <svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#091412" />
        <stop offset="50%" stop-color="#060c0b" />
        <stop offset="100%" stop-color="#0c231e" />
      </linearGradient>
      <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#00e676" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#05cd99" stop-opacity="0.05" />
      </linearGradient>
      <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="164" height="314" fill="url(#bgGrad)" />

    <!-- Ambient glowing curves -->
    <path d="M-20 40 Q 82 -20 184 60 T 184 300" stroke="#00e676" stroke-width="2" fill="none" opacity="0.3" filter="url(#neonGlow)" />
    <path d="M-40 220 Q 82 160 204 240" stroke="#05cd99" stroke-width="1.5" fill="none" opacity="0.25" />

    <!-- Decorative Top & Bottom Border strokes -->
    <rect x="0" y="0" width="164" height="4" fill="#00e676" />
    <rect x="0" y="310" width="164" height="4" fill="#05cd99" />

    <!-- Decorative Frame Box -->
    <rect x="12" y="16" width="140" height="282" rx="12" fill="none" stroke="url(#glowGrad)" stroke-width="1.5" />

    <!-- Bottom Branding Text -->
    <text x="82" y="275" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="#00e676" text-anchor="middle" letter-spacing="1">ASISTENTE</text>
    <text x="82" y="290" font-family="Arial, sans-serif" font-weight="bold" font-size="11" fill="#e9edef" text-anchor="middle" letter-spacing="1">VIRTUAL</text>
  </svg>
  `;

  // Composite 3D Bot Icon in the middle of sidebar (80x80 px)
  const sidebarBase = await sharp(Buffer.from(sidebarSvg)).toBuffer();
  let iconResized = null;
  if (fs.existsSync(iconPath)) {
    iconResized = await sharp(iconPath).resize(84, 84).toBuffer();
  }

  const sidebarComposite = iconResized
    ? await sharp(sidebarBase)
        .composite([{ input: iconResized, top: 105, left: 40 }])
        .toBuffer()
    : sidebarBase;

  await sharp(sidebarComposite).toFile(sidebarPath);
  console.log('✅ Generated custom installerSidebar.bmp (164x314)');

  // 2. Generate Header Image (150x57 px)
  const headerSvg = `
  <svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
    <rect width="150" height="57" fill="#091412" />
    <text x="75" y="34" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#00e676" text-anchor="middle">ASISTENTE VIRTUAL</text>
  </svg>
  `;

  const headerBase = await sharp(Buffer.from(headerSvg)).toBuffer();
  let iconSmall = null;
  if (fs.existsSync(iconPath)) {
    iconSmall = await sharp(iconPath).resize(36, 36).toBuffer();
  }

  const headerComposite = iconSmall
    ? await sharp(headerBase)
        .composite([{ input: iconSmall, top: 10, left: 10 }])
        .toBuffer()
    : headerBase;

  await sharp(headerComposite).toFile(headerPath);
  console.log('✅ Generated custom installerHeader.bmp (150x57)');
}

createNSISGraphics().catch(console.error);
