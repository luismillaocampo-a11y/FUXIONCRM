const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
const env = {};

if (fs.existsSync(envPath)) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = line.split('=');
      if (!key) return;
      env[key.trim()] = rest.join('=').trim();
    });
  } catch (err) {
    console.error('[Evolution API Monitor] Failed to read .env.local:', err.message);
  }
}

// Merge with process.env
const config = {
  evolutionApiUrl: process.env.EVOLUTION_API_URL || env.EVOLUTION_API_URL || '',
  smtpHost: process.env.SMTP_HOST || env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || env.SMTP_FROM || 'alerts@fuxionflow.com',
  adminEmail: process.env.ADMIN_EMAIL || env.ADMIN_EMAIL || 'admin@fuxionflow.com',
};

// Check if SMTP is configured
const hasSmtp = Boolean(config.smtpHost && config.smtpUser && config.smtpPass);

async function sendEmailAlert(url, errorMessage) {
  const subject = '🚨 ALERTA: Evolution API no responde';
  const bodyText = `El servidor de Evolution API en la dirección ${url} no responde.
Detalle del error: ${errorMessage}
Fecha/Hora: ${new Date().toLocaleString()}

Por favor, verifique el estado del servidor.`;

  console.log(`[Evolution API Monitor] [Email Alert] Subject: "${subject}"`);

  if (hasSmtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: config.smtpFrom,
        to: config.adminEmail,
        subject: subject,
        text: bodyText
      });

      console.log(`[Evolution API Monitor] SMTP Alert sent successfully. Msg ID: ${info.messageId}`);
    } catch (err) {
      console.error('[Evolution API Monitor] Failed to send SMTP alert email:', err.message);
    }
  } else {
    // Fallback: log alert locally to console and file
    const logDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (e) {}
    }
    const logFile = path.join(logDir, 'email_logs.txt');
    const logEntry = `
========================================
ALERTA DE CAÍDA DE SERVIDOR
TIMESTAMP: ${new Date().toISOString()}
TO: ${config.adminEmail}
FROM: ${config.smtpFrom} (SIMULATED)
SUBJECT: ${subject}
----------------------------------------
BODY:
${bodyText}
========================================
\n`;
    try {
      fs.appendFileSync(logFile, logEntry, 'utf-8');
      console.log(`[Evolution API Monitor] Simulated alert written to: ${logFile}`);
    } catch (e) {
      console.error('[Evolution API Monitor] Failed to write simulated alert log:', e.message);
    }
  }
}

async function checkEvolutionApi() {
  const url = config.evolutionApiUrl;
  if (!url) {
    console.warn('[Evolution API Monitor] EVOLUTION_API_URL is not set. Please configure it in .env.local to enable pinging.');
    return;
  }

  console.log(`[Evolution API Monitor] [${new Date().toLocaleTimeString()}] Pinging: ${url}...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    console.log(`[Evolution API Monitor] Server responded. Status: ${response.status}`);
  } catch (error) {
    const errorMsg = error.name === 'AbortError' ? 'Timeout (10 seconds elapsed)' : error.message;
    console.error(`[Evolution API Monitor] 🚨 CRITICAL ERROR: Server did not respond! Info: ${errorMsg}`);
    await sendEmailAlert(url, errorMsg);
  }
}

// Start immediately and run every 5 minutes
if (!config.evolutionApiUrl) {
  console.warn('[Evolution API Monitor] EVOLUTION_API_URL is missing in environment/env.local.');
  console.warn('The monitor will start, but will not perform checks until the variable is configured.');
}

checkEvolutionApi();
const intervalMs = 5 * 60 * 1000;
setInterval(checkEvolutionApi, intervalMs);
console.log(`[Evolution API Monitor] Started successfully. Check frequency: every 5 minutes (${intervalMs}ms)`);
