import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { queryKnowledgeBase } from '@/lib/gemini';
import { alertKnowledgeGap, alertPaymentVerification } from '@/lib/notifications';
import { whatsappService } from '@/lib/whatsapp-service';

// Initialize Supabase Client with Service Key to bypass RLS policies
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[webhook/whatsapp] Warning: Supabase URL or Service Key is missing. Webhook database operations might fail.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Extracts phone digits from a WhatsApp ID.
 */
function getPhoneFromWhatsappId(id: string): string | null {
  if (!id || typeof id !== 'string') return null;
  const raw = id.split('@')[0] || '';
  const digits = raw.replace(/\D/g, '');
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
    const remoteJid = key.remoteJid || '';

    // Ignore status updates, broadcast lists, and group chats
    if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) {
      console.log('[webhook/whatsapp] Ignored: Group, broadcast or status message');
      return NextResponse.json({ success: true, message: 'Ignored: Group or broadcast message' });
    }

    const phone = getPhoneFromWhatsappId(remoteJid);
    if (!phone) {
      console.log('[webhook/whatsapp] Ignored: Could not extract phone number from remoteJid:', remoteJid);
      return NextResponse.json({ success: true, message: 'Ignored: Invalid phone number' });
    }

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
      console.log(`[webhook/whatsapp] Logging outgoing message for lead ${leadId}`);
      
      // Ensure lead exists
      await supabase.from('leads').upsert({
        id: leadId,
        name: cleanName,
        phone: phone,
        status: 'New',
        tags: '[]',
        bot_active: 1
      }, { onConflict: 'id' });

      // Save outgoing message (uses WhatsApp key ID to avoid duplicates)
      const msgId = key.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      await supabase.from('chat_messages').upsert({
        id: msgId,
        lead_id: leadId,
        sender: 'bot',
        message: messageText
      }, { onConflict: 'id' });

      return NextResponse.json({ success: true, message: 'Logged outgoing message' });
    }

    // --- Incoming Message Processing (from client) ---
    console.log(`[webhook/whatsapp] Processing incoming message from customer: ${phone}, text: "${messageText}"`);

    // 1. Fetch or create lead using service client
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (fetchError) {
      console.error('[webhook/whatsapp] Fetch lead error:', fetchError);
    }

    let activeLead = lead;
    if (!lead) {
      const { data: newLead, error: upsertError } = await supabase
        .from('leads')
        .upsert({
          id: leadId,
          name: cleanName,
          phone: phone,
          status: 'New',
          tags: '[]',
          bot_active: 1
        }, { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        console.error('[webhook/whatsapp] Error upserting lead:', upsertError);
        throw upsertError;
      }
      activeLead = newLead;
    }

    // 2. Save incoming message to database
    const msgId = key.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    await supabase.from('chat_messages').upsert({
      id: msgId,
      lead_id: leadId,
      sender: 'customer',
      message: messageText
    }, { onConflict: 'id' });

    // 3. Stop if bot is inactive (Shadow Mode / paused) for this lead
    const isBotActive = activeLead.bot_active === 1 || activeLead.bot_active === true;
    if (!isBotActive) {
      console.log(`[webhook/whatsapp] Bot is paused for lead ${leadId}. Message logged.`);
      return NextResponse.json({ success: true, message: 'Message logged. Bot is paused.' });
    }

    // 4. Retrieve recent message history for AI context
    const { data: historyData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = (historyData || []).map((m: any) => ({
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
      await supabase
        .from('leads')
        .update({ bot_active: 0, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      // Determine appropriate status update
      let newStatus = activeLead.status || 'New';
      const lowerText = messageText.toLowerCase();
      if (lowerText.includes('pay') || lowerText.includes('comprar') || lowerText.includes('pago')) {
        newStatus = 'Pending Verification';
      } else {
        newStatus = 'Engaged';
      }

      await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      // Construct history snippet for knowledge gap context
      const contextSnippet = history
        .slice(-4)
        .map((m: any) => `${m.sender}: ${m.message}`)
        .join('\n');

      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await supabase
        .from('knowledge_gaps')
        .insert({
          id: gapId,
          lead_id: leadId,
          question: messageText,
          context: contextSnippet,
          status: 'pending'
        });

      // Send email alert for Knowledge Gap
      await alertKnowledgeGap({
        name: activeLead.name || cleanName,
        phone: activeLead.phone || phone
      }, messageText);

      // Save fallback bot message
      const fallbackReply = 'Lo siento, no tengo esa información en este momento. Un agente humano revisará su pregunta y le responderá a la brevedad.';
      const fallbackMsgId = `msg-bot-${Date.now()}`;
      await supabase.from('chat_messages').insert({
        id: fallbackMsgId,
        lead_id: leadId,
        sender: 'bot',
        message: fallbackReply
      });

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
    const botMsgId = `msg-bot-${Date.now()}`;
    await supabase.from('chat_messages').insert({
      id: botMsgId,
      lead_id: leadId,
      sender: 'bot',
      message: reply
    });

    // 8. Reply back via WhatsApp
    await sendWhatsAppMessage(activeLead.phone || phone, reply);

    // 9. Payment verification keywords trigger
    const paymentKeywords = ['yape', 'plin', 'transferencia', 'banco', 'pago', 'recibo', 'comprobante', 'voucher', 'pagar'];
    const isPaymentTrigger = paymentKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

    if (isPaymentTrigger && activeLead.status !== 'Pending Verification') {
      await supabase
        .from('leads')
        .update({ status: 'Pending Verification', updated_at: new Date().toISOString() })
        .eq('id', leadId);

      let currentTags: string[] = [];
      try {
        currentTags = typeof activeLead.tags === 'string' ? JSON.parse(activeLead.tags) : (activeLead.tags || []);
      } catch (e) {
        currentTags = [];
      }

      if (!currentTags.includes('needs-verification')) {
        currentTags.push('needs-verification');
        await supabase
          .from('leads')
          .update({ tags: JSON.stringify(currentTags), updated_at: new Date().toISOString() })
          .eq('id', leadId);
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
