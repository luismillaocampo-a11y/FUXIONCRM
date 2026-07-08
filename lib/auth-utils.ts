import crypto from 'crypto';

const SALT = process.env.AUTH_SALT || 'fuxionflow_crm_default_salt_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'fuxionflow_crm_secret_session_encryption_key_2026';

// 32-byte key derived from secret
const ENCRYPTION_KEY = crypto.scryptSync(JWT_SECRET, 'session-salt', 32);
const ALGORITHM = 'aes-256-cbc';

/**
 * Hashes a plain-text password using SHA-512 with salt.
 */
export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha512').toString('hex');
}

/**
 * Generates an encrypted session token string containing user metadata and expiration.
 */
export function signToken(payload: { userId: string; email: string }, expiresInSeconds = 86400): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const data = JSON.stringify({ ...payload, expiresAt });
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV concatenated with encrypted text
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a session token and returns the verified payload if valid.
 */
export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload = JSON.parse(decrypted);
    
    // Check expiration
    if (Date.now() > payload.expiresAt) {
      console.warn('[auth-utils] Session token has expired');
      return null;
    }
    
    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (err) {
    console.error('[auth-utils] Token verification failed:', err);
    return null;
  }
}
