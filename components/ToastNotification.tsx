'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  type: ToastType;
  title: string;
  message?: string;
  onClose?: () => void;
}

export default function ToastNotification({ type, title, message, onClose }: ToastProps) {
  const typeStyles = {
    success: {
      border: 'border-emerald-500/40 bg-[#0c1f17]/95 text-emerald-300',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    error: {
      border: 'border-rose-500/40 bg-[#210c12]/95 text-rose-300',
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    warning: {
      border: 'border-amber-500/40 bg-[#22180a]/95 text-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    info: {
      border: 'border-blue-500/40 bg-[#0a1827]/95 text-blue-300',
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    }
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-xl border ${style.border} shadow-2xl backdrop-blur-md max-w-md animate-in slide-in-from-bottom-5 duration-300`}>
      {style.icon}
      <div className="flex-1 space-y-0.5">
        <h4 className="text-xs font-bold text-slate-100">{title}</h4>
        {message && <p className="text-[11px] text-slate-300 leading-relaxed">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
