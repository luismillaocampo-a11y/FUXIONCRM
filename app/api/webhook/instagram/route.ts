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
  return getWebhookVerifyToken('instagram_verify_token', 'INSTAGRAM_VERIFY_TOKEN');
}

async function verifySignature(request: Request, rawBody: string): Promise<boolean> {
  return verifyMetaSignature(request, rawBody, 'INSTAGRAM_APP_SECRET', 'FACEBOOK_APP_SECRET');
}

/**
 * GET /api/webhook/instagram
 * Verificación de Webhook para Instagram Direct (Meta)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token) {
    const verifyToken = await getVerifyToken();
    if (!verifyToken) {
      console.error('[webhook/instagram] Verify token no configurado. Define INSTAGRAM_VERIFY_TOKEN.');
      return new Response('Webhook no configurado', { status: 500 });
    }
    if (timingSafeEqual(token, verifyToken)) {
      console.log('[webhook/instagram] Webhook de Instagram verificado con éxito!');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }
  return new Response('Not Found', { status: 404 });
}

/**
 * POST /api/webhook/instagram
 * Procesamiento de DMs entrantes de Instagram
 */
export async function POST(request: Request) {
  let body: any;
  try {
    const rawBody = await request.text();
    if (!(await verifySignature(request, rawBody))) {
      console.warn('[webhook/instagram] Firma Meta inválida.');
      return NextResponse.json({ error: 'Unauthorized: firma inválida' }, { status: 401 });
    }
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ success: true, message: 'Ignored: invalid JSON' });
    }

    if (body.object === 'instagram' || body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const messagingItem of entry.messaging || entry.changes || []) {
          const message = messagingItem.message;
          const senderId = messagingItem.sender?.id;

          if (message && senderId && !message.is_echo) {
            const text = message.text || '[Mensaje multimedia de Instagram]';
            const leadId = `ig_${senderId}`;
            const clientName = messagingItem.sender?.username ? `@${messagingItem.sender.username}` : `Instagram user ${senderId.slice(-4)}`;

            // 1. Crear o actualizar Lead en la Base de Datos
            let lead = await db.getLeadById(leadId);
            if (!lead) {
              lead = await db.upsertLead({
                id: leadId,
                name: clientName,
                phone: leadId,
                status: 'New',
                tags: ['instagram', 'ig-dm'],
                bot_active: true,
                channel: 'instagram'
              });
            }

            // 2. Guardar mensaje entrante
            await db.addMessage(leadId, 'customer', text, `msg_ig_${Date.now()}`);

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
                    channel: 'instagram'
                  });

                  await db.addMessage(leadId, 'bot', aiReply, `msg_ig_ai_${Date.now()}`);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' });
  } catch (error: any) {
    console.error('[webhook/instagram] Error procesando DM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
