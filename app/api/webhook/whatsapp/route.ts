import { NextResponse } from 'next/server';
import { queryKnowledgeBase, logRecommendedProduct, snapshotOrderForLead, sanitizeAiReply, stripInternalTagsForSending } from '@/lib/gemini';
import { alertKnowledgeGap, alertPaymentVerification, alertRegistration } from '@/lib/notifications';
import { whatsappService } from '@/lib/whatsapp-service';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';
import { getAiGloballyEnabled } from '@/lib/ai-settings';
import {
  timingSafeEqual,
  getWebhookVerifyToken,
  verifyMetaSignature,
} from '@/lib/webhook-auth';
import { getPhoneFromWhatsappId } from '@/lib/lead-utils';

export const dynamic = 'force-dynamic';

async function getVerifyToken(): Promise<string> {
  return getWebhookVerifyToken('whatsapp_verify_token', 'WHATSAPP_VERIFY_TOKEN');
}

async function getWebhookToken(): Promise<string> {
  try {
    const fromDb = await db.getSystemSetting('whatsapp_webhook_token');
    if (fromDb && fromDb.trim()) return fromDb.trim();
  } catch {
    /* ignore */
  }
  return (process.env.EVOLUTION_WEBHOOK_TOKEN || process.env.WHATSAPP_WEBHOOK_TOKEN || '').trim();
}

async function verifySignature(request: Request, rawBody: string): Promise<boolean> {
  return verifyMetaSignature(request, rawBody, 'WHATSAPP_APP_SECRET');
}

/**
 * GET /api/webhook/whatsapp
 * Meta Webhook verification endpoint
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    const verifyToken = await getVerifyToken();
    if (!verifyToken) {
      console.error('[webhook/whatsapp] Verify token no configurado. Define WHATSAPP_VERIFY_TOKEN.');
      return new Response('Webhook no configurado', { status: 500 });
    }
    if (timingSafeEqual(token, verifyToken)) {
      console.log('[webhook/whatsapp] Meta Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      console.warn('[webhook/whatsapp] Meta Webhook verification failed. Tokens mismatch.');
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Not Found', { status: 404 });
}

/**
 * Extrae texto del mensaje (getPhoneFromWhatsappId vive en @/lib/lead-utils).
 */

