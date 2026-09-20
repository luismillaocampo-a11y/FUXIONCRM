'use client';

import React from 'react';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#0f1222] border border-slate-800/90 rounded-2xl p-5 max-w-[340px] w-full shadow-2xl relative flex flex-col gap-4">
        
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
            variant === 'danger' 
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
              : variant === 'warning' 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
          }`}>
            {variant === 'danger' ? (
              <Trash2 className="h-5 w-5" />
            ) : variant === 'warning' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white tracking-tight leading-snug">{title}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Nutraflow CRM</p>
          </div>
        </div>

        {/* Optional Secondary Context (Only if specifically needed, without bulky boxes) */}
        {message && message !== title && (
          <p className="text-xs text-slate-400 leading-relaxed -mt-1 px-0.5">
            {message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white transition shadow-md ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                : variant === 'warning'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-950/50'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-950/50'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
