import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, message } = body;

    if (!leadId || !message || !message.toString().trim()) {
      return NextResponse.json({ success: false, error: 'Missing leadId or message' }, { status: 400 });
    }

    const cleanMessage = message.toString().trim();

    // 1. Guardar en BD inmediatamente (Optimistic UI) para que aparezca al instante en la web
    const tempMsgId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await db.addMessage(leadId, 'agent', cleanMessage, tempMsgId);
    } catch (dbErr) {
      console.error('[api/whatsapp/send] Error guardando mensaje optimista:', dbErr);
    }

    // 2. Resolver destinatario (teléfono)
    const lead = await db.getLeadById(leadId);
    const phone = lead?.phone || leadId;

    // 3. Enviar a WhatsApp (Evolution API / Meta con fallback a Baileys)
    await sendWhatsAppMessageDynamic(phone, cleanMessage);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/whatsapp/send] error:', error);
    const errorMessage = error?.message || 'Failed to send WhatsApp message';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

