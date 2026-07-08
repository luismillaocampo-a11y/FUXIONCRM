import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth-utils';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Obtener la cookie del token de autenticación
  const tokenCookie = request.cookies.get('auth_token');
  const token = tokenCookie?.value;

  // 2. Verificar la validez del token
  const payload = token ? verifyToken(token) : null;
  const hasSession = !!payload;

  // 3. Reglas de redirección de seguridad
  const isLoginPage = pathname === '/login';

  if (!hasSession && !isLoginPage) {
    // Si no está logueado y no está en el login, lo obligamos a loguearse
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isLoginPage) {
    // Si ya está logueado y va al login, lo mandamos directo al dashboard
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluir todas las rutas de API, assets estáticos de Next.js, imágenes y el favicon
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
