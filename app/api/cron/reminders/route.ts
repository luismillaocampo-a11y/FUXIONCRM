import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

const CRON_API_KEY = process.env.CRON_API_KEY || 'default-secret-key';

async function sendWhatsAppMessage(phone: string, text: string) {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_API_INSTANCE;

  if (url && apiKey && instance) {
    const cleanPhone = phone.replace(/\D/g, '');
    const endpoint = `${url.replace(/\/$/, '')}/message/sendText/${instance}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ number: cleanPhone, text })
      });
      if (response.ok) return;
    } catch (err) {
      console.error('[cron/reminders] Evolution API failed, falling back to Baileys:', err);
    }
  }
  await whatsappService.sendMessageToPhone(phone, text);
}

async function handleCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const token = searchParams.get('api_key') || (authHeader ? authHeader.replace('Bearer ', '') : null);

    if (!token || token !== CRON_API_KEY) {
      console.warn('[Cron/Reminders] Unauthorized access attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });
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
