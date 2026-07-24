'use client';

import React from 'react';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = '¿Confirmar Acción?',
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-[#0c0f1d] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative flex flex-col gap-4">
        
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${
            variant === 'danger' 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : variant === 'warning' 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
          }`}>
            {variant === 'danger' ? (
              <Trash2 className="h-5 w-5" />
            ) : variant === 'warning' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
            <p className="text-[11px] text-slate-400">Nutraflow CRM</p>
          </div>
        </div>

        {/* Message */}
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-850 text-xs leading-relaxed text-slate-300">
          {message}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 shadow-red-950/40'
                : variant === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-950/40'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-950/40'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
