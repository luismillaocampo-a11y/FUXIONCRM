import crypto from 'crypto';
import { db } from './db';

/** Comparación timing-safe (vacío nunca iguala). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Token de verificación: setting en BD o env (sin fallbacks hardcoded).
 * Devuelve '' si no hay ninguno configurado (el llamador debe fallar cerrado).
 */
export async function getWebhookVerifyToken(
  settingKey: string,
  ...envNames: string[]
): Promise<string> {
  try {
    const fromDb = await db.getSystemSetting(settingKey);
    if (fromDb && fromDb.trim()) return fromDb.trim();
  } catch {
    /* ignore */
  }
  for (const name of envNames) {
    const v = (process.env[name] || '').trim();
    if (v) return v;
  }
  return '';
}

/**
 * Verifica firma Meta X-Hub-Signature-256 con el secret indicado.
 * Si no hay secret configurado, no se exige (compatibilidad Evolution).
 */
export async function verifyMetaSignature(
  request: Request,
  rawBody: string,
  ...secretEnvNames: string[]
): Promise<boolean> {
  let secret = '';
  for (const name of secretEnvNames) {
    const v = (process.env[name] || '').trim();
    if (v) {
      secret = v;
      break;
    }
  }
  if (!secret) return true;
  const sig = request.headers.get('x-hub-signature-256') || '';
  if (!sig.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(sig, expected);
}
