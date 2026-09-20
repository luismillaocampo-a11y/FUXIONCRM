import { whatsappService } from './whatsapp-service';

/**
 * Envía un mensaje de WhatsApp por la conexión local Baileys (QR).
 * Modo local: sin Meta Cloud API ni Evolution (código retirado).
 */
export async function sendWhatsAppMessageDynamic(phone: string, text: string, mediaUrl?: string, jidOverride?: string): Promise<{ success: boolean; api: 'baileys' }> {
  const hasText = text && text.toString().trim();
  if (!hasText && !mediaUrl) {
    throw new Error('Message text or mediaUrl is required');
  }

  await whatsappService.initialize();
  await whatsappService.sendMessageToPhone(phone, text, mediaUrl, jidOverride);
  console.log(`[whatsapp-sender] Sent message to ${phone} via local Baileys service`);
  return { success: true, api: 'baileys' };
}
