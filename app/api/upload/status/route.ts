import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se ha proporcionado ningún archivo' }, { status: 400 });
    }

    const originalName = file.name || 'status-media';
    const extension = originalName.includes('.')
      ? originalName.split('.').pop()?.toLowerCase() || 'jpg'
      : 'jpg';

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido (jpg, png, webp, gif, mp4)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 15MB)' }, { status: 413 });
    }
    const buffer = Buffer.from(bytes);

    let mimeType = file.type || (extension === 'mp4' ? 'video/mp4' : 'image/jpeg');
    const isVideo = mimeType.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi'].includes(extension);
    const mediaType = isVideo ? 'video' : 'image';

    // Generar nombre aleatorio seguro que no dependa del nombre original
    const randomHash = crypto.randomBytes(8).toString('hex');
    const uniqueFileName = `status-${Date.now()}-${randomHash}.${extension}`;
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    let publicUrl = `/uploads/status/${uniqueFileName}`;

    // 1. Modo local / contenedor: almacenar en la carpeta multimedia del CRM (public/uploads/status)
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'status');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      console.log(`[Upload Status API] Guardado exitosamente en multimedia local: ${publicUrl}`);
    } catch (fsErr) {
      console.warn('[Upload Status API] Guardado local en disco falló:', fsErr);
    }

    // 2. Persistencia en Base de Datos (Supabase / SQLite) para Cloud Run
    try {
      await db.setSystemSetting(`media:status/${uniqueFileName}`, dataUri);
      await db.setSystemSetting(`media:${uniqueFileName}`, dataUri);
      console.log(`[Upload Status API] ✅ Guardado en DB para Cloud Run: media:status/${uniqueFileName}`);
    } catch (dbErr) {
      console.warn('[Upload Status API] Falló respaldo en DB:', dbErr);
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      mediaType,
      fileName: uniqueFileName,
      sizeBytes: buffer.length
    });
  } catch (err: any) {
    console.error('[Upload Status API] Error:', err);
    return NextResponse.json({ error: err.message || 'Error al procesar archivo multimedia' }, { status: 500 });
  }
}
