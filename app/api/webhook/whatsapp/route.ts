import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { queryKnowledgeBase } from '@/lib/gemini';
import { alertKnowledgeGap, alertPaymentVerification } from '@/lib/notifications';
import { whatsappService } from '@/lib/whatsapp-service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Initialize Supabase Client with Service Key to bypass RLS policies
let cachedSupabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!cachedSupabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[webhook/whatsapp] Warning: Supabase URL or Service Key is missing. Webhook database operations might fail.');
    }
    // Explicitly configure connection to accept and send UTF-8 for utf8mb4 emoji support
    cachedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept-Charset': 'utf-8'
        }
      }
    });
  }
  return cachedSupabase;
}

/**
 * Extracts phone digits from a WhatsApp ID.
 */
function getPhoneFromWhatsappId(id: string): string | null {
  if (!id || typeof id !== 'string') return null;
  const raw = id.split('@')[0] || '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) {
    digits = '51' + digits;
  }
  return digits.length > 0 ? digits : null;
}

/**
 * Extracts the message text from different Evolution API / Baileys message payload structures.
 */
function extractMessageText(message: any): string | null {
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
        return payload?.caption || null;
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
 * Sends a text message back to WhatsApp. 
 * Prioritizes Evolution API if configured, otherwise falls back to local Baileys service.
 */
async function sendWhatsAppMessage(phone: string, text: string) {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_API_INSTANCE;

  if (!url || !apiKey || !instance) {
    console.warn('[webhook/whatsapp] Evolution API config missing. Falling back to local whatsappService (Baileys).');
    await whatsappService.sendMessageToPhone(phone, text);
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const endpoint = `${url.replace(/\/$/, '')}/message/sendText/${instance}`;

  const payload = {
    number: cleanPhone,
    text: text
  };

  try {
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
      console.error(`[webhook/whatsapp] Evolution API returned error: ${response.status} - ${errorText}`);
      throw new Error(`Evolution API send failed: ${response.status}`);
    }
    console.log(`[webhook/whatsapp] Sent message to ${cleanPhone} via Evolution API`);
  } catch (err) {
    console.error('[webhook/whatsapp] Failed to send message via Evolution API, attempting Baileys fallback...', err);
    await whatsappService.sendMessageToPhone(phone, text);
  }
}

/**
 * GET handler for webhook verification (needed by Meta/Evolution verification endpoints)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    console.log('[webhook/whatsapp] GET challenge verification successful');
    return new Response(challenge, { status: 200 });
  }

  return new Response('WhatsApp Webhook Active', { status: 200 });
}

/**
 * POST handler to process Evolution API / Baileys events
 */
export async function POST(request: Request) {
  console.log('[webhook/whatsapp] POST called');

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

  const supabase = getSupabaseClient();
  try {
    const body = await request.json();

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
    if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) {
      console.log('[webhook/whatsapp] Ignored: Group, broadcast or status message');
      return NextResponse.json({ success: true, message: 'Ignored: Group or broadcast message' });
    }

    // Extract text directly. No cleaning, stripping, or sanitization is done to the message content,
    // ensuring complete support for special characters and complex utf8mb4 emojis (e.g. 🥺).
    const messageText = extractMessageText(messageObj);
    if (!messageText) {
      console.log('[webhook/whatsapp] Ignored: No text extractable from message');
      return NextResponse.json({ success: true, message: 'Ignored: Empty message body' });
    }

    const leadId = phone;
    const pushName = data?.pushName || body.pushName || `WhatsApp ${phone}`;
    const cleanName = pushName.trim();

    // If message is outgoing (sent by us or from physical phone of agent)
    if (fromMe) {
      console.log(`[webhook/whatsapp] Logging outgoing message: direction = 'outgoing', sender = 'agent', source = 'mobile_device' for lead ${leadId}`);

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
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        await supabase.from('chat_messages').upsert({
          id: msgId,
          lead_id: leadId,
          sender: 'agent',
          message: messageText
        }, { onConflict: 'id' });
      } else {
        await db.addMessage(leadId, 'agent', messageText, msgId);
      }

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
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      await supabase.from('chat_messages').upsert({
        id: msgId,
        lead_id: leadId,
        sender: 'customer',
        message: messageText
      }, { onConflict: 'id' });
    } else {
      await db.addMessage(leadId, 'customer', messageText);
    }

    // 3. Stop if bot is inactive (Shadow Mode / paused) for this lead
    const isBotActive = activeLead.bot_active === 1 || activeLead.bot_active === true;
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

    // 5. Query Gemini AI with RAG Context
    const reply = await queryKnowledgeBase(messageText, history);
    console.log(`[webhook/whatsapp] AI Response: "${reply}"`);

    // 6. Handle UNKNOWN replies (Shadow Mode Activation)
    if (reply.trim() === '[UNKNOWN]') {
      console.log(`[webhook/whatsapp] AI could not answer. Pausing bot and creating knowledge gap task.`);

      // Pause bot
      await db.updateLeadBotActive(leadId, false);

      // Determine appropriate status update
      let newStatus = activeLead.status || 'New';
      const lowerText = messageText.toLowerCase();
      if (lowerText.includes('pay') || lowerText.includes('comprar') || lowerText.includes('pago')) {
        newStatus = 'Pending Verification';
      } else {
        newStatus = 'Engaged';
      }

      await db.updateLeadStatus(leadId, newStatus);

      // Construct history snippet for knowledge gap context
      const contextSnippet = history
        .slice(-4)
        .map((m: any) => `${m.sender}: ${m.message}`)
        .join('\n');

      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await db.addGap(gapId, leadId, messageText, contextSnippet);

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

    // 7. Save Bot Response to Logs
    await db.addMessage(leadId, 'bot', reply);

    // 8. Reply back via WhatsApp
    await sendWhatsAppMessage(activeLead.phone || phone, reply);

    // 9. Payment verification keywords trigger
    const paymentKeywords = ['yape', 'plin', 'transferencia', 'banco', 'pago', 'recibo', 'comprobante', 'voucher', 'pagar'];
    const isPaymentTrigger = paymentKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

    if (isPaymentTrigger && activeLead.status !== 'Pending Verification') {
      await db.updateLeadStatus(leadId, 'Pending Verification');

      let currentTags: string[] = [];
      try {
        currentTags = typeof activeLead.tags === 'string' ? JSON.parse(activeLead.tags) : (activeLead.tags || []);
      } catch (e) {
        currentTags = [];
      }

      if (!currentTags.includes('needs-verification')) {
        currentTags.push('needs-verification');
        await db.updateLeadTags(leadId, currentTags);
      }

      await alertPaymentVerification({
        name: activeLead.name || cleanName,
        phone: activeLead.phone || phone,
        status: 'Pending Verification'
      });
    }

    return NextResponse.json({ success: true, reply });

  } catch (error: any) {
    console.error('[webhook/whatsapp] Error handling webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
