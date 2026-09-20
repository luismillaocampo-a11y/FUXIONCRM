import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';
import { isCronAuthorized, cronUnauthorized } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    console.warn('[Cron Status] Unauthorized access attempt blocked.');
    return cronUnauthorized();
  }
  try {
    const pendingSchedules = await db.getPendingStatusSchedules();
    console.log(`[Cron Status] Verificando estados programados. Pendientes encontrados: ${pendingSchedules.length}`);

    const results = [];

    for (const schedule of pendingSchedules) {
      try {
        console.log(`[Cron Status] Publicando estado programado ID: ${schedule.id}`);
        await whatsappService.publishStatusToWhatsApp({
          mediaUrl: schedule.media_url,
          mediaType: schedule.media_type || 'image',
          caption: schedule.caption || ''
        });

        await db.markStatusSchedulePublished(schedule.id);
        results.push({ id: schedule.id, status: 'published' });
      } catch (err: any) {
        console.error(`[Cron Status] Error al publicar estado ${schedule.id}:`, err);
        await db.markStatusSchedulePublished(schedule.id, err?.message || 'Error en cron');
        results.push({ id: schedule.id, status: 'failed', error: err?.message });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: pendingSchedules.length,
      results
    });
  } catch (error: any) {
    console.error('[Cron Status] Error en proceso cron:', error);
    return NextResponse.json({ error: error.message || 'Error en cron de estados' }, { status: 500 });
  }
}
