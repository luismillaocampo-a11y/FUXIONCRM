import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSocialMessage } from '@/lib/social-sender';
import { requireSession, requireActiveLicense } from '@/lib/api-auth';
import { stripInternalTagsForSending, sanitizeAiReply } from '@/lib/gemini';

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ID_LENGTH = 128;

function inferChannel(lead: any, leadId: string): 'instagram' | 'facebook' | null {
  const c = String(lead?.channel || '').toLowerCase();
  if (c === 'instagram' || c === 'facebook') return c;
  if (leadId.startsWith('ig_') || String(lead?.phone || '').startsWith('ig_')) return 'instagram';
  if (leadId.startsWith('fb_') || String(lead?.phone || '').startsWith('fb_')) return 'facebook';
  return null;
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  const lic = await requireActiveLicense();
  if ('response' in lic) return lic.response;
  try {
    const body = await request.json();
    const { leadId, message } = body;
    if (!leadId || !message || !message.toString().trim()) {
      return NextResponse.json({ success: false, error: 'Missing leadId or message' }, { status: 400 });
    }
    const cleanLeadId = leadId.toString().trim().slice(0, MAX_ID_LENGTH);
    const rawMessage = message.toString().trim().slice(0, MAX_MESSAGE_LENGTH);
    const cleanMessage = stripInternalTagsForSending(sanitizeAiReply(rawMessage)) || rawMessage;
    if (!cleanMessage) {
      return NextResponse.json({ success: false, error: 'Mensaje vacío' }, { status: 400 });
    }

    const lead = await db.getLeadById(cleanLeadId);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead no encontrado' }, { status: 404 });
    }
    const channel = inferChannel(lead, cleanLeadId);
    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Este lead es de WhatsApp. Usa el envío de WhatsApp.' },
        { status: 400 }
      );
    }

    const recipientId = cleanLeadId.replace(/^(ig_|fb_)/, '');
    if (!recipientId) {
      return NextResponse.json({ success: false, error: 'Destinatario social inválido' }, { status: 400 });
    }

    // Guardado optimista para que aparezca al instante
    try {
      await db.addMessage(cleanLeadId, 'agent', cleanMessage, `web-social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    } catch (e) {
      console.error('[api/social/send] Error guardando mensaje optimista:', e);
    }

    const result = await sendSocialMessage({ recipientId, messageText: cleanMessage, channel });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || `No se pudo enviar a ${channel}. Verifica el Page Access Token en Conexión Redes Sociales.` },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, channel });
  } catch (error: any) {
    console.error('[api/social/send] error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Error al enviar mensaje social' }, { status: 500 });
  }
}
