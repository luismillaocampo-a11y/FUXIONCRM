import { NextResponse } from 'next/server';
import { backupSqliteDb, getAppDataStorageDir } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/backup
 * Crea un respaldo manual de SQLite en %APPDATA%/NutraFlow CRM/backups/.
 */
export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const dest = await backupSqliteDb(7);
    if (!dest) {
      return NextResponse.json({ success: false, error: 'SQLite local no disponible' }, { status: 500 });
    }
    return NextResponse.json({ success: true, path: dest, dir: `${getAppDataStorageDir()}\\backups` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al crear respaldo';
    console.error('[api/settings/backup] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