async function fetchMediaBase64FromEvolution(messageObj: any, messageKey: any): Promise<string | null> {
  try {
    const url = await db.getSystemSetting('whatsapp_api_url') || process.env.EVOLUTION_API_URL || '';
    const apiKey = await db.getSystemSetting('whatsapp_api_key') || process.env.EVOLUTION_API_KEY || '';
    const instance = await db.getSystemSetting('whatsapp_instance') || process.env.EVOLUTION_API_INSTANCE || '';

    if (!url || !apiKey || !instance || !messageKey) return null;

    const endpoint = `${url.replace(/\/$/, '')}/message/getBase64FromMediaMessage/${instance}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        message: {
          key: messageKey,
          message: messageObj
        },
        convertToMp4: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.base64) {
        return data.base64.startsWith('data:') ? data.base64 : `data:image/jpeg;base64,${data.base64}`;
      }
    }
  } catch (e) {
    console.warn('[webhook/whatsapp] Error consultando Base64 multimedia a Evolution:', e);
  }
  return null;
}

/**
 * Extracts the message text from different Evolution API / Baileys message payload structures.
 */
async function extractMessageText(message: any, key?: any): Promise<string | null> {
  if (!message || typeof message !== 'object') return null;
  if (typeof message === 'string') return message;

  const messageTypes = [
    'conversation',
    'extendedTextMessage',
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'audioMessage',
    'stickerMessage',
    'buttonsResponseMessage',
    'templateButtonReplyMessage',
    'listResponseMessage',
    'reactionMessage'
  ];

  for (const type of messageTypes) {
    if (message[type]) {
      const payload = message[type];
      if (type === 'conversation') return payload;
      if (type === 'extendedTextMessage') return payload?.text || payload?.contextInfo?.quotedMessage?.conversation || null;
      if (type === 'imageMessage' || type === 'videoMessage' || type === 'documentMessage' || type === 'audioMessage') {
        let mediaUrl = payload?.url || payload?.directPath || payload?.base64 || payload?.mediaUrl || payload?.jpegThumbnail || payload?.thumbnailUrl || message?.mediaUrl || message?.base64 || '';
        
        if (!mediaUrl && key) {
          mediaUrl = await fetchMediaBase64FromEvolution(message, key) || '';
        }

        if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('/')) {
          const mime = type === 'audioMessage' ? 'audio/ogg' : 'image/jpeg';
          mediaUrl = `data:${mime};base64,${mediaUrl}`;
        }
        const caption = payload?.caption ? `${payload.caption} ` : '';
        if (type === 'imageMessage') return mediaUrl ? `[Foto] ${caption}${mediaUrl}`.trim() : `[Foto] ${caption}`.trim();
        if (type === 'audioMessage') return mediaUrl ? `[Audio] ${mediaUrl}`.trim() : '[Audio]';
        if (type === 'documentMessage') return mediaUrl ? `[Documento] ${caption}${mediaUrl}`.trim() : `[Documento] ${caption}`.trim();
        if (type === 'videoMessage') return mediaUrl ? `[Video] ${caption}${mediaUrl}`.trim() : `[Video] ${caption}`.trim();
        return null;
      }
      if (type === 'stickerMessage') return payload?.url ? 'Sticker' : null;
      if (type === 'buttonsResponseMessage') return payload?.selectedButtonId || payload?.selectedDisplayText || null;
      if (type === 'templateButtonReplyMessage') return payload?.selectedId || payload?.selectedDisplayText || null;
      if (type === 'listResponseMessage') return payload?.singleSelectReply?.selectedRowId || payload?.singleSelectReply?.title || null;
      if (type === 'reactionMessage') return payload?.text || null;
    }
  }

  if (message.text) return message.text;
  if (message.textMessage?.text) return message.textMessage.text;

  return null;
}

/**
 * Detects if the user has an active conversation controlled by the IA.
 * If the last bot/agent message does not match any static flow node text,
 * then it was generated by the IA, meaning the IA has control.
 */
function hasActiveIAConversation(messages: any[], activeFlows: any[]): boolean {
  if (!messages || messages.length === 0) return false;

  const botMessages = messages.filter((m: any) => m.sender === 'bot');
  if (botMessages.length === 0) return false;

  const lastBotMsg = botMessages[botMessages.length - 1];
  const lastBotText = lastBotMsg.message || '';

  for (const flow of activeFlows) {
    for (const node of flow.nodes || []) {
      if (node.type === 'message' && node.data?.message) {
        if (lastBotText.includes(node.data.message)) {
          return false;
        }
      }
      if (node.type === 'buttons') {
        const btnText = (node.data?.buttons || []).map((b: string, i: number) => `🔹 *${i+1}.* ${b}`).join('\n');
        if (lastBotText.includes(btnText)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Sends a text message back to WhatsApp. 
 * Prioritizes Evolution API if configured, otherwise falls back to local Baileys service.
 */
async function sendWhatsAppMessage(phone: string, text: string) {
  await sendWhatsAppMessageDynamic(phone, text);
}



/**
 * POST handler to process Evolution API / Baileys events
 */
export async function POST(request: Request) {
  console.log('[webhook/whatsapp] POST called');

  // Auth del webhook: si hay token configurado (DB o env), se exige.
  // Acepta header x-webhook-token / apikey / Authorization Bearer, o query ?token= / ?api_key=.
  try {
    const configuredToken = await getWebhookToken();
    if (configuredToken) {
      const url = new URL(request.url);
      const provided =
        (request.headers.get('x-webhook-token') || '').trim() ||
        (request.headers.get('apikey') || '').trim() ||
        (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
        (url.searchParams.get('token') || '').trim() ||
        (url.searchParams.get('api_key') || '').trim();
      if (!timingSafeEqual(provided, configuredToken)) {
        console.warn('[webhook/whatsapp] Unauthorized webhook attempt blocked.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('[webhook/whatsapp] Sin EVOLUTION_WEBHOOK_TOKEN configurado: webhook abierto. Configúralo para producción.');
    }
  } catch (e) {
    console.error('[webhook/whatsapp] Error verificando auth del webhook:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  // Si la sesión de Baileys local está activa en la base de datos, ignoramos el webhook externo.
  // Baileys procesa directamente los mensajes en tiempo real vía websocket en whatsapp-service.ts.
  try {
    const session = await db.getWhatsappSession('default');
    if (session && session.creds && session.creds.me && session.creds.me.id && !session.creds.me.id.startsWith('placeholder')) {
      const activeLocalPhone = getPhoneFromWhatsappId(session.creds.me.id) || '';
      console.log(`[webhook/whatsapp] Conexión local de Baileys activa (${activeLocalPhone}). Ignorando webhook externo.`);
      return NextResponse.json({ success: true, message: 'Ignored: Local Baileys session is active' });
    }
  } catch (e) {
    console.error('[webhook/whatsapp] Error al comprobar la sesión persistida:', e);
  }

  try {
    const rawBody = await request.text();
    if (!(await verifySignature(request, rawBody))) {
      console.warn('[webhook/whatsapp] Firma Meta inválida.');
      return NextResponse.json({ error: 'Unauthorized: firma inválida' }, { status: 401 });
    }
    let body: { event?: string; data?: any; key?: any; message?: any; sender?: string; pushName?: string };
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ success: true, message: 'Ignored: invalid JSON' });
    }

    // Evolution API payload uses 'event' and 'data' keys
    const event = body.event;
    const data = body.data;

    // Check key and message structure
    const key = data?.key || body.key;
    const messageObj = data?.message || body.message;

    if (!key || !messageObj) {
      console.log('[webhook/whatsapp] Ignored: Not a valid message payload (missing key or message content)');
      return NextResponse.json({ success: true, message: 'Ignored: Missing key or message content' });
    }

    const fromMe = key.fromMe ?? false;

    // Resolve clean phone number from conversation JID (remoteJid represents the customer chat thread, prioritizing remoteJidAlt)
    const remoteJid = data?.key?.remoteJidAlt || key?.remoteJidAlt || data?.key?.remoteJid || key?.remoteJid || '';
    const hasAlt = !!(data?.key?.remoteJidAlt || key?.remoteJidAlt);
    const phoneJid = hasAlt ? (data?.key?.remoteJidAlt || key?.remoteJidAlt).toString() : remoteJid.toString();
    const lidJid = hasAlt ? (data?.key?.remoteJid || key?.remoteJid).toString() : null;

    let phone = getPhoneFromWhatsappId(phoneJid);
    let lid = lidJid ? getPhoneFromWhatsappId(lidJid) : null;

    // Si no se puede extraer de remoteJid, intentamos de sender
    if (!phone) {
      const senderJid = data?.sender || body?.sender || '';
      phone = getPhoneFromWhatsappId(senderJid);
    }

    // Normalización Universal de JID tipo LID
    if (phoneJid.endsWith('@lid') && phone) {
      const normalizedPhoneJid = await db.normalizeJid(phoneJid);
      if (normalizedPhoneJid !== phoneJid) {
        lid = phone;
        phone = getPhoneFromWhatsappId(normalizedPhoneJid);
      }
    }

    // Tabla de Mapeo de Identidad estática para celular vinculado
    if (phone && db.IDENTITY_MAPPING[phone]) {
      const staticEquivs = db.IDENTITY_MAPPING[phone];
      const realPhone = staticEquivs.find((id: string) => id !== phone && id.startsWith('51'));
      if (realPhone) {
        console.log(`[webhook/whatsapp] Normalizando ID ${phone} a número real mapeado estáticamente: ${realPhone}`);
        if (!lid) lid = phone;
        phone = realPhone;
      }
    }

    // Si por alguna razón el remitente no se puede leer, arroja un console.error con el objeto completo
    if (!phone) {
      console.error('[webhook/whatsapp] ERROR: No se pudo leer el remitente del mensaje. Objeto completo:', JSON.stringify(body, null, 2));
      return NextResponse.json({ success: false, error: 'Remitente no legible' }, { status: 400 });
    }

    // Ignorar número de prueba de Meta/Sandbox para que no ensucie la base de datos
    if (phone === '141532090908916' || phone.startsWith('1415')) {
      console.log('[webhook/whatsapp] Ignorando número de prueba de Meta/Sandbox:', phone);
      return NextResponse.json({ success: true, message: 'Ignored test number' });
    }

    // Ignore group chats, status, or empty phone
    const rawRemoteJid = (data?.key?.remoteJid || key?.remoteJid || '').toString();
    if (rawRemoteJid === 'status@broadcast' || rawRemoteJid.endsWith('@broadcast') || rawRemoteJid.endsWith('@g.us')) {
      console.log('[webhook/whatsapp] Ignored: Group, broadcast or status message');
      return NextResponse.json({ success: true, message: 'Ignored: Group or broadcast message' });
    }

    // Extract text directly. No cleaning, stripping, or sanitization is done to the message content,
    // ensuring complete support for special characters and complex utf8mb4 emojis (e.g. 🥺).
    const rawMessageText = await extractMessageText(messageObj, key);
    if (!rawMessageText) {
      console.log('[webhook/whatsapp] Ignored: No text extractable from message');
      return NextResponse.json({ success: true, message: 'Ignored: Empty message body' });
    }
    let messageText: string = rawMessageText;

    const leadId = phone;
    const pushName = data?.pushName || body.pushName || `WhatsApp ${phone}`;
    const cleanName = pushName.trim();

    // If message is outgoing (sent by us or from physical phone of agent)
    if (fromMe) {
      console.log(`[webhook/whatsapp] Logging outgoing message: direction = 'outgoing', sender = 'agent', source = 'mobile_device' for lead ${leadId}`);

      // Check if this outgoing message is a duplicate of a recent bot or agent message to avoid double-logging
      const recentMessages = await db.getMessages(leadId);
      const nowMs = Date.now();
      const isDuplicateOutbound = recentMessages.some((m: any) => {
        if (m.sender === 'customer') return false;
        if (m.message.trim() !== messageText.trim()) return false;

        let isoStr = m.created_at;
        if (typeof isoStr === 'string') {
          if (!isoStr.includes('T')) isoStr = isoStr.replace(' ', 'T');
          if (!isoStr.endsWith('Z') && !isoStr.match(/[+-]\d{2}:?\d{2}$/)) isoStr += 'Z';
        }
        const msgTime = new Date(isoStr).getTime();
        const diffSeconds = Math.abs(nowMs - msgTime) / 1000;
        return diffSeconds <= 30;
      });

      if (isDuplicateOutbound) {
        console.log(`[webhook/whatsapp] Outgoing message is a duplicate of a recent bot/agent response within 30s. Skipping duplicate log.`);
        return NextResponse.json({ success: true, message: 'Ignored: Duplicate outbound message within 30s' });
      }

      // Ensure lead exists
      await db.upsertLead({
        id: leadId,
        name: cleanName,
        phone: phone,
        whatsapp_lid: lid,
        status: 'New',
        tags: [],
        bot_active: true
      });

      // Save outgoing message (uses WhatsApp key ID to avoid duplicates)
      const msgId = key.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      await db.addMessage(leadId, 'agent', messageText, msgId);

      return NextResponse.json({ success: true, message: 'Logged outgoing message' });
    }

    // --- Incoming Message Processing (from client) ---
    console.log(`[webhook/whatsapp] Processing incoming message from customer: ${phone}, text: "${messageText}"`);

    // 1. Fetch or create lead using database helper
    let activeLead = await db.getLeadById(leadId);
    if (!activeLead) {
      activeLead = await db.upsertLead({
        id: leadId,
        name: cleanName,
        phone: phone,
        whatsapp_lid: lid,
        status: 'New',
        tags: [],
        bot_active: true
      });
    } else if (lid && activeLead.whatsapp_lid !== lid) {
      // Si el LID cambió o se detectó por primera vez, lo actualizamos
      activeLead = await db.upsertLead({
        id: leadId,
        name: activeLead.name || cleanName,
        phone: activeLead.phone || phone,
        whatsapp_lid: lid
      });
    }

    // 2. Save incoming message to database
    const msgId = key.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    await db.addMessage(activeLead ? activeLead.id : leadId, 'customer', messageText, msgId);

    // Detectar si el cliente envió un comprobante (imagen/foto) después de recibir datos de pago
    const isPaymentAttachment = messageObj.imageMessage || messageText === '[Foto]';
    if (isPaymentAttachment) {
      const recentMsgs = await db.getMessages(leadId);
      const hasSentPaymentDetails = recentMsgs.slice(-5).some(m => {
        if (m.sender !== 'bot' && m.sender !== 'agent') return false;
        const msgLower = m.message.toLowerCase();
        return msgLower.includes('yape') || msgLower.includes('plin') || msgLower.includes('transferenci') || msgLower.includes('banco') || msgLower.includes('cuenta') || msgLower.includes('comprobante');
      });

      if (hasSentPaymentDetails) {
        console.log(`[webhook/whatsapp] 💳 Comprobante recibido para el lead ${leadId}. Actualizando a Verificación Pendiente y pausando bot.`);
        await db.updateLeadStatus(leadId, 'Pending Verification');
        await db.updateLeadBotActive(leadId, false);
        
        const autoReply = '¡Muchas gracias por tu pago! Tu comprobante ha sido recibido. Un asesor humano lo verificará en unos minutos y procederemos con tu entrega. ¡Que tengas un excelente día! 😊';
        await db.addMessage(leadId, 'bot', autoReply);
        await sendWhatsAppMessage(activeLead.phone || phone, autoReply);

        // Despachar notificación por correo SMTP al Administrador
        try {
          await alertPaymentVerification({
            name: activeLead.name || cleanName,
            phone: activeLead.phone || phone,
            status: 'Pendiente de Verificación de Pago'
          });
          console.log(`[webhook/whatsapp] Alerta SMTP enviada exitosamente para comprobante de ${leadId}`);
        } catch (err: any) {
          console.error('[webhook/whatsapp] Error enviando alerta de pago SMTP:', err);
        }

        return NextResponse.json({ success: true, reply: autoReply });
      }
    }

    // Detectar si el mensaje es un disparador de un flujo activo para reactivar el bot
    let isBotActive = activeLead.bot_active === 1 || activeLead.bot_active === true;
    
    const flows = await db.getFlows();
    const activeFlows = flows.filter((f: any) => f.is_active);

    let messageTriggersFlow = false;
    for (const flow of activeFlows) {
      if (flow.nodes) {
        const triggerNode = flow.nodes.find((n: any) => n.type === 'trigger');
        if (triggerNode) {
          const keywords = (triggerNode.data.keyword || '').split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
          const cleanText = messageText.toLowerCase().trim();
          const matches = keywords.some((k: string) => cleanText === k || (cleanText.length <= k.length + 3 && cleanText.includes(k)));
          if (matches) {
            messageTriggersFlow = true;
            break;
          }
        }
      }
    }

    if (messageTriggersFlow) {
      console.log(`[webhook/whatsapp] Mensaje coincide con disparador. Reactivando bot para ${leadId}.`);
      await db.updateLeadBotActive(activeLead.id, true);
      isBotActive = true;
      whatsappService.flowState.delete(leadId);
    }

    if (!isBotActive) {
      console.log(`[webhook/whatsapp] Bot is paused for lead ${leadId}. Message logged.`);
      return NextResponse.json({ success: true, message: 'Message logged. Bot is paused.' });
    }



    // 4. Retrieve recent message history for AI context
    const historyMessages = await db.getMessages(leadId);
    const history = historyMessages.slice(-10).map((m: any) => ({
      sender: m.sender,
      message: m.message
    }));

    // 4.1 DETECCIÓN AUTOMÁTICA DE COMPROBANTES DE PAGO (Yape, Plin, Transferencia)
    const isImageMessage = messageText === '[Foto]' || messageText === '[Documento]';
    const isPaymentKeyword = /yape|plin|transferencia|comprobante|voucher|vouche|pago/i.test(messageText);

    if (isImageMessage || (isPaymentKeyword && historyMessages.length > 1)) {
      console.log(`[webhook/whatsapp] Comprobante de pago o foto detectada para cliente ${phone}. Enviando alerta SMTP.`);

      // Actualizar estado del cliente
      await db.updateLeadStatus(activeLead.id, 'Pending Verification');
      // Pausar bot para no interrumpir al agente
      await db.updateLeadBotActive(activeLead.id, false);
      // Fase 2 pedidos: congelar producto x cantidad = total (no bloquea)
      void snapshotOrderForLead(activeLead.id);

      // Despachar correo electrónico de alerta SMTP al Administrador
      try {
        await alertPaymentVerification({
          name: activeLead.name || cleanName,
          phone: activeLead.phone || phone,
          status: 'Pendiente de Verificación de Pago'
        });
      } catch (err: any) {
        console.error('[webhook/whatsapp] Error enviando correo de alerta de pago:', err);
      }

      // Mensaje de respuesta al cliente por WhatsApp
      const paymentReply = 'Hemos recibido tu comprobante de pago. Un asesor verificará la transacción y te confirmará en breve. ¡Muchas gracias por tu preferencia!';
      await db.addMessage(leadId, 'bot', paymentReply);
      await sendWhatsAppMessage(activeLead.phone || phone, paymentReply);

      return NextResponse.json({
        success: true,
        reply: paymentReply,
        paymentVerificationTriggered: true
      });
    }

    // 3.5. Flow Priority System Check

    const hasIAControl = hasActiveIAConversation(historyMessages, activeFlows);
    const isWaitingClose = activeLead.status === 'Pending Verification';

    let isFlowTriggered = false;
    
    // Evaluar si una palabra clave del flujo fuerza el reinicio del flujo
    if (!hasIAControl && !isWaitingClose) {
      for (const flow of activeFlows) {
        const triggerNode = flow.nodes?.find((n: any) => n.type === 'trigger');
        if (triggerNode) {
          const keywords = (triggerNode.data?.keyword || '').split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
          if (keywords.some((k: string) => messageText.toLowerCase().includes(k))) {
            isFlowTriggered = true;
            break;
          }
        }
      }
    }

    const inFlowState = whatsappService.flowState?.has(leadId);

    // CONTROL CRÍTICO: Si la IA ya tomó el control de la conversación, 
    // se ignora el estado del flujo activo para evitar reinicios forzados del menú.
    if (!hasIAControl && (isFlowTriggered || inFlowState)) {
      console.log(`[webhook/whatsapp] Flow triggered or active flow state detected for lead ${leadId}. Executing flow...`);
      const flowContext = { overrideText: null as string | null };
      const flowReply = await whatsappService.executeActiveFlow(
        leadId,
        messageText,
        activeLead.phone || phone,
        flowContext,
        async (p: string, t: string) => {
          await sendWhatsAppMessage(p, t);
        }
      );

      if (flowReply) {
        await db.addMessage(leadId, 'bot', flowReply);
        console.log(`[webhook/whatsapp] Flow response sent: "${flowReply}"`);
        return NextResponse.json({ success: true, reply: flowReply });
      } else if (flowContext.overrideText) {
        console.log(`[webhook/whatsapp] Flow set override text to: "${flowContext.overrideText}". Querying Gemini...`);
        messageText = flowContext.overrideText;
      }
    } else if (hasIAControl) {
      console.log(`[webhook/whatsapp] 🧠 IA activa detectada para el lead ${leadId}. Omitiendo flujos automáticos.`);
    }

    // 3.1 Stop if AI is globally disabled by the operator
    const aiGloballyEnabled = await getAiGloballyEnabled();
    if (!aiGloballyEnabled) {
      console.log(`[webhook/whatsapp] AI is globally disabled. Message logged for lead ${leadId}, no AI response sent.`);
      return NextResponse.json({ success: true, message: 'Message logged. AI globally disabled.' });
    }

    // 5. Query Gemini AI with RAG Context (ya sanitizada dentro, doble barrera aquí)
    const rawReply = await queryKnowledgeBase(messageText, history);
    const reply = sanitizeAiReply(rawReply);
    console.log(`[webhook/whatsapp] AI Response: "${reply}"`);

    // 6. Handle UNKNOWN replies (Shadow Mode Activation)
    if (reply.trim() === '[UNKNOWN]' || reply.trim().startsWith('[UNKNOWN] ')) {
      console.log(`[webhook/whatsapp] AI could not answer. Pausing bot and creating knowledge gap task.`);

      // Pause bot
      await db.updateLeadBotActive(activeLead.id, false);

      // Determine appropriate status update
      let newStatus = activeLead.status || 'New';
      const lowerText = messageText.toLowerCase();
      if (lowerText.includes('pay') || lowerText.includes('comprar') || lowerText.includes('pago')) {
        newStatus = 'Pending Verification';
      } else {
        newStatus = 'Engaged';
      }

      await db.updateLeadStatus(activeLead.id, newStatus);

      // Construct history snippet for knowledge gap context
      const contextSnippet = history
        .slice(-4)
        .map((m: any) => `${m.sender}: ${m.message}`)
        .join('\n');

      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await db.addGap(gapId, activeLead.id, messageText, contextSnippet);

      // Send email alert for Knowledge Gap
      await alertKnowledgeGap({
        name: activeLead.name || cleanName,
        phone: activeLead.phone || phone
      }, messageText);

      // Save fallback bot message
      const fallbackReply = 'Lo siento, no tengo esa información en este momento. Un agente humano revisará su pregunta y le responderá a la brevedad.';
      await db.addMessage(leadId, 'bot', fallbackReply);

      // Reply back via WhatsApp
      await sendWhatsAppMessage(activeLead.phone || phone, fallbackReply);

      return NextResponse.json({
        success: true,
        reply: fallbackReply,
        bot_active: false,
        gapCreated: true
      });
    }

    // 7. Detect [REGISTRO_DETECTADO] tag from AI response
    const registroMatch = reply.match(/\[REGISTRO_DETECTADO:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);
    if (registroMatch) {
      const [, regNombre, regDni, regCelular, regCorreo] = registroMatch;
      // Strip the internal tag from the visible message (doble limpieza anti-fuga)
      const confirmMsg = stripInternalTagsForSending(reply) || '¡Gracias! Hemos recibido tus datos y los estamos procesando. 😊';
      // The follow-up payment question is embedded or we add it separately
      const paymentFollowUp = 'Mientras procesamos tu registro y te llamamos, ¿cómo te gustaría dejar programado el pago de tu pedido de hoy? ¿Por Yape o transferencia?';

      // Save and send the confirmation message
      await db.addMessage(leadId, 'bot', confirmMsg);
      await sendWhatsAppMessage(activeLead.phone || phone, confirmMsg);

      // Wait a moment then send the payment question as a second message
      await new Promise(r => setTimeout(r, 1200));
      await db.addMessage(leadId, 'bot', paymentFollowUp);
      await sendWhatsAppMessage(activeLead.phone || phone, paymentFollowUp);

      // Pause bot and update lead status to Por Registrar en Web
      await db.updateLeadBotActive(activeLead.id, false);
      await db.updateLeadStatus(activeLead.id, 'Por Registrar en Web');

      // Determine CRM base URL dynamically from request.url
      let crmBase = 'http://localhost:3000';
      try {
        const reqUrl = new URL(request.url);
        crmBase = reqUrl.origin;
      } catch (e) {
        crmBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      }

      // Fire admin WhatsApp alert with client data
      await alertRegistration({
        nombre: regNombre.trim(),
        dni: regDni.trim(),
        celular: regCelular.trim(),
        correo: regCorreo.trim(),
        leadId: activeLead.id,
        crmBaseUrl: crmBase
      });

      console.log(`[webhook/whatsapp] 🎯 Registro detectado para lead ${leadId}. Bot pausado. Alerta al admin disparada.`);
      return NextResponse.json({ success: true, reply: confirmMsg, registroDetectado: true });
    }

    // 7. Save Bot Response to Logs (solo texto visible, sin tags internos)
    const visibleReply = stripInternalTagsForSending(reply);
    await db.addMessage(leadId, 'bot', visibleReply);

    // 7b. Fase 1 pedidos: registrar producto recomendado (no bloquea)
    void logRecommendedProduct(leadId, visibleReply);

    // 8. Reply back via WhatsApp
    await sendWhatsAppMessage(activeLead.phone || phone, visibleReply);

    // 9. Payment verification keywords trigger
    const paymentKeywords = ['yape', 'plin', 'transferencia', 'banco', 'pago', 'recibo', 'comprobante', 'voucher', 'pagar'];
    const isPaymentTrigger = paymentKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

    if (isPaymentTrigger && activeLead.status !== 'Pending Verification') {
      await db.updateLeadStatus(activeLead.id, 'Pending Verification');
      // Fase 2 pedidos: congelar producto x cantidad = total (no bloquea)
      void snapshotOrderForLead(activeLead.id);

      let currentTags: string[] = [];
      try {
        currentTags = typeof activeLead.tags === 'string' ? JSON.parse(activeLead.tags) : (activeLead.tags || []);
      } catch (e) {
        currentTags = [];
      }

      if (!currentTags.includes('needs-verification')) {
        currentTags.push('needs-verification');
        await db.updateLeadTags(activeLead.id, currentTags);
      }

      await alertPaymentVerification({
        name: activeLead.name || cleanName,
        phone: activeLead.phone || phone,
        status: 'Pending Verification'
      });
    }

    return NextResponse.json({ success: true, reply: visibleReply });

  } catch (error: any) {
    console.error('[webhook/whatsapp] Error handling webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
