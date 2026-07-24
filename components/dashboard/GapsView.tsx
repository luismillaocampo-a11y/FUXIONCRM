'use client';

import React from 'react';
import { X, RefreshCw, UserCheck } from 'lucide-react';

interface GapsViewProps {
  gaps: any[];
  gapAnswers: { [key: string]: string };
  setGapAnswers: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  resolvingGapId: string | null;
  handleResolveGap: (id: string) => void;
  handleDeleteGap: (id: string) => void;
}

export default function GapsView({
  gaps,
  gapAnswers,
  setGapAnswers,
  resolvingGapId,
  handleResolveGap,
  handleDeleteGap
}: GapsViewProps) {
  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <h3 className="text-sm font-semibold text-white">Dudas Pendientes de Entrenamiento</h3>
        <p className="text-xs text-slate-400">Cuando el bot de IA no está seguro de una respuesta, activa el Modo Manual, silencia al bot para este cliente y almacena la duda aquí. Escribe la respuesta correcta para guardarla en la base de conocimientos y reactivar el bot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-2">
        {gaps.map((gap) => (
          <div 
            key={gap.id} 
            className={`p-6 rounded-xl border flex flex-col gap-4 transition bg-[#0c0f1d] ${
              gap.status === 'pending' 
                ? 'border-amber-500/30 bg-amber-500/[0.01]' 
                : 'border-slate-800 opacity-60'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  gap.status === 'pending' 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {gap.status === 'pending' ? 'Requiere respuesta humana' : 'Resuelta'}
                </span>
                <h4 className="font-semibold text-white mt-2">
                  Para: {gap.leads?.name || 'Cliente Desconocido'} ({gap.leads?.phone || 'Sin número'})
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500">{new Date(gap.created_at).toLocaleString()}</span>
                {gap.status === 'pending' && (
                  <button
                    onClick={() => handleDeleteGap(gap.id)}
                    className="p-1 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Descartar Duda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 font-medium text-slate-200">
              <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Pregunta sin respuesta:</p>
              <p className="text-sm">"{gap.question}"</p>
            </div>

            {gap.context && (
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-900/60">
                <p className="text-xs text-slate-500 font-semibold mb-1 uppercase tracking-wider">Contexto del chat:</p>
                <pre className="text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">{gap.context}</pre>
              </div>
            )}

            {gap.status === 'pending' ? (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Respuesta Oficial:</label>
                <textarea
                  rows={3}
                  value={gapAnswers[gap.id] || ''}
                  onChange={(e) => setGapAnswers(prev => ({ ...prev, [gap.id]: e.target.value }))}
                  placeholder="Escribe la respuesta correcta. Esto entrenará a la IA..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-650 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => handleResolveGap(gap.id)}
                  disabled={!gapAnswers[gap.id]?.trim() || resolvingGapId === gap.id}
                  className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all shadow-lg shadow-emerald-950/20"
                >
                  {resolvingGapId === gap.id ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Enviando a WhatsApp y Entrenando IA...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      Enviar Respuesta a WhatsApp, Guardar en RAG y Reactivar Bot
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/20 rounded-lg mt-2 text-slate-300 text-xs">
                <p className="font-semibold text-emerald-400 mb-1">Respuesta Aprendida:</p>
                <p className="italic">"{gap.answer}"</p>
              </div>
            )}
          </div>
        ))}

        {gaps.length === 0 && (
          <div className="col-span-2 text-center py-20 text-slate-500 bg-[#0c0f1d] border border-slate-800/80 rounded-xl italic">
            No hay dudas pendientes de entrenamiento. Todo opera de forma automática.
          </div>
        )}
      </div>
    </div>
  );
}
