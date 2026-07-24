'use client';

import React, { useState } from 'react';
import { Key, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Building2, Lock } from 'lucide-react';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivated?: (data: { companyName: string; plan: string }) => void;
}

export default function ActivationModal({ isOpen, onClose, onActivated }: ActivationModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [serialKey, setSerialKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !serialKey.trim()) {
      setErrorMsg('Por favor ingresa el nombre de tu empresa y el serial key.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          serialKey: serialKey.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        if (onActivated) {
          onActivated({ companyName: data.companyName, plan: data.plan });
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setErrorMsg(data.error || 'Error al activar la licencia');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor de licencias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0c0f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
        {/* Glow de adorno */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Activación de Licencia Comercial</h2>
            <p className="text-xs text-slate-400">Ingresa tus datos para desbloquear tu CRM.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex gap-2.5 items-center">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex gap-2.5 items-center">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              Nombre Oficial de tu Empresa / Negocio
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Botica San Martín"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            <span className="text-[10px] text-slate-500 block">Este nombre quedará sellado permanentemente en la firma de tu CRM.</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Serial Key de Licencia (Proporcionado por L. Milla)
            </label>
            <input
              type="text"
              required
              placeholder="NF-PRO-XXXX-YYYY-ZZZZ-WWWW"
              value={serialKey}
              onChange={(e) => setSerialKey(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono tracking-wider"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Validando...' : 'Activar Licencia'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
