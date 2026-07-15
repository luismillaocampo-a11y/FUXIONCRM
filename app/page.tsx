'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

const KanbanView = dynamic(() => import('@/components/dashboard/KanbanView'));
import { 
  Plus, MessageSquare, RefreshCw, List, LayoutGrid
} from 'lucide-react';

const DashboardView = dynamic(() => import('@/components/dashboard/DashboardView'));
const LeadsView = dynamic(() => import('@/components/dashboard/LeadsView'));
const GapsView = dynamic(() => import('@/components/dashboard/GapsView'));
const KnowledgeBaseView = dynamic(() => import('@/components/dashboard/KnowledgeBaseView'));

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
  const lastScrolledLeadIdRef = React.useRef<string | null>(null);
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
    if (!container || chatMessages.length === 0) return;

    const currentLeadId = selectedLead?.id || null;
    const isNewConversation = lastScrolledLeadIdRef.current !== currentLeadId;

    if (isNewConversation) {
      lastScrolledLeadIdRef.current = currentLeadId;
      // Scroll inmediato al fondo al cambiar de chat
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
      return;
    }

    // Si hay un nuevo mensaje, scroll suave condicional
    const lastMessage = chatMessages[chatMessages.length - 1];
    const isSentByUs = lastMessage?.sender === 'agent' || lastMessage?.sender === 'bot';
    
    // Tolerancia de 150px del fondo
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 150;

    if (isSentByUs || isAtBottom || forceScrollToBottomRef.current) {
      forceScrollToBottomRef.current = false;
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
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
      setLeads(leadsList);

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

      // Mantener seleccionado el lead con los datos frescos
      if (selectedLeadRef.current && Array.isArray(leadsData)) {
        const freshLead = leadsData.find((l: any) => l.id === selectedLeadRef.current.id);
        if (freshLead) {
          setSelectedLead(freshLead);
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

  const handleDeleteNote = async (id: string) => {
    if (!confirm('¿Seguro de eliminar esta nota?')) return;
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && selectedLead) {
        fetchNotes(selectedLead.id);
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
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

  const handleDeleteReminder = async (id: string) => {
    if (!confirm('¿Seguro de eliminar este recordatorio?')) return;
    try {
      const res = await fetch(`/api/reminders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && selectedLead) {
        fetchReminders(selectedLead.id);
      }
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

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

  // Suscribirse a cambios en tiempo real en la tabla de leads
  useEffect(() => {
    const client = supabaseBrowser;
    if (!client) return;

    const channel = client
      .channel('realtime_leads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload: any) => {
          console.log('👥 Cambio detectado en leads en tiempo real:', payload);
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('🔗 Estado canal leads Realtime:', status);
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Suscribirse a mensajes entrantes globales para alertas
  // Suscribirse a mensajes entrantes globales para alertas y actualizaciones de chat activo
  useEffect(() => {
    const client = supabaseBrowser;
    if (!client) return;

    const channel = client
      .channel('realtime_global_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg) return;

          // Si el chat está abierto para este cliente, procesamos el mensaje directamente
          const isMsgForSelectedLead = selectedLeadRef.current && (() => {
            const associatedIds = getAssociatedIds(selectedLeadRef.current);
            return associatedIds.includes(newMsg.lead_id) || 
                   (newMsg.lead_id && associatedIds.map(id => id.replace(/\D/g, '')).includes(newMsg.lead_id.replace(/\D/g, '')));
          })();

          if (isMsgForSelectedLead) {
            setChatMessages((prev) => {
              if (prev.find((msg) => msg.id === newMsg.id)) {
                return prev;
              }
              return [...prev, newMsg];
            });

            // Si es un mensaje entrante del cliente, lo marcamos como leído en la base de datos
            if (newMsg.sender === 'customer') {
              fetch(`/api/chat/messages?leadId=${encodeURIComponent(newMsg.lead_id)}`, {
                method: 'PUT'
              }).then(() => fetchData()).catch(err => console.error('Error auto-marking messages as read:', err));
            }
            return;
          }

          // Si el chat no está abierto para este cliente, solo procesamos mensajes entrantes del cliente
          if (newMsg.sender !== 'customer') return;

          // Reproducir bip sonoro
          playNotificationSound();

          // Refrescar lista de clientes para actualizar la burbuja en tiempo real
          fetchData();

          // Encontrar nombre del lead para la alerta
          fetch(`/api/leads?_t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(leadsData => {
              const list = Array.isArray(leadsData) ? leadsData : [];
              const senderLead = list.find((l: any) => 
                l.id === newMsg.lead_id || 
                l.phone === newMsg.lead_id || 
                (l.whatsapp_lid && l.whatsapp_lid === newMsg.lead_id)
              );
              const senderName = senderLead ? senderLead.name : `Cliente (+${newMsg.lead_id})`;
              
              // Disparar banner flotante
              setActiveNotification({
                id: `notif-${Date.now()}`,
                senderName,
                message: newMsg.message,
                leadId: senderLead ? senderLead.id : newMsg.lead_id
              });
            })
            .catch(() => {
              setActiveNotification({
                id: `notif-${Date.now()}`,
                senderName: `Cliente (+${newMsg.lead_id})`,
                message: newMsg.message,
                leadId: newMsg.lead_id
              });
            });
        }
      )
      .subscribe((status) => {
        console.log('🔗 Estado canal mensajes global Realtime:', status);
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Cargar mensajes cuando cambia el cliente seleccionado
  useEffect(() => {
    if (!selectedLead) {
      setChatMessages([]);
      setNewMessageAlert(false);
      setNotes([]);
      setReminders([]);
      return;
    }

    const leadId = selectedLead.id;
    setNewMessageAlert(false);
    setChatTab('chat');
    fetchMessages(leadId);
    fetchNotes(leadId);
    fetchReminders(leadId);

    // Iniciamos polling de respaldo por si falla la conexión en tiempo real
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(leadId)}&_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        const messages = Array.isArray(data) ? data : [];
        console.log(`[UI pollInterval] leadId: ${leadId}, messages count: ${messages.length}`, messages);

        if (messages.length > chatCountRef.current) {
          const newMsg = messages[messages.length - 1];
          console.log('✅ Nuevo mensaje detectado vía polling:', newMsg?.message);
          setChatMessages(messages);
          if (newMsg && newMsg.sender !== 'agent') {
            setNewMessageAlert(true);
          }
        } else if (messages.length !== chatCountRef.current) {
          setChatMessages(messages);
        }
      } catch (err) {
        console.error('❌ Error en polling:', err);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedLead]);

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(leadId)}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      console.log(`[UI fetchMessages] leadId: ${leadId}, messages count: ${Array.isArray(data) ? data.length : 0}`, data);
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    }
  };

  // Enviar mensaje (como Agente o Cliente simulado)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !selectedLead) return;

    const messageText = typedMessage.trim();
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
        // Enviar mensaje de agente a WhatsApp
        const agentMsg = { id: `m-temp-agent-${Date.now()}`, sender: 'agent', message: messageText, created_at: new Date().toISOString() };
        setChatMessages(prev => [...prev, agentMsg]);

        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: selectedLead.id,
            message: messageText
          })
        });

        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to send WhatsApp message');
        }

        await fetchMessages(selectedLead.id);
      }
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedLead) return;
    if (!confirm('¿Estás seguro de que deseas eliminar todo el chat de este cliente?')) return;

    try {
      setChatLoading(true);
      console.log('🗑️ Eliminando chat para leadId:', selectedLead.id);
      const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      console.log('📋 Respuesta delete:', data, 'Status:', res.status);
      
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to delete chat (status: ${res.status})`);
      }

      setChatMessages([]);
      setNewMessageAlert(false);
      setChatNotice('✅ Chat eliminado. El historial está vacío.');
      console.log('✅ Chat eliminado exitosamente');
      window.setTimeout(() => setChatNotice(null), 5000);
    } catch (err) {
      console.error('❌ Error al eliminar chat:', err);
      setChatNotice('❌ No se pudo eliminar el chat. Intenta de nuevo.');
      window.setTimeout(() => setChatNotice(null), 5000);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente y todo su historial de chat?')) return;

    try {
      setChatLoading(true);
      console.log('🗑️ Eliminando cliente leadId:', selectedLead.id);
      const res = await fetch(`/api/leads?leadId=${encodeURIComponent(selectedLead.id)}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      console.log('📋 Respuesta delete lead:', data, 'Status:', res.status);
      
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to delete lead (status: ${res.status})`);
      }

      setSelectedLead(null);
      setChatMessages([]);
      setNewMessageAlert(false);
      setChatNotice('✅ Cliente eliminado junto con su historial de chat.');
      console.log('✅ Cliente eliminado exitosamente');
      window.setTimeout(() => setChatNotice(null), 5000);
      fetchData();
    } catch (err) {
      console.error('❌ Error al eliminar cliente:', err);
      setChatNotice('❌ No se pudo eliminar el cliente. Intenta de nuevo.');
      window.setTimeout(() => setChatNotice(null), 5000);
    } finally {
      setChatLoading(false);
    }
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
      alert('Por favor, ingresa un número de teléfono válido.');
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
        alert(data.error || 'Fallo al subir el archivo');
      }
    } catch (err) {
      console.error('Error en subida:', err);
    } finally {
      setUploading(false);
    }
  };

  // Eliminar Recurso
  const handleDeleteKB = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este recurso de la biblioteca?')) return;
    try {
      await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch (err) {
      console.error('Error eliminando KB:', err);
    }
  };

  // Resolver Duda Pendiente
  const handleResolveGap = async (gapId: string) => {
    const answer = gapAnswers[gapId];
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
  const handleDeleteGap = async (gapId: string) => {
    if (!confirm('¿Estás seguro de que deseas descartar esta duda? Se eliminará y se reactivará el bot para este cliente.')) return;
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
        alert(data.error || 'Error al descartar la duda');
      }
    } catch (err) {
      console.error('Error al descartar duda:', err);
    }
  };

  // Traducir estados para la visualización del usuario
  const translateStatus = (status: string) => {
    switch (status) {
      case 'New': 
        return 'Nuevo/Prospecto';
      case 'Engaged': 
        return 'Interactuando/info enviada';
      case 'Pending Verification': 
        return 'Esperando pago';
      case 'Por Registrar en Web': 
        return 'Por Registrar en Web/Por Despachar';
      case 'Converted': 
        return 'Venta Confirmada';
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
    
    // Mapeo inverso de filtros de español a inglés de base de datos
    let dbStatus = leadsFilter;
    if (leadsFilter === 'Nuevo') dbStatus = 'New';
    else if (leadsFilter === 'Interactuando') dbStatus = 'Engaged';
    else if (leadsFilter === 'Verificación Pendiente') dbStatus = 'Pending Verification';
    else if (leadsFilter === 'Venta Confirmada') dbStatus = 'Converted';
    // Por Registrar en Web: se guarda igual en BD

    return matchesSearch && lead.status === dbStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Cabecera Principal */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-[#0c0f1d] shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white tracking-tight">Panel de Control</h2>
          <div className="h-4 w-px bg-slate-800"></div>
          {/* Navegación por Pestañas */}
          <div className="flex gap-1">
            {(['dashboard', 'leads', 'kanban', 'gaps', 'kb'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-slate-850 text-white border border-slate-700'
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
          <Link 
            href="/whatsapp" 
            className={`px-4 py-2 rounded border transition text-sm flex items-center gap-2 ${
              whatsappStatus === 'connected' || whatsappStatus === 'open'
                ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20'
                : 'bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${
              whatsappStatus === 'connected' || whatsappStatus === 'open'
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-rose-500 animate-pulse'
            }`} />
            <MessageSquare size={16} />
            <span>WhatsApp</span>
          </Link>
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
