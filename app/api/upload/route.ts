import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let mimeType = file.type || 'application/octet-stream';
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    let publicUrl = dataUri;
    let uploadedToSupabase = false;

    // 1. Try uploading to Supabase Storage 'knowledge' bucket
    if (supabase) {
      try {
        const uniqueFileName = `broadcast-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('knowledge')
          .upload(uniqueFileName, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('knowledge')
            .getPublicUrl(uniqueFileName);

          if (publicUrlData?.publicUrl) {
            publicUrl = publicUrlData.publicUrl;
            uploadedToSupabase = true;
            console.log(`[Upload API] Saved to Supabase: ${publicUrl}`);
          }
        } else if (uploadError) {
          console.warn('[Upload API] Supabase storage upload error:', uploadError.message);
        }
      } catch (err: any) {
        console.warn('[Upload API] Supabase storage exception:', err?.message || err);
      }
    }

    // 2. Fallback to local files for local dev
    if (!uploadedToSupabase) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const uniqueFileName = `broadcast-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
          const filePath = path.join(uploadsDir, uniqueFileName);
          fs.writeFileSync(filePath, buffer);
          publicUrl = `/uploads/${uniqueFileName}`;
          uploadedToSupabase = true;
          console.log(`[Upload API] Saved file locally: ${publicUrl}`);
        }
      } catch (err) {
        console.warn('[Upload API] Local save fallback failed:', err);
      }
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('[Upload API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
