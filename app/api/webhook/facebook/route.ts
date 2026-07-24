import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryKnowledgeBase } from '@/lib/gemini';
import { sendSocialMessage } from '@/lib/social-sender';

export const dynamic = 'force-dynamic';

/**
 * GET /api/webhook/facebook
 * Verificación de Webhook para Facebook Messenger (Meta)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    const verifyToken = await db.getSystemSetting('facebook_verify_token') || 'nutraflow_facebook_token';
    if (token === verifyToken) {
      console.log('[webhook/facebook] Webhook de Facebook verificado con éxito!');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Not Found', { status: 404 });
}

/**
 * POST /api/webhook/facebook
 * Procesamiento de mensajes entrantes de Facebook Messenger
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const messagingItem of entry.messaging || []) {
          const message = messagingItem.message;
          const senderId = messagingItem.sender?.id;

          if (message && senderId && !message.is_echo) {
            const text = message.text || '[Mensaje de Facebook Messenger]';
            const leadId = `fb_${senderId}`;
            const clientName = `Facebook user ${senderId.slice(-4)}`;

            // 1. Crear o actualizar Lead en la Base de Datos
            let lead = await db.getLeadById(leadId);
            if (!lead) {
              lead = await db.upsertLead({
                id: leadId,
                name: clientName,
                phone: leadId,
                status: 'New',
                tags: ['facebook', 'messenger'],
                bot_active: true
              });
            }

            // 2. Guardar mensaje entrante
            await db.addMessage(leadId, 'customer', text, `msg_fb_${Date.now()}`);

            // 3. Respuesta Automática con Gemini IA si el bot está activo
            const aiSetting = await db.getSystemSetting('ai_enabled');
            const isBotActive = lead.bot_active && (aiSetting === null || aiSetting === 'true');

            if (isBotActive) {
              const aiReply = await queryKnowledgeBase(text);
              if (aiReply && aiReply.trim()) {
                await sendSocialMessage({
                  recipientId: senderId,
                  messageText: aiReply,
                  channel: 'facebook'
                });

                await db.addMessage(leadId, 'bot', aiReply, `msg_fb_ai_${Date.now()}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' });
  } catch (error: any) {
    console.error('[webhook/facebook] Error procesando mensaje de Messenger:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
