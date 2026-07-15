'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, AlertCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight,
  Smile, List, LayoutGrid, StickyNote, Bell, Trash, ChevronRight, Check
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
  leads,
  filteredLeads,
  selectedLead,
  setSelectedLead,
  errorMsg,
  leadsSearch,
  setLeadsSearch,
  leadsFilter,
  setLeadsFilter,
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

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getAvatarBg = (name: string) => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-teal-500 to-emerald-500',
      'from-amber-500 to-orange-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const isIdInAssociatedIds = (id: string) => {
    if (!selectedLead) return false;
    const associatedIds = getAssociatedIds(selectedLead);
    return associatedIds.includes(id) || (id && associatedIds.map(x => x.replace(/\D/g, '')).includes(id.replace(/\D/g, '')));
  };

  // Encontrar el último mensaje de cada lead para mostrar previsualización
  const getLastMessage = (lead: any) => {
    const associated = getAssociatedIds(lead);
    const leadMsgs = chatMessages.filter(m => associated.includes(m.lead_id) || (m.lead_id && associated.map(x => x.replace(/\D/g, '')).includes(m.lead_id.replace(/\D/g, ''))));
    if (leadMsgs.length === 0) return 'Sin mensajes aún';
    const last = leadMsgs[leadMsgs.length - 1];
    return last.message;
  };

  const getLeadTime = (lead: any) => {
    const associated = getAssociatedIds(lead);
    const leadMsgs = chatMessages.filter(m => associated.includes(m.lead_id) || (m.lead_id && associated.map(x => x.replace(/\D/g, '')).includes(m.lead_id.replace(/\D/g, ''))));
    const timestamp = leadMsgs.length > 0 ? leadMsgs[leadMsgs.length - 1].created_at : lead.created_at;
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  const pipelineStages = [
    { label: 'Nuevo Contacto', value: 'New' },
    { label: 'En Conversación', value: 'Engaged' },
    { label: 'Verificación Pendiente', value: 'Pending Verification' },
    { label: 'Por Registrar en Web', value: 'Por Registrar en Web' },
    { label: 'Venta Cerrada 🎉', value: 'Converted' }
  ];

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden bg-[#07090e] border-t border-slate-900 -m-8 text-slate-100 relative">
      
      {errorMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex gap-3 items-start shadow-2xl backdrop-blur-md max-w-lg">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <span className="font-semibold block text-red-400">Error de Base de Datos</span>
            <p className="mt-1 text-xs">{errorMsg}</p>
          </div>
          <button onClick={() => fetchData()} className="text-slate-400 hover:text-white"><RefreshCw size={14} /></button>
        </div>
      )}

      {/* COLUMNA 1: BANDEJA DE CHATS (IZQUIERDA) */}
      <div className="w-80 shrink-0 border-r border-slate-900 bg-[#090b11] flex flex-col h-full">
        {/* Cabecera Bandeja */}
        <div className="p-4 border-b border-slate-900 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Bandeja</h3>
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="p-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 transition-all"
              title="Registrar nuevo cliente"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={leadsSearch}
              onChange={(e) => setLeadsSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-650 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        {/* Filtros de Estado */}
        <div className="flex px-4 py-2 gap-1 overflow-x-auto border-b border-slate-900 scrollbar-none bg-[#090b11]">
          {['Todos', 'Nuevo', 'Interactuando', 'Verificación Pendiente', 'Por Registrar en Web', 'Venta Confirmada'].map((filter) => (
            <button
              key={filter}
              onClick={() => setLeadsFilter(filter)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition ${
                leadsFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {filter === 'Todos' ? 'Todas' : filter === 'Nuevo' ? 'Nuevas' : filter === 'Verificación Pendiente' ? 'Pendientes' : filter === 'Venta Confirmada' ? 'Ventas' : filter}
            </button>
          ))}
        </div>

        {/* Lista de Leads/Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/40">
          {filteredLeads.map((lead) => {
            const isSelected = selectedLead?.id === lead.id;
            const initials = getInitials(lead.name);
            const avatarBg = getAvatarBg(lead.name);
            const lastMsg = getLastMessage(lead);
            const timeStr = getLeadTime(lead);

            return (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className={`p-4 flex gap-3 cursor-pointer transition relative items-center ${
                  isSelected ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : 'hover:bg-slate-900/30'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${avatarBg} flex items-center justify-center font-bold text-xs text-white shadow-md`}>
                    {initials}
                  </div>
                  {/* Indicador del Bot */}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#090b11] ${
                    lead.bot_active ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} title={lead.bot_active ? 'Bot de IA Activo' : 'Modo Manual'} />
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white truncate max-w-[70%]">{lead.name}</h4>
                    <span className="text-[9px] text-slate-500">{timeStr}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{lastMsg}</p>
                </div>

                {/* Badge no leído */}
                {lead.unread_count > 0 && (
                  <span className="shrink-0 h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                    {lead.unread_count}
                  </span>
                )}
              </div>
            );
          })}

          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-600 italic">
              No hay conversaciones en esta categoría.
            </div>
          )}
        </div>
      </div>

      {/* COLUMNA 2: ÁREA DE CONVERSACIÓN (CENTRO) */}
      <div className="flex-1 bg-[#07090e] flex flex-col min-w-0 relative border-r border-slate-900 h-full">
        {selectedLead ? (
          <>
            {/* Cabecera del Chat */}
            <div className="h-16 shrink-0 border-b border-slate-900 bg-[#090b11]/80 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarBg(selectedLead.name)} flex items-center justify-center font-bold text-xs text-white`}>
                  {getInitials(selectedLead.name)}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white leading-none">{selectedLead.name}</h3>
                  <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">+{selectedLead.phone.replace(/\D/g, '')}</span>
                </div>
              </div>

              {/* Botones de Cabecera */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleBot(selectedLead)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition ${
                    selectedLead.bot_active 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {selectedLead.bot_active ? '🤖 Bot Activo' : '👤 Modo Manual'}
                </button>
                <div className="h-4 w-px bg-slate-800" />
                <button
                  onClick={handleDeleteChat}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                  title="Vaciar chat"
                >
                  <Trash size={14} />
                </button>
                <button
                  onClick={handleDeleteLead}
                  className="p-2 rounded-lg hover:bg-red-600/10 text-slate-400 hover:text-red-500 transition"
                  title="Eliminar cliente"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Ventana de Mensajes */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#07090e]">
              {chatNotice && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200 text-center">
                  {chatNotice}
                </div>
              )}
              {chatMessages
                .filter((msg) => isIdInAssociatedIds(msg.lead_id))
                .map((msg) => {
                  const isCustomer = msg.sender === 'customer';
                  const isBot = msg.sender === 'bot';
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[70%] ${
                        isCustomer ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      {/* Remitente e indicador */}
                      <span className="text-[9px] text-slate-500 mb-1 px-1 flex items-center gap-1">
                        {!isCustomer && (
                          isBot ? <Bot className="h-3 w-3 text-emerald-400" /> : <User className="h-3 w-3 text-indigo-400" />
                        )}
                        {isCustomer ? 'Cliente' : isBot ? 'Asistente IA' : 'Agente'}
                      </span>
                      
                      {/* Burbuja */}
                      <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isCustomer 
                          ? 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800/40' 
                          : isBot
                            ? 'bg-emerald-600/15 text-emerald-100 rounded-tr-none border border-emerald-500/20'
                            : 'bg-indigo-600/20 text-indigo-100 rounded-tr-none border border-indigo-500/20'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })}

              {chatMessages.filter((msg) => isIdInAssociatedIds(msg.lead_id)).length === 0 && (
                <div className="text-center py-20 text-slate-650 text-xs italic">
                  No hay historial de conversación.
                </div>
              )}

              {chatLoading && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 italic mt-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                  Redactando respuesta automática...
                </div>
              )}
            </div>

            {/* Input y simulador en pie de página */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900 bg-[#090b11]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 text-[10px] text-slate-500">
                <span className="tracking-wider uppercase">Responder en modo:</span>
                <button
                  type="button"
                  onClick={() => setIsSimulatingCustomer(!isSimulatingCustomer)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-bold uppercase transition ${
                    isSimulatingCustomer ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isSimulatingCustomer ? 'Simular Cliente' : 'Respuesta Manual'}
                </button>
              </div>

              <div className="flex gap-2 relative">
                <div className="relative flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute left-3.5 text-slate-500 hover:text-indigo-400 transition"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    placeholder={isSimulatingCustomer ? "Escribe como si fueras el cliente..." : "Escribe una respuesta..."}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />

                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 z-30 grid grid-cols-8 gap-1 p-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl w-64">
                      {['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '🤔', '😎', '💡', '🚀', '👇', '✅', '❌', '😊'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setTypedMessage(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-slate-800 transition"
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
                  className={`p-2.5 rounded-xl transition-all ${
                    isSimulatingCustomer 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                      : 'bg-indigo-650 text-white hover:bg-indigo-550'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
            <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-slate-400 mb-4">
              <MessageSquare size={32} className="mx-auto" />
            </div>
            <h3 className="font-semibold text-white text-sm">Ningún chat seleccionado</h3>
            <p className="text-[11px] text-slate-500 text-center mt-1 max-w-xs leading-relaxed">
              Selecciona un cliente de la lista de la izquierda para comenzar a chatear, gestionar las alertas de seguimiento y alternar el Bot de IA.
            </p>
          </div>
        )}
      </div>

      {/* COLUMNA 3: DETALLES DE CRM (DERECHA) */}
      {selectedLead && (
        <div className="w-80 shrink-0 bg-[#090b11] flex flex-col h-full overflow-y-auto">
          {/* Detalles Perfil */}
          <div className="p-6 border-b border-slate-900/60 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getAvatarBg(selectedLead.name)} flex items-center justify-center font-bold text-xl text-white shadow-lg mb-3`}>
              {getInitials(selectedLead.name)}
            </div>
            <h4 className="font-semibold text-white text-xs">{selectedLead.name}</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-1">+{selectedLead.phone.replace(/\D/g, '')}</p>
          </div>

          {/* Switch IA */}
          <div className="px-6 py-4 border-b border-slate-900/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">IA en esta conversación</span>
            <button
              onClick={() => handleToggleBot(selectedLead)}
              className="text-slate-400 hover:text-white transition"
            >
              {selectedLead.bot_active ? (
                <ToggleRight className="h-7 w-7 text-emerald-400" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-slate-600" />
              )}
            </button>
          </div>

          {/* Etapas del Pipeline (Línea de tiempo vertical) */}
          <div className="p-6 border-b border-slate-900/60">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-4">Etapa del Pipeline</span>
            <div className="relative pl-6 space-y-4">
              {/* Línea conectora */}
              <div className="absolute left-2.5 top-1 bottom-1 w-0.5 bg-slate-900" />
              
              {pipelineStages.map((stage) => {
                const isActive = selectedLead.status === stage.value;
                return (
                  <div
                    key={stage.value}
                    onClick={() => handleStatusChange(selectedLead.id, stage.value)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    {/* Bullet */}
                    <div className={`absolute left-1.5 w-2.5 h-2.5 rounded-full border transition z-10 ${
                      isActive 
                        ? 'bg-indigo-500 border-indigo-400 scale-125' 
                        : 'bg-[#090b11] border-slate-800 group-hover:border-slate-655'
                    }`} />
                    <span className={`text-[10px] font-semibold transition ${
                      isActive ? 'text-indigo-400 font-bold' : 'text-slate-500 group-hover:text-slate-350'
                    }`}>
                      {stage.label}
                    </span>
                    {isActive && <Check className="h-3 w-3 text-indigo-400 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notas y Alertas */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#090b11]">
            <div className="flex border-b border-slate-900">
              <button
                onClick={() => setChatTab('notes')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition border-b flex items-center justify-center gap-1.5 ${
                  chatTab === 'notes' ? 'text-indigo-400 border-indigo-500 bg-slate-950/20' : 'text-slate-550 border-transparent hover:text-slate-300'
                }`}
              >
                <StickyNote size={12} />
                Notas ({notes.length})
              </button>
              <button
                onClick={() => setChatTab('reminders')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition border-b flex items-center justify-center gap-1.5 ${
                  chatTab === 'reminders' ? 'text-indigo-400 border-indigo-500 bg-slate-950/20' : 'text-slate-550 border-transparent hover:text-slate-300'
                }`}
              >
                <Bell size={12} />
                Alertas ({reminders.filter(r => !r.sent).length})
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-0">
              {chatTab === 'notes' && (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <form onSubmit={handleAddNote} className="flex flex-col gap-2 shrink-0">
                    <textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Añadir nota de seguimiento..."
                      rows={2}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-650 focus:outline-none focus:border-indigo-500/50 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!newNoteContent.trim()}
                      className="w-full py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white rounded-lg text-[10px] font-semibold transition disabled:opacity-50"
                    >
                      Guardar nota
                    </button>
                  </form>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {notes.map((note) => (
                      <div key={note.id} className="p-2.5 bg-slate-950/50 border border-slate-900 rounded-lg relative group">
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="absolute top-1.5 right-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={10} />
                        </button>
                        <p className="text-[8px] text-slate-500 font-mono">{new Date(note.created_at).toLocaleString('es-PE')}</p>
                        <p className="text-[11px] text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-center py-6 text-[10px] text-slate-600 italic">Sin anotaciones.</p>
                    )}
                  </div>
                </div>
              )}

              {chatTab === 'reminders' && (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <form onSubmit={handleAddReminder} className="flex flex-col gap-2 shrink-0 p-2.5 bg-slate-950 border border-slate-900 rounded-xl">
                    <div className="flex items-center justify-between text-[8px] font-bold text-slate-550 uppercase">
                      <span>Programar en:</span>
                      <select
                        value={newReminderHours}
                        onChange={(e) => setNewReminderHours(Number(e.target.value))}
                        className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none"
                      >
                        <option value={1}>1 hora</option>
                        <option value={6}>6 horas</option>
                        <option value={24}>24 horas</option>
                        <option value={48}>48 horas</option>
                      </select>
                    </div>
                    <textarea
                      value={newReminderMessage}
                      onChange={(e) => setNewReminderMessage(e.target.value)}
                      placeholder="Mensaje de WhatsApp..."
                      rows={2}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 placeholder-slate-650 focus:outline-none resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!newReminderMessage.trim()}
                      className="w-full py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white rounded text-[10px] font-semibold transition disabled:opacity-50"
                    >
                      Agendar alerta
                    </button>
                  </form>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {reminders.map((rem) => (
                      <div key={rem.id} className="p-2.5 bg-slate-950/50 border border-slate-900 rounded-lg relative group">
                        <button
                          onClick={() => handleDeleteReminder(rem.id)}
                          className="absolute top-1.5 right-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={10} />
                        </button>
                        <div className="flex items-center justify-between">
                          <span className={`px-1 rounded text-[7px] font-bold ${
                            rem.sent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                          }`}>
                            {rem.sent ? 'Enviado' : 'Pendiente'}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono">{new Date(rem.scheduled_at).toLocaleString('es-PE')}</span>
                        </div>
                        <p className="text-[11px] text-slate-350 mt-1.5 leading-relaxed">{rem.message}</p>
                      </div>
                    ))}
                    {reminders.length === 0 && (
                      <p className="text-center py-6 text-[10px] text-slate-600 italic">Sin recordatorios.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO DE LEADS */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 bg-[#0c0f1d] border border-slate-800 rounded-xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowNewLeadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="font-semibold text-white text-xs mb-4 flex items-center gap-2 uppercase tracking-wide">
              <Plus className="h-4 w-4 text-indigo-400" />
              Nuevo Cliente
            </h3>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nombre del Cliente</label>
                <input
                  type="text"
                  placeholder="Juan Perez"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Número de Teléfono</label>
                <input
                  type="text"
                  placeholder="+51987654321"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold rounded-lg bg-indigo-650 hover:bg-indigo-550 text-white transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              >
                Crear Cliente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
