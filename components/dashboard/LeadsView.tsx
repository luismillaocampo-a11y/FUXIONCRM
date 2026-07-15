'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, AlertCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight,
  Smile, List, LayoutGrid, StickyNote, Bell, TrendingUp, DollarSign, Users, Award, Clock, CheckCircle2
} from 'lucide-react';

const IDENTITY_MAPPING: { [key: string]: string[] } = {
  '51955252932': ['51955252932', '955252932'],
  '955252932': ['51955252932', '955252932'],
  '51900401930': ['51900401930', '900401930'],
  '900401930': ['51900401930', '900401930']
};

function getAssociatedIds(lead: any): string[] {
  if (!lead) return [];
  const ids = new Set<string>();
  ids.add(lead.id);
  if (lead.phone) ids.add(lead.phone);
  if (lead.whatsapp_lid) ids.add(lead.whatsapp_lid);

  const staticEquivs = IDENTITY_MAPPING[lead.id] || (lead.phone && IDENTITY_MAPPING[lead.phone]);
  if (staticEquivs) {
    staticEquivs.forEach(id => ids.add(id));
  }

  const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
  if (cleanPhone) {
    ids.add(cleanPhone);
    const nineDigits = cleanPhone.startsWith('51') && cleanPhone.length > 2 ? cleanPhone.substring(2) : cleanPhone;
    if (nineDigits.length === 9) {
      ids.add(nineDigits);
      ids.add('51' + nineDigits);
    }
  }
  return Array.from(ids);
}

interface LeadsViewProps {
  leadStats: {
    total: number;
    newToday: number;
    inNegotiation: number;
    converted: number;
    conversionRate: number;
  };
  leads: any[];
  filteredLeads: any[];
  selectedLead: any | null;
  setSelectedLead: (lead: any | null) => void;
  whatsappStatus: string;
  aiEnabled: boolean;
  errorMsg: string | null;
  leadsSearch: string;
  setLeadsSearch: React.Dispatch<React.SetStateAction<string>>;
  leadsFilter: string;
  setLeadsFilter: React.Dispatch<React.SetStateAction<string>>;
  viewMode: 'list' | 'kanban';
  setViewMode: React.Dispatch<React.SetStateAction<'list' | 'kanban'>>;
  showNewLeadModal: boolean;
  setShowNewLeadModal: React.Dispatch<React.SetStateAction<boolean>>;
  newLeadName: string;
  setNewLeadName: React.Dispatch<React.SetStateAction<string>>;
  newLeadPhone: string;
  setNewLeadPhone: React.Dispatch<React.SetStateAction<string>>;
  chatMessages: any[];
  chatLoading: boolean;
  chatNotice: string | null;
  newMessageAlert: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  chatTab: 'chat' | 'notes' | 'reminders';
  setChatTab: React.Dispatch<React.SetStateAction<'chat' | 'notes' | 'reminders'>>;
  notes: any[];
  newNoteContent: string;
  setNewNoteContent: React.Dispatch<React.SetStateAction<string>>;
  reminders: any[];
  newReminderMessage: string;
  setNewReminderMessage: React.Dispatch<React.SetStateAction<string>>;
  newReminderHours: number;
  setNewReminderHours: React.Dispatch<React.SetStateAction<number>>;
  isSimulatingCustomer: boolean;
  setIsSimulatingCustomer: React.Dispatch<React.SetStateAction<boolean>>;
  typedMessage: string;
  setTypedMessage: React.Dispatch<React.SetStateAction<string>>;
  activeNotification: {
    id: string;
    senderName: string;
    message: string;
    leadId: string;
  } | null;
  setActiveNotification: React.Dispatch<React.SetStateAction<{
    id: string;
    senderName: string;
    message: string;
    leadId: string;
  } | null>>;
  handleSendMessage: (e: React.FormEvent) => void;
  handleDeleteChat: () => void;
  handleDeleteLead: () => void;
  handleToggleBot: (lead: any) => void;
  handleSelectLead: (lead: any) => void;
  handleCreateLead: (e: React.FormEvent) => void;
  handleStatusChange: (leadId: string, newStatus: string) => void;
  handleAddNote: (e: React.FormEvent) => void;
  handleDeleteNote: (id: string) => void;
  handleAddReminder: (e: React.FormEvent) => void;
  handleDeleteReminder: (id: string) => void;
  fetchData: () => void;
  forceScrollToBottomRef: React.MutableRefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function LeadsView({
  leadStats,
  leads,
  filteredLeads,
  selectedLead,
  setSelectedLead,
  whatsappStatus,
  aiEnabled,
  errorMsg,
  leadsSearch,
  setLeadsSearch,
  leadsFilter,
  setLeadsFilter,
  viewMode,
  setViewMode,
  showNewLeadModal,
  setShowNewLeadModal,
  newLeadName,
  setNewLeadName,
  newLeadPhone,
  setNewLeadPhone,
  chatMessages,
  chatLoading,
  chatNotice,
  newMessageAlert,
  showEmojiPicker,
  setShowEmojiPicker,
  chatTab,
  setChatTab,
  notes,
  newNoteContent,
  setNewNoteContent,
  reminders,
  newReminderMessage,
  setNewReminderMessage,
  newReminderHours,
  setNewReminderHours,
  isSimulatingCustomer,
  setIsSimulatingCustomer,
  typedMessage,
  setTypedMessage,
  activeNotification,
  setActiveNotification,
  handleSendMessage,
  handleDeleteChat,
  handleDeleteLead,
  handleToggleBot,
  handleSelectLead,
  handleCreateLead,
  handleStatusChange,
  handleAddNote,
  handleDeleteNote,
  handleAddReminder,
  handleDeleteReminder,
  fetchData,
  forceScrollToBottomRef,
  chatContainerRef
}: LeadsViewProps) {

  const calculateScore = (lead: any) => {
    if (!lead) return 0;
    let score = 0;
    let tagsList: string[] = [];
    try {
      tagsList = typeof lead.tags === 'string' ? JSON.parse(lead.tags) : (lead.tags || []);
    } catch (e) {
      tagsList = lead.tags || [];
    }

    if (tagsList.includes('hot-lead')) score += 25;
    if (tagsList.includes('interested') || tagsList.includes('interesado')) score += 10;
    if (tagsList.includes('needs-verification') || tagsList.includes('ready-to-buy')) score += 15;

    if (lead.status === 'Pending Verification') score += 20;
    if (lead.status === 'Por Registrar en Web') score += 30;
    if (lead.status === 'Converted') score += 50;

    if (lead.unread_count > 0) score += 10;

    return Math.min(score, 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 30) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'New': return 'Nuevo Lead';
      case 'Engaged': return 'Interactuando';
      case 'Pending Verification': return 'Verificación Pendiente';
      case 'Converted': return 'Venta Confirmada';
      case 'Por Registrar en Web': return 'Por Registrar en Web';
      default: return status;
    }
  };

