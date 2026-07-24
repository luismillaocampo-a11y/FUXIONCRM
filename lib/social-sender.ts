import { db } from '@/lib/db';

interface SendSocialMessageParams {
  recipientId: string;
  messageText: string;
  channel: 'instagram' | 'facebook';
}

/**
 * Servicio para enviar respuestas automáticas o manuales a Instagram Direct y Facebook Messenger
 * utilizando la Meta Graph API v18.0
 */
export async function sendSocialMessage({ recipientId, messageText, channel }: SendSocialMessageParams): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const pageAccessToken = await db.getSystemSetting(`${channel}_access_token`) || process.env.META_PAGE_ACCESS_TOKEN || '';
    
    if (!pageAccessToken) {
      console.warn(`[social-sender] ADVERTENCIA: No se ha configurado el Token de Acceso para ${channel}. El mensaje no pudo enviarse.`);
      return { success: false, error: `Falta configurar el Token de Acceso para ${channel}` };
    }

    const cleanRecipientId = recipientId.replace(/^(ig_|fb_)/, '');

    // Endpoint Graph API de Meta
    const url = channel === 'instagram' 
      ? `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`
      : `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;

    const payload = {
      recipient: { id: cleanRecipientId },
      message: { text: messageText }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[social-sender] Error al enviar respuesta a ${channel}:`, data);
      return { success: false, error: data.error?.message || 'Error en la Meta Graph API' };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[social-sender] Excepción enviando a ${channel}:`, error);
    return { success: false, error: error.message };
  }
}
