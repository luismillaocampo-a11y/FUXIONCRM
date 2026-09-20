import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryKnowledgeBase, sanitizeAiReply, stripInternalTagsForSending } from '@/lib/gemini';
import { alertKnowledgeGap, alertPaymentVerification } from '@/lib/notifications';
import { requireSession } from '@/lib/api-auth';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_ID_LENGTH = 128;

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { leadId, message, name, phone } = body;

    if (!leadId || !message) {
      return NextResponse.json({ error: 'Missing leadId or message' }, { status: 400 });
    }

    if (typeof leadId !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const cleanLeadId = leadId.slice(0, MAX_ID_LENGTH);
    const cleanMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!cleanMessage) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
    }

    // 1. Fetch or create lead
    let lead = await db.getLeadById(cleanLeadId);
    if (!lead) {
      const rawPhone = typeof phone === 'string' ? phone : cleanLeadId;
      const cleanPhone = rawPhone.replace(/\D/g, '').slice(0, 20) || cleanLeadId;
      const cleanName = (typeof name === 'string' && name.trim() ? name.trim() : `Lead (${cleanPhone.slice(-4)})`).slice(0, 120);
      lead = await db.upsertLead({
        id: cleanLeadId,
        name: cleanName,
        phone: cleanPhone,
        status: 'New',
        tags: [],
        bot_active: true
      });
    }

    // 2. Save user message to log
    await db.addMessage(lead.id, 'customer', cleanMessage);

    // 3. If bot is paused (Shadow Mode active), do not respond automatically
    if (!lead.bot_active) {
      return NextResponse.json({
        reply: null,
        bot_active: false,
        message: 'Bot is currently paused for this lead. Waiting for agent manual reply.'
      });
    }

    // 4. Load recent conversation history for context
    const history = await db.getMessages(lead.id);

    // 5. Query Knowledge Base using Gemini (with RAG) — ya sanitizada, doble barrera
    const rawReply = await queryKnowledgeBase(cleanMessage, history);
    const reply = sanitizeAiReply(rawReply);

    // 6. Handle Shadow Mode Activation
    if (reply.trim() === '[UNKNOWN]' || reply.trim().startsWith('[UNKNOWN] ')) {
      // Pause the bot
      await db.updateLeadBotActive(lead.id, false);
      
      // Update status to shadow mode / pending verification if they were talking about payments
      const lowerMsg = cleanMessage.toLowerCase();
      if (lowerMsg.includes('pay') || lowerMsg.includes('comprar') || lowerMsg.includes('pago')) {
        await db.updateLeadStatus(lead.id, 'Pending Verification');
      } else {
        await db.updateLeadStatus(lead.id, 'Engaged');
      }

      // Create Knowledge Gap Task
      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Construct context snippet for the gap
      const contextSnippet = history
        .slice(-4)
        .map((m: any) => `${m.sender}: ${String(m.message || '').slice(0, 500)}`)
        .join('\n');
      
      await db.addGap(gapId, lead.id, cleanMessage, contextSnippet);

      // Trigger Email Notification for Knowledge Gap
      await alertKnowledgeGap(lead, cleanMessage);

      // Save bot's fallback pausing message to logs
      const fallbackReply = 'Lo siento, no tengo esa información en este momento. Un agente humano revisará su pregunta y le responderá a la brevedad.';
      await db.addMessage(lead.id, 'bot', fallbackReply);

      return NextResponse.json({
        reply: fallbackReply,
        bot_active: false,
        gapCreated: true
      });
    }

    // 7. Save bot reply to log (solo visible, sin tags internos)
    const visibleReply = stripInternalTagsForSending(reply);
    await db.addMessage(lead.id, 'bot', visibleReply);

    return NextResponse.json({
      reply: visibleReply,
      bot_active: true
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
