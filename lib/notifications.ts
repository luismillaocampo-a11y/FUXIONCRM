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
  
  // Formatear teléfono si viene con código de país o si es LID
  let displayPhone = lead.phone || 'WhatsApp';
  const cleanDigits = displayPhone.replace(/\D/g, '');
  if (cleanDigits.length === 11 && cleanDigits.startsWith('51')) {
    displayPhone = `+51 ${cleanDigits.slice(2, 5)} ${cleanDigits.slice(5, 8)} ${cleanDigits.slice(8)}`;
  } else if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
    displayPhone = `+51 ${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6)}`;
  } else if (cleanDigits.length >= 14) {
    displayPhone = `WhatsApp (LID: ${cleanDigits.slice(-6)})`;
  } else if (displayPhone.startsWith('lead-') || !cleanDigits) {
    displayPhone = 'WhatsApp Directo';
  }

  const subject = `⚠️ VERIFICACIÓN DE PAGO REQUERIDA: ${lead.name} (${displayPhone})`;
  const text = `
Estimado Administrador,

Un cliente ha enviado su comprobante de pago para verificación.

📋 Detalles del Cliente:
• Nombre: ${lead.name}
• Celular / WhatsApp: ${displayPhone}
• Estado: ${lead.status}

🔹 Por favor, revisa la captura en la Bandeja de Mensajes de tu CRM para validar la acreditación.

Saludos cordiales,
Bot Inteligente ${companyName}
`;

  return sendEmailNotification(subject, text);
}

/**
 * Alerta específica para Venta Cerrada / Pedido Completado
 */
export async function alertSaleConverted(lead: { name: string; phone: string; totalAmount?: string; product?: string }) {
  const companyName = (await db.getSystemSetting('client_company_name')) || 'NutraFlow CRM';
  const subject = `🎉 ¡VENTA CERRADA CON ÉXITO!: ${lead.name}`;
  const text = `
=====================================================
            🎉 NUEVA VENTA CONFIRMADA EN NUTRAFLOW CRM
=====================================================

¡Felicitaciones! Se ha concretado una nueva venta a través de WhatsApp.

📋 DETALLES DE LA ORDEN:
-----------------------------------------------------
• Cliente:            ${lead.name}
• Teléfono / WhatsApp: ${lead.phone}
• Producto:           ${lead.product || 'Productos Fuxion'}
• Monto / Estado:     ${lead.totalAmount || 'Venta Concretada (Converted)'}
• Fecha y Hora:       ${new Date().toLocaleString('es-PE')}

🔹 ACCIÓN RECOMENDADA:
Ingresa al CRM para emitir la boleta/factura y programar el despacho con tu courier o motorizado.

Saludos cordiales,
Sistema Automatizado ${companyName}
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
 * Envía un mensaje de alerta por WhatsApp al administrador.
 * Modo local: por Baileys directo; sin número de admin configurado, por email.
 */
export async function sendWhatsAppToAdmin(message: string): Promise<void> {
  const adminPhone = (process.env.ADMIN_PHONE || process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, '');

  if (adminPhone) {
    try {
      const { whatsappService } = await import('./whatsapp-service');
      await whatsappService.initialize();
      await whatsappService.sendMessageToPhone(adminPhone, message);
      console.log(`[sendWhatsAppToAdmin] ✅ Alerta WhatsApp enviada al admin (${adminPhone})`);
      return;
    } catch (err) {
      console.error('[sendWhatsAppToAdmin] Fallo al enviar alerta WhatsApp al admin:', err);
    }
  }
  await sendEmailNotification(
    '🚨 NUEVO CLIENTE POR REGISTRAR - Alerta CRM',
    message
  );
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
