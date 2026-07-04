import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    const reminders = await db.getRemindersByLead(leadId);
    return NextResponse.json(reminders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, message, scheduledAt } = body;
    if (!leadId || !message?.trim() || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields: leadId, message, scheduledAt' }, { status: 400 });
    }
    const id = `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const reminder = await db.addReminder(id, leadId, message.trim(), scheduledAt);
    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing reminder id' }, { status: 400 });
    await db.deleteReminder(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
