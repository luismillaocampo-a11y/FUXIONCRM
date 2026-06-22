import { NextResponse } from 'next/server';
import { whatsappService } from '@/lib/whatsapp-service';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, message } = body;

    if (!leadId || !message || !message.toString().trim()) {
      return NextResponse.json({ success: false, error: 'Missing leadId or message' }, { status: 400 });
    }

    // 1. Guardar en BD inmediatamente (Optimistic UI) para que aparezca al instante en la web
    const tempMsgId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await db.addMessage(leadId, 'agent', message.toString().trim(), tempMsgId);
    } catch (dbErr) {
      console.error('[api/whatsapp/send] Error guardando mensaje optimista:', dbErr);
    }

    // 2. Enviar a WhatsApp
    await whatsappService.initialize();
    await whatsappService.sendMessageToLead(leadId, message.toString().trim());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/whatsapp/send] error:', error);
    const errorMessage = error?.message || 'Failed to send WhatsApp message';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
