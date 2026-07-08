'use client';

import React, { useState } from 'react';
import { Mail, Lock, Bot, ArrowRight, UserPlus, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validar coincidencia de contraseña en registro
    if (isRegistering && password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (isRegistering) {
          setSuccessMsg('¡Usuario registrado! Ya puedes iniciar sesión.');
          setIsRegistering(false);
          setPassword('');
          setConfirmPassword('');
        } else {
          // Login exitoso, redirección al Dashboard principal
          window.location.href = '/';
        }
      } else {
        throw new Error(data.error || 'Ocurrió un error inesperado.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#090b12] text-slate-100 p-4 relative overflow-hidden select-none">
      
      {/* Background Decorative Neon Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      <div className="max-w-md w-full z-10 space-y-6">
        
        {/* Logo and Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-3xl text-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.08)]">
            <Bot className="h-10 w-10 animate-[bounce_3s_infinite]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            FUXION CRM
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
            Plataforma de Ventas y WhatsApp con IA
          </p>
        </div>

        {/* Auth Glassmorphism Card */}
        <div className="bg-slate-950/40 border border-slate-800/80 backdrop-blur-2xl p-8 rounded-[32px] shadow-2xl relative">
          
          {/* Alerts */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs flex gap-2.5 items-center shadow-[0_4px_20px_rgba(244,63,94,0.05)]">
              <ShieldAlert className="h-4.5 w-4.5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs flex gap-2.5 items-center shadow-[0_4px_20px_rgba(16,185,129,0.05)]">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <h2 className="text-lg font-bold text-white mb-6">
            {isRegistering ? 'Crear Cuenta de Administrador' : 'Iniciar Sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Correo */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico</label>
              <div className="relative">
                <input 
                  type="email"
                  required
                  placeholder="ejemplo@sudominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/25"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contraseña</label>
              <div className="relative">
                <input 
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/25 font-mono"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
            </div>

            {/* Confirmar Contraseña (Solo en registro) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confirmar Contraseña</label>
                <div className="relative">
                  <input 
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/25 font-mono"
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-850 disabled:text-slate-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 transform active:scale-[0.98] disabled:scale-100 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <span>{isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema'}</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>

          </form>

          {/* Toggle Register/Login Link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition cursor-pointer"
            >
              {isRegistering ? (
                <>
                  <span>¿Ya tienes una cuenta? Inicia sesión</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>¿No tienes una cuenta? Regístrate aquí</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Small Legal Disclaimer */}
        <p className="text-[10px] text-center text-slate-600">
          Protección de datos cifrada localmente y en la nube.
        </p>

      </div>
    </div>
  );
}
