import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { analyzeMultimediaFile } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const KB_ALLOWED_EXT = new Set(['pdf', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mkv']);
const KB_MAX_BYTES = 20 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const items = await db.getKBItems();
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileTypeInput = formData.get('fileType') as string; // 'pdf', 'txt', 'image', 'mp4'
    const titleInput = formData.get('title') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const title = (typeof titleInput === 'string' && titleInput.trim() ? titleInput.trim() : file.name).slice(0, 200);
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!KB_ALLOWED_EXT.has(extension)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
    }
    
    // Resolve file type if not provided
    let fileType = fileTypeInput;
    if (!fileType) {
      if (['pdf'].includes(extension || '')) fileType = 'pdf';
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')) fileType = 'image';
      else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) fileType = 'mp4';
      else fileType = 'txt';
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > KB_MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 20MB)' }, { status: 413 });
    }
    const buffer = Buffer.from(bytes);

    // Construct a Base64 Data URI to avoid write operations on read-only serverless filesystems (Vercel)
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'image': 'image/jpeg',
      'mp4': 'video/mp4'
    };
    const mimeType = mimeTypes[fileType] || file.type || 'application/octet-stream';
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // 1. Guardado local en public/uploads (modo local, sin Supabase Storage)
    let publicUrl = dataUri;

    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const safeBase = file.name.split('/').pop()!.split('\\').pop()!.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'archivo';
      const uniqueFileName = `${Date.now()}-${safeBase}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      publicUrl = `/uploads/${uniqueFileName}`;
      console.log(`Saved file locally for development: ${publicUrl}`);
    } catch (err) {
      console.warn('Local filesystem write failed. Using Data URI instead:', err);
    }


    // 2. Perform Gemini multimodal extraction
    const { content, summary } = await analyzeMultimediaFile(file.name, fileType, buffer);

    // 3. Save to database
    const kbId = `kb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem = await db.addKBItem(kbId, title, fileType, content, summary, publicUrl);

    return NextResponse.json({
      success: true,
      item: newItem
    });

  } catch (error: any) {
    console.error('KB Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    // Vaciar base completa (filas; archivos físicos intactos para Deshacer perfecto)
    if (searchParams.get('all') === 'true') {
      const deleted = await db.deleteAllKBItems();
      return NextResponse.json({ success: true, deleted });
    }
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // Optional: read item details to delete file locally
    const items = await db.getKBItems();
    const item = items.find((i: any) => i.id === id);
    
    if (item && item.file_path && item.file_path.startsWith('/uploads/')) {
      const relativePath = item.file_path;
      const absolutePath = path.join(process.cwd(), 'public', relativePath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (err) {
          console.error(`Failed to delete local file ${absolutePath}:`, err);
        }
      }
    }

    await db.deleteKBItem(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
