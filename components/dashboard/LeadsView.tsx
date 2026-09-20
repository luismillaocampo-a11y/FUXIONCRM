'use client';

import React from 'react';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, AlertCircle, RefreshCw, UserCheck, ToggleLeft, ToggleRight,
  Smile, List, LayoutGrid, StickyNote, Bell, Trash, ChevronRight, Check,
  Paperclip, Loader2, Download, Copy, FileText, ClipboardCheck, MoreVertical,
  Mic, Play, Pause, Palette, Sparkles
} from 'lucide-react';

// Reproductor de Audio Estilo WhatsApp Web Oficial (Imagen 3)
function WhatsAppVoicePlayer({ 
  src, 
  senderName, 
  isAgent, 
  transcription 
}: { 
  src: string; 
  senderName: string; 
  isAgent: boolean; 
  transcription?: string; 
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Barras visuales de forma de onda (28 barras con alturas dinámicas idénticas a WhatsApp Web)
  const barHeights = [
    30, 45, 70, 40, 85, 100, 60, 40, 90, 75, 50, 65, 80, 45, 95, 70, 50, 80, 60, 40, 70, 90, 55, 35, 60, 45, 30, 20
  ];

  return (
    <div className="flex flex-col gap-1.5 max-w-[320px] w-full my-1">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="hidden"
      />

      <div className={`p-3 rounded-2xl border ${isAgent ? 'bg-[#005c4b] border-emerald-600/40 text-white' : 'bg-[#202c33] border-[#2a3942] text-slate-100'} shadow-md flex items-center gap-3 relative`}>
        {/* Botón Circular de Play/Pausa */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 flex-shrink-0"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current text-white" />
          ) : (
            <Play className="w-5 h-5 fill-current text-white ml-0.5" />
          )}
        </button>

        {/* Visualizador de Onda de Sonido y Barra de Progreso */}
        <div className="flex-1 flex flex-col justify-center gap-1 cursor-pointer select-none" onClick={handleSeek}>
          <div className="flex items-center gap-[2.5px] h-6 px-1">
            {barHeights.map((h, i) => {
              const barPercent = (i / barHeights.length) * 100;
              const isPlayed = barPercent <= progress;
              return (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-[3px] rounded-full transition-colors duration-150 ${
                    isPlayed 
                      ? (isAgent ? 'bg-emerald-200' : 'bg-emerald-400') 
                      : (isAgent ? 'bg-emerald-800/60' : 'bg-slate-600/60')
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium px-1 text-slate-300">
            <span>{isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSpeed(); }}
              className="text-[10px] font-bold bg-black/30 hover:bg-black/50 px-1.5 py-0.5 rounded text-emerald-300 border border-emerald-500/20"
            >
              {speed}x
            </button>
          </div>
        </div>

        {/* Foto de Perfil / Avatar con Insignia de Micrófono */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden border border-slate-600 shadow-sm">
            {senderName ? senderName.charAt(0) : 'U'}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-[#111b21]">
            <Mic className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>

      {/* Insignia Elegante de Transcripción de la IA */}
      {transcription && (
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 text-xs text-slate-200 shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <Mic className="w-3 h-3" />
            <span>Transcripción de Voz (IA):</span>
          </div>
          <p className="italic leading-relaxed text-slate-300 text-xs">"{transcription}"</p>
        </div>
      )}
    </div>
  );
}

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

// Utilidades de leads centralizadas en @/lib/lead-utils (teléfonos, estados, scoring).
import {
  getAssociatedIds,
  getPhoneVariants,
  getPhoneFromWhatsappId,
  isLidDigits,
  formatLeadPhone,
  translateLeadStatus,
  calculateScore,
  IDENTITY_MAPPING,
} from '@/lib/lead-utils';
// Re-export por compatibilidad con importadores existentes.
export {
  getAssociatedIds,
  getPhoneVariants,
  getPhoneFromWhatsappId,
  isLidDigits,
  formatLeadPhone,
  translateLeadStatus,
  calculateScore,
  IDENTITY_MAPPING,
};

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

  // Tema de la Notificación Flotante ('neon-glass' o 'classic')
  const [notifTheme, setNotifThemeState] = React.useState<'neon-glass' | 'classic'>('neon-glass');

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('crm_notif_theme');
      if (saved === 'classic' || saved === 'neon-glass') {
        setNotifThemeState(saved);
      }
    } catch (e) {}
  }, []);

  const setNotifTheme = (theme: 'neon-glass' | 'classic') => {
    setNotifThemeState(theme);
    try {
      localStorage.setItem('crm_notif_theme', theme);
    } catch (e) {}
  };

  // Estados de archivos adjuntos para chat individual
  const [attachmentUrl, setAttachmentUrl] = React.useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);
  const [copyNotice, setCopyNotice] = React.useState<string | null>(null);
  const [syncingSheets, setSyncingSheets] = React.useState(false);
  const [sheetsMenuOpen, setSheetsMenuOpen] = React.useState(false);
  const [lastSheetsSync, setLastSheetsSync] = React.useState<string | null>(null);
  const [mergeTargetInput, setMergeTargetInput] = React.useState('');
  const [mergingLead, setMergingLead] = React.useState(false);

  const loadLastSheetsSync = async () => {
    try {
      const res = await fetch('/api/google-sheets');
      const data = await res.json();
      if (data?.success && data.last_sync) setLastSheetsSync(data.last_sync);
    } catch {
      /* sin última sync: no bloquea */
    }
  };
  const [showActionMenu, setShowActionMenu] = React.useState(false);
  const [previewImageModal, setPreviewImageModal] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-refresco en tiempo real (cada 2.5 segundos) para recibir nuevos mensajes automáticamente
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-scroll automático al final de la ventana de chat al seleccionar o actualizar mensajes
  React.useEffect(() => {
    if (chatContainerRef && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, selectedLead]);

  // Estados de edición rápida de Lead (Nombre, Teléfono Real, Tags)
  const [editingLeadName, setEditingLeadName] = React.useState(false);
  const [tempLeadName, setTempLeadName] = React.useState('');
  const [editingLeadPhone, setEditingLeadPhone] = React.useState(false);
  const [tempLeadPhone, setTempLeadPhone] = React.useState('');
  const [phoneCopied, setPhoneCopied] = React.useState(false);

  const handleCopyPhone = async (text: string) => {
    if (!text || text === 'Sin teléfono') return;
    try {
      await navigator.clipboard.writeText(text);
      setPhoneCopied(true);
      window.setTimeout(() => setPhoneCopied(false), 1500);
    } catch (e) {
      console.error('No se pudo copiar el teléfono:', e);
    }
  };
  const [savingLeadDetails, setSavingLeadDetails] = React.useState(false);

  // Modal customizado para alertas y confirmaciones
  const [customModal, setCustomModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleStartEditName = () => {
    if (!selectedLead) return;
    setTempLeadName(selectedLead.name || '');
    setEditingLeadName(true);
  };

  const handleSaveLeadName = async () => {
    if (!selectedLead || !tempLeadName.trim()) {
      setEditingLeadName(false);
      return;
    }
    try {
      setSavingLeadDetails(true);
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedLead,
          name: tempLeadName.trim()
        })
      });
      if (res.ok) {
        selectedLead.name = tempLeadName.trim();
        fetchData();
      }
    } catch (e) {
      console.error('Error al guardar nombre del lead:', e);
    } finally {
      setSavingLeadDetails(false);
      setEditingLeadName(false);
    }
  };

  const handleStartEditPhone = () => {
    if (!selectedLead) return;
    const currentPhone = selectedLead.real_phone || selectedLead.phone || '';
    setTempLeadPhone(currentPhone.replace(/\D/g, ''));
    setEditingLeadPhone(true);
  };

  const handleSaveLeadPhone = async () => {
    if (!selectedLead) {
      setEditingLeadPhone(false);
      return;
    }
    try {
      setSavingLeadDetails(true);
      const clean = tempLeadPhone.replace(/\D/g, '');
      let finalPhone = clean;
      if (clean.length === 9 && clean.startsWith('9')) {
        finalPhone = '51' + clean;
      }
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedLead,
          real_phone: finalPhone || selectedLead.real_phone || null
        })
      });
      if (res.ok) {
        selectedLead.real_phone = finalPhone;
        if (clean) selectedLead.phone = finalPhone;
        fetchData();
      }
    } catch (e) {
      console.error('Error al guardar teléfono del lead:', e);
    } finally {
      setSavingLeadDetails(false);
      setEditingLeadPhone(false);
    }
  };

  const handleSyncGoogleSheets = async (mode: 'full' | 'delta' | 'rebuild' = 'delta') => {
    try {
      setSyncingSheets(true);
      const res = await fetch('/api/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.success) {
        if (data.last_sync) setLastSheetsSync(data.last_sync);
        const detail = [
          typeof data.created === 'number' ? `${data.created} nuevos` : null,
          typeof data.updated === 'number' ? `${data.updated} actualizados` : null,
        ].filter(Boolean).join(' · ');
        setCustomModal({
          isOpen: true,
          title: 'Google Sheets Sincronizado',
          message: (data.message || '¡Sincronización exitosa con Google Sheets!') + (detail ? `\n${detail}.` : ''),
          confirmText: 'Aceptar',
          variant: 'info',
          onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false }))
        });
      } else {
        setCustomModal({
          isOpen: true,
          title: 'Google Sheets no Configurado',
          message: (data.error || 'Error al conectar con Google Sheets.') + ' ¿Deseas ir a Configuración para registrar la URL de tu hoja de cálculo?',
          confirmText: 'Ir a Configuración',
          variant: 'warning',
          onConfirm: () => {
            setCustomModal(prev => ({ ...prev, isOpen: false }));
            window.location.href = '/settings?section=system';
          }
        });
      }
    } catch (err: any) {
      setCustomModal({
        isOpen: true,
        title: 'Error de Red',
        message: 'Error al conectar con Google Sheets: ' + (err.message || 'Error de red'),
        confirmText: 'Aceptar',
        variant: 'danger',
        onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleRequestMergeLead = () => {
    if (!selectedLead) return;
    const target = mergeTargetInput.trim();
    if (!target || target === selectedLead.id) return;
    setCustomModal({
      isOpen: true,
      title: 'Fusionar leads',
      message: `Se moverán mensajes, notas, alertas y dudas de "${selectedLead.name}" al lead "${target}" y se eliminará el actual. ¿Continuar?`,
      confirmText: 'Fusionar',
      variant: 'warning',
      onConfirm: async () => {
        setCustomModal((prev) => ({ ...prev, isOpen: false }));
        try {
          setMergingLead(true);
          const res = await fetch('/api/leads/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId: selectedLead.id, targetId: target })
          });
          const data = await res.json();
          if (data.success) {
            setMergeTargetInput('');
            if (data.lead) setSelectedLead(data.lead);
            fetchData();
          } else {
            throw new Error(data.error || 'No se pudo fusionar');
          }
        } catch (e: any) {
          setCustomModal({
            isOpen: true,
            title: 'No se pudo fusionar',
            message: e?.message || 'Error al fusionar leads.',
            confirmText: 'Aceptar',
            variant: 'danger',
            onConfirm: () => setCustomModal((prev) => ({ ...prev, isOpen: false }))
          });
        } finally {
          setMergingLead(false);
        }
      }
    });
  };

  const handleRequestRebuildSheets = () => {    setSheetsMenuOpen(false);
    setCustomModal({
      isOpen: true,
      title: 'Reconstruir hoja de cálculo',
      message: 'Esto limpia la hoja y vuelve a escribir todos los contactos. Úsalo solo si la hoja está descuadrada. ¿Continuar?',
      confirmText: 'Reconstruir',
      variant: 'warning',
      onConfirm: () => {
        setCustomModal(prev => ({ ...prev, isOpen: false }));
        handleSyncGoogleSheets('rebuild');
      }
    });
  };

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
        setCustomModal({
          isOpen: true,
          title: 'Error al Subir Archivo',
          message: data.error || 'No se pudo subir el archivo seleccionado.',
          confirmText: 'Aceptar',
          variant: 'danger',
          onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setCustomModal({
        isOpen: true,
        title: 'Error de Red',
        message: 'No se pudo subir el archivo: ' + (err.message || 'Error de red'),
        confirmText: 'Aceptar',
        variant: 'danger',
        onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false }))
      });
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

  const renderMessageContent = (text: string, sender: string = 'customer') => {
    if (!text) return null;
    let cleanText = text;
    let mediaUrl = '';
    let isAudio = false;
    let isPhoto = false;
    let transcription = '';

    // 1. Detectar patrón 📎 Imagen adjunta: URL
    const attachmentMatch = text.match(/📎 Imagen adjunta:\s*(\S+)/);
    if (attachmentMatch) {
      mediaUrl = attachmentMatch[1];
      cleanText = text.replace(/📎 Imagen adjunta:\s*\S+/, '').trim();
      isPhoto = true;
    } 
    // 2. Detectar marca [Foto] o URL directa de imagen
    else if (text.startsWith('[Foto]') || text.match(/\.(jpeg|jpg|png|webp)/i) || text.includes('data:image')) {
      isPhoto = true;
      const urlMatch = text.match(/(https?:\/\/[^\s]+|data:image\/[^\s]+|\/uploads\/[^\s]+)/);
      if (urlMatch) {
        mediaUrl = urlMatch[0];
        cleanText = text.replace(/\[Foto\]/g, '').replace(urlMatch[0], '').trim();
      } else {
        cleanText = text.replace(/\[Foto\]/g, '').trim();
      }
    } 
    // 3. Detectar marca [Audio] o URL directa de audio/nota de voz
    else if (text.startsWith('[Audio]') || text.match(/\.(mp3|ogg|m4a|wav)/i) || text.includes('data:audio')) {
      isAudio = true;
      if (text.startsWith('[Audio]')) {
        const rawMedia = text.replace(/^\[Audio\]\s*/, '').trim();
        const urlMatch = rawMedia.match(/(data:audio\/[^\s]+|https?:\/\/[^\s]+|\/uploads\/[^\s]+)/);
        if (urlMatch) {
          mediaUrl = urlMatch[0];
          cleanText = rawMedia.replace(urlMatch[0], '').trim();
        } else if (rawMedia.startsWith('data:audio') || rawMedia.startsWith('http') || rawMedia.startsWith('/')) {
          mediaUrl = rawMedia;
          cleanText = '';
        } else {
          cleanText = rawMedia;
        }
      } else {
        const urlMatch = text.match(/(data:audio\/[^\s]+|https?:\/\/[^\s]+|\/uploads\/[^\s]+)/);
        if (urlMatch) {
          mediaUrl = urlMatch[0];
          cleanText = text.replace(urlMatch[0], '').trim();
        } else {
          cleanText = text;
        }
      }
      const transMatch = text.match(/\[Transcripción de Voz\]:\s*"([^"]+)"/);
      if (transMatch) {
        transcription = transMatch[1];
        cleanText = cleanText.replace(/\[Transcripción de Voz\]:\s*"[^"]+"/, '').trim();
      }
    }

    const isVideo = mediaUrl && mediaUrl.match(/\.(mp4|webm)/i);

    return (
      <div className="space-y-2">
        {/* Renderizar Reproductor de Audio Estilo WhatsApp Web */}
        {isAudio && (
          mediaUrl ? (
            <WhatsAppVoicePlayer
              src={mediaUrl}
              senderName={sender === 'agent' ? 'Tú' : (selectedLead?.name || 'Cliente')}
              isAgent={sender === 'agent'}
              transcription={transcription}
            />
          ) : (
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-medium text-xs flex items-center gap-2">
              <Mic className="w-4 h-4 text-indigo-400" />
              <span>🎵 Nota de voz recibida</span>
            </div>
          )
        )}

        {/* Renderizar Imagen o Video si es Foto */}
        {isPhoto && (
          mediaUrl ? (
            <div className="rounded-xl overflow-hidden max-w-xs border border-slate-800 bg-slate-950/40 p-1 flex justify-center shadow-md">
              {isVideo ? (
                <video 
                  src={mediaUrl} 
                  controls 
                  className="max-h-56 rounded object-contain" 
                />
              ) : (
                <img 
                  src={mediaUrl} 
                  alt="Imagen adjunta" 
                  className="max-h-56 rounded object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-200" 
                  onClick={() => setPreviewImageModal(mediaUrl)}
                />
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center gap-2">
              <span>📷 Comprobante / Imagen adjunta</span>
            </div>
          )
        )}

        {cleanText && <p className="whitespace-pre-wrap break-words leading-relaxed">{cleanText}</p>}
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
      'from-slate-700 to-slate-800 text-slate-200 border border-slate-600/50',
      'from-emerald-900/80 to-slate-800 text-emerald-200 border border-emerald-500/30',
      'from-teal-900/80 to-slate-800 text-teal-200 border border-teal-500/30',
      'from-slate-800 to-slate-900 text-slate-300 border border-slate-700/60',
      'from-cyan-950/80 to-slate-800 text-cyan-200 border border-cyan-500/30'
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
    if (lead.last_message) return lead.last_message;
    const associated = getAssociatedIds(lead);
    const leadMsgs = chatMessages.filter(m => associated.includes(m.lead_id) || (m.lead_id && associated.map(x => x.replace(/\D/g, '')).includes(m.lead_id.replace(/\D/g, ''))));
    if (leadMsgs.length === 0) return 'Sin mensajes aún';
    const last = leadMsgs[leadMsgs.length - 1];
    return last.message;
  };

  const getLeadTime = (lead: any) => {
    const timestamp = lead.last_message_at || lead.updated_at || lead.created_at;
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  const handleDownloadChat = () => {
    if (!selectedLead) return;
    const currentMsgs = chatMessages.filter((msg) => isIdInAssociatedIds(msg.lead_id));
    if (currentMsgs.length === 0) {
      setCustomModal({
        isOpen: true,
        title: 'Conversación Vacía',
        message: 'No hay mensajes en esta conversación para descargar.',
        confirmText: 'Entendido',
        variant: 'info',
        onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // Deduplicar mensajes consecutivos idénticos enviados en el mismo segundo o con el mismo texto
    const deduplicatedMsgs: typeof currentMsgs = [];
    currentMsgs.forEach((msg) => {
      if (deduplicatedMsgs.length === 0) {
        deduplicatedMsgs.push(msg);
      } else {
        const last = deduplicatedMsgs[deduplicatedMsgs.length - 1];
        const sameText = (last.message || '').trim() === (msg.message || '').trim();
        const bothOutbound = last.sender !== 'customer' && msg.sender !== 'customer';
        if (sameText && bothOutbound) {
          // Omitir duplicado generado por sincronización del bot
          return;
        }
        deduplicatedMsgs.push(msg);
      }
    });

    const leadPhone = selectedLead.phone ? `+${selectedLead.phone.replace(/\D/g, '')}` : 'Sin teléfono';
    const exportDate = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' });

    const formattedLines = [
      `================================================================================`,
      `                     NUTRAFLOW CRM - TRANSCRIPCIÓN OFICIAL DE CHAT`,
      `================================================================================`,
      `Cliente:              ${selectedLead.name}`,
      `WhatsApp / Celular:   ${leadPhone}`,
      `Estado Comercial:     ${translateLeadStatus(selectedLead.status)}`,
      `Modo de Atención:     ${selectedLead.bot_active ? '🤖 IA Automática' : '👤 Atención Manual'}`,
      `Fecha de Exportación: ${exportDate}`,
      `Total de Mensajes:    ${deduplicatedMsgs.length}`,
      `================================================================================\n`,
      `------------------- INICIO DE HISTORIAL DE CONVERSACIÓN -------------------\n`
    ];

    deduplicatedMsgs.forEach((msg) => {
      const msgDate = msg.created_at ? new Date(msg.created_at).toLocaleString('es-PE') : 'Ahora';
      const isCustomer = msg.sender === 'customer';
      const senderLabel = isCustomer ? `👤 ${selectedLead.name}` : (msg.sender === 'bot' ? '🤖 Asistente IA' : '💬 Agente (Tú)');
      
      formattedLines.push(`[${msgDate}] ${senderLabel}:`);
      formattedLines.push(`   ${(msg.message || '').split('\n').join('\n   ')}`);
      formattedLines.push(``);
    });

    formattedLines.push(`-------------------- FIN DE HISTORIAL DE CONVERSACIÓN --------------------`);
    formattedLines.push(`================================================================================`);
    formattedLines.push(`              DOCUMENTO GENERADO AUTOMÁTICAMENTE POR NUTRAFLOW CRM`);
    formattedLines.push(`================================================================================`);

    const fullText = formattedLines.join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = selectedLead.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    link.download = `Chat_${safeName}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const pipelineStages = [
    { label: 'Nuevo Contacto · sin atender', value: 'New' },
    { label: 'En Conversación con el cliente', value: 'Engaged' },
    { label: 'Esperando su pago', value: 'Pending Verification' },
    { label: 'Por Registrar en Web', value: 'Por Registrar en Web' },
    { label: 'Venta Cerrada 🎉', value: 'Converted' },
    { label: 'Archivado (fuera del embudo)', value: 'Archived' }
  ];

  const sortedLeadsList = React.useMemo(() => {
    const timeOf = (v: unknown): number => {
      if (!v) return 0;
      const t = new Date(String(v)).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...filteredLeads].sort((a, b) => {
      // Lo más reciente primero (último mensaje/actividad arriba)
      const byActivity = timeOf(b.last_activity) - timeOf(a.last_activity);
      if (byActivity !== 0) return byActivity;
      const byUpdate = timeOf(b.updated_at) - timeOf(a.updated_at);
      if (byUpdate !== 0) return byUpdate;
      const byCreated = timeOf(b.created_at) - timeOf(a.created_at);
      if (byCreated !== 0) return byCreated;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [filteredLeads]);

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] overflow-hidden bg-[#0c0f1d] border-t border-slate-800 -m-8 text-slate-100 relative">
      
      {/* BANNER FLOTANTE DE NUEVO MENSAJE EN TIEMPO REAL (ESQUINA INFERIOR DERECHA) */}
      {activeNotification && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] sm:w-full pointer-events-auto">
          {notifTheme === 'neon-glass' ? (
            /* ESTILO NEÓN GLASS TRANSPARENTE (MARCO DE TUBO NEÓN CIAN & CRISTAL TRANSLÚCIDO) */
            <div className="p-4 rounded-2xl bg-[#050811]/45 border-[1.5px] border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.65),0_0_45px_rgba(6,182,212,0.25),inset_0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-2xl flex items-start gap-3.5 relative overflow-hidden group">
              {/* Brillo ambiental neón */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 via-teal-400/5 to-cyan-500/10 rounded-2xl blur-lg pointer-events-none" />

              {/* Tubo de luz superior resplandeciente */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_10px_#22d3ee]" />

              {/* Avatar Neón con anillo luminoso */}
              <div className="relative shrink-0 mt-0.5 z-10">
                <div className="w-12 h-12 rounded-full bg-cyan-950/40 border-2 border-cyan-400 flex items-center justify-center text-cyan-200 font-bold text-base shadow-[0_0_15px_#22d3ee] backdrop-blur-md">
                  {activeNotification.senderName ? activeNotification.senderName.substring(0, 2).toUpperCase() : 'WA'}
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full border-2 border-black flex items-center justify-center text-[9px] text-black font-extrabold shadow-[0_0_8px_#22d3ee]">
                  ✓
                </span>
              </div>

              {/* Detalles de la notificación */}
              <div className="flex-1 min-w-0 pr-6 z-10">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white tracking-wide truncate flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_8px_#22d3ee]" />
                    {activeNotification.senderName}
                  </h4>
                  <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-400/50 uppercase tracking-wider shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                    Nuevo Mensaje
                  </span>
                </div>
                <p className="text-xs text-slate-100 mt-2 line-clamp-2 leading-relaxed bg-white/[0.04] p-2.5 rounded-xl border border-cyan-400/20 backdrop-blur-md shadow-[inset_0_0_12px_rgba(6,182,212,0.1)]">
                  {activeNotification.message}
                </p>

                {/* Acciones */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const targetLead = leads.find((l: any) => 
                        l.id === activeNotification.leadId || 
                        l.phone === activeNotification.leadId || 
                        (l.whatsapp_lid && l.whatsapp_lid === activeNotification.leadId)
                      );
                      if (targetLead) {
                        handleSelectLead(targetLead);
                      }
                      setActiveNotification(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_18px_rgba(34,211,238,0.7)] active:scale-95 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    Abrir Chat Ahora
                  </button>
                  <button
                    onClick={() => setActiveNotification(null)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/15 font-medium text-xs transition backdrop-blur-sm cursor-pointer"
                  >
                    Ignorar
                  </button>
                </div>
              </div>

              {/* Botones de Cabecera: Toggle de Estilo y Cerrar */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20">
                <button
                  onClick={() => setNotifTheme('classic')}
                  title="Cambiar a estilo clásico"
                  className="text-slate-400 hover:text-cyan-300 p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <Palette size={14} />
                </button>
                <button
                  onClick={() => setActiveNotification(null)}
                  className="text-slate-400 hover:text-cyan-300 p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : (
            /* ESTILO ACTUAL (CLÁSICO ESMERALDA Y OSCURO) */
            <div className="p-4 rounded-2xl bg-[#0b1320]/95 border border-emerald-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(16,185,129,0.25)] backdrop-blur-xl flex items-start gap-3.5 relative overflow-hidden group">
              {/* Barra de estado con pulso */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />

              {/* Avatar / Icono con estado online */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-base shadow-lg ring-2 ring-emerald-500/30">
                  {activeNotification.senderName ? activeNotification.senderName.substring(0, 2).toUpperCase() : 'WA'}
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0b1320] flex items-center justify-center text-[9px] text-slate-950 font-bold">
                  ✓
                </span>
              </div>

              {/* Detalles de la notificación */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    {activeNotification.senderName}
                  </h4>
                  <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                    Nuevo Mensaje
                  </span>
                </div>
                <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                  {activeNotification.message}
                </p>

                {/* Acciones del Banner */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const targetLead = leads.find((l: any) => 
                        l.id === activeNotification.leadId || 
                        l.phone === activeNotification.leadId || 
                        (l.whatsapp_lid && l.whatsapp_lid === activeNotification.leadId)
                      );
                      if (targetLead) {
                        handleSelectLead(targetLead);
                      }
                      setActiveNotification(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    Abrir Chat Ahora
                  </button>
                  <button
                    onClick={() => setActiveNotification(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-medium text-xs transition cursor-pointer"
                  >
                    Ignorar
                  </button>
                </div>
              </div>

              {/* Botones de Cabecera: Toggle de Estilo y Cerrar */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20">
                <button
                  onClick={() => setNotifTheme('neon-glass')}
                  title="Cambiar a estilo Neón Glass"
                  className="text-slate-400 hover:text-emerald-300 p-1 rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <Sparkles size={14} />
                </button>
                <button
                  onClick={() => setActiveNotification(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* COLUMNA 1: BANDEJA DE CHATS (Fondo idéntico al Sidebar: #0c0f1d) */}
      <div className="w-80 shrink-0 border-r border-slate-800 bg-[#0c0f1d] flex flex-col h-full">
        {/* Cabecera Bandeja */}
        <div className="p-3.5 border-b border-slate-800 bg-[#0c0f1d] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#e9edef] tracking-wide">Chats</h3>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSyncGoogleSheets('delta')}
                    disabled={syncingSheets}
                    className="px-2.5 py-1.5 rounded-l-lg bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] text-[#e9edef] font-medium text-[11px] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title={lastSheetsSync ? `Sincronizar cambios desde ${new Date(lastSheetsSync).toLocaleString('es-PE')}` : 'Sincronizar cambios con Google Sheets'}
                  >
                    <span>📊</span>
                    <span>{syncingSheets ? 'Sincronizando...' : 'Google Sheets'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncingSheets}
                    onClick={() => {
                      const next = !sheetsMenuOpen;
                      setSheetsMenuOpen(next);
                      if (next && !lastSheetsSync) loadLastSheetsSync();
                    }}
                    className="px-1.5 py-1.5 rounded-r-lg bg-[#202c33] hover:bg-[#2a3942] border border-l-0 border-[#2a3942] text-[#8696a0] hover:text-[#e9edef] text-[10px] transition-all disabled:opacity-50"
                    title="Opciones de sincronización"
                  >
                    ▾
                  </button>
                </div>
                {sheetsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSheetsMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-40 w-56 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1.5 text-xs text-[#e9edef]">
                      <button
                        onClick={() => { setSheetsMenuOpen(false); handleSyncGoogleSheets('delta'); }}
                        className="w-full text-left px-3 py-2 hover:bg-[#2a3942] transition"
                        title="Solo contactos modificados desde la última sincronización"
                      >
                        ⚡ Sincronizar cambios
                      </button>
                      <button
                        onClick={() => { setSheetsMenuOpen(false); handleSyncGoogleSheets('full'); }}
                        className="w-full text-left px-3 py-2 hover:bg-[#2a3942] transition"
                        title="Enviar todos los contactos (actualiza existentes por ID)"
                      >
                        📋 Sincronización completa
                      </button>
                      <button
                        onClick={handleRequestRebuildSheets}
                        className="w-full text-left px-3 py-2 hover:bg-[#2a3942] text-amber-300 transition"
                        title="Limpia la hoja y la reescribe (requiere script actualizado)"
                      >
                        🧹 Reconstruir hoja
                      </button>
                      {lastSheetsSync && (
                        <div className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-[#2a3942]">
                          Última: {new Date(lastSheetsSync).toLocaleString('es-PE')}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <a
                href="/api/reports/export"
                download
                className="p-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] text-[#8696a0] hover:text-[#e9edef] transition"
                title="Exportar Reporte Excel / CSV"
              >
                <Download size={14} />
              </a>
              <button
                type="button"
                onClick={() => setShowNewLeadModal(true)}
                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                title="Nuevo Cliente"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          
          {/* Buscador de Contactos */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Buscar o empezar un nuevo chat"
              value={leadsSearch}
              onChange={(e) => setLeadsSearch(e.target.value)}
              className="w-full bg-[#111b21] border border-[#222d34] focus:border-emerald-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#e9edef] placeholder-[#8696a0] outline-none transition"
            />
            {leadsSearch && (
              <button
                onClick={() => setLeadsSearch('')}
                className="absolute right-2.5 top-2.5 text-[#8696a0] hover:text-[#e9edef]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtros por Canal (Todos / WhatsApp / Instagram / Facebook) */}
          <div className="flex bg-[#111b21] p-0.5 rounded-lg border border-[#222d34]/60">
            {['Todos', 'WhatsApp', 'Instagram', 'Facebook'].map((channelFilter) => (
              <button
                key={channelFilter}
                onClick={() => setLeadsFilter(channelFilter)}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold text-center transition-all ${
                  leadsFilter === channelFilter
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33]'
                }`}
              >
                {channelFilter}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Leads/Chats */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {sortedLeadsList.map((lead) => {
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
                  isSelected ? 'bg-slate-800/80 border-l-4 border-emerald-500' : 'hover:bg-slate-800/30'
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

      {/* COLUMNA 2: ÁREA DE CONVERSACIÓN (Mismo fondo que el Sidebar: #0c0f1d) */}
      <div className="flex-1 bg-[#0c0f1d] flex flex-col min-w-0 relative border-r border-slate-800 h-full shadow-2xl">
        {selectedLead ? (
          <>
            {/* Cabecera del Chat (Fondo unificado #0c0f1d) */}
            <div className="h-16 shrink-0 border-b border-slate-800 bg-[#0c0f1d] px-4 md:px-5 flex items-center justify-between z-20 shadow-sm relative">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                {selectedLead.avatar_url ? (
                  <img 
                    src={selectedLead.avatar_url} 
                    alt={selectedLead.name} 
                    className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-emerald-500/20 shrink-0" 
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getAvatarBg(selectedLead.name)} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-emerald-500/20 shrink-0`}>
                    {getInitials(selectedLead.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {editingLeadName ? (
                    <div className="flex items-center gap-1.5 mb-1">
                      <input
                        type="text"
                        value={tempLeadName}
                        onChange={(e) => setTempLeadName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveLeadName();
                          if (e.key === 'Escape') setEditingLeadName(false);
                        }}
                        autoFocus
                        placeholder="Nombre del cliente..."
                        className="bg-[#111b21] border border-emerald-500/60 rounded px-2 py-0.5 text-xs text-[#e9edef] outline-none w-48 shadow-inner"
                      />
                      <button
                        onClick={handleSaveLeadName}
                        disabled={savingLeadDetails}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingLeadName(false)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 
                        onClick={handleStartEditName}
                        title={`${selectedLead.name} — haz clic para editar el nombre`}
                        className="text-sm font-semibold text-[#e9edef] leading-tight truncate hover:text-emerald-400 cursor-pointer group flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{selectedLead.name}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 opacity-60">✏️</span>
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Estado interno: ${selectedLead.status || 'New'}`}>
                        {translateLeadStatus(selectedLead.status)}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5 mt-0.5 min-w-0">
                    {editingLeadPhone ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="tel"
                          value={tempLeadPhone}
                          onChange={(e) => setTempLeadPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveLeadPhone();
                            if (e.key === 'Escape') setEditingLeadPhone(false);
                          }}
                          autoFocus
                          placeholder="Ej. 955252932"
                          title="Escribe el número real del contacto (9 dígitos o con 51)"
                          className="bg-[#111b21] border border-emerald-500/60 rounded px-2 py-0.5 text-[11px] font-mono text-[#e9edef] outline-none w-40 shadow-inner"
                        />
                        <button
                          onClick={handleSaveLeadPhone}
                          disabled={savingLeadDetails}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                          title="Guardar número"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingLeadPhone(false)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span
                          onClick={() => handleCopyPhone(formatLeadPhone(selectedLead, leads))}
                          title={`${formatLeadPhone(selectedLead, leads)} — clic para copiar`}
                          className="text-[11px] text-[#8696a0] font-mono font-medium break-all hover:text-emerald-300 cursor-pointer"
                        >
                          {formatLeadPhone(selectedLead, leads)}
                        </span>
                        <button
                          onClick={() => handleCopyPhone(formatLeadPhone(selectedLead, leads))}
                          title="Copiar número"
                          className="text-slate-500 hover:text-emerald-400 transition shrink-0"
                        >
                          {phoneCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={handleStartEditPhone}
                          title="Asignar o corregir el número real del contacto"
                          className="text-slate-500 hover:text-emerald-400 transition shrink-0 text-[10px]"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <span className="text-[11px] text-[#8696a0]">• {selectedLead.bot_active ? '🤖 Bot Activo' : '👤 Manual'}</span>
                  </div>
                </div>
              </div>

              {/* Botones de Cabecera (Escritorio e Ícono Desplegable Opción 2) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Botones Visibles en Pantalla Normal */}
                <div className="hidden lg:flex items-center gap-2">
                  <button
                    onClick={handleDownloadChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition shadow-sm whitespace-nowrap"
                    title="Descargar la conversación completa formateada en un archivo de texto oficial"
                  >
                    <Download size={13} />
                    <span>Descargar Chat</span>
                  </button>
                  <button
                    onClick={() => handleToggleBot(selectedLead)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm whitespace-nowrap ${
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
                    title="Eliminar Lead"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* MENÚ DE ACCIONES [...] OPCIÓN 2 (Para ventanas redimensionadas o acceso compacto) */}
                <div className="relative">
                  <button
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    className="p-2 rounded-full hover:bg-[#374248] text-[#8696a0] hover:text-white transition flex items-center justify-center"
                    title="Más opciones de chat"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showActionMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-30" 
                        onClick={() => setShowActionMenu(false)} 
                      />
                      <div className="absolute right-0 top-10 z-40 w-52 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1.5 text-xs text-[#e9edef] animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            handleDownloadChat();
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition text-emerald-400 font-medium"
                        >
                          <Download size={15} />
                          <span>Descargar Chat (.txt)</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            handleToggleBot(selectedLead);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition font-medium"
                        >
                          <Bot size={15} className={selectedLead.bot_active ? 'text-emerald-400' : 'text-amber-400'} />
                          <span>{selectedLead.bot_active ? 'Pausar Bot (Manual)' : 'Reactivar Bot (IA)'}</span>
                        </button>
                        <div className="my-1 border-t border-[#2a3942]" />
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            handleDeleteChat();
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition text-slate-300 hover:text-rose-400"
                        >
                          <Trash size={15} />
                          <span>Vaciar Historial de Chat</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            handleDeleteLead();
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-[#182229] flex items-center gap-2.5 transition text-rose-400 font-medium"
                        >
                          <Trash2 size={15} />
                          <span>Eliminar Cliente</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ventana de Mensajes con Fondo WhatsApp Doodle Wallpaper (100% Seleccionable para copiar a Bloc de Notas) */}
            <div 
              ref={chatContainerRef} 
              className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0c0f1d] relative select-text cursor-text selection:bg-emerald-500/30 selection:text-emerald-200"
              style={{
                backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px), radial-gradient(#1e293b 1px, #0c0f1d 1px)`,
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 20px 20px'
              }}
            >
              {(chatNotice || copyNotice) && (
                <div className="rounded-lg border border-emerald-500/30 bg-[#182229] px-4 py-2.5 text-xs text-emerald-300 text-center mx-auto max-w-md shadow-md select-none sticky top-2 z-10 animate-bounce">
                  {copyNotice || chatNotice}
                </div>
              )}
              {chatMessages
                .filter((msg) => isIdInAssociatedIds(msg.lead_id))
                .filter((msg, idx, arr) => {
                  if (idx === 0) return true;
                  const prev = arr[idx - 1];
                  const sameText = (prev.message || '').trim() === (msg.message || '').trim();
                  const bothOutbound = prev.sender !== 'customer' && msg.sender !== 'customer';
                  if (sameText && bothOutbound) {
                    const tPrev = new Date(prev.created_at || 0).getTime();
                    const tCur = new Date(msg.created_at || 0).getTime();
                    if (Math.abs(tCur - tPrev) <= 15000) return false;
                  }
                  return true;
                })
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
                      <span className="text-[10px] text-[#8696a0] mb-0.5 px-1 flex items-center gap-1 font-medium select-none">
                        {!isCustomer && (
                          isBot ? <Bot className="h-3 w-3 text-emerald-400" /> : <User className="h-3 w-3 text-indigo-400" />
                        )}
                        {isCustomer ? selectedLead.name : isBot ? 'IA Nutraflow' : 'Agente (Tú)'}
                      </span>
                      
                      {/* Burbuja Estilo WhatsApp Web (#202c33 entrante / #005c4b saliente) */}
                      <div className={`px-3.5 py-2.5 rounded-lg text-xs text-[#e9edef] leading-relaxed shadow-md relative group select-text ${
                        isCustomer 
                          ? 'bg-[#202c33] rounded-tl-none border-l-4 border-slate-600' 
                          : isBot
                            ? 'bg-[#005c4b] rounded-tr-none border-r-4 border-emerald-400'
                            : 'bg-[#005c4b] rounded-tr-none border-r-4 border-indigo-400'
                      }`}>
                        <div className="select-text">{renderMessageContent(msg.message, msg.sender)}</div>
                        
                        {/* Timestamp + Botón de Copiar + Double Check (✓✓) */}
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-[9px] text-[#8696a0]">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.message);
                              setCopyNotice('📋 Mensaje copiado al portapapeles.');
                              setTimeout(() => setCopyNotice(null), 2500);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-emerald-300 transition-opacity flex items-center gap-1 text-[10px] text-slate-400 select-none bg-black/20 px-1.5 py-0.5 rounded"
                            title="Copiar solo este mensaje"
                          >
                            <Copy size={10} /> Copiar
                          </button>
                          <div className="flex items-center gap-1 ml-auto select-none">
                            <span>{msgTime}</span>
                            {!isCustomer && (
                              <span className="text-[#53bdeb] font-bold tracking-tighter text-[10px]">✓✓</span>
                            )}
                          </div>
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

            {/* Pie de Página / Barra de Entrada (Fondo unificado #0c0f1d) */}
            <form onSubmit={localHandleSubmit} className="p-3 border-t border-slate-800 bg-[#0c0f1d] flex flex-col gap-2 z-10">
              <div className="flex items-center justify-between px-2 text-[10px] text-[#8696a0]">
                <span className="tracking-wider uppercase font-semibold">Modo de Respuesta:</span>
                <button
                  type="button"
                  onClick={() => setIsSimulatingCustomer(!isSimulatingCustomer)}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] transition ${
                    isSimulatingCustomer ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800/60 text-[#e9edef] border border-slate-800'
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
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 mb-4">
              <MessageSquare size={32} className="mx-auto" />
            </div>
            <h3 className="font-semibold text-white text-sm">Ningún chat seleccionado</h3>
            <p className="text-[11px] text-slate-500 text-center mt-1 max-w-xs leading-relaxed">
              Selecciona un cliente de la lista de la izquierda para comenzar a chatear, gestionar las alertas de seguimiento y alternar el Bot de IA.
            </p>
          </div>
        )}
      </div>

      {/* COLUMNA 3: DETALLES DE CRM (Fondo unificado #0c0f1d) */}
      {selectedLead && (
        <div className="w-80 shrink-0 bg-[#0c0f1d] border-l border-slate-800 flex flex-col h-full overflow-y-auto">
          {/* Detalles Perfil */}
          <div className="p-6 border-b border-slate-800 flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getAvatarBg(selectedLead.name)} flex items-center justify-center font-bold text-xl text-white shadow-lg mb-3`}>
              {getInitials(selectedLead.name)}
            </div>
            
            {editingLeadName ? (
              <div className="flex items-center gap-1.5 mb-1 w-full justify-center">
                <input
                  type="text"
                  value={tempLeadName}
                  onChange={(e) => setTempLeadName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveLeadName();
                    if (e.key === 'Escape') setEditingLeadName(false);
                  }}
                  autoFocus
                  placeholder="Nombre..."
                  className="bg-slate-950 border border-emerald-500/60 rounded px-2 py-1 text-xs text-white outline-none w-44 text-center"
                />
                <button onClick={handleSaveLeadName} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px]">✓</button>
                <button onClick={() => setEditingLeadName(false)} className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px]">✕</button>
              </div>
            ) : (
              <h4 
                onClick={handleStartEditName}
                title="Clic para editar nombre"
                className="font-semibold text-white text-xs hover:text-emerald-400 cursor-pointer flex items-center gap-1"
              >
                <span>{selectedLead.name}</span>
                <span className="text-[10px] text-slate-500 opacity-60">✏️</span>
              </h4>
            )}

            <p className="text-[11px] text-slate-300 font-mono mt-1 font-medium">
              {formatLeadPhone(selectedLead, leads)}
            </p>

            <div className="mt-3 flex items-center gap-1.5 flex-wrap justify-center">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {selectedLead.channel || 'WhatsApp'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" title={`Estado interno: ${selectedLead.status || 'New'}`}>
                {translateLeadStatus(selectedLead.status)}
              </span>
            </div>
          </div>

          {/* Switch IA */}
          <div className="px-6 py-4 border-b border-slate-900/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IA en esta conversación</span>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Etapa del Pipeline</span>
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
                        : 'bg-[#090b11] border-slate-800 group-hover:border-slate-600'
                    }`} />
                    <span className={`text-[10px] font-semibold transition ${
                      isActive ? 'text-indigo-400 font-bold' : 'text-slate-500 group-hover:text-slate-300'
                    }`}>
                      {stage.label}
                    </span>
                    {isActive && <Check className="h-3 w-3 text-indigo-400 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fusionar duplicado */}
          <div className="p-6 border-b border-slate-900/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Fusionar duplicado</span>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
              Mueve mensajes, notas, alertas y dudas de este contacto a otro lead y elimina el actual. Solo para duplicados confirmados.
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={mergeTargetInput}
                onChange={(e) => setMergeTargetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRequestMergeLead();
                }}
                placeholder="ID o teléfono destino..."
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={handleRequestMergeLead}
                disabled={mergingLead || !mergeTargetInput.trim()}
                className="px-2.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                title="Fusionar este lead dentro del destino"
              >
                {mergingLead ? '...' : 'Fusionar'}
              </button>
            </div>
          </div>

          {/* Notas y Alertas */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#090b11]">
            <div className="flex border-b border-slate-900">
              <button
                onClick={() => setChatTab('notes')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition border-b flex items-center justify-center gap-1.5 ${
                  chatTab === 'notes' ? 'text-indigo-400 border-indigo-500 bg-slate-950/20' : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <StickyNote size={12} />
                Notas ({notes.length})
              </button>
              <button
                onClick={() => setChatTab('reminders')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition border-b flex items-center justify-center gap-1.5 ${
                  chatTab === 'reminders' ? 'text-indigo-400 border-indigo-500 bg-slate-950/20' : 'text-slate-500 border-transparent hover:text-slate-300'
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
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!newNoteContent.trim()}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold transition disabled:opacity-50"
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
                    <div className="flex items-center justify-between text-[8px] font-bold text-slate-500 uppercase">
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
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 placeholder-slate-600 focus:outline-none resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!newReminderMessage.trim()}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold transition disabled:opacity-50"
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
                        <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">{rem.message}</p>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre del Cliente</label>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Teléfono</label>
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
                className="w-full py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              >
                Crear Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lightbox de Vista Previa de Comprobante / Imagen */}
      {previewImageModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageModal(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-2 border-b border-slate-800/80 text-slate-200">
              <span className="text-sm font-semibold flex items-center gap-2">
                📷 Vista Previa del Comprobante
              </span>
              <button 
                onClick={() => setPreviewImageModal(null)}
                className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img 
                src={previewImageModal} 
                alt="Comprobante de pago HD" 
                className="max-h-[75vh] w-auto rounded-2xl object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Estilizado de Alertas y Confirmaciones */}
      <ConfirmModal
        isOpen={customModal.isOpen}
        title={customModal.title}
        message={customModal.message}
        confirmText={customModal.confirmText || 'Aceptar'}
        variant={customModal.variant || 'info'}
        onConfirm={customModal.onConfirm}
        onCancel={() => setCustomModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
