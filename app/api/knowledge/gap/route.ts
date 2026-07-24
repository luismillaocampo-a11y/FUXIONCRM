import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';

export async function GET() {
  try {
    const gaps = await db.getGaps();
    return NextResponse.json(gaps);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, answer } = body;

    if (!id || !answer) {
      return NextResponse.json({ error: 'Missing id or answer' }, { status: 400 });
    }

    // 1. Obtener los detalles de la duda para enviar la respuesta al cliente
    const gaps = await db.getGaps();
    const gap = (gaps || []).find((g: any) => g.id === id);

    // 2. Resolves gap: inserts answer to KB, marks resolved, reactivates lead bot.
    await db.resolveGap(id, answer);

    // 3. Enviar la respuesta directamente al WhatsApp del cliente si tiene teléfono registrado
    if (gap && gap.leads && gap.leads.phone) {
      try {
        await sendWhatsAppMessageDynamic(gap.leads.phone, answer);
        await db.addMessage(gap.lead_id || gap.leads.id, 'bot', answer);
      } catch (wsErr) {
        console.error('[knowledge/gap] Error enviando respuesta por WhatsApp:', wsErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Knowledge gap resolved, answer sent to lead, and bot reactivated.' });
  } catch (error: any) {
    console.error('Gap Resolution Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing gap id' }, { status: 400 });
    }

    // Delete the gap (also reactivates the bot for the associated lead)
    await db.deleteGap(id);

    return NextResponse.json({ success: true, message: 'Knowledge gap deleted.' });
  } catch (error: any) {
    console.error('Gap Deletion Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
