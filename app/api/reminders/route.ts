import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_ID_LENGTH = 128;

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
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
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { leadId, message, scheduledAt } = body;
    if (!leadId || !message?.trim() || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields: leadId, message, scheduledAt' }, { status: 400 });
    }
    if (typeof leadId !== 'string' || typeof message !== 'string' || typeof scheduledAt !== 'string') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'scheduledAt debe ser una fecha futura válida' }, { status: 400 });
    }
    const lead = await db.getLeadById(leadId.slice(0, MAX_ID_LENGTH));
    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }
    const id = `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const reminder = await db.addReminder(id, lead.id, message.trim().slice(0, MAX_MESSAGE_LENGTH), scheduledAt);
    return NextResponse.json({ success: true, reminder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
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
