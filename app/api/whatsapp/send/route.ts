import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';
import { requireSession, requireActiveLicense, isAllowedMediaUrl } from '@/lib/api-auth';

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ID_LENGTH = 128;

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
    if (!/^[A-Za-z0-9_.@+\-\s:]+$/.test(cleanLeadId)) {
      return NextResponse.json({ success: false, error: 'leadId inválido' }, { status: 400 });
    }

    const cleanMessage = message.toString().trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!cleanMessage) {
      return NextResponse.json({ success: false, error: 'Mensaje vacío' }, { status: 400 });
    }

    // 1. Guardar en BD inmediatamente (Optimistic UI) para que aparezca al instante en la web
    const tempMsgId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await db.addMessage(cleanLeadId, 'agent', cleanMessage, tempMsgId);
    } catch (dbErr) {
      console.error('[api/whatsapp/send] Error guardando mensaje optimista:', dbErr);
    }

    // 2. Resolver destinatario (teléfono o LID)
    const lead = await db.getLeadById(cleanLeadId);
    // Priorizar número real corto; el LID solo si no hay otro destino.
    // LID = match con whatsapp_lid o 14+ dígitos (móviles AR de 13 son reales).
    const leadLid = typeof lead?.whatsapp_lid === 'string' ? lead.whatsapp_lid.replace(/\D/g, '') : '';
    const lidEvidence = leadLid.length >= 14 ? leadLid : '';
    const isLidVal = (v: unknown) => {
      if (typeof v !== 'string') return false;
      const d = v.replace(/\D/g, '');
      if (!d) return false;
      if (lidEvidence && d === lidEvidence) return true;
      return d.length >= 14;
    };
    const shortNum = (v: unknown) =>
      typeof v === 'string' && v.replace(/\D/g, '').length >= 7 && !isLidVal(v)
        ? v.replace(/\D/g, '')
        : null;
    let targetPhone =
      shortNum(lead?.real_phone) || shortNum(lead?.phone) || lead?.whatsapp_lid || lead?.phone || cleanLeadId;

    if (!/^[+\d][\d\s()+.-]{6,25}$/.test(String(targetPhone))) {
      return NextResponse.json({ success: false, error: 'Destino inválido' }, { status: 400 });
    }

    // JID exacto igual que en broadcast
    const tpDigits = String(targetPhone).replace(/\D/g, '');
    const sendJid = isLidVal(targetPhone) ? `${tpDigits}@lid` : `${tpDigits}@s.whatsapp.net`;

    // 3. Enviar a WhatsApp (Evolution API / Meta con fallback a Baileys)
    let cleanMsgToSend = cleanMessage;
    let mediaUrl: string | undefined = undefined;
    const attachmentMatch = cleanMessage.match(/📎 Imagen adjunta:\s*(\S+)/);
    if (attachmentMatch) {
      const candidate = attachmentMatch[1];
      if (!isAllowedMediaUrl(candidate)) {
        return NextResponse.json({ success: false, error: 'mediaUrl inválida (solo https o imagen subida al CRM)' }, { status: 400 });
      }
      mediaUrl = candidate;
      cleanMsgToSend = cleanMessage.replace(/📎 Imagen adjunta:\s*(\S+)/, '').trim();
    }

    await sendWhatsAppMessageDynamic(targetPhone, cleanMsgToSend, mediaUrl, sendJid);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/whatsapp/send] error:', error);
    const errorMessage = error?.message || 'Error al enviar mensaje por WhatsApp';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

