import { db } from './db';
import { whatsappService } from './whatsapp-service';

/**
 * Sends a WhatsApp message to a phone number.
 * Automatically detects and adapts to the configured service:
 * 1. Meta Cloud API (Official) -> If the URL contains graph.facebook.com or facebook.com
 * 2. Evolution API (Open Source) -> If an external URL is configured (non-Meta)
 * 3. Local Baileys connection (QR code) -> Default fallback if no external API is configured
 */
export async function sendWhatsAppMessageDynamic(phone: string, text: string, mediaUrl?: string): Promise<{ success: boolean; api: 'meta' | 'evolution' | 'baileys' }> {
  const hasText = text && text.toString().trim();
  if (!hasText && !mediaUrl) {
    throw new Error('Message text or mediaUrl is required');
  }

  let url = await db.getSystemSetting('whatsapp_api_url');
  let apiKey = await db.getSystemSetting('whatsapp_api_key');
  let instance = await db.getSystemSetting('whatsapp_instance');

  // Fallback to environment variables
  if (!url) url = process.env.EVOLUTION_API_URL || '';
  if (!apiKey) apiKey = process.env.EVOLUTION_API_KEY || '';
  if (!instance) instance = process.env.EVOLUTION_API_INSTANCE || '';

  if (url && apiKey && instance) {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanUrl = url.replace(/\/$/, '');
    
    // Check if it is Meta Cloud API (Official Graph URL)
    const isMeta = cleanUrl.includes('facebook.com') || cleanUrl.includes('graph.facebook.com');

    if (isMeta) {
      // 1. META OFFICIAL CLOUD API
      const endpoint = `${cleanUrl}/v20.0/${instance}/messages`;
      
      const payload = mediaUrl ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: {
          link: mediaUrl,
          caption: text ? text.toString().trim() : ""
        }
      } : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: text.toString().trim()
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[whatsapp-sender] Meta Cloud API returned error: ${response.status} - ${errorText}`);
        throw new Error(`Meta Cloud API send failed: ${response.status}`);
      }

      console.log(`[whatsapp-sender] Sent message to ${cleanPhone} via Meta Cloud API`);
      return { success: true, api: 'meta' };
    } else {
      // 2. EVOLUTION API (BAILEYS-BASED EXTERNAL GATEWAY)
      const endpoint = mediaUrl 
        ? `${cleanUrl}/message/sendMedia/${instance}` 
        : `${cleanUrl}/message/sendText/${instance}`;
      
      const payload = mediaUrl ? {
        number: cleanPhone,
        caption: text ? text.toString().trim() : "",
        media: mediaUrl,
        mediatype: 'image'
      } : {
        number: cleanPhone,
        text: text ? text.toString().trim() : ""
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[whatsapp-sender] Evolution API returned error: ${response.status} - ${errorText}`);
        throw new Error(`Evolution API send failed: ${response.status}`);
      }

      console.log(`[whatsapp-sender] Sent message to ${cleanPhone} via Evolution API`);
      return { success: true, api: 'evolution' };
    }
  } else {
    // 3. LOCAL BAILEYS CONNECTION (DEFAULT FALLBACK)
    await whatsappService.initialize();
    await whatsappService.sendMessageToPhone(phone, text, mediaUrl);
    console.log(`[whatsapp-sender] Sent message to ${phone} via local Baileys service`);
    return { success: true, api: 'baileys' };
  }
}
