'use client';

import React from 'react';
import { Search, Plus, Clock, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatLeadPhone, calculateScore } from '@/lib/lead-utils';

interface KanbanViewProps {
  leads: any[];
  filteredLeads: any[];
  selectedLead: any | null;
  handleSelectLead: (lead: any) => void;
  handleStatusChange: (leadId: string, newStatus: string) => void;
  leadsSearch: string;
  setLeadsSearch: React.Dispatch<React.SetStateAction<string>>;
  leadsFilter: string;
  setLeadsFilter: React.Dispatch<React.SetStateAction<string>>;
}

export default function KanbanView({
  filteredLeads,
  selectedLead,
  handleSelectLead,
  handleStatusChange,
  leadsSearch,
  setLeadsSearch,
  leadsFilter,
  setLeadsFilter
}: KanbanViewProps) {

  const [syncMessage, setSyncMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 30) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  return (
    <div className="flex-1 flex flex-col gap-6 h-[calc(100vh-64px)] overflow-hidden bg-[#07090e] border-t border-slate-900 -m-8 p-8 text-slate-100">
      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div>
          <h3 className="text-sm font-semibold text-white">Embudo de Ventas (Kanban)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Arrastra y suelta los clientes entre las columnas para cambiar su etapa del pipeline.</p>
        </div>
        <div className="flex gap-4 items-center self-stretch md:self-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={leadsSearch}
              onChange={(e) => setLeadsSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/google-sheets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'delta' })
                  });
                  const data = await res.json();
                  if (data.success) {
                    const detail = [
                      typeof data.created === 'number' ? `${data.created} nuevos` : null,
                      typeof data.updated === 'number' ? `${data.updated} actualizados` : null,
                    ].filter(Boolean).join(' · ');
                    setSyncMessage({ type: 'success', text: (data.message || '¡Sincronización exitosa con Google Sheets!') + (detail ? ` (${detail})` : '') });
                  } else {
                    setSyncMessage({ type: 'error', text: data.error || 'Configura la URL de Google Sheets en Configuración > Sistema.' });
                  }
                } catch (err: any) {
                  setSyncMessage({ type: 'error', text: 'Error al conectar con Google Sheets: ' + (err.message || 'Error de red') });
                }
                setTimeout(() => setSyncMessage(null), 5000);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 shadow-md shrink-0"
              title="Guardar y Sincronizar Contactos y Pedidos con Google Sheets"
            >
              <span>📊</span>
              <span>Guardar en Google Sheets</span>
            </button>

            {syncMessage && (
              <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                syncMessage.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}>
                {syncMessage.text}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {['Todos', 'Nuevo', 'Interactuando', 'Verificación Pendiente', 'Por Registrar en Web', 'Venta Confirmada'].map((filter) => (
              <button
                key={filter}
                onClick={() => setLeadsFilter(filter)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                  leadsFilter === filter
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {filter === 'Todos' ? 'Todas' : filter === 'Nuevo' ? 'Nuevas' : filter === 'Verificación Pendiente' ? 'Pendientes' : filter === 'Venta Confirmada' ? 'Ventas' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 select-none min-h-0 items-start">
        {[
          { title: 'Nuevo Contacto', statusDb: 'New', color: 'border-blue-500/30 bg-blue-500/[0.01]' },
          { title: 'Calificado / Interactuando', statusDb: 'Engaged', color: 'border-purple-500/30 bg-purple-500/[0.01]' },
          { title: 'Negociación / Pago', statusDb: 'Pending Verification', color: 'border-amber-500/30 bg-amber-500/[0.01]' },
          { title: 'Por Registrar en Web', statusDb: 'Por Registrar en Web', color: 'border-orange-500/30 bg-orange-500/[0.01]' },
          { title: 'Venta Cerrada 🎉', statusDb: 'Converted', color: 'border-emerald-500/30 bg-emerald-500/[0.01]' },
          { title: 'Archivados', statusDb: 'Archived', color: 'border-slate-500/30 bg-slate-500/[0.01]' }
        ].map((column) => {
          const columnLeads = filteredLeads.filter(l => l.status === column.statusDb);
          return (
            <div 
              key={column.statusDb}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const leadId = e.dataTransfer.getData('text/plain');
                handleStatusChange(leadId, column.statusDb);
              }}
              className={`w-72 shrink-0 flex flex-col rounded-xl border p-4 h-full max-h-full ${column.color}`}
            >
              {/* Cabecera Columna */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{column.title}</span>
                <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{columnLeads.length}</span>
              </div>

              {/* Lista de Tarjetas en la Columna */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                {columnLeads.map((lead) => {
                  const score = calculateScore(lead);
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                      onClick={() => handleSelectLead(lead)}
                      className={`p-4 rounded-xl border border-slate-800 bg-[#0c0f1d] hover:border-slate-700 transition cursor-grab active:cursor-grabbing flex flex-col gap-3 relative ${
                        selectedLead?.id === lead.id ? 'ring-2 ring-indigo-500/50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-white text-xs truncate max-w-[80%]">{lead.name}</h4>
                        {lead.unread_count > 0 && (
                          <span className="h-5 min-w-[20px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
                            {lead.unread_count}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-mono">{formatLeadPhone(lead)}</p>

                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px]">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-bold ${getScoreColor(score)}`}>
                          Score: {score}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          lead.bot_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {lead.bot_active ? '🤖 Bot' : '👤 Manual'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {columnLeads.length === 0 && (
                  <div className="text-center py-12 text-xs text-slate-600 italic border border-dashed border-slate-800/40 rounded-xl">
                    Arrastra clientes aquí
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
