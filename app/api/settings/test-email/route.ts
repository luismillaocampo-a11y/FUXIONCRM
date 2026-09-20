import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const companyName = (await db.getSystemSetting('client_company_name')) || 'Fuxion Flow';
    const host = (await db.getSystemSetting('smtp_host')) || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt((await db.getSystemSetting('smtp_port')) || process.env.SMTP_PORT || '587');
    const user = (await db.getSystemSetting('smtp_user')) || process.env.SMTP_USER || '';
    const pass = (await db.getSystemSetting('smtp_pass')) || process.env.SMTP_PASS || '';
    const from = (await db.getSystemSetting('smtp_from')) || process.env.SMTP_FROM || `"${companyName}" <${user}>`;
    const adminEmail = (await db.getSystemSetting('admin_email')) || process.env.ADMIN_EMAIL || user;

    if (!user || !pass) {
      return NextResponse.json({
        success: false,
        error: 'Falta ingresar el Usuario y la Contraseña SMTP en el formulario.'
      }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: user,
        pass: pass
      }
    });

    const timestamp = new Date().toLocaleString('es-PE');
    const info = await transporter.sendMail({
      from: from,
      to: adminEmail || user,
      subject: `🧪 CORREO DE PRUEBA - ${companyName}`,
      text: `¡Hola! Este es un correo de prueba enviado desde tu CRM de ${companyName} el ${timestamp}.\n\nSi recibiste este mensaje, la configuración de tu Servidor SMTP está 100% activa y lista para recibir alertas automáticas.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0c0f1d; color: #ffffff; border-radius: 16px; border: 1px solid #1e293b; max-width: 600px;">
          <h2 style="color: #00a884; margin-top: 0; font-size: 20px;">🧪 ¡Conexión SMTP Exitosa!</h2>
          <p style="font-size: 14px; color: #cbd5e1; leading-height: 1.6;">Este es un correo de prueba enviado desde tu sistema de gestión <strong>${companyName}</strong> el <code>${timestamp}</code>.</p>
          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 13px; margin-bottom: 0;">Si has recibido este correo, tus alertas automáticas por dudas de clientes, registros y compras llegarán sin problemas a tu bandeja de entrada.</p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: `¡Correo de prueba enviado con éxito a ${adminEmail || user}!`,
      messageId: info.messageId
    });
  } catch (error: any) {
    console.error('[test-email] Error probando servidor SMTP:', error);
    
    let rawMsg = error.message || '';
    let helpMsg = rawMsg;

    if (rawMsg.includes('ENOTFOUND')) {
      helpMsg = `Error de Host SMTP: Servidor "${error.hostname || 'ingresado'}" no encontrado. Verifica si cometiste un error de tipeo (ejemplo: usar "smtp.gmail.com" en lugar de "smpt").`;
    } else if (rawMsg.includes('Invalid login') || rawMsg.includes('535-5.7.8')) {
      helpMsg = 'Error de Autenticación: Si usas Gmail, debes utilizar una "Contraseña de Aplicación" de 16 caracteres de Google, no tu contraseña personal.';
    } else if (rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ETIMEDOUT')) {
      helpMsg = `Error de Conexión: No se pudo conectar al puerto SMTP. Si usas puerto 587 (TLS), asegúrate de tener acceso a internet.`;
    }

    return NextResponse.json({
      success: false,
      error: helpMsg
    }, { status: 500 });
  }
}
