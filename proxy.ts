import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, signToken } from './lib/auth-utils';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Obtener la cookie del token de autenticación
  const tokenCookie = request.cookies.get('auth_token');
  const token = tokenCookie?.value;

  // 2. Verificar la validez del token
  const payload = token ? verifyToken(token) : null;
  const hasSession = !!payload;

  const isLoginPage = pathname === '/login';

  // 3. Acceso directo: solo auto-firmar sesión local en localhost/Electron.
  // En red/producción, sin sesión se redirige a /login en vez de regalar admin.
  if (!hasSession) {
    const hostname = request.nextUrl.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (!isLocal && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!isLocal && isLoginPage) {
      return NextResponse.next();
    }
    const defaultToken = signToken({ userId: 'local_admin_1', email: 'admin@local' }, 315360000); // 10 años (3650 días)
    const response = isLoginPage 
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next();

    response.cookies.set('auth_token', defaultToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 315360000,
      path: '/',
    });
    return response;
  }

  // 4. Si ya tiene sesión y entra a /login, redirigir directo al panel de control
  if (hasSession && isLoginPage) {
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
