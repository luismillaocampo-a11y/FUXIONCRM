import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Reglas núcleo del sistema: no se pueden eliminar (protegen tono, 1-producto y entrega).
const PROTECTED_RULES = new Set(['rule-1', 'rule-2', 'rule-3']);

/**
 * GET /api/settings/ai-rules
 * Returns all configured AI behavior rules.
 */
export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
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
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { id, title, instruction, category } = body;

    if (!title || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Título e instrucción son obligatorios' },
        { status: 400 }
      );
    }

    if (typeof title !== 'string' || typeof instruction !== 'string') {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
    }
    if (title.trim().length > 120 || instruction.trim().length > 2000) {
      return NextResponse.json({ success: false, error: 'Título (120) o instrucción (2000) muy largos' }, { status: 400 });
    }
    if (category !== undefined && (typeof category !== 'string' || category.length > 80)) {
      return NextResponse.json({ success: false, error: 'Categoría inválida' }, { status: 400 });
    }

    const savedRule = await db.addAIRule({ id, title: title.trim(), instruction: instruction.trim(), category });
    return NextResponse.json({ success: true, rule: savedRule });
  } catch (err: any) {
    console.error('Error saving AI rule:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/ai-rules
 * Body: { id: string, is_active: boolean }
 * Toggles a rule on or off.
 */
export async function PATCH(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
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
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el parámetro ID' },
        { status: 400 }
      );
    }

    if (PROTECTED_RULES.has(id)) {
      return NextResponse.json(
        { success: false, error: 'Esta regla es del sistema y no se puede eliminar (puedes desactivarla)' },
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
