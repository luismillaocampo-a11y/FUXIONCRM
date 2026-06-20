import { NextResponse } from 'next/server';
import { whatsappService } from '@/lib/whatsapp-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, message } = body;

    if (!leadId || !message || !message.toString().trim()) {
      return NextResponse.json({ success: false, error: 'Missing leadId or message' }, { status: 400 });
    }

    await whatsappService.initialize();
    await whatsappService.sendMessageToLead(leadId, message.toString().trim());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/whatsapp/send] error:', error);
    const errorMessage = error?.message || 'Failed to send WhatsApp message';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
