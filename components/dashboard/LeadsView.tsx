'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, AlertCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight,
  Smile, List, LayoutGrid, StickyNote, Bell, Trash, ChevronRight, Check,
  Paperclip, Loader2, Download
} from 'lucide-react';

// Logos Oficiales SVG para Insignias de Avatar (WhatsApp, Instagram, Facebook)
function WhatsAppBadgeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <div className={`rounded-full bg-[#25D366] flex items-center justify-center p-0.5 shadow-md border-2 border-[#111b21] ${className}`} title="WhatsApp">
      <svg className="w-full h-full text-white fill-current" viewBox="0 0 24 24">
        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.993L2 22l5.233-1.37a9.954 9.954 0 004.779 1.218h.004c5.505 0 9.988-4.478 9.989-9.984A9.972 9.972 0 0012.012 2zm5.83 14.195c-.244.688-1.42 1.31-1.956 1.385-.503.07-1.156.126-3.702-.924-3.256-1.344-5.35-4.66-5.512-4.877-.162-.217-1.32-1.758-1.32-3.354 0-1.595.834-2.38 1.13-2.705.297-.326.65-.407.868-.407.217 0 .434.002.623.01.202.008.473-.077.74.563.272.651.923 2.253 1.004 2.417.081.163.136.353.028.57-.109.217-.163.353-.326.543-.163.19-.342.424-.488.57-.163.163-.334.341-.144.667.19.326.845 1.394 1.815 2.258 1.246 1.11 2.296 1.455 2.622 1.618.326.163.516.136.706-.081.19-.217.815-.95.1.032-1.2.217-.245.435-.109.652.136.218.245 1.386 1.547 1.549 1.737.163.19.163.353.108.57-.054.217-.244.688-.488 1.376z"/>
      </svg>
    </div>
  );
}

function InstagramBadgeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <div className={`rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center p-0.5 shadow-md border-2 border-[#111b21] ${className}`} title="Instagram Direct">
      <svg className="w-full h-full text-white fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    </div>
  );
}

function FacebookBadgeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <div className={`rounded-full bg-[#0084FF] flex items-center justify-center p-0.5 shadow-md border-2 border-[#111b21] ${className}`} title="Facebook Messenger">
      <svg className="w-full h-full text-white fill-current" viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.45 5.518 3.715 7.215V22l3.35-1.84c.93.258 1.91.401 2.935.401 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.191 12.443l-2.583-2.756-5.034 2.756 5.534-5.875 2.646 2.756 4.97-2.756-5.534 5.875z"/>
      </svg>
    </div>
  );
}

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
  handleSendMessage: (e?: React.FormEvent, customText?: string) => void;
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

  // Estados de archivos adjuntos para chat individual
  const [attachmentUrl, setAttachmentUrl] = React.useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setAttachmentUrl(data.url);
      } else {
        alert(data.error || 'Error al subir archivo');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Error de red al subir archivo');
    } finally {
      setUploadingAttachment(false);
      if (e.target) e.target.value = '';
    }
  };

  const localHandleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() && !attachmentUrl) return;

    let finalMessage = typedMessage.trim();
    if (attachmentUrl) {
      finalMessage = finalMessage 
        ? `${finalMessage}\n📎 Imagen adjunta: ${attachmentUrl}` 
        : `📎 Imagen adjunta: ${attachmentUrl}`;
    }

    handleSendMessage(e, finalMessage);
    setAttachmentUrl(null);
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    let cleanText = text;
    let mediaUrl = '';
    
    // Buscar patrón 📎 Imagen adjunta: URL
    const attachmentMatch = text.match(/📎 Imagen adjunta:\s*(https?:\/\/\S+)/);
    if (attachmentMatch) {
      mediaUrl = attachmentMatch[1];
      cleanText = text.replace(/📎 Imagen adjunta:\s*(https?:\/\/\S+)/, '').trim();
    } else if (text.startsWith('http') && text.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|ogg)/i)) {
      mediaUrl = text;
      cleanText = '';
    }

    const isVideo = mediaUrl && mediaUrl.match(/\.(mp4|webm|ogg)/i);

    return (
      <div className="space-y-2">
        {mediaUrl && (
          <div className="rounded-xl overflow-hidden max-w-xs border border-slate-800 bg-slate-950/40 p-1 flex justify-center">
            {isVideo ? (
              <video 
                src={mediaUrl} 
                controls 
                className="max-h-48 rounded object-contain" 
              />
            ) : (
              <img 
                src={mediaUrl} 
                alt="Imagen" 
                className="max-h-48 rounded object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-200" 
                onClick={() => window.open(mediaUrl, '_blank')}
              />
            )}
          </div>
        )}
        {cleanText && <p className="whitespace-pre-wrap break-words">{cleanText}</p>}
      </div>
    );
  };

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

      {/* COLUMNA 1: BANDEJA DE CHATS ESTILO WHATSAPP WEB */}
      <div className="w-80 shrink-0 border-r border-[#222d34] bg-[#111b21] flex flex-col h-full">
        {/* Cabecera Bandeja */}
        <div className="p-3.5 border-b border-[#222d34] bg-[#202c33] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#e9edef] tracking-wide">Chats</h3>
            <div className="flex items-center gap-1.5">
              <a
                href="/api/reports/export"
                download
                className="p-1.5 rounded-full bg-[#2a3942] hover:bg-[#374248] text-[#e9edef] transition-all flex items-center justify-center"
                title="Exportar Clientes a Excel"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="p-1.5 rounded-full bg-[#00a884]/20 hover:bg-[#00a884]/30 text-emerald-400 transition-all"
                title="Registrar nuevo cliente"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Buscar o empezar un nuevo chat"
              value={leadsSearch}
              onChange={(e) => setLeadsSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#202c33] border border-transparent rounded-lg text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:bg-[#2a3942] transition"
            />
          </div>
        </div>

        {/* Filtros de Canal de Red Social */}
        <div className="flex px-3 py-2 gap-1.5 border-b border-[#222d34] bg-[#111b21]">
          {['Todos', 'WhatsApp', 'Instagram', 'Facebook'].map((channelFilter) => (
            <button
              key={channelFilter}
              onClick={() => setLeadsFilter(channelFilter)}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold text-center transition-all ${
                leadsFilter === channelFilter
                  ? 'bg-[#00a884] text-white shadow-md'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
              }`}
            >
              {channelFilter}
            </button>
          ))}
        </div>

        {/* Lista de Leads/Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/40">
          {filteredLeads.map((lead) => {
            const isSelected = selectedLead?.id === lead.id;
            const initials = getInitials(lead.name);
            const avatarBg = getAvatarBg(lead.name);
            const lastMsg = getLastMessage(lead);
            const timeStr = getLeadTime(lead);

            // Determinar canal de origen (WhatsApp, Instagram, Facebook)
            const channel = (lead.channel || (lead.id?.startsWith('ig_') ? 'instagram' : lead.id?.startsWith('fb_') ? 'facebook' : 'whatsapp')).toLowerCase();

            return (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className={`p-3.5 flex gap-3 cursor-pointer transition relative items-center ${
                  isSelected ? 'bg-[#2a3942] border-l-4 border-[#00a884]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Avatar con Foto de Perfil Real o Iniciales + Logo Oficial */}
                <div className="relative shrink-0">
                  {lead.avatar_url ? (
                    <img 
                      src={lead.avatar_url} 
                      alt={lead.name}
                      className="w-11 h-11 rounded-full object-cover shadow-sm ring-1 ring-white/10" 
                    />
                  ) : (
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${avatarBg} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/10`}>
                      {initials}
                    </div>
                  )}
                  
                  {/* Insignia con Logo Oficial SVG (WhatsApp / Instagram / Facebook) */}
                  {channel === 'instagram' ? (
                    <InstagramBadgeIcon className="w-5 h-5 absolute -bottom-1 -right-1" />
                  ) : channel === 'facebook' ? (
                    <FacebookBadgeIcon className="w-5 h-5 absolute -bottom-1 -right-1" />
                  ) : (
                    <WhatsAppBadgeIcon className="w-5 h-5 absolute -bottom-1 -right-1" />
                  )}
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[#e9edef] truncate max-w-[70%]">{lead.name}</h4>
                    <span className="text-[10px] text-[#8696a0]">{timeStr}</span>
                  </div>
                  <p className="text-[11px] text-[#8696a0] truncate mt-0.5">{lastMsg}</p>
                </div>

                {/* Badge no leído */}
                {lead.unread_count > 0 && (
                  <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-[#00a884] text-white font-bold text-[10px] flex items-center justify-center shadow-md">
                    {lead.unread_count}
                  </span>
                )}
              </div>
            );
          })}

          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-xs text-[#8696a0] italic">
              No hay conversaciones en esta categoría.
            </div>
          )}
        </div>
      </div>

      {/* COLUMNA 2: ÁREA DE CONVERSACIÓN (ESTILO WHATSAPP WEB) */}
      <div className="flex-1 bg-[#0b141a] flex flex-col min-w-0 relative border-r border-[#222d34] h-full shadow-2xl">
        {selectedLead ? (
          <>
            {/* Cabecera del Chat Estilo WhatsApp Web */}
            <div className="h-16 shrink-0 border-b border-[#222d34] bg-[#202c33] px-5 flex items-center justify-between z-10 shadow-md">
              <div className="flex items-center gap-3.5">
                {selectedLead.avatar_url ? (
                  <img 
                    src={selectedLead.avatar_url} 
                    alt={selectedLead.name} 
                    className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-emerald-500/20" 
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getAvatarBg(selectedLead.name)} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-emerald-500/20`}>
                    {getInitials(selectedLead.name)}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-[#e9edef] leading-tight">{selectedLead.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-[#8696a0]">
                      +{selectedLead.phone.replace(/\D/g, '')} • {selectedLead.bot_active ? '🤖 Bot Inteligente Activo' : '👤 Atención Manual'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de Cabecera */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleBot(selectedLead)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm ${
                    selectedLead.bot_active 
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' 
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                >
                  {selectedLead.bot_active ? '🤖 Bot Activo' : '👤 Pausar Bot (Manual)'}
                </button>
                <div className="h-4 w-px bg-[#374248] mx-1" />
                <button
                  onClick={handleDeleteChat}
                  className="p-2 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-rose-400 transition"
                  title="Vaciar chat"
                >
                  <Trash size={16} />
                </button>
                <button
                  onClick={handleDeleteLead}
                  className="p-2 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-rose-500 transition"
                  title="Eliminar contacto"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Ventana de Mensajes con Fondo WhatsApp Doodle Wallpaper */}
            <div 
              ref={chatContainerRef} 
              className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0b141a] relative"
              style={{
                backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px), radial-gradient(#1f2c34 1px, #0b141a 1px)`,
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 20px 20px'
              }}
            >
              {chatNotice && (
                <div className="rounded-lg border border-emerald-500/30 bg-[#182229] px-4 py-2.5 text-xs text-emerald-300 text-center mx-auto max-w-md shadow-md">
                  {chatNotice}
                </div>
              )}
              {chatMessages
                .filter((msg) => isIdInAssociatedIds(msg.lead_id))
                .map((msg) => {
                  const isCustomer = msg.sender === 'customer';
                  const isBot = msg.sender === 'bot';
                  const msgTime = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ahora';
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[75%] sm:max-w-[65%] ${
                        isCustomer ? 'mr-auto items-start' : 'ml-auto items-end'
                      }`}
                    >
                      {/* Remitente e indicador */}
                      <span className="text-[10px] text-[#8696a0] mb-0.5 px-1 flex items-center gap-1 font-medium">
                        {!isCustomer && (
                          isBot ? <Bot className="h-3 w-3 text-emerald-400" /> : <User className="h-3 w-3 text-indigo-400" />
                        )}
                        {isCustomer ? selectedLead.name : isBot ? 'IA Nutraflow' : 'Agente (Tú)'}
                      </span>
                      
                      {/* Burbuja Estilo WhatsApp Web (#202c33 entrante / #005c4b saliente) */}
                      <div className={`px-3.5 py-2.5 rounded-lg text-xs text-[#e9edef] leading-relaxed shadow-md relative group ${
                        isCustomer 
                          ? 'bg-[#202c33] rounded-tl-none border-l-4 border-slate-600' 
                          : isBot
                            ? 'bg-[#005c4b] rounded-tr-none border-r-4 border-emerald-400'
                            : 'bg-[#005c4b] rounded-tr-none border-r-4 border-indigo-400'
                      }`}>
                        <div>{renderMessageContent(msg.message)}</div>
                        
                        {/* Timestamp + Double Check (✓✓) al estilo WhatsApp */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0]">
                          <span>{msgTime}</span>
                          {!isCustomer && (
                            <span className="text-[#53bdeb] font-bold tracking-tighter text-[10px]">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {chatMessages.filter((msg) => isIdInAssociatedIds(msg.lead_id)).length === 0 && (
                <div className="text-center py-20 text-[#8696a0] text-xs italic bg-[#182229]/60 max-w-sm mx-auto rounded-xl border border-[#222d34] p-6 shadow-lg">
                  🔒 Mensajes cifrados de extremo a extremo. No hay historial previo guardado.
                </div>
              )}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-[#8696a0] bg-[#202c33] px-3.5 py-2 rounded-lg w-fit shadow-md animate-pulse">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#00a884]" />
                  <span>Escribiendo respuesta...</span>
                </div>
              )}
            </div>

            {/* Pie de Página / Barra de Entrada Estilo WhatsApp Web */}
            <form onSubmit={localHandleSubmit} className="p-3 border-t border-[#222d34] bg-[#202c33] flex flex-col gap-2 z-10">
              <div className="flex items-center justify-between px-2 text-[10px] text-[#8696a0]">
                <span className="tracking-wider uppercase font-semibold">Modo de Respuesta:</span>
                <button
                  type="button"
                  onClick={() => setIsSimulatingCustomer(!isSimulatingCustomer)}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] transition ${
                    isSimulatingCustomer ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-[#111b21] text-[#e9edef] border border-[#2a3942]'
                  }`}
                >
                  {isSimulatingCustomer ? '🧪 Simular Cliente' : '📱 Modo Agente WhatsApp'}
                </button>
              </div>

              {/* Preview de adjunto cargado */}
              {attachmentUrl && (
                <div className="relative inline-flex items-center gap-2 p-1.5 bg-[#111b21] border border-[#2a3942] rounded-xl max-w-xs animate-fade-in self-start shadow-md">
                  {attachmentUrl.match(/\.(mp4|webm|ogg)/i) ? (
                    <video src={attachmentUrl} className="h-10 w-10 object-cover rounded" muted />
                  ) : (
                    <img src={attachmentUrl} alt="Preview" className="h-10 w-10 object-cover rounded" />
                  )}
                  <span className="text-[10px] text-[#e9edef] truncate max-w-[120px]">Archivo adjunto</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentUrl(null)}
                    className="p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition ml-2 shadow-lg"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              <div className="flex gap-2 relative items-center">
                {/* Emojis (😀) */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2.5 text-[#8696a0] hover:text-[#e9edef] transition shrink-0"
                  title="Emojis"
                >
                  <Smile className="h-5 w-5" />
                </button>

                {/* Adjuntar (📎) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachment}
                  className="p-2.5 text-[#8696a0] hover:text-[#e9edef] transition shrink-0 disabled:opacity-50"
                  title="Adjuntar imagen o video"
                >
                  {uploadingAttachment ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachmentSelect}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    placeholder={isSimulatingCustomer ? "Escribe un mensaje como cliente..." : "Escribe un mensaje aquí..."}
                    className="w-full px-4 py-2.5 bg-[#2a3942] border border-transparent rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:bg-[#2a3942] focus:ring-1 focus:ring-emerald-500/50"
                  />

                  {showEmojiPicker && (
                    <div className="absolute bottom-14 left-0 z-50 grid grid-cols-8 gap-1 p-3 bg-[#233138] border border-[#2a3942] rounded-2xl shadow-2xl w-72">
                      {['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '🤔', '😎', '💡', '🚀', '👇', '✅', '❌', '😊'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setTypedMessage(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="w-8 h-8 flex items-center justify-center text-base rounded-lg hover:bg-[#182229] transition"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón Verde WhatsApp (#00a884) */}
                <button
                  type="submit"
                  disabled={(!typedMessage.trim() && !attachmentUrl) || chatLoading}
                  className="p-3 rounded-full bg-[#00a884] hover:bg-[#008f70] text-white transition-all shadow-md shrink-0 disabled:opacity-40 disabled:hover:bg-[#00a884]"
                  title="Enviar mensaje"
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
