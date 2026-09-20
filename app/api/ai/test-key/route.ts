import { NextResponse } from 'next/server';
import { requireSession, requireActiveLicense } from '@/lib/api-auth';
import { testProviderKey, VALID_AI_PROVIDERS } from '@/lib/ai-test';

export async function POST(req: Request) {
  const auth = requireSession(req);
  if ('response' in auth) return auth.response;
  const lic = await requireActiveLicense();
  if ('response' in lic) return lic.response;
  try {
    const { provider, apiKey, model } = await req.json();

    if (!provider || !(VALID_AI_PROVIDERS as readonly string[]).includes(String(provider))) {
      return NextResponse.json({ success: false, error: 'Proveedor de IA no reconocido.' }, { status: 400 });
    }

    const result = await testProviderKey(provider, apiKey, model);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al probar la clave de API.'
    }, { status: 500 });
  }
}