  const isIdInAssociatedIds = (id: string) => {
    if (!selectedLead) return false;
    const associatedIds = getAssociatedIds(selectedLead);
    return associatedIds.includes(id) || (id && associatedIds.map(x => x.replace(/\D/g, '')).includes(id.replace(/\D/g, '')));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#0c0f1d]/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Leads</span>
            <p className="text-xl font-bold text-white mt-0.5">{leadStats.total}</p>
          </div>
        </div>

        <div className="bg-[#0c0f1d]/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nuevos Hoy</span>
            <p className="text-xl font-bold text-white mt-0.5">{leadStats.newToday}</p>
          </div>
        </div>

        <div className="bg-[#0c0f1d]/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">En Negociación</span>
            <p className="text-xl font-bold text-white mt-0.5">{leadStats.inNegotiation}</p>
          </div>
        </div>

        <div className="bg-[#0c0f1d]/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Confirmados</span>
            <p className="text-xl font-bold text-white mt-0.5">{leadStats.converted}</p>
          </div>
        </div>

        <div className="bg-[#0c0f1d]/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Conversión</span>
            <p className="text-xl font-bold text-white mt-0.5">{leadStats.conversionRate}%</p>
          </div>
        </div>
      </div>



      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex gap-3 items-start shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <span className="font-semibold block text-red-400">Error de Configuración de Base de Datos</span>
            <p className="mt-1">{errorMsg}</p>
            <p className="mt-2 text-xs text-slate-400">
              Por favor, configura las variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY) en tu panel de control de Vercel y vuelve a desplegar.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-6 min-h-0">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="w-full md:w-80 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar nombre o teléfono..."
              value={leadsSearch}
              onChange={(e) => setLeadsSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            {['Todos', 'Nuevo', 'Interactuando', 'Verificación Pendiente', 'Venta Confirmada', 'Por Registrar en Web'].map((filter) => (
              <button
                key={filter}
                onClick={() => setLeadsFilter(filter)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  leadsFilter === filter
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-[#0c0f1d] flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Nombre del Cliente</th>
                    <th className="px-6 py-4">Teléfono</th>
                    <th className="px-6 py-4">Prioridad / Score</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Etiquetas</th>
                    <th className="px-6 py-4">Respuestas Automáticas</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                  {filteredLeads.map((lead) => {
                    const score = calculateScore(lead);
                    return (
                      <tr 
                        key={lead.id} 
                        className={`hover:bg-slate-800/20 transition-all cursor-pointer ${
                          selectedLead?.id === lead.id ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
                        }`}
                        onClick={() => handleSelectLead(lead)}
                      >
                        <td className="px-6 py-4 font-medium text-white flex items-center justify-between gap-2">
                          <span>{lead.name}</span>
                          {lead.unread_count > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-bounce shrink-0 shadow-lg shadow-rose-500/25">
                              {lead.unread_count}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{lead.phone}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${getScoreColor(score)}`}>
                            Score: {score}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lead.status === 'New' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            lead.status === 'Engaged' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            lead.status === 'Pending Verification' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 glow-active' :
                            lead.status === 'Por Registrar en Web' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30 animate-pulse' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {lead.status === 'Pending Verification' && <Clock className="h-3 w-3 animate-pulse" />}
                            {lead.status === 'Por Registrar en Web' && <UserCheck className="h-3 w-3" />}
                            {translateStatus(lead.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {lead.tags && lead.tags.map((tag: string) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700/50">
                                {tag}
                              </span>
                            ))}
                            {(!lead.tags || lead.tags.length === 0) && (
                              <span className="text-slate-600 text-xs italic">Sin etiquetas</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleBot(lead)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              lead.bot_active 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {lead.bot_active ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Bot Activo (Auto)
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                                Modo Manual
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectLead(lead)}
                            className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
                          >
                            Ver Chat
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500 italic">
                        No se encontraron clientes con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'kanban' && (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 select-none min-h-0">
            {[
              { title: 'Nuevo Contacto', statusDb: 'New', color: 'border-blue-500/30 bg-blue-500/[0.01]' },
              { title: 'Calificado / Interactuando', statusDb: 'Engaged', color: 'border-purple-500/30 bg-purple-500/[0.01]' },
              { title: 'Negociación / Pago', statusDb: 'Pending Verification', color: 'border-amber-500/30 bg-amber-500/[0.01]' },
              { title: 'Por Registrar en Web', statusDb: 'Por Registrar en Web', color: 'border-orange-500/30 bg-orange-500/[0.01]' },
              { title: 'Venta Cerrada 🎉', statusDb: 'Converted', color: 'border-emerald-500/30 bg-emerald-500/[0.01]' }
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
                  className={`w-72 shrink-0 flex flex-col rounded-xl border p-4 ${column.color}`}
                >
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{column.title}</span>
                    <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{columnLeads.length}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {columnLeads.map((lead) => {
                      const score = calculateScore(lead);
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                          onClick={() => handleSelectLead(lead)}
                          className={`p-4 rounded-xl border border-slate-800 bg-[#0c0f1d] hover:border-slate-700 transition cursor-grab active:cursor-grabbing flex flex-col gap-3 relative ${
                            selectedLead?.id === lead.id ? 'ring-2 ring-emerald-500/50' : ''
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

                          <p className="text-[10px] text-slate-500 font-mono">+{lead.phone.replace(/\D/g, '')}</p>

                          <div className="flex flex-wrap gap-1">
                            {lead.tags && lead.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-850 text-[9px] text-slate-400 border border-slate-800">
                                {tag}
                              </span>
                            ))}
                          </div>

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
                        Sin leads en esta etapa
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="w-96 border-l border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0 absolute right-0 top-0 shadow-2xl z-20 transition-all duration-300 animate-slide-in">
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-400 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white leading-tight">{selectedLead.name}</h3>
                  {newMessageAlert && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 text-rose-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-rose-500/30 animate-pulse">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                      Nuevo
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-mono truncate">+{selectedLead.phone.replace(/\D/g, '')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleDeleteChat}
                className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition" title="Eliminar chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDeleteLead}
                className="p-2 rounded-lg hover:bg-red-600/10 text-slate-400 hover:text-red-500 transition" title="Eliminar cliente y chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Responder del Bot:</span>
              <button
                onClick={() => handleToggleBot(selectedLead)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                  selectedLead.bot_active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {selectedLead.bot_active ? 'Automático' : 'Modo Manual'}
              </button>
            </div>
            
            <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-800/80">
              <button
                onClick={() => setChatTab('chat')}
                className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition ${
                  chatTab === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setChatTab('notes')}
                className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 ${
                  chatTab === 'notes' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <StickyNote size={10} />
                Notas ({notes.length})
              </button>
              <button
                onClick={() => setChatTab('reminders')}
                className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition flex items-center justify-center gap-1 ${
                  chatTab === 'reminders' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <Bell size={10} />
                Alertas ({reminders.filter(r => !r.sent).length})
              </button>
            </div>
          </div>

          {chatTab === 'chat' && (
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0c16]">
              {chatNotice && (
                <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                  {chatNotice}
                </div>
              )}
              {chatMessages
                .filter((msg) => {
                  if (!selectedLead) return false;
                  return isIdInAssociatedIds(msg.lead_id);
                })
                .map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[80%] ${
                      msg.sender === 'customer' ? 'mr-auto items-start' : 'ml-auto items-end'
                    }`}
                  >
                    <div className={`flex items-center gap-1 text-[9px] text-slate-500 mb-1 px-1`}>
                      {msg.sender === 'bot' && <Bot className="h-3 w-3 text-emerald-400" />}
                      {msg.sender === 'agent' && <User className="h-3 w-3 text-cyan-400" />}
                      <span className="capitalize">{msg.sender === 'customer' ? 'Cliente' : msg.sender === 'bot' ? 'Asistente IA' : 'Agente'}</span>
                    </div>
                    <div className={`chat-message-text p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'customer' 
                        ? 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/40' 
                        : msg.sender === 'bot'
                          ? 'bg-emerald-600/15 text-emerald-100 rounded-tr-none border border-emerald-500/20'
                          : 'bg-cyan-600/15 text-cyan-100 rounded-tr-none border border-cyan-500/20'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
              {chatMessages.length === 0 && (
                <div className="text-center py-10 text-slate-650 text-xs italic">
                  No hay historial de chat.
                </div>
              )}
              {chatLoading && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 italic">
                  <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                  El Bot está redactando...
                </div>
              )}
            </div>
          )}

          {chatTab === 'notes' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#0a0c16]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notas Privadas</span>
              
              <form onSubmit={handleAddNote} className="flex flex-col gap-2">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Escribe detalles internos..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
                <button
                  type="submit"
                  disabled={!newNoteContent.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Guardar Nota Interna
                </button>
              </form>

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {notes.map((note) => (
                  <div key={note.id} className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl relative group">
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="absolute top-2 right-2 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={12} />
                    </button>
                    <p className="text-[9px] text-amber-500/80 font-mono">{new Date(note.created_at).toLocaleString('es-PE')}</p>
                    <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  </div>
                ))}

                {notes.length === 0 && (
                  <div className="text-center py-10 text-slate-600 text-xs italic">
                    Sin notas de seguimiento.
                  </div>
                )}
              </div>
            </div>
          )}

          {chatTab === 'reminders' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#0a0c16]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seguimientos / Alertas WhatsApp</span>

              <form onSubmit={handleAddReminder} className="flex flex-col gap-3 p-3 border border-slate-800 bg-slate-950/40 rounded-xl">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Programar Envío en:</label>
                  <select
                    value={newReminderHours}
                    onChange={(e) => setNewReminderHours(Number(e.target.value))}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value={1}>1 hora</option>
                    <option value={3}>3 horas</option>
                    <option value={6}>6 horas</option>
                    <option value={12}>12 horas</option>
                    <option value={24}>24 horas (Recomendado)</option>
                    <option value={48}>48 horas</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mensaje de WhatsApp:</label>
                  <textarea
                    value={newReminderMessage}
                    onChange={(e) => setNewReminderMessage(e.target.value)}
                    placeholder="Ej. ¡Hola! ¿Pudiste realizar el pago de tu pedido? 😊"
                    rows={3}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!newReminderMessage.trim()}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Agendar Seguimiento
                </button>
              </form>

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {reminders.map((rem) => (
                  <div key={rem.id} className="p-3 bg-slate-950 border border-slate-900 rounded-xl relative group">
                    <button
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="absolute top-2 right-2 text-slate-655 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={12} />
                    </button>
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        rem.sent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                      }`}>
                        {rem.sent ? 'Enviado ✔' : 'Pendiente ⏳'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">{new Date(rem.scheduled_at).toLocaleString('es-PE')}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{rem.message}</p>
                  </div>
                ))}

                {reminders.length === 0 && (
                  <div className="text-center py-10 text-slate-600 text-xs italic">
                    Sin recordatorios agendados.
                  </div>
                )}
              </div>
            </div>
          )}

          {chatTab === 'chat' && (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2">
              <div className="flex items-center justify-between border border-slate-800 bg-slate-950/80 px-3 py-1.5 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Simular Cliente</span>
                <button
                  type="button"
                  onClick={() => setIsSimulatingCustomer(!isSimulatingCustomer)}
                  className={`p-1 rounded transition-colors ${
                    isSimulatingCustomer ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isSimulatingCustomer ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 px-1 py-0.5 rounded">ON</span>
                      <ToggleRight className="h-6 w-6" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-slate-800 px-1 py-0.5 rounded">OFF</span>
                      <ToggleLeft className="h-6 w-6" />
                    </div>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1 flex">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    placeholder={isSimulatingCustomer ? "Preguntar al bot..." : "Responder manualmente..."}
                    className="chat-message-text flex-1 pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />

                  {showEmojiPicker && (
                    <div className="absolute bottom-11 left-0 z-30 grid grid-cols-8 gap-1 p-2 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl w-64">
                      {['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '🤔', '😎', '💡', '🚀', '👇', '✅', '❌', '😊'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setTypedMessage(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-slate-850 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!typedMessage.trim() || chatLoading}
                  className={`p-2 rounded-lg transition-all ${
                    isSimulatingCustomer 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                      : 'bg-cyan-500 text-white hover:bg-cyan-600'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 bg-[#0c0f1d] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowNewLeadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="font-semibold text-white text-base mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              Registrar Nuevo Cliente
            </h3>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre del Cliente</label>
                <input
                  type="text"
                  placeholder="Juan Perez"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Número de Teléfono</label>
                <input
                  type="text"
                  placeholder="+51987654321"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
              >
                Crear Cliente e Iniciar Conversación
              </button>
            </form>
          </div>
        </div>
      )}

      {activeNotification && (
        <div className={`fixed bottom-8 z-50 w-96 rounded-3xl border border-emerald-500/25 bg-slate-950/50 p-5 shadow-[0_20px_50px_rgba(16,185,129,0.12)] animate-slide-in flex items-start gap-4 backdrop-blur-xl transition-all duration-300 ${
          selectedLead ? 'right-[416px]' : 'right-8'
        }`}>
          <div className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
            <MessageSquare className="h-4 w-4 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase block">¡Nuevo Mensaje!</span>
            <span className="text-sm font-semibold text-white block mt-1 truncate">{activeNotification.senderName}</span>
            <p className="chat-message-text text-xs text-slate-200 mt-2 line-clamp-3 leading-relaxed italic bg-slate-950/30 p-2.5 rounded-xl border border-slate-900/60">
              "{activeNotification.message}"
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={async () => {
                  const rawLeadId = activeNotification.leadId;
                  const senderName = activeNotification.senderName;
                  
                  let cleanLeadId = rawLeadId.replace(/\D/g, '');
                  if (cleanLeadId.length === 9 && cleanLeadId.startsWith('9')) {
                    cleanLeadId = '51' + cleanLeadId;
                  }

                  try {
                    const res = await fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' });
                    const leadsData = await res.json();
                    const list = Array.isArray(leadsData) ? leadsData : [];
                    let targetLead = list.find((l: any) => l.id === cleanLeadId || l.phone === cleanLeadId);

                    if (!targetLead) {
                      const createRes = await fetch('/api/leads', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: cleanLeadId,
                          name: senderName || `Cliente (+${cleanLeadId})`,
                          phone: cleanLeadId,
                          status: 'New',
                          tags: [],
                          bot_active: true
                        })
                      });
                      const createData = await createRes.json();
                      if (createData && createData.success) {
                        targetLead = createData.lead;
                        fetchData();
                      }
                    }

                    if (targetLead) {
                      forceScrollToBottomRef.current = true;
                      setSelectedLead(targetLead);
                    }
                  } catch (err) {
                    console.error('Error al responder desde la notificación:', err);
                  }
                  setActiveNotification(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/10"
              >
                Responder
              </button>
              <button
                onClick={() => setActiveNotification(null)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-all border border-slate-800"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
