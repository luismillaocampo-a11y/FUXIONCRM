import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'alerts@fuxionflow.com';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@fuxionflow.com';

const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);

/**
 * Sends an email notification to the administrator.
 * If SMTP configuration is missing, it will log the email to process console
 * and write to a local log file inside the workspace for review.
 */
export async function sendEmailNotification(subject: string, bodyText: string, htmlContent?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[Notification Alert] Subject: "${subject}"`);

  if (hasSmtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for others
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: adminEmail,
        subject: subject,
        text: bodyText,
        html: htmlContent || bodyText.replace(/\n/g, '<br>')
      });

      console.log(`[Notification Alert] SMTP email sent successfully. Msg ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[Notification Alert] SMTP email dispatch failed:', error);
      // Fallback to local logs on failure
    }
  }

  // SIMULATION MODE
  // Create a log directory inside process workspace if not exist (only if writable)
  const logsDir = path.join(process.cwd(), 'scratch');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Skipping scratch directory creation (read-only environment):', err);
  }

  const logFilePath = path.join(logsDir, 'email_logs.txt');
  const emailLogEntry = `
========================================
TIMESTAMP: ${timestamp}
TO: ${adminEmail}
FROM: ${smtpFrom} (SIMULATED)
SUBJECT: ${subject}
----------------------------------------
BODY:
${bodyText}
========================================
\n`;

  try {
    fs.appendFileSync(logFilePath, emailLogEntry, 'utf-8');
    console.log(`[Notification Alert] Simulated email appended to: ${logFilePath}`);
  } catch (error) {
    console.error('[Notification Alert] Failed to write simulated email log:', error);
  }

  return { success: true, simulated: true, logPath: logFilePath };
}

/**
 * Specific alert for Payment Verification
 */
export async function alertPaymentVerification(lead: { name: string; phone: string; status: string }) {
  const subject = `⚠️ PAYMENT VERIFICATION REQUIRED: ${lead.name}`;
  const text = `
Dear Admin,

A customer is ready for payment verification.

Lead Details:
- Name: ${lead.name}
- Phone: ${lead.phone}
- Status: ${lead.status}

Please review the payment details in the Fuxion Flow CRM Dashboard and confirm the transaction.

Best regards,
Fuxion Flow Automation Bot
`;

  return sendEmailNotification(subject, text);
}

/**
 * Specific alert for Shadow Mode (Knowledge Gap)
 */
export async function alertKnowledgeGap(lead: { name: string; phone: string }, question: string) {
  const subject = `🚨 KNOWLEDGE GAP DETECTED: Chat paused for ${lead.name}`;
  const text = `
Dear Admin,

A customer asked a question that the AI bot could not answer based on the knowledge base.
The bot has been PAUSED (Shadow Mode active) for this customer.

Lead Details:
- Name: ${lead.name}
- Phone: ${lead.phone}

Unanswered Question:
"${question}"

Action Required:
Go to the CRM Dashboard under "Knowledge Gaps", provide the answer, and reactivate the bot.

Best regards,
Fuxion Flow Automation Bot
`;

  return sendEmailNotification(subject, text);
}
