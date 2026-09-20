import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/knowledge/restore { items: [...] }
 * Restaura filas respaldadas (Deshacer del vaciado). Topes anti-abuso.
 * Los archivos físicos no se tocaron en el vaciado, así que los enlaces siguen válidos.
 */
export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
      return NextResponse.json({ success: false, error: 'items inválido (1-200)' }, { status: 400 });
    }
    const restored = await db.restoreKBItems(items);
    return NextResponse.json({ success: true, restored });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al restaurar';
    console.error('[api/knowledge/restore] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
