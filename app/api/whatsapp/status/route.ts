import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const schedules = await db.getStatusSchedules();
    return NextResponse.json(schedules);
  } catch (error: any) {
    console.error('[API WhatsApp Status] GET Error:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener historial de estados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { action, library_id, media_url, media_type, caption, scheduled_at, recurrence_type, recurrence_days } = body;

    if (!media_url || typeof media_url !== 'string') {
      return NextResponse.json({ error: 'Se requiere una imagen o video para el estado' }, { status: 400 });
    }

    if (!/^https:\/\/\S{1,2048}$/.test(media_url) && !media_url.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'media_url inválida (solo https o /uploads/)' }, { status: 400 });
    }

    const cleanCaption = typeof caption === 'string' ? caption.slice(0, 1000) : '';

    if (action === 'publish_now') {
      try {
        console.log(`[API WhatsApp Status] Publicando estado ahora`);
        const messageId = await whatsappService.publishStatusToWhatsApp({
          mediaUrl: media_url,
          mediaType: media_type || (media_url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
          caption: cleanCaption
        });

        const created = await db.createStatusSchedule({
          library_id: typeof library_id === 'string' ? library_id.slice(0, 128) : undefined,
          media_url,
          media_type: media_type || (media_url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
          caption: cleanCaption,
          scheduled_at: null,
          recurrence_type: 'none',
          status: 'published',
          published_at: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          message: 'Estado de WhatsApp publicado exitosamente',
          messageId: messageId || null,
          item: created
        });
      } catch (publishErr: any) {
        console.error('[API WhatsApp Status] Error al publicar estado en WhatsApp:', publishErr);
        
        // Registrar el intento fallido en el historial
        await db.createStatusSchedule({
          library_id: typeof library_id === 'string' ? library_id.slice(0, 128) : undefined,
          media_url,
          media_type: media_type || 'image',
          caption: cleanCaption,
          status: 'failed',
          error_message: publishErr?.message || 'Error al conectar con WhatsApp'
        });

        return NextResponse.json({
          success: false,
          error: `Error al publicar en WhatsApp: ${publishErr?.message || 'Verifica la conexión'}`
        }, { status: 500 });
      }
    } else {
      // Programar para fecha y hora futura
      if (!scheduled_at || typeof scheduled_at !== 'string') {
        return NextResponse.json({ error: 'Se requiere la fecha y hora para programar el estado' }, { status: 400 });
      }

      const when = new Date(scheduled_at);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduled_at debe ser una fecha futura válida' }, { status: 400 });
      }

      const cleanRecurrence = recurrence_type === 'daily' || recurrence_type === 'weekdays' ? recurrence_type : 'none';
      const cleanDays = Array.isArray(recurrence_days)
        ? recurrence_days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7)
        : [];

      const created = await db.createStatusSchedule({
        library_id: typeof library_id === 'string' ? library_id.slice(0, 128) : undefined,
        media_url,
        media_type: media_type || (media_url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
        caption: cleanCaption,
        scheduled_at,
        recurrence_type: cleanRecurrence,
        recurrence_days: cleanDays,
        status: 'pending'
      });

      return NextResponse.json({
        success: true,
        message: cleanRecurrence !== 'none' 
          ? `Estado recurrente (${cleanRecurrence === 'daily' ? 'Diario' : 'Lunes a Viernes'}) programado con éxito`
          : 'Estado programado correctamente',
        item: created
      });
    }
  } catch (error: any) {
    console.error('[API WhatsApp Status] POST Error:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar la solicitud de estado' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la programación a cancelar' }, { status: 400 });
    }

    await db.deleteStatusSchedule(id);
    return NextResponse.json({ success: true, message: 'Programación eliminada' });
  } catch (error: any) {
    console.error('[API WhatsApp Status] DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar programación' }, { status: 500 });
  }
}
