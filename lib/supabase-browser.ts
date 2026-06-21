import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (typeof window !== 'undefined') {
  console.log('[Supabase Browser Diagnostic] Cargando cliente en navegador...', {
    urlExist: !!supabaseUrl,
    urlValue: supabaseUrl ? supabaseUrl : 'VACÍO (FALTA NEXT_PUBLIC_SUPABASE_URL)',
    anonKeyExist: !!supabaseAnonKey,
    anonKeyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
    anonKeyMask: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 10)}...${supabaseAnonKey.slice(-8)}` : 'VACÍO'
  });
}

if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    if (typeof window !== 'undefined') {
      console.log('✅ [Supabase Browser Diagnostic] Cliente inicializado correctamente para Realtime.');
    }
  } catch (error) {
    console.error('❌ [Supabase Browser Diagnostic] Error al inicializar el cliente:', error);
  }
} else {
  const missing = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const errorMessage = 
    `❌ [Supabase Browser Diagnostic] Error crítico: No se pudo inicializar el cliente de Supabase para el navegador.\n` +
    `Falta(n) la(s) siguiente(s) variable(s) de entorno: ${missing.join(', ')}.\n` +
    `👉 Nota de Experto: En Next.js, las variables NEXT_PUBLIC_ se inyectan EN TIEMPO DE COMPILACIÓN (build time).\n` +
    `Si estás compilando en Railway (ej. vía Dockerfile o Nixpacks), debes configurar estas variables en la sección de Variables del panel de Railway ANTES de compilar (o asegurarte de que estén presentes durante el paso de compilación del contenedor).`;

  console.error(errorMessage);
}

export const supabaseBrowser = client;


