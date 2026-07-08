import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada.' });

  // Instantly expire the secure cookie
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return response;
}
