import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4']);
const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (typeof file.size === 'number' && file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 413 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido (jpg, png, webp, gif, mp4)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 413 });
    }
    const buffer = Buffer.from(bytes);

    let mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
      mimeType = extension === 'mp4' ? 'video/mp4' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    }
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    let publicUrl = dataUri;

    // Nombre seguro: sin rutas ni caracteres especiales (evita path traversal)
    const safeBase = file.name
      .split('/').pop()!.split('\\').pop()!
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80) || 'imagen';

    const uniqueFileName = `broadcast-${Date.now()}-${safeBase}`;

    // 1. Guardar en disco local (public/uploads)
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      publicUrl = `/uploads/${uniqueFileName}`;
      console.log(`[Upload API] Saved file locally: ${publicUrl}`);
    } catch (err) {
      console.warn('[Upload API] Local save failed, using Data URI:', err);
    }

    // 2. Guardar en base de datos para persistencia permanente en Cloud Run
    try {
      await db.setSystemSetting(`media:${uniqueFileName}`, dataUri);
    } catch (dbErr) {
      console.warn('[Upload API] Database media save warning:', dbErr);
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('[Upload API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
