import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireActiveLicense } from '@/lib/api-auth';
import { testProviderKey } from '@/lib/ai-test';

/**
 * POST /api/ai/test-stored { id }
 * Prueba la clave guardada en el servidor por su id, sin exponerla al navegador.
 * Para claves enmascaradas que ya no se pueden enviar en claro.
 */
export async function POST(req: Request) {
  const auth = requireSession(req);
  if ('response' in auth) return auth.response;
  const lic = await requireActiveLicense();
  if ('response' in lic) return lic.response;
  try {
    const { id } = await req.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Falta el id de la clave.' }, { status: 400 });
    }

    const raw = await db.getSystemSetting('ai_api_keys');
    if (!raw) {
      return NextResponse.json({ success: false, error: 'No hay claves guardadas.' }, { status: 404 });
    }

    let list: Array<{ id?: string; provider?: string; apiKey?: string; model?: string }>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('formato inválido');
      list = parsed;
    } catch {
      return NextResponse.json({ success: false, error: 'Claves guardadas con formato inválido.' }, { status: 500 });
    }

    const entry = list.find((k) => k && k.id === id);
    if (!entry || !entry.apiKey || !entry.provider) {
      return NextResponse.json({ success: false, error: 'Clave no encontrada.' }, { status: 404 });
    }

    const result = await testProviderKey(entry.provider, entry.apiKey, entry.model);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al probar la clave guardada.'
    }, { status: 500 });
  }
}
