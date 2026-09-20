import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_ID_LENGTH = 128;

/**
 * POST /api/leads/merge
 * Fusiona dos leads manualmente: { sourceId, targetId }.
 * Mueve mensajes/notas/recordatorios/gaps al target y elimina el origen.
 * Solo coincidencias decididas por el operador (el auto-merge solo usa match exacto).
 */
export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { sourceId, targetId } = body;

    if (typeof sourceId !== 'string' || typeof targetId !== 'string' || !sourceId || !targetId) {
      return NextResponse.json({ success: false, error: 'sourceId y targetId son obligatorios' }, { status: 400 });
    }
    if (sourceId.length > MAX_ID_LENGTH || targetId.length > MAX_ID_LENGTH) {
      return NextResponse.json({ success: false, error: 'IDs inválidos' }, { status: 400 });
    }
    if (sourceId === targetId) {
      return NextResponse.json({ success: false, error: 'No se puede fusionar un lead consigo mismo' }, { status: 400 });
    }

    const [source, target] = await Promise.all([db.getLeadById(sourceId), db.getLeadById(targetId)]);
    if (!source) {
      return NextResponse.json({ success: false, error: 'Lead origen no encontrado' }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ success: false, error: 'Lead destino no encontrado' }, { status: 404 });
    }

    await db.mergeLeads(source.id, target.id);
    const merged = await db.getLeadById(target.id);
    return NextResponse.json({ success: true, lead: merged });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al fusionar leads';
    console.error('[api/leads/merge] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
