import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAiGloballyEnabled, setAiGloballyEnabled } from '@/lib/ai-settings';
import { requireSession, maskSecret, maskAiApiKeys } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Claves secretas: jamás se devuelven en claro. Solo flags + máscara.
const SECRET_KEYS = new Set([
  'whatsapp_api_key',
  'whatsapp_verify_token',
  'gemini_api_key',
  'groq_api_key',
  'ai_api_keys',
  'smtp_pass',
  'google_service_account',
  'instagram_access_token',
  'facebook_access_token',
]);

const CONFIG_KEYS = [
  'whatsapp_api_url',
  'whatsapp_api_key',
  'whatsapp_instance',
  'whatsapp_verify_token',
  'gemini_api_key',
  'groq_api_key',
  'ai_api_keys',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'admin_email',
  'ai_enabled',
  'google_sheets_url',
  'google_sheet_id',
  'google_service_account',
  'instagram_access_token',
  'instagram_verify_token',
  'facebook_access_token',
  'facebook_verify_token',
  'appearance_mode',
  'appearance_accent'
];

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const configs: { [key: string]: string | null } = {};
    const masked: { [key: string]: string } = {};
    const configured: { [key: string]: boolean } = {};

    for (const key of CONFIG_KEYS) {
      let dbValue = await db.getSystemSetting(key);
      
      // Fallback to process.env if not set in DB (Only in dev mode)
      const isDev = process.env.NODE_ENV !== 'production';
      if (dbValue === null) {
        if (isDev && key === 'whatsapp_api_url') dbValue = process.env.EVOLUTION_API_URL || '';
        else if (isDev && key === 'whatsapp_api_key') dbValue = process.env.EVOLUTION_API_KEY || '';
        else if (isDev && key === 'whatsapp_instance') dbValue = process.env.EVOLUTION_API_INSTANCE || '';
        else if (isDev && key === 'gemini_api_key') dbValue = process.env.GEMINI_API_KEY || '';
        else if (isDev && key === 'groq_api_key') dbValue = process.env.GROQ_API_KEY || '';
        else if (key === 'smtp_host') dbValue = process.env.SMTP_HOST || '';
        else if (key === 'smtp_port') dbValue = process.env.SMTP_PORT || '';
        else if (key === 'smtp_user') dbValue = process.env.SMTP_USER || '';
        else if (key === 'smtp_pass') dbValue = process.env.SMTP_PASS || '';
        else if (key === 'smtp_from') dbValue = process.env.SMTP_FROM || '';
        else if (key === 'admin_email') dbValue = process.env.ADMIN_EMAIL || '';
        else if (key === 'ai_enabled') {
          dbValue = String(await getAiGloballyEnabled());
        }
      }
      configs[key] = dbValue;
    }

    // Nunca exponer secretos en claro: solo máscara + flag.
    for (const key of SECRET_KEYS) {
      const raw = configs[key];
      if (key === 'ai_api_keys') {
        masked[key] = maskAiApiKeys(raw) ?? '';
      } else {
        masked[key] = maskSecret(raw);
      }
      configured[key] = !!raw;
      configs[key] = null;
    }

    return NextResponse.json({ success: true, configs, masked, configured });
  } catch (err: any) {
    console.error('[api/settings/configs] GET error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const settings = body.settings || {};

    if (typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      if (CONFIG_KEYS.includes(key)) {
        let valStr = String(value).slice(0, 20000);
        // No sobrescribir secretos simples con máscaras o vacíos desde el cliente.
        if (SECRET_KEYS.has(key) && key !== 'ai_api_keys' && (valStr === '' || valStr.includes('****'))) {
          continue;
        }
        // Merge seguro para ai_api_keys: preserva claves reales por id si el cliente
        // envía máscaras o vacíos (evita sobrescribir secretos con "****").
        if (key === 'ai_api_keys') {
          try {
            const incoming = JSON.parse(valStr);
            if (Array.isArray(incoming)) {
              const storedRaw = await db.getSystemSetting('ai_api_keys');
              let stored: Array<Record<string, unknown>> = [];
              try {
                const p = storedRaw ? JSON.parse(storedRaw) : [];
                if (Array.isArray(p)) stored = p;
              } catch {
                stored = [];
              }
              const byId = new Map(stored.map((s) => [String((s as { id?: unknown }).id), s]));
              const merged = incoming.slice(0, 4).map((entry) => {
                const e = entry as Record<string, unknown>;
                const id = String(e.id ?? '');
                const prev = byId.get(id) as Record<string, unknown> | undefined;
                const prevKey = prev ? String(prev.apiKey ?? '') : '';
                const newKey = typeof e.apiKey === 'string' ? e.apiKey : '';
                const keepPrev = !newKey || newKey.includes('****');
                return {
                  ...e,
                  apiKey: keepPrev ? prevKey : newKey.slice(0, 500),
                };
              });
              // Si alguna entrada queda sin clave real y no había previa, se rechaza.
              if (merged.some((m) => !String((m as Record<string, unknown>).apiKey ?? ''))) {
                return NextResponse.json(
                  { success: false, error: 'ai_api_keys contiene claves vacías' },
                  { status: 400 }
                );
              }
              valStr = JSON.stringify(merged);
            }
          } catch {
            return NextResponse.json({ success: false, error: 'ai_api_keys inválido' }, { status: 400 });
          }
        }
        await db.setSystemSetting(key, valStr);
        
        // Sync the in-memory global state if it's the global AI switch
        if (key === 'ai_enabled') {
          await setAiGloballyEnabled(valStr === 'true');
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    console.error('[api/settings/configs] POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
