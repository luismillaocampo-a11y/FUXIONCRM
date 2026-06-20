import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryKnowledgeBase } from '@/lib/gemini';
import { alertKnowledgeGap, alertPaymentVerification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, message, name, phone } = body;

    if (!leadId || !message) {
      return NextResponse.json({ error: 'Missing leadId or message' }, { status: 400 });
    }

    // 1. Fetch or create lead
    let lead = await db.getLeadById(leadId);
    if (!lead) {
      const cleanPhone = phone || leadId;
      const cleanName = name || `Lead (${cleanPhone.slice(-4)})`;
      lead = await db.upsertLead({
        id: leadId,
        name: cleanName,
        phone: cleanPhone,
        status: 'New',
        tags: [],
        bot_active: true
      });
    }

    // 2. Save user message to log
    await db.addMessage(leadId, 'customer', message);

    // 3. If bot is paused (Shadow Mode active), do not respond automatically
    if (!lead.bot_active) {
      return NextResponse.json({
        reply: null,
        bot_active: false,
        message: 'Bot is currently paused for this lead. Waiting for agent manual reply.'
      });
    }

    // 4. Load recent conversation history for context
    const history = await db.getMessages(leadId);

    // 5. Query Knowledge Base using Gemini (with RAG)
    const reply = await queryKnowledgeBase(message, history);

    // 6. Handle Shadow Mode Activation
    if (reply.trim() === '[UNKNOWN]') {
      // Pause the bot
      await db.updateLeadBotActive(leadId, false);
      
      // Update status to shadow mode / pending verification if they were talking about payments
      let newStatus = lead.status;
      if (message.toLowerCase().includes('pay') || message.toLowerCase().includes('comprar') || message.toLowerCase().includes('pago')) {
        newStatus = 'Pending Verification';
        await db.updateLeadStatus(leadId, 'Pending Verification');
      } else {
        await db.updateLeadStatus(leadId, 'Engaged');
      }

      // Create Knowledge Gap Task
      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Construct context snippet for the gap
      const contextSnippet = history
        .slice(-4)
        .map((m: any) => `${m.sender}: ${m.message}`)
        .join('\n');
      
      await db.addGap(gapId, leadId, message, contextSnippet);

      // Trigger Email Notification for Knowledge Gap
      await alertKnowledgeGap(lead, message);

      // Save bot's fallback pausing message to logs
      const fallbackReply = 'Lo siento, no tengo esa información en este momento. Un agente humano revisará su pregunta y le responderá a la brevedad.';
      await db.addMessage(leadId, 'bot', fallbackReply);

      return NextResponse.json({
        reply: fallbackReply,
        bot_active: false,
        gapCreated: true
      });
    }

    // 7. Save bot reply to log
    await db.addMessage(leadId, 'bot', reply);

    // 8. Dynamic triggers (e.g. check if client is ready for payment verification)
    // If the customer mentions yape, plin, receipt, payment validation, or transfer, and the bot answered
    const paymentKeywords = ['yape', 'plin', 'transferencia', 'banco', 'pago', 'recibo', 'comprobante', 'voucher', 'pagar'];
    const lowerMsg = message.toLowerCase();
    const isPaymentTrigger = paymentKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isPaymentTrigger && lead.status !== 'Pending Verification') {
      // Update status to Pending Verification
      await db.updateLeadStatus(leadId, 'Pending Verification');
      
      // Assign tag "needs-verification"
      const currentTags = lead.tags || [];
      if (!currentTags.includes('needs-verification')) {
        await db.updateLeadTags(leadId, [...currentTags, 'needs-verification']);
      }

      // Trigger Alert Email Notification for Payment Verification
      await alertPaymentVerification({
        ...lead,
        status: 'Pending Verification'
      });
    }

    return NextResponse.json({
      reply,
      bot_active: true
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
