import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth-utils';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Por favor, introduce el correo y la contraseña.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Retrieve user
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Correo o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    // Verify password hash
    const inputHash = hashPassword(password);
    if (user.password !== inputHash) {
      return NextResponse.json(
        { success: false, error: 'Correo o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    // Sign session token
    const token = signToken({
      userId: user.id,
      email: user.email
    });

    console.log(`[auth/login] User logged in: ${normalizedEmail}`);

    const response = NextResponse.json({ success: true, message: 'Sesión iniciada correctamente.' });

    // Set secure HttpOnly cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 86400, // 24 hours
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return response;
  } catch (error: any) {
    console.error('[auth/login] Error logging in:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
