import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth-utils';

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
    if (!verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: 'Correo o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    // Sign session token for 10 years (315360000s)
    const token = signToken({
      userId: user.id,
      email: user.email
    }, 315360000);

    console.log(`[auth/login] User logged in: ${normalizedEmail}`);

    const response = NextResponse.json({ success: true, message: 'Sesión iniciada correctamente.' });

    // Set secure HttpOnly cookie (10 años de sesión persistente)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 315360000, // 10 años
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
