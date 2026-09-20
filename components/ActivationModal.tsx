'use client';

import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Building2, Lock, Copy, Check, MonitorSmartphone } from 'lucide-react';

interface ActivationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  onActivated?: (data: { companyName: string; plan: string }) => void;
}

interface LicenseInfo {
  state?: string;
  companyName?: string;
  licensePlan?: string;
  locked?: boolean;
  machineId?: string;
  installId?: string;
  message?: string;
}

export default function ActivationModal({ isOpen, onClose, canClose = true, onActivated }: ActivationModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = React.useCallback(() => {
    fetch('/api/license/activate')
      .then(res => res.json())
      .then(data => {
        setInfo(data);
        if (data.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      loadStatus();
    }
  }, [isOpen, loadStatus]);

  if (!isOpen) return null;

  const blocked = info?.state === 'blocked';
  const needsCompany = !info?.companyName;

  const handleCopyInstallId = () => {
    if (info?.installId) {
      navigator.clipboard.writeText(info.installId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMsg('Escribe el nombre de tu empresa o negocio.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-company', companyName: companyName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onActivated) {
          onActivated({ companyName: companyName.trim(), plan: info?.licensePlan || 'PRO' });
        }
        if (onClose) onClose();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar la empresa.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0c0f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Licencia del sistema</h2>
            <p className="text-xs text-slate-400">
              {blocked ? 'Instalación bloqueada' : info?.state === 'active' ? 'Instalación activa en esta PC' : 'Registro inicial'}
            </p>
          </div>
        </div>

        {blocked ? (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{info?.message || 'Esta instalación fue movida a otra PC.'}</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex gap-2.5 items-center">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Este programa está vinculado automáticamente a esta PC. No necesitas ninguna clave.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex gap-2.5 items-center">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {needsCompany && !blocked && (
          <form onSubmit={handleSaveCompany} className="space-y-4">
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
              <span className="text-[10px] text-slate-500 block">Se registra una sola vez y queda sellado en tu CRM.</span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg disabled:opacity-50"
            >
              <span>{loading ? 'Registrando...' : 'Registrar mi empresa'}</span>
            </button>
          </form>
        )}

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <MonitorSmartphone className="w-3.5 h-3.5" /> ID de instalación:
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-emerald-400 font-bold tracking-wider truncate">{info?.installId || '···'}</span>
              <button
                type="button"
                onClick={handleCopyInstallId}
                className="px-2 py-1 rounded-lg bg-[#14192b] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition flex items-center gap-1 shrink-0"
                title="Copiar ID de instalación"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            </div>
          </div>
          {info?.machineId && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Equipo vinculado:
              </span>
              <span className="font-mono text-slate-400 text-[10px] truncate">{info.machineId}</span>
            </div>
          )}
        </div>

        {blocked && (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Para reactivarla, contacta a quien te instaló el sistema e indícale tu ID de instalación de arriba.
          </p>
        )}

        {canClose && !blocked && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
