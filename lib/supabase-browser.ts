import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. Definimos las variables primero usando process.env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 2. Diagnóstico inicial
console.log('¿NEXT_PUBLIC_SUPABASE_URL presente?', !!supabaseUrl);
console.log('¿NEXT_PUBLIC_SUPABASE_ANON_KEY presente?', !!supabaseAnonKey);

let client: SupabaseClient | null = null;

if (typeof window !== 'undefined') {
  console.log('[Supabase Browser Diagnostic] Cargando cliente en navegador...', {
    urlExist: !!supabaseUrl,
    anonKeyExist: !!supabaseAnonKey,
  });
}

// 3. Inicialización
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

  console.error(`❌ Error crítico: Falta(n) la(s) variable(s): ${missing.join(', ')}.`);
}

export const supabaseBrowser = client;