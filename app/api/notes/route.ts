import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 2000;
const MAX_ID_LENGTH = 128;

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    const notes = await db.getNotesByLead(leadId);
    return NextResponse.json(notes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { leadId, content } = body;
    if (!leadId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing leadId or content' }, { status: 400 });
    }
    if (typeof leadId !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    const cleanContent = content.trim().slice(0, MAX_CONTENT_LENGTH);
    const lead = await db.getLeadById(leadId.toString().slice(0, MAX_ID_LENGTH));
    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }
    const id = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const note = await db.addNote(id, lead.id, cleanContent);
    return NextResponse.json({ success: true, note });
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
    if (!id) return NextResponse.json({ error: 'Missing note id' }, { status: 400 });
    await db.deleteNote(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
