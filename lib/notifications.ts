import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

/**
 * Obtiene dinámicamente las credenciales SMTP de la base de datos local (o variables de entorno como respaldo)
 */
async function getSmtpConfig() {
  const host = (await db.getSystemSetting('smtp_host')) || process.env.SMTP_HOST || '';
  const port = parseInt((await db.getSystemSetting('smtp_port')) || process.env.SMTP_PORT || '587');
  const user = (await db.getSystemSetting('smtp_user')) || process.env.SMTP_USER || '';
  const pass = (await db.getSystemSetting('smtp_pass')) || process.env.SMTP_PASS || '';
  const from = (await db.getSystemSetting('smtp_from')) || process.env.SMTP_FROM || `"Alertas CRM" <${user || 'alertas@nutraflow.com'}>`;
  const adminEmail = (await db.getSystemSetting('admin_email')) || process.env.ADMIN_EMAIL || user || 'admin@nutraflow.com';

  const hasConfig = Boolean(host && user && pass);

  return { host, port, user, pass, from, adminEmail, hasConfig };
}

/**
 * Envía una notificación por correo electrónico al administrador.
 */
export async function sendEmailNotification(subject: string, bodyText: string, htmlContent?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[Notification Alert] Intentando enviar correo: "${subject}"`);

  const config = await getSmtpConfig();

  if (config.hasConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465, // true para puerto 465 (SSL), false para 587 (TLS)
        auth: {
          user: config.user,
          pass: config.pass
        }
      });

      const info = await transporter.sendMail({
        from: config.from,
        to: config.adminEmail,
        subject: subject,
        text: bodyText,
        html: htmlContent || bodyText.replace(/\n/g, '<br>')
      });

      console.log(`[Notification Alert] Correo enviado exitosamente vía SMTP. ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[Notification Alert] Error al despachar correo por SMTP:', error);
      // Caer en modo simulación de respaldo si falla el servidor
    }
  }

  // MODO SIMULACIÓN DE RESPALDO
  const logsDir = path.join(process.cwd(), 'scratch');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Saltando creación de directorio scratch:', err);
  }

  const logFilePath = path.join(logsDir, 'email_logs.txt');
  const emailLogEntry = `
========================================
TIMESTAMP: ${timestamp}
TO: ${config.adminEmail}
FROM: ${config.from} (SIMULADO)
SUBJECT: ${subject}
----------------------------------------
BODY:
${bodyText}
========================================
\n`;

  try {
    fs.appendFileSync(logFilePath, emailLogEntry, 'utf-8');
    console.log(`[Notification Alert] Correo simulado guardado en: ${logFilePath}`);
  } catch (error) {
    console.error('[Notification Alert] Error al escribir en el registro de simulación:', error);
  }

  return { success: true, simulated: true, logPath: logFilePath };
}

/**
 * Alerta específica para Verificación de Pagos
 */
export async function alertPaymentVerification(lead: { name: string; phone: string; status: string }) {
  const companyName = (await db.getSystemSetting('client_company_name')) || 'Fuxion Flow';
  const subject = `⚠️ VERIFICACIÓN DE PAGO REQUERIDA: ${lead.name}`;
  const text = `
Estimado Administrador,

Un cliente ha enviado su información para verificación de pago.

Detalles del Cliente:
- Nombre: ${lead.name}
- Celular: ${lead.phone}
- Estado: ${lead.status}

Por favor, revisa el comprobante en la Bandeja de Mensajes de tu CRM y confirma la transacción.

Saludos cordiales,
Bot Inteligente ${companyName}
`;

  return sendEmailNotification(subject, text);
}

/**
 * Alerta específica para Dudas No Respondidas de la IA (Knowledge Gaps)
 */
export async function alertKnowledgeGap(lead: { name: string; phone: string }, question: string) {
  const companyName = (await db.getSystemSetting('client_company_name')) || 'Fuxion Flow';
  const subject = `🚨 DUDA NO RESPONDIDA: Chat pausado para ${lead.name}`;
  const text = `
Estimado Administrador,

Un cliente realizó una consulta que la Inteligencia Artificial no pudo responder con la base de conocimientos actual.
La atención automática ha sido PAUSADA para este cliente.

Detalles del Cliente:
- Nombre: ${lead.name}
- Celular: ${lead.phone}

Pregunta Realizada:
"${question}"

Acción Requerida:
Ingresa al CRM bajo la pestaña "Dudas Pendientes", proporciona la respuesta oficial y reactiva el bot.

Saludos cordiales,
Bot Inteligente ${companyName}
`;

  return sendEmailNotification(subject, text);
}

/**
 * Envía un mensaje de alerta por WhatsApp al administrador
 */
export async function sendWhatsAppToAdmin(message: string): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE || process.env.WHATSAPP_ADMIN_NUMBER || '';
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const evolutionKey = process.env.EVOLUTION_API_KEY;
  const evolutionInstance = process.env.EVOLUTION_API_INSTANCE;

  if (evolutionUrl && evolutionKey && evolutionInstance) {
    try {
      const endpoint = `${evolutionUrl.replace(/\/$/, '')}/message/sendText/${evolutionInstance}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionKey
        },
        body: JSON.stringify({ number: adminPhone, text: message })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[sendWhatsAppToAdmin] Error Evolution API: ${res.status} - ${err}`);
      } else {
        console.log(`[sendWhatsAppToAdmin] ✅ Alerta WhatsApp enviada al admin (${adminPhone})`);
      }
    } catch (err) {
      console.error('[sendWhatsAppToAdmin] Fallo al enviar alerta WhatsApp al admin:', err);
    }
  } else {
    await sendEmailNotification(
      '🚨 NUEVO CLIENTE POR REGISTRAR - Alerta CRM',
      message
    );
  }
}

/**
 * Alerta para registro oficial de cliente
 */
export async function alertRegistration(data: {
  nombre: string;
  dni: string;
  celular: string;
  correo: string;
  leadId: string;
  crmBaseUrl?: string;
}): Promise<void> {
  const crmLink = data.crmBaseUrl
    ? `${data.crmBaseUrl}/?lead=${encodeURIComponent(data.leadId)}`
    : `https://tu-crm.com/?lead=${encodeURIComponent(data.leadId)}`;

  const message =
`🚨 ¡NUEVO CLIENTE POR REGISTRAR! 🚨
El bot ha pausado la conversación porque el cliente solicitó el registro oficial.

📋 Datos del Cliente:
- Nombre: ${data.nombre}
- DNI: ${data.dni}
- Celular: ${data.celular}
- Correo: ${data.correo}

🔗 Enlace directo al chat en el CRM:
${crmLink}`;

  await sendWhatsAppToAdmin(message);
}
