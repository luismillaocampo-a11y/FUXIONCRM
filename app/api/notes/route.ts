import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
  try {
    const body = await request.json();
    const { leadId, content } = body;
    if (!leadId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing leadId or content' }, { status: 400 });
    }
    const id = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const note = await db.addNote(id, leadId, content.trim());
    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
