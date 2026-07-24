import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/ai-rules
 * Returns all configured AI behavior rules.
 */
export async function GET() {
  try {
    const rules = await db.getAIRules();
    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    console.error('Error fetching AI rules:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/settings/ai-rules
 * Body: { title: string, instruction: string, category?: string }
 * Adds a new AI behavior rule.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, instruction, category } = body;

    if (!title || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Título e instrucción son obligatorios' },
        { status: 400 }
      );
    }

    const newRule = await db.addAIRule({ title, instruction, category });
    return NextResponse.json({ success: true, rule: newRule });
  } catch (err: any) {
    console.error('Error adding AI rule:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/ai-rules
 * Body: { id: string, is_active: boolean }
 * Toggles a rule on or off.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'ID y estado is_active son obligatorios' },
        { status: 400 }
      );
    }

    const updated = await db.toggleAIRule(id, is_active);
    return NextResponse.json({ success: true, rule: updated });
  } catch (err: any) {
    console.error('Error toggling AI rule:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/ai-rules?id=xxx
 * Deletes an AI behavior rule.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el parámetro ID' },
        { status: 400 }
      );
    }

    await db.deleteAIRule(id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting AI rule:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
