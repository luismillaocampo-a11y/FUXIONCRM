import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Sesión no autenticada.' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se subió ninguna imagen.' }, { status: 400 });
    }

    // Validate type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de archivo inválido. Solo se permite PNG, JPG y WebP.' }, { status: 400 });
    }

    // Define upload folder in public/uploads/avatars
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    // Save with user ID naming to avoid duplicate files per user
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExt = file.name.split('.').pop() || 'png';
    const filename = `${payload.userId}.${fileExt}`;
    const filePath = path.join(uploadDir, filename);

    await writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    // Persistir avatar en Base de Datos (Supabase / SQLite) para Cloud Run
    try {
      const mime = file.type || (fileExt === 'png' ? 'image/png' : 'image/jpeg');
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      await db.setSystemSetting(`media:avatars/${filename}`, dataUri);
      await db.setSystemSetting(`media:${filename}`, dataUri);
    } catch (e) {
      console.warn('[auth/avatar] Warning persisting avatar in DB:', e);
    }

    // Update user in DB
    await db.updateUserAvatar(payload.email, avatarUrl);

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error: any) {
    console.error('[auth/avatar] Error uploading avatar:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error en el servidor.' }, { status: 500 });
  }
}
