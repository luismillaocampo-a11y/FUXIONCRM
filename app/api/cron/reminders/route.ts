import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';
import { isCronAuthorized, cronUnauthorized } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

async function sendWhatsAppMessage(phone: string, text: string) {
  // Modo local: Baileys directo (código Evolution retirado)
  await whatsappService.sendMessageToPhone(phone, text);
}

async function handleCron(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      console.warn('[Cron/Reminders] Unauthorized access attempt blocked.');
      return cronUnauthorized();
    }

    console.log('[Cron/Reminders] Running pending reminders check...');
    const pending = await db.getPendingReminders();
    const processed: { id: string; leadId: string; message: string }[] = [];

    for (const reminder of pending) {
      const phone = reminder.leads?.phone || reminder.lead_phone;
      if (!phone) {
        console.warn(`[Cron/Reminders] No phone for reminder ${reminder.id}, skipping`);
        continue;
      }

      try {
        await sendWhatsAppMessage(phone, reminder.message);
        await db.addMessage(reminder.lead_id, 'bot', reminder.message);
        await db.markReminderSent(reminder.id);
        processed.push({ id: reminder.id, leadId: reminder.lead_id, message: reminder.message });
        console.log(`[Cron/Reminders] Sent reminder ${reminder.id} to ${phone}`);
      } catch (err) {
        console.error(`[Cron/Reminders] Failed to send reminder ${reminder.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders cron executed. Sent ${processed.length} of ${pending.length} pending reminders.`,
      processed
    });
  } catch (error: any) {
    console.error('[Cron/Reminders] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
