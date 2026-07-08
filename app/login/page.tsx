'use client';

import React, { useState } from 'react';
import { Mail, Lock, Bot, ArrowRight, UserPlus, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
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
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (isRegistering) {
          setSuccessMsg('¡Usuario registrado! Ya puedes iniciar sesión.');
          setIsRegistering(false);
          setName('');
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#07090e] text-slate-100 p-4 relative overflow-hidden select-none">
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full z-10 space-y-6">
        
        {/* Auth Card */}
        <div className="bg-[#0f111a] border border-[#1e2330] p-9 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative">
          
          {/* Top-Left Chat/Bot Icon */}
          <div className="flex mb-6">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Bot className="h-6 w-6" />
            </div>
          </div>

          {/* Header Texts */}
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {isRegistering ? 'Crear una cuenta' : 'Welcome back'}
            </h1>
            <p className="text-xs text-slate-400">
              {isRegistering ? 'Regístrate para comenzar a usar el CRM' : 'Sign in to your account'}
            </p>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs flex gap-2 items-center">
              <ShieldAlert className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs flex gap-2 items-center">
              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Nombre Completo (Solo en registro) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Nombre Completo</label>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    placeholder="Escribe tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#161922] border border-[#2a3040] rounded-xl text-xs text-slate-200 placeholder-slate-550 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            )}

            {/* Correo */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">Email</label>
              <div className="relative">
                <input 
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#161922] border border-[#2a3040] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-slate-300 block">Password</label>
                {!isRegistering && (
                  <button 
                    type="button" 
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition cursor-pointer"
                    onClick={() => alert('Por favor contacta al administrador del sistema para restablecer tu contraseña.')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#161922] border border-[#2a3040] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Confirmar Contraseña (Solo en registro) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Confirmar Contraseña</label>
                <div className="relative">
                  <input 
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[#161922] border border-[#2a3040] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-550 text-white font-semibold rounded-xl text-xs transition-all duration-300 active:scale-[0.98] disabled:scale-100 disabled:opacity-50 cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <span>{isRegistering ? 'Create account' : 'Sign in'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

          </form>

          {/* Toggle Register/Login Link */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {isRegistering ? (
              <span>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer"
                >
                  Inicia sesión
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer"
                >
                  Create account
                </button>
              </span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
