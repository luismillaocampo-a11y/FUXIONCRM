import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeMultimediaFile } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const items = await db.getKBItems();
    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileTypeInput = formData.get('fileType') as string; // 'pdf', 'txt', 'image', 'mp4'
    const titleInput = formData.get('title') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const title = titleInput || file.name;
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Resolve file type if not provided
    let fileType = fileTypeInput;
    if (!fileType) {
      if (['pdf'].includes(extension || '')) fileType = 'pdf';
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')) fileType = 'image';
      else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) fileType = 'mp4';
      else fileType = 'txt';
    }

    const bytes = await file.arrayBuffer();
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

    // Optionally attempt local save only if we have write permissions (e.g. local development)
    let publicUrl = dataUri;
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      // If we are not on Vercel/Lambda or if uploadsDir already exists and is writable, try writing
      if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = path.join(uploadsDir, uniqueFileName);
        fs.writeFileSync(filePath, buffer);
        publicUrl = `/uploads/${uniqueFileName}`;
        console.log(`Saved file locally for development: ${publicUrl}`);
      }
    } catch (err) {
      console.warn('Skipping local filesystem write (read-only environment). Using Data URI instead:', err);
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
  try {
    const { searchParams } = new URL(request.url);
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
