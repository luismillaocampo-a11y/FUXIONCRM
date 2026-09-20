import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSupabaseUrl = process.env.SUPABASE_URL;
  const serverSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const effectiveSupabaseUrl = serverSupabaseUrl || publicSupabaseUrl;
  const effectiveSupabaseAnonKey = serverSupabaseAnonKey || publicSupabaseAnonKey;
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT ? true : false;
  // Backend efectivo (misma lógica que lib/db.ts): solo si es true, Realtime cubre los cambios
  const useSupabase = Boolean(process.env.VERCEL) || Boolean(process.env.LAMBDA_TASK_ROOT) || process.env.USE_SUPABASE === 'true';

  return NextResponse.json({
    success: true,
    env: {
      nodeEnv,
      isProduction,
      useSupabase,
      effectiveSupabaseUrl: effectiveSupabaseUrl || null,
      effectiveSupabaseAnonKeyExists: !!effectiveSupabaseAnonKey,
      effectiveSupabaseAnonKeyLength: effectiveSupabaseAnonKey ? effectiveSupabaseAnonKey.length : 0,
      effectiveSupabaseAnonKeyMask: effectiveSupabaseAnonKey
        ? `${effectiveSupabaseAnonKey.slice(0, 10)}...${effectiveSupabaseAnonKey.slice(-8)}`
        : null,
      publicSupabaseUrl: publicSupabaseUrl || null,
      publicSupabaseAnonKeyExists: !!publicSupabaseAnonKey,
      serverSupabaseUrl: serverSupabaseUrl || null,
      serverSupabaseAnonKeyExists: !!serverSupabaseAnonKey
    }
  });
}
