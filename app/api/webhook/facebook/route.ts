import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryKnowledgeBase, sanitizeAiReply, stripInternalTagsForSending } from '@/lib/gemini';
import { sendSocialMessage } from '@/lib/social-sender';
import {
  timingSafeEqual,
  getWebhookVerifyToken,
  verifyMetaSignature,
} from '@/lib/webhook-auth';

export const dynamic = 'force-dynamic';

async function getVerifyToken(): Promise<string> {
  return getWebhookVerifyToken('facebook_verify_token', 'FACEBOOK_VERIFY_TOKEN');
}

async function verifySignature(request: Request, rawBody: string): Promise<boolean> {
  return verifyMetaSignature(request, rawBody, 'FACEBOOK_APP_SECRET');
}

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
    const verifyToken = await getVerifyToken();
    if (!verifyToken) {
      console.error('[webhook/facebook] Verify token no configurado. Define FACEBOOK_VERIFY_TOKEN.');
      return new Response('Webhook no configurado', { status: 500 });
    }
    if (timingSafeEqual(token, verifyToken)) {
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
  let body: any;
  try {
    const rawBody = await request.text();
    if (!(await verifySignature(request, rawBody))) {
      console.warn('[webhook/facebook] Firma Meta inválida.');
      return NextResponse.json({ error: 'Unauthorized: firma inválida' }, { status: 401 });
    }
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ success: true, message: 'Ignored: invalid JSON' });
    }

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
                bot_active: true,
                channel: 'facebook'
              });
            }

            // 2. Guardar mensaje entrante
            await db.addMessage(leadId, 'customer', text, `msg_fb_${Date.now()}`);

            // 3. Respuesta Automática con Gemini IA si el bot está activo
            const aiSetting = await db.getSystemSetting('ai_enabled');
            const isBotActive = lead.bot_active && (aiSetting === null || aiSetting === 'true');

            if (isBotActive) {
              const rawReply = await queryKnowledgeBase(text);
              const sanitized = sanitizeAiReply(rawReply);
              if (sanitized.trim() === '[UNKNOWN]' || sanitized.trim().startsWith('[UNKNOWN] ')) {
                await db.addGap(`gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, leadId, text, '');
              } else {
                const aiReply = stripInternalTagsForSending(sanitized);
                if (aiReply) {
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
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' });
  } catch (error: any) {
    console.error('[webhook/facebook] Error procesando mensaje de Messenger:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
