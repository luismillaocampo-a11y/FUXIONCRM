import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Resolves gap: inserts answer to KB, marks resolved, reactivates lead bot.
    await db.resolveGap(id, answer);

    return NextResponse.json({ success: true, message: 'Knowledge gap resolved and bot reactivated.' });
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
