'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, Upload, FileText, Image, Video, HelpCircle, 
  AlertCircle, CheckCircle2, UserCheck, ToggleLeft, ToggleRight,
  RefreshCw, FileCode, Check, Clock, Smile
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

export default function CRMDashboard() {
  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<'leads' | 'gaps' | 'kb'>('leads');
  
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
      setLeads(Array.isArray(leadsData) ? leadsData : []);

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
          setWhatsappStatus(waStatusData.status);
        }
      } catch (waErr) {
        console.error('Error fetching WhatsApp status:', waErr);
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
          setWhatsappStatus(data.status);
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
      return;
    }

    const leadId = selectedLead.id;
    setNewMessageAlert(false);
    fetchMessages(leadId);

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

  // Traducir estados para la visualización del usuario
  const translateStatus = (status: string) => {
    switch (status) {
      case 'New': return 'Nuevo';
      case 'Engaged': return 'Interactuando';
      case 'Pending Verification': return 'Verificación Pendiente';
      case 'Converted': return 'Venta Confirmada';
      default: return status;
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
            {(['leads', 'gaps', 'kb'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'kb' ? 'Biblioteca Multimedia' : tab === 'gaps' ? 'Dudas Pendientes' : 'Clientes'}
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
        <div className="mb-6 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-5 shadow-xl shadow-black/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Panel de WhatsApp</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    whatsappStatus === 'connected' || whatsappStatus === 'open'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      whatsappStatus === 'connected' || whatsappStatus === 'open'
                        ? 'bg-emerald-400'
                        : 'bg-rose-400'
                    }`} />
                    {whatsappStatus === 'connected' || whatsappStatus === 'open' ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">Vincule y gestione la conexión de WhatsApp en un panel dedicado.</p>
              </div>
            </div>
            <Link
              href="/whatsapp"
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition duration-200 ${
                whatsappStatus === 'connected' || whatsappStatus === 'open'
                  ? 'bg-emerald-500 shadow-emerald-500/15 hover:bg-emerald-400'
                  : 'bg-cyan-500 shadow-cyan-500/15 hover:bg-cyan-400'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              {whatsappStatus === 'connected' || whatsappStatus === 'open' ? 'Administrar Conexión' : 'Ir a WhatsApp (Vincular)'}
            </Link>
          </div>
        </div>

        {/* Alerta de sesión caída de WhatsApp */}
        {(whatsappStatus !== 'connected' && whatsappStatus !== 'open') && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm flex gap-3 items-start shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-400">Sesión de WhatsApp Desconectada</span>
              <p className="mt-1">
                La conexión de WhatsApp está inactiva. El bot de IA no podrá responder a los mensajes entrantes de los clientes en tiempo real.
              </p>
              <div className="mt-3">
                <Link
                  href="/whatsapp"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  Ir a Vincular o Reconectar Sesión
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Banner de error de base de datos */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm flex gap-3 items-start shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <span className="font-semibold block text-red-400">Error de Configuración de Base de Datos</span>
              <p className="mt-1">{errorMsg}</p>
              <p className="mt-2 text-xs text-slate-400">
                Por favor, configura las variables de entorno de Supabase (<code className="bg-slate-950 px-1 py-0.5 rounded text-red-300 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="bg-slate-950 px-1 py-0.5 rounded text-red-300 font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) en tu panel de control de Vercel y vuelve a desplegar.
              </p>
            </div>
          </div>
        )}

        {/* PANEL DE CLIENTES */}
        {activeTab === 'leads' && (
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            {/* Buscador y Filtros */}
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

              <div className="flex gap-2 self-start md:self-auto">
                {['Todos', 'Nuevo', 'Interactuando', 'Verificación Pendiente', 'Venta Confirmada'].map((filter) => (
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

            {/* Tabla de Clientes */}
            <div className="flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-[#0c0f1d] flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Nombre del Cliente</th>
                      <th className="px-6 py-4">Teléfono</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Etiquetas</th>
                      <th className="px-6 py-4">Respuestas Automáticas</th>
                      <th className="px-6 py-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                    {filteredLeads.map((lead) => (
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
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lead.status === 'New' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            lead.status === 'Engaged' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            lead.status === 'Pending Verification' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 glow-active' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {lead.status === 'Pending Verification' && <Clock className="h-3 w-3 animate-pulse" />}
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
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                          No se encontraron clientes con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE DUDAS PENDIENTES */}
        {activeTab === 'gaps' && (
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
                    <span className="text-[10px] text-slate-500">{new Date(gap.created_at).toLocaleString()}</span>
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
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                      />
                      <button
                        onClick={() => handleResolveGap(gap.id)}
                        disabled={!gapAnswers[gap.id]?.trim() || resolvingGapId === gap.id}
                        className="mt-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all"
                      >
                        {resolvingGapId === gap.id ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Guardando y Reactivando Bot...
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            Guardar Respuesta y Reactivar Bot
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
        )}

        {/* PANEL DE BIBLIOTECA MULTIMEDIA */}
        {activeTab === 'kb' && (
          <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-0">
            {/* Formulario de Subida */}
            <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
              <form onSubmit={handleFileUpload} className="p-6 bg-[#0c0f1d] border border-slate-800/80 rounded-xl flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-emerald-400" />
                  Indexar Nuevo Recurso
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Título del Recurso</label>
                  <input
                    type="text"
                    placeholder="Ej. Lista de Precios"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo de Archivo</label>
                  <select
                    value={uploadFileType}
                    onChange={(e) => setUploadFileType(e.target.value)}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="txt">Texto Plano (.txt)</option>
                    <option value="pdf">Documento PDF (.pdf)</option>
                    <option value="image">Imagen (.png, .jpg, .jpeg)</option>
                    <option value="mp4">Video (.mp4)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Seleccionar Archivo</label>
                  <div className="border border-dashed border-slate-800 hover:border-slate-700/80 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition relative bg-slate-950/20">
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadFile(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileCode className="h-8 w-8 text-slate-500 mb-2" />
                    <span className="text-[10px] text-slate-400 text-center">
                      {uploadFile ? uploadFile.name : 'Arrastra un archivo o haz clic'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.1)]"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Indexando con Gemini...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Indexar en Biblioteca
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Cuadrícula de Recursos */}
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 xl:grid-cols-2 gap-6 self-start">
              {kbItems.map((item) => (
                <div key={item.id} className="p-6 bg-[#0c0f1d] border border-slate-800/80 rounded-xl flex flex-col gap-4 relative group">
                  <button
                    onClick={() => handleDeleteKB(item.id)}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 opacity-0 group-hover:opacity-100 transition duration-200"
                    title="Eliminar Recurso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex gap-4 items-center">
                    <div className={`p-3 rounded-lg border ${
                      item.file_type === 'pdf' ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                      item.file_type === 'image' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' :
                      item.file_type === 'mp4' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    }`}>
                      {item.file_type === 'pdf' && <FileText className="h-5 w-5" />}
                      {item.file_type === 'image' && <Image className="h-5 w-5" />}
                      {item.file_type === 'mp4' && <Video className="h-5 w-5" />}
                      {item.file_type === 'txt' && <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Formato: {item.file_type.toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-900/60 text-xs flex flex-col gap-1.5">
                    <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Resumen de Gemini:</p>
                    <p className="text-slate-300 leading-relaxed italic">"{item.summary}"</p>
                  </div>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-900 text-xs flex flex-col gap-1.5">
                    <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Datos de RAG Extraídos:</p>
                    <pre className="text-slate-400 leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-36">
                      {item.content}
                    </pre>
                  </div>
                </div>
              ))}

              {kbItems.length === 0 && (
                <div className="col-span-2 text-center py-24 text-slate-500 bg-[#0c0f1d] border border-slate-800/80 rounded-xl italic">
                  No hay recursos subidos aún. Completa el formulario de la izquierda.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PANEL DE SIMULADOR DE WHATSAPP (LATERAL DERECHO) */}
      {selectedLead && (
        <div className="w-96 border-l border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0 absolute right-0 top-0 shadow-2xl z-20 transition-all duration-300 animate-slide-in">
          {/* Cabecera */}
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

          {/* Barra de Modo */}
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between">
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

          {/* Registro de Mensajes */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0c16]">
            {chatNotice && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                {chatNotice}
              </div>
            )}
            {chatMessages
              .filter((msg) => {
                if (!selectedLead) return false;
                // Usar validación unificada por IDs asociados (LID + número real + asociados)
                const isMatch = isIdInAssociatedIds(msg.lead_id);
                console.log(`[UI filter] msg.id: ${msg.id}, msg.lead_id: ${msg.lead_id}, matches: ${isMatch}`);
                return isMatch;
              })
              .map((msg) => {
                console.log('[UI chatMessages.map] msg:', msg, 'selectedLead:', selectedLead);
                return (
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
                          ? 'bg-emerald-600/15 text-emerald-100 rounded-tr-none border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                          : 'bg-cyan-600/15 text-cyan-100 rounded-tr-none border border-cyan-500/20'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            {chatMessages.length === 0 && (
              <div className="text-center py-10 text-slate-600 text-xs italic">
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

          {/* Caja de Entrada de Texto */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2">
            
            {/* Selector de Simulación */}
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
                  title="Insertar emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  placeholder={isSimulatingCustomer ? "Preguntar al bot como Cliente..." : "Responder manualmente como Agente..."}
                  className="chat-message-text flex-1 pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />

                {/* Floating Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-11 left-0 z-30 grid grid-cols-8 gap-1 p-2 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl w-64 animate-fade-in">
                    {['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '🤔', '😎', '💡', '🚀', '👇', '✅', '❌', '😊'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setTypedMessage(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-slate-800 transition-colors"
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
            <p className="text-[9px] text-slate-500 text-center italic">
              {isSimulatingCustomer 
                ? "💡 Simula el mensaje del cliente en WhatsApp para evaluar la respuesta de IA."
                : "✏️ Permite responder manualmente en el chat. Al enviar, desactiva el Modo Manual del cliente."
              }
            </p>
          </form>
        </div>
      )}

      {/* REGISTRO DE NUEVO CLIENTE (MODAL) */}
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
      {/* Notificación flotante de nuevos mensajes */}
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
                  
                  // Limpiar número en formato de puros dígitos con código de país 51 por defecto si tiene 9 dígitos
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
                      console.log('Creando lead de forma automática desde notificación:', cleanLeadId);
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