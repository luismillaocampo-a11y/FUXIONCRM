import { NextResponse } from 'next/server';
import { verifyToken } from './auth-utils';

export type Session = { userId: string; email: string };

function getCookieToken(request: Request): string | null {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Devuelve la sesión válida o null. No auto-firma: las rutas /api están excluidas del proxy. */
export function getSession(request: Request): Session | null {
  const token = getCookieToken(request);
  if (!token) return null;
  return verifyToken(token);
}

/** Responde 401 JSON si no hay sesión. Devuelve la sesión si es válida. */
export function requireSession(request: Request): { session: Session } | { response: NextResponse } {
  const session = getSession(request);
  if (!session) {
    return {
      response: NextResponse.json({ success: false, error: 'No autorizado. Inicia sesión.' }, { status: 401 }),
    };
  }
  return { session };
}

/**
 * Auth para crons: acepta sesión válida O CRON_API_KEY por header/query.
 * Sin fallback 'default-secret-key': si CRON_API_KEY no está configurado,
 * solo se acepta sesión (fail-closed para acceso con token).
 */
export function isCronAuthorized(request: Request): boolean {
  if (getSession(request)) return true;
  const configured = (process.env.CRON_API_KEY || '').trim();
  if (!configured) return false;
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('api_key') || '').trim();
    if (q && q === configured) return true;
  } catch {
    /* ignore */
  }
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer === configured) return true;
  return false;
}

export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });
}

/**
 * Exige licencia activa (o en gracia) para acciones con costo/envío.
 * La lectura queda abierta; el bloqueo real vive en el servidor, no en el cliente.
 */
export async function requireActiveLicense(): Promise<{ ok: true } | { response: NextResponse }> {
  try {
    const { ensureActivated } = await import('./license');
    const status = await ensureActivated();
    if (status.state === 'active' || status.state === 'grace') {
      return { ok: true as const };
    }
    return {
      response: NextResponse.json(
        {
          success: false,
          code: 'LICENSE_BLOCKED',
          installId: status.installId,
          error: status.message || 'Licencia bloqueada. Contacta a tu proveedor.',
        },
        { status: 402 }
      ),
    };
  } catch {
    // Ante fallo interno de verificación, no bloquear operación local
    return { ok: true as const };
  }
}

/** Enmascara secretos para nunca exponerlos en claro al cliente. */
export function maskSecret(value: string | null): string {
  if (!value) return '';
  const v = String(value);
  if (v.length <= 8) return '****';
  return `${v.slice(0, 2)}****${v.slice(-2)}`;
}

/** Intenta parsear ai_api_keys sin lanzar. */
export function maskAiApiKeys(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return JSON.stringify(
        parsed.map((k: unknown) => {
          if (k && typeof k === 'object' && 'apiKey' in (k as Record<string, unknown>)) {
            const entry = k as Record<string, unknown>;
            return { ...entry, apiKey: maskSecret(String(entry.apiKey ?? '')) };
          }
          return k;
        })
      );
    }
    return '****';
  } catch {
    return '****';
  }
}

/** Nombre de archivo seguro para /uploads (sin rutas ni caracteres raros). */
export function isSafeUploadsPath(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('/uploads/')) return false;
  const rest = value.slice('/uploads/'.length);
  if (!rest || rest.length > 200 || rest.includes('\\') || rest.includes('..')) return false;
  const segs = rest.split('/');
  // Se permite como máximo un subdirectorio (ej. /uploads/status/x.jpg)
  if (segs.length > 2 || segs.some((s) => !s)) return false;
  const name = segs[segs.length - 1];
  if (segs.length === 2 && segs[0] !== 'status') return false;
  return /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif|mp4)$/i.test(name);
}

/**
 * URLs de medios aceptadas en campañas/estados/envíos:
 * - https://... (remotas, las descarga Baileys)
 * - /uploads/<archivo> generado por /api/upload (local, se resuelve a Buffer)
 * Se rechaza http://, data:, javascript:, rutas arbitrarias, etc.
 */
export function isAllowedMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  if (value.length > 2048) return false;
  if (/^https:\/\/\S+$/.test(value)) return true;
  return isSafeUploadsPath(value);
}
