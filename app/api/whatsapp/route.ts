import { NextResponse } from 'next/server';
import { whatsappService } from '@/lib/whatsapp-service';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  console.log('[api/whatsapp] GET called');
  const { searchParams } = new URL(request.url);
  const statusOnly = searchParams.get('statusOnly') === 'true';

  if (statusOnly) {
    if (!whatsappService.status || whatsappService.status === 'disconnected') {
      try {
        const session = await db.getWhatsappSession('default');
        if (session && session.creds && session.creds.me && session.creds.me.id && !session.creds.me.id.startsWith('placeholder')) {
          whatsappService.initialize().catch((err: any) => console.error('[api/whatsapp] Background auto-init error:', err));
          return NextResponse.json({ 
            success: true, 
            status: 'connected'
          });
        }
      } catch (dbErr: any) {
        console.error('[api/whatsapp] Error checking persisted WhatsApp session:', dbErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      status: whatsappService.status ?? 'disconnected' 
    });
  }

  try {
    await whatsappService.initialize();
  } catch (initErr: any) {
    console.error('[api/whatsapp] initialize() threw error:', initErr);
    if (initErr?.stack) console.error(initErr.stack);
    return NextResponse.json({ success: false, error: String(initErr) }, { status: 500 });
  }

  if (whatsappService.error) {
    console.error('[api/whatsapp] whatsappService.error set:', whatsappService.error, 'status:', whatsappService.status);
    return NextResponse.json({
      success: false,
      error: whatsappService.error,
      status: whatsappService.status ?? 'error',
    }, { status: 500 });
  }

  try {
    const qrcode = await whatsappService.getQrDataUrl();
    console.log('[api/whatsapp] getQrDataUrl success, status:', whatsappService.status);
    return NextResponse.json({ success: true, qrcode, status: whatsappService.status ?? 'unknown' });
  } catch (error: any) {
    console.error('[api/whatsapp] getQrDataUrl error:', error);
    if (error?.stack) console.error(error.stack);
    return NextResponse.json({ success: false, error: error?.message || 'Error al obtener el QR', status: whatsappService.status ?? 'error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[api/whatsapp] POST called');

  let body: any = {};
  try {
    body = await request.json();
  } catch (parseError) {
    console.warn('[api/whatsapp] POST body parse failed, using empty object');
  }

  const action = (body.action || '').toString();
  console.log('[api/whatsapp] POST action:', action);

  if (action === 'refresh' || action === 'restart') {
    await whatsappService.reset();
    try {
      await whatsappService.initialize();
    } catch (initErr: any) {
      console.error('[api/whatsapp] initialize() after reset threw error:', initErr);
      if (initErr?.stack) console.error(initErr.stack);
      return NextResponse.json({ success: false, error: String(initErr) }, { status: 500 });
    }

    try {
      const qrcode = await whatsappService.getQrDataUrl(10000);
      return NextResponse.json({ success: true, message: 'WhatsApp socket restarted', qrcode, status: whatsappService.status ?? 'unknown' });
    } catch (error: any) {
      console.error('[api/whatsapp] getQrDataUrl after reset error:', error);
      if (error?.stack) console.error(error.stack);
      return NextResponse.json({ success: false, error: error?.message || 'Error al reiniciar el socket', status: whatsappService.status ?? 'error' }, { status: 500 });
    }
  }

  if (action === 'close') {
    await whatsappService.reset();
    return NextResponse.json({ success: true, message: 'Closed WhatsApp socket' });
  }

  return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
}
