import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await props.params;
    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    // Prevenir directory traversal
    const safeSegments = pathSegments.map((s) => s.replace(/[^a-zA-Z0-9._-]/g, ''));
    if (safeSegments.some((s) => s.includes('..') || !s)) {
      return new Response('Forbidden', { status: 403 });
    }

    const relPath = safeSegments.join('/');
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...safeSegments);

    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 1. Si el archivo existe en el disco local
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Fallback a Supabase / DB si el archivo fue subido en otra réplica o antes de reiniciar
    try {
      const mediaKey = `media:${relPath}`;
      const directKey = `media:${safeSegments[safeSegments.length - 1]}`;
      const mediaDataUri = (await db.getSystemSetting(mediaKey)) || (await db.getSystemSetting(directKey));
      if (mediaDataUri && mediaDataUri.startsWith('data:')) {
        const base64Data = mediaDataUri.split(',')[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          // Cachear en disco para responder instantáneamente en siguientes peticiones
          const parentDir = path.dirname(filePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(filePath, buffer);

          return new Response(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('[Uploads] Fallback de lectura en DB falló:', dbErr);
    }

    return new Response('File Not Found', { status: 404 });
  } catch (err) {
    console.error('[Uploads Route] Error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
