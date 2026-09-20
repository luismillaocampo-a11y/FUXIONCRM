'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const KanbanView = dynamic(() => import('@/components/dashboard/KanbanView'));
import ConfirmModal from '@/components/ConfirmModal';
import { 
  Plus, MessageSquare, RefreshCw, List, LayoutGrid
} from 'lucide-react';

const DashboardView = dynamic(() => import('@/components/dashboard/DashboardView'));
const LeadsView = dynamic(() => import('@/components/dashboard/LeadsView'));
const GapsView = dynamic(() => import('@/components/dashboard/GapsView'));
const KnowledgeBaseView = dynamic(() => import('@/components/dashboard/KnowledgeBaseView'));
import { getAssociatedIds } from '@/lib/lead-utils';

function CRMDashboard() {
  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'kanban' | 'gaps' | 'kb'>('dashboard');
  
  const searchParams = useSearchParams();
  const tabQuery = searchParams.get('tab');
  
  useEffect(() => {
    if (tabQuery === 'kanban') {
      setActiveTab('kanban');
    } else if (tabQuery === 'leads') {
      setActiveTab('leads');
    } else if (tabQuery === 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [tabQuery]);
  
  // Datos
  const [leads, setLeads] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [kbItems, setKbItems] = useState<any[]>([]);
  
  // Selección y Estados del Chat
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [isSimulatingCustomer, setIsSimulatingCustomer] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);
  const chatCountRef = React.useRef(0);
  const prevLeadIdRef = React.useRef<string | null>(null);
  const prevMessagesCountRef = React.useRef<number>(0);
  const selectedLeadRef = React.useRef<any>(null);
  const forceScrollToBottomRef = React.useRef(false);
  const statusTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Nuevas variables de estado para mejoras profesionales
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [chatTab, setChatTab] = useState<'chat' | 'notes' | 'reminders'>('chat');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminderMessage, setNewReminderMessage] = useState('');
  const [newReminderHours, setNewReminderHours] = useState(24);
  const [leadStats, setLeadStats] = useState<any>({ total: 0, newToday: 0, inNegotiation: 0, converted: 0, conversionRate: 0 });
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);

  // Modal de confirmación customizado
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {}
  });

  const updateWhatsappStatusDebounced = (newStatus: string) => {
    if (newStatus === 'connected' || newStatus === 'open') {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      setWhatsappStatus(newStatus);
    } else {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => {
        setWhatsappStatus(newStatus);
      }, 5000);
    }
  };

  const isIdInAssociatedIds = (id: string) => {
    if (!selectedLead) return false;
    const associatedIds = getAssociatedIds(selectedLead);
    return associatedIds.includes(id) || (id && associatedIds.map(x => x.replace(/\D/g, '')).includes(id.replace(/\D/g, '')));
  };

  // Notificación flotante de nuevos mensajes
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    senderName: string;
    message: string;
    leadId: string;
  } | null>(null);

  // Sincronizar selectedLeadRef
  useEffect(() => {
    selectedLeadRef.current = selectedLead;
  }, [selectedLead]);

  // Sincronizar chatCountRef con el número de mensajes en pantalla
  useEffect(() => {
    chatCountRef.current = chatMessages.length;
  }, [chatMessages]);

  // Scroll automático al fondo del chat estilo WhatsApp
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const currentLeadId = selectedLead?.id || null;
    
    // Si no hay lead seleccionado o no hay mensajes, reiniciar contadores y salir
    if (!currentLeadId || chatMessages.length === 0) {
      if (!currentLeadId) {
        prevLeadIdRef.current = null;
        prevMessagesCountRef.current = 0;
      }
      return;
    }

    const isNewConversation = prevLeadIdRef.current !== currentLeadId;

    if (isNewConversation) {
      // Registrar nueva conversación e inicializar
      prevLeadIdRef.current = currentLeadId;
      prevMessagesCountRef.current = chatMessages.length;
      
      // Scroll instantáneo al fondo con reintentos para evitar desfases de renderizado y saltos de layout
      container.scrollTop = container.scrollHeight;
      const t1 = setTimeout(() => { container.scrollTop = container.scrollHeight; }, 30);
      const t2 = setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
      const t3 = setTimeout(() => { container.scrollTop = container.scrollHeight; }, 300);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    // Si es la misma conversación y se agregó un nuevo mensaje
    const diff = chatMessages.length - prevMessagesCountRef.current;
    if (diff > 0) {
      if (diff <= 2) {
        const lastMessage = chatMessages[chatMessages.length - 1];
        const isSentByUs = lastMessage?.sender === 'agent' || lastMessage?.sender === 'bot';
        
        // Tolerancia de 180px antes de agregar el nuevo mensaje
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 180;

        if (isSentByUs || isAtBottom || forceScrollToBottomRef.current) {
          forceScrollToBottomRef.current = false;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth' // Scroll suave solo para nuevos mensajes
          });
        }
      } else {
        // Carga masiva o actualización de mensajes: scroll inmediato
        container.scrollTop = container.scrollHeight;
        const t = setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
        return () => clearTimeout(t);
      }
    }

    prevMessagesCountRef.current = chatMessages.length;
  }, [chatMessages, selectedLead]);
  
  // Búsqueda y Filtros
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsFilter, setLeadsFilter] = useState('Todos');

  // Estado de Subida de Archivo
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFileType, setUploadFileType] = useState('txt');
  const [uploading, setUploading] = useState(false);
  
  // Estado de Resolución de Dudas
  const [gapAnswers, setGapAnswers] = useState<{ [key: string]: string }>({});
  const [resolvingGapId, setResolvingGapId] = useState<string | null>(null);

  // Modal para Nuevo Cliente
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');

  // Estado de error de conexión/configuración
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado de WhatsApp
  const [whatsappStatus, setWhatsappStatus] = useState<string>('disconnected');

  // Carga de datos inicial
  const fetchData = async () => {
    try {
      setErrorMsg(null);
      
      const leadsRes = await fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' });
      const leadsData = await leadsRes.json();
      if (leadsData && leadsData.error) {
        setErrorMsg(leadsData.error);
        return;
      }
      const leadsList = Array.isArray(leadsData) ? leadsData : [];
      
      // Detectar si entró un nuevo mensaje no leído en modo local para disparar sonido y banner
      setLeads(prev => {
        if (prev.length > 0) {
          for (const fresh of leadsList) {
            const old = prev.find((p: any) => p.id === fresh.id);
            // Si el cliente tiene más mensajes no leídos que antes o su actividad es más reciente
            const hasNewUnread = fresh.unread_count > (old?.unread_count || 0);
            const isDifferentActivity = fresh.last_activity && old?.last_activity && new Date(fresh.last_activity).getTime() > new Date(old.last_activity).getTime();
            
            if (hasNewUnread || (isDifferentActivity && selectedLeadRef.current?.id !== fresh.id)) {
              console.log(`🔔 [CRM Alert] Nuevo mensaje detectado para ${fresh.name}`);
              playNotificationSound();
              
              // Disparar banner flotante Toast
              setActiveNotification({
                id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                senderName: fresh.name || `Cliente (${fresh.phone})`,
                message: fresh.last_message || 'Nuevo mensaje recibido por WhatsApp',
                leadId: fresh.id
              });
              break;
            }
          }
        }
        if (JSON.stringify(prev) === JSON.stringify(leadsList)) return prev;
        return leadsList;
      });

      // Calcular estadísticas de ventas en el cliente
      const total = leadsList.length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newToday = leadsList.filter((l: any) => l.created_at && new Date(l.created_at) >= today).length;
      const inNegotiation = leadsList.filter((l: any) => l.status === 'Pending Verification').length;
      const converted = leadsList.filter((l: any) => l.status === 'Converted').length;
      const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
      setLeadStats({ total, newToday, inNegotiation, converted, conversionRate });

      const gapsRes = await fetch('/api/knowledge/gap');
      const gapsData = await gapsRes.json();
      if (gapsData && gapsData.error) {
        setErrorMsg(gapsData.error);
        return;
      }
      setGaps(Array.isArray(gapsData) ? gapsData : []);

      const kbRes = await fetch('/api/knowledge');
      const kbData = await kbRes.json();
      if (kbData && kbData.error) {
        setErrorMsg(kbData.error);
        return;
      }
      setKbItems(Array.isArray(kbData) ? kbData : []);

      // Obtener estado de WhatsApp
      try {
        const waStatusRes = await fetch('/api/whatsapp?statusOnly=true');
        const waStatusData = await waStatusRes.json();
        if (waStatusData && waStatusData.success) {
          updateWhatsappStatusDebounced(waStatusData.status);
        }
      } catch (waErr) {
        console.error('Error fetching WhatsApp status:', waErr);
      }

      // Obtener estado de IA global
      try {
        const aiStatusRes = await fetch('/api/settings');
        const aiStatusData = await aiStatusRes.json();
        if (aiStatusData && typeof aiStatusData.ai_enabled === 'boolean') {
          setAiEnabled(aiStatusData.ai_enabled);
        }
      } catch (e) {
        console.error('Error fetching AI status:', e);
      }

      // Mantener seleccionado el lead con los datos frescos solo si cambiaron sus datos
      if (selectedLeadRef.current && Array.isArray(leadsData)) {
        const freshLead = leadsData.find((l: any) => l.id === selectedLeadRef.current.id);
        if (freshLead) {
          setSelectedLead((prev: any) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(freshLead)) return prev;
            return freshLead;
          });
        }
      }
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setErrorMsg(err.message || 'Error al conectar con la base de datos.');
    }
  };

  const fetchNotes = async (leadId: string) => {
    try {
      const res = await fetch(`/api/notes?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !selectedLead) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, content: newNoteContent.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewNoteContent('');
        fetchNotes(selectedLead.id);
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const handleDeleteNote = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Nota?',
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success && selectedLead) {
            fetchNotes(selectedLead.id);
          }
        } catch (err) {
          console.error('Error deleting note:', err);
        }
      }
    });
  };

  const fetchReminders = async (leadId: string) => {
    try {
      const res = await fetch(`/api/reminders?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      setReminders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderMessage.trim() || !selectedLead) return;
    const scheduledAt = new Date(Date.now() + newReminderHours * 60 * 60 * 1000).toISOString();
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, message: newReminderMessage.trim(), scheduledAt })
      });
      const data = await res.json();
      if (data.success) {
        setNewReminderMessage('');
        fetchReminders(selectedLead.id);
      }
    } catch (err) {
      console.error('Error adding reminder:', err);
    }
  };

  const handleDeleteReminder = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Recordatorio?',
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success && selectedLead) {
            fetchReminders(selectedLead.id);
          }
        } catch (err) {
          console.error('Error deleting reminder:', err);
        }
      }
    });
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const leadToUpdate = leads.find(l => l.id === leadId);
      if (!leadToUpdate) return;
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadToUpdate,
          status: newStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error('Error updating lead status via drag-drop:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling local cada 3s (modo local SQLite; sin Realtime).
  useEffect(() => {
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Polling del estado de WhatsApp cada 15 segundos
  useEffect(() => {
    const fetchWAStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp?statusOnly=true');
        const data = await res.json();
        if (data && data.success) {
          updateWhatsappStatusDebounced(data.status);
        }
      } catch (err) {
        console.error('Error fetching WhatsApp status in poll:', err);
      }
    };

    fetchWAStatus();
    const interval = setInterval(fetchWAStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Reproducir sonido sintetizado de notificación (dos beeps en frecuencia agradable)
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      
      // bip 1
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      
      // bip 2 rápido
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.error('Failed to play notification audio:', e);
    }
  };

  // Temporizador para ocultar la notificación flotante
  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeNotification]);

  // Suscripciones Realtime eliminadas (modo local): el polling de 3s cubre todo.
  // (Se quitaron los canales realtime_leads_changes y realtime_global_messages.)

  // Cargar mensajes cuando cambia el cliente seleccionado
  const activeChatLeadIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!selectedLead) {
      setChatMessages([]);
      setNewMessageAlert(false);
      setNotes([]);
      setReminders([]);
      activeChatLeadIdRef.current = null;
      return;
    }

    const leadId = selectedLead.id;
    const isNewLead = activeChatLeadIdRef.current !== leadId;
    activeChatLeadIdRef.current = leadId;

    setNewMessageAlert(false);
    setChatTab('chat');
    if (isNewLead) {
      setChatMessages([]); // Limpiar mensajes anteriores solo al cambiar de cliente
    }
    fetchMessages(leadId);
    fetchNotes(leadId);
    fetchReminders(leadId);

    // Iniciamos sincronización ultrarrápida local (1.2s) para recibir mensajes entrantes de WhatsApp al instante
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(leadId)}&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        const messages = Array.isArray(data) ? data : [];

        setChatMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(messages)) return prev;
          if (messages.length > prev.length) {
            const last = messages[messages.length - 1];
            if (last && last.sender !== 'agent') {
              setNewMessageAlert(true);
            }
          }
          return messages;
        });
      } catch (err) {
        console.error('❌ Error en sincronización de mensajes:', err);
      }
    }, 1200);

    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedLead]);

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(leadId)}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      const newMsgs = Array.isArray(data) ? data : [];
      setChatMessages(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newMsgs)) return prev;
        return newMsgs;
      });
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    }
  };

  // Enviar mensaje (como Agente o Cliente simulado)
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : typedMessage;
    if (!textToSend.trim() || !selectedLead) return;

    const messageText = textToSend.trim();
    setTypedMessage('');
    setChatLoading(true);

    try {
      if (isSimulatingCustomer) {
        // Enviar mensaje como cliente al Bot
        const userMsg = { id: `m-temp-usr-${Date.now()}`, sender: 'customer', message: messageText, created_at: new Date().toISOString() };
        setChatMessages(prev => [...prev, userMsg]);

        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: selectedLead.id,
            message: messageText
          })
        });

        fetchData();
        const updatedLeads = await (await fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' })).json();
        const freshLead = updatedLeads.find((l: any) => l.id === selectedLead.id);
        if (freshLead) setSelectedLead(freshLead);

        await fetchMessages(selectedLead.id);
      } else {
        // Enviar mensaje de agente: WhatsApp o Red Social según el canal del lead
        const agentMsg = { id: `m-temp-agent-${Date.now()}`, sender: 'agent', message: messageText, created_at: new Date().toISOString() };
        setChatMessages(prev => [...prev, agentMsg]);

        const leadIdStr = String(selectedLead.id || '');
        const leadChannel = String((selectedLead as any).channel || '').toLowerCase();
        const isSocial = leadChannel === 'instagram' || leadChannel === 'facebook' || leadIdStr.startsWith('ig_') || leadIdStr.startsWith('fb_');
        const endpoint = isSocial ? '/api/social/send' : '/api/whatsapp/send';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: selectedLead.id,
            message: messageText
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          console.warn('[handleSendMessage] Error reportado por servidor:', data?.error);
          setChatNotice(`❌ No se pudo enviar${isSocial ? ' a Instagram/Facebook (verifica el token en Conexión Redes Sociales)' : ''}: ${data?.error || ''}`);
          window.setTimeout(() => setChatNotice(null), 6000);
        }

        await fetchMessages(selectedLead.id);
      }
    } catch (err) {
      console.warn('Error al enviar mensaje:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteChat = () => {
    if (!selectedLead) return;
    setConfirmModal({
      isOpen: true,
      title: `¿Eliminar Chat con ${selectedLead.name || selectedLead.phone}?`,
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setChatLoading(true);
          const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            throw new Error(data?.error || `Failed to delete chat (status: ${res.status})`);
          }
          setChatMessages([]);
          setNewMessageAlert(false);
          setChatNotice('✅ Chat eliminado. El historial está vacío.');
          window.setTimeout(() => setChatNotice(null), 5000);
        } catch (err) {
          console.error('Error al eliminar chat:', err);
          setChatNotice('❌ No se pudo eliminar el chat. Intenta de nuevo.');
          window.setTimeout(() => setChatNotice(null), 5000);
        } finally {
          setChatLoading(false);
        }
      }
    });
  };

  const handleDeleteLead = () => {
    if (!selectedLead) return;
    setConfirmModal({
      isOpen: true,
      title: `¿Eliminar a ${selectedLead.name || selectedLead.phone}?`,
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setChatLoading(true);
          const res = await fetch(`/api/leads?leadId=${encodeURIComponent(selectedLead.id)}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            throw new Error(data?.error || `Failed to delete lead (status: ${res.status})`);
          }
          setSelectedLead(null);
          setChatMessages([]);
          setNewMessageAlert(false);
          setChatNotice('✅ Cliente eliminado junto con su historial de chat.');
          window.setTimeout(() => setChatNotice(null), 5000);
          fetchData();
        } catch (err) {
          console.error('Error al eliminar cliente:', err);
          setChatNotice('❌ No se pudo eliminar el cliente.');
          window.setTimeout(() => setChatNotice(null), 5000);
        } finally {
          setChatLoading(false);
        }
      }
    });
  };

  // Alternar automatización del Bot
  const handleToggleBot = async (lead: any) => {
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          tags: lead.tags,
          bot_active: !lead.bot_active
        })
      });
      fetchData();
      if (selectedLead && selectedLead.id === lead.id) {
        setSelectedLead({ ...selectedLead, bot_active: !lead.bot_active });
      }
    } catch (err) {
      console.error('Error alternando bot:', err);
    }
  };

  // Seleccionar un cliente y marcar mensajes como leídos
  const handleSelectLead = async (lead: any) => {
    setSelectedLead(lead);
    
    // Si tiene mensajes no leídos, limpiamos la burbuja inmediatamente localmente
    if (lead.unread_count > 0) {
      setLeads(prevLeads => prevLeads.map(l => l.id === lead.id ? { ...l, unread_count: 0 } : l));
      try {
        await fetch(`/api/chat/messages?leadId=${encodeURIComponent(lead.id)}`, {
          method: 'PUT'
        });
        fetchData();
      } catch (err) {
        console.error('Error al marcar mensajes como leídos:', err);
      }
    }
  };

  // Registrar Nuevo Cliente
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) return;

    let cleanPhone = newLeadPhone.replace(/\D/g, '');
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }

    if (!cleanPhone) {
      setErrorMsg('Por favor, ingresa un número de teléfono válido.');
      return;
    }

    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cleanPhone,
          name: newLeadName.trim(),
          phone: cleanPhone,
          status: 'New',
          tags: [],
          bot_active: true
        })
      });
      setNewLeadName('');
      setNewLeadPhone('');
      setShowNewLeadModal(false);
      fetchData();
    } catch (err) {
      console.error('Error al registrar cliente:', err);
    }
  };

  // Subir recurso multimedia
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('fileType', uploadFileType);
    formData.append('title', uploadTitle || uploadFile.name);

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setUploadFile(null);
        setUploadTitle('');
        fetchData();
      } else {
        setErrorMsg(data.error || 'Fallo al subir el archivo');
      }
    } catch (err) {
      console.error('Error en subida:', err);
    } finally {
      setUploading(false);
    }
  };

  // Eliminar Recurso de Biblioteca
  const handleDeleteKB = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Recurso de la Biblioteca?',
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
          });
          fetchData();
        } catch (err) {
          console.error('Error eliminando KB:', err);
        }
      }
    });
  };

    // Papelera del RAG: copia para Deshacer (vive hasta recargar la página)
  const [lastWipedKb, setLastWipedKb] = useState<any[] | null>(null);

  const downloadKbBackup = (items: any[]) => {
    try {
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo-rag-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('No se pudo descargar el respaldo:', e);
    }
  };

  // Vaciar base completa (con respaldo + Deshacer)
  const handleWipeAllKB = () => {
    if (kbItems.length === 0) return;
    const snapshot = kbItems.map((it: any) => ({
      id: it.id,
      title: it.title,
      file_type: it.file_type,
      content: it.content,
      summary: it.summary,
      file_path: it.file_path
    }));
    setConfirmModal({
      isOpen: true,
      title: `¿Vaciar toda la base (${snapshot.length} documentos)?`,
      confirmText: 'Vaciar todo',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          downloadKbBackup(snapshot);
          const res = await fetch('/api/knowledge?all=true', { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            setLastWipedKb(snapshot);
            fetchData();
          } else {
            throw new Error(data.error || 'No se pudo vaciar');
          }
        } catch (err: any) {
          setErrorMsg(err?.message || 'Error al vaciar la base.');
        }
      }
    });
  };

  // Deshacer vaciado (restaura filas + archivos intactos)
  const handleUndoWipeKB = async () => {
    if (!lastWipedKb || lastWipedKb.length === 0) return;
    try {
      const res = await fetch('/api/knowledge/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lastWipedKb })
      });
      const data = await res.json();
      if (data.success) {
        setLastWipedKb(null);
        fetchData();
      } else {
        throw new Error(data.error || 'No se pudo restaurar');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al restaurar la base.');
    }
  };

  // Resolver Duda Pendiente
  const handleResolveGap = async (gapId: string) => {    const answer = gapAnswers[gapId];
    if (!answer || !answer.trim()) return;

    setResolvingGapId(gapId);
    try {
      const res = await fetch('/api/knowledge/gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gapId,
          answer
        })
      });
      const data = await res.json();
      if (data.success) {
        setGapAnswers(prev => {
          const updated = { ...prev };
          delete updated[gapId];
          return updated;
        });
        fetchData();
        if (selectedLead) {
          const updatedLeads = await (await fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' })).json();
          const freshLead = updatedLeads.find((l: any) => l.id === selectedLead.id);
          if (freshLead) setSelectedLead(freshLead);
        }
      }
    } catch (err) {
      console.error('Error al resolver duda:', err);
    } finally {
      setResolvingGapId(null);
    }
  };

  // Eliminar/Descartar Duda Pendiente
  const handleDeleteGap = (gapId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Descartar Duda Pendiente?',
      confirmText: 'Descartar',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/knowledge/gap?id=${encodeURIComponent(gapId)}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            fetchData();
            if (selectedLead) {
              const updatedLeads = await (await fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' })).json();
              const freshLead = updatedLeads.find((l: any) => l.id === selectedLead.id);
              if (freshLead) setSelectedLead(freshLead);
            }
          } else {
            setErrorMsg(data.error || 'Error al descartar la duda');
          }
        } catch (err) {
          console.error('Error al descartar duda:', err);
        }
      }
    });
  };

  // Traducir estados para la visualización del usuario
  const translateStatus = (status: string) => {
    switch (status) {
      case 'New': 
        return 'Nuevo · sin atender';
      case 'Engaged': 
        return 'En conversación';
      case 'Pending Verification': 
        return 'Esperando pago';
      case 'Por Registrar en Web': 
        return 'Por registrar en web';
      case 'Converted': 
        return 'Venta cerrada';
      case 'Archived':
        return 'Archivado';
      default: 
        return status;
    }
  };

  // Filtrado de lista de clientes
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(leadsSearch.toLowerCase()) || 
      lead.phone?.includes(leadsSearch);
    
    if (leadsFilter === 'Todos') return matchesSearch;
    if (leadsFilter === 'WhatsApp') {
      return matchesSearch && (!lead.channel || lead.channel === 'whatsapp' || (!lead.id?.startsWith('ig_') && !lead.id?.startsWith('fb_')));
    }
    if (leadsFilter === 'Instagram') {
      return matchesSearch && (lead.channel === 'instagram' || lead.id?.startsWith('ig_') || lead.phone?.startsWith('ig_'));
    }
    if (leadsFilter === 'Facebook') {
      return matchesSearch && (lead.channel === 'facebook' || lead.id?.startsWith('fb_') || lead.phone?.startsWith('fb_'));
    }

    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Cabecera Principal */}
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-800 bg-[#0c0f1d] shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none">
        <div className="flex items-center gap-4 shrink-0">
          <h2 className="text-lg font-semibold text-white tracking-tight shrink-0">Panel de Control</h2>
          <div className="h-4 w-px bg-slate-800 shrink-0"></div>
          {/* Navegación por Pestañas */}
          <div className="flex gap-1 shrink-0">
            {(['dashboard', 'leads', 'kanban', 'gaps', 'kb'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', tab);
                    window.history.pushState({}, '', url.pathname + url.search);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'dashboard' ? 'Dashboard' : tab === 'kb' ? 'Biblioteca RAG' : tab === 'gaps' ? 'Dudas de IA' : tab === 'kanban' ? 'Embudo Kanban' : 'Bandeja de Clientes'}
                {tab === 'gaps' && gaps.filter(g => g.status === 'pending').length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950">
                    {gaps.filter(g => g.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Actualizar Datos"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {activeTab === 'leads' && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
                title="Vista de Lista"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition ${viewMode === 'kanban' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
                title="Tablero Kanban"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
          {activeTab === 'leads' && (
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Cliente
            </button>
          )}
        </div>
      </header>

      {/* Cuerpo de Pestañas */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col min-w-0">
        {activeTab === 'dashboard' && (
          <DashboardView
            leadStats={leadStats}
            leads={leads}
            gaps={gaps}
            kbItems={kbItems}
            whatsappStatus={whatsappStatus}
            aiEnabled={aiEnabled}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'leads' && (
          <LeadsView
            leadStats={leadStats}
            leads={leads}
            filteredLeads={filteredLeads}
            selectedLead={selectedLead}
            setSelectedLead={setSelectedLead}
            whatsappStatus={whatsappStatus}
            aiEnabled={aiEnabled}
            errorMsg={errorMsg}
            leadsSearch={leadsSearch}
            setLeadsSearch={setLeadsSearch}
            leadsFilter={leadsFilter}
            setLeadsFilter={setLeadsFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            showNewLeadModal={showNewLeadModal}
            setShowNewLeadModal={setShowNewLeadModal}
            newLeadName={newLeadName}
            setNewLeadName={setNewLeadName}
            newLeadPhone={newLeadPhone}
            setNewLeadPhone={setNewLeadPhone}
            chatMessages={chatMessages}
            chatLoading={chatLoading}
            chatNotice={chatNotice}
            newMessageAlert={newMessageAlert}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            chatTab={chatTab}
            setChatTab={setChatTab}
            notes={notes}
            newNoteContent={newNoteContent}
            setNewNoteContent={setNewNoteContent}
            reminders={reminders}
            newReminderMessage={newReminderMessage}
            setNewReminderMessage={setNewReminderMessage}
            newReminderHours={newReminderHours}
            setNewReminderHours={setNewReminderHours}
            isSimulatingCustomer={isSimulatingCustomer}
            setIsSimulatingCustomer={setIsSimulatingCustomer}
            typedMessage={typedMessage}
            setTypedMessage={setTypedMessage}
            activeNotification={activeNotification}
            setActiveNotification={setActiveNotification}
            handleSendMessage={handleSendMessage}
            handleDeleteChat={handleDeleteChat}
            handleDeleteLead={handleDeleteLead}
            handleToggleBot={handleToggleBot}
            handleSelectLead={handleSelectLead}
            handleCreateLead={handleCreateLead}
            handleStatusChange={handleStatusChange}
            handleAddNote={handleAddNote}
            handleDeleteNote={handleDeleteNote}
            handleAddReminder={handleAddReminder}
            handleDeleteReminder={handleDeleteReminder}
            fetchData={fetchData}
            forceScrollToBottomRef={forceScrollToBottomRef}
            chatContainerRef={chatContainerRef}
          />
        )}

        {activeTab === 'gaps' && (
          <GapsView
            gaps={gaps}
            gapAnswers={gapAnswers}
            setGapAnswers={setGapAnswers}
            resolvingGapId={resolvingGapId}
            handleResolveGap={handleResolveGap}
            handleDeleteGap={handleDeleteGap}
          />
        )}

        {activeTab === 'kb' && (
          <KnowledgeBaseView
            uploadTitle={uploadTitle}
            setUploadTitle={setUploadTitle}
            uploadFileType={uploadFileType}
            setUploadFileType={setUploadFileType}
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            uploading={uploading}
            kbItems={kbItems}
            handleFileUpload={handleFileUpload}
            handleDeleteKB={handleDeleteKB}
            handleWipeAllKB={handleWipeAllKB}
            wipedCount={lastWipedKb ? lastWipedKb.length : 0}
            handleUndoWipeKB={handleUndoWipeKB}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanView
            leads={leads}
            filteredLeads={filteredLeads}
            selectedLead={selectedLead}
            handleSelectLead={handleSelectLead}
            handleStatusChange={handleStatusChange}
            leadsSearch={leadsSearch}
            setLeadsSearch={setLeadsSearch}
            leadsFilter={leadsFilter}
            setLeadsFilter={setLeadsFilter}
          />
        )}
      </div>

      {/* Modal de Confirmación Estilizado */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Cargando CRM...</div>}>
      <CRMDashboard />
    </React.Suspense>
  );
}
