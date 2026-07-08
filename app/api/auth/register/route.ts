import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth-utils';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !email.includes('@') || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'El correo debe ser válido y la contraseña tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este correo electrónico ya está registrado.' },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();

    await db.createUser({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || ''
    });

    console.log(`[auth/register] User registered successfully: ${normalizedEmail}`);
    return NextResponse.json({ success: true, message: 'Usuario registrado exitosamente.' });
  } catch (error: any) {
    console.error('[auth/register] Error registering user:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
