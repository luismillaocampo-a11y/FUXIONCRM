'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import { 
  Megaphone, Plus, Users, Send, AlertTriangle, 
  CheckCircle2, RefreshCw, Clock, MessageSquare, ListFilter, Play, Loader2,
  Image as ImageIcon, X, Sparkles, Calendar, Video, Trash2, Eye, 
  Check, ArrowRight, Upload, Layers, Tag, Film, Share2
} from 'lucide-react';

type BroadcastTab = 'broadcast' | 'statuses';

const FUXION_CATEGORIES = [
  'Limpieza y Detox',
  'Control de Peso',
  'Regeneración y Antiedad',
  'Sistema Inmunológico',
  'Vigor Mental',
  'Rendimiento Físico',
  'Promociones Especiales',
  'General'
];

const FUXION_PRODUCTS = [
  'Prunex 1', 'Thermo T3', 'Vita Energía Chicha', 'Beauty-In', 
  'Golden Flx', 'Berry Balance', 'Probal', 'Biopro+ Tect', 
  'Biopro+ Fit', 'Youth Elixir', 'NoCarb-T', 'Off', 'On', 
  'Alpha Balance', 'Flora Liv', 'Pack Detox 5 Días', 'Pack 10/14 Días'
];

export default function BroadcastPage() {
  const [activeTab, setActiveTab] = useState<BroadcastTab>('broadcast');

  // Modal de confirmación estilizado
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {}
  });

  // --- BROADCAST CAMPAIGNS STATE ---
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Broadcast Form State
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [targetsType, setTargetsType] = useState<'all' | 'status' | 'tags' | 'custom'>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [customSearch, setCustomSearch] = useState('');
  const [manualNumbers, setManualNumbers] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // --- WHATSAPP STATUSES & LIBRARY STATE ---
  const [statusLibrary, setStatusLibrary] = useState<any[]>([]);
  const [statusSchedules, setStatusSchedules] = useState<any[]>([]);
  const [fetchingStatusData, setFetchingStatusData] = useState(true);
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  
  // Library Form State
  const [libraryTitle, setLibraryTitle] = useState('');
  const [libraryProduct, setLibraryProduct] = useState('');
  const [libraryCategory, setLibraryCategory] = useState(FUXION_CATEGORIES[0]);
  const [libraryTags, setLibraryTags] = useState('');
  const [libraryCaption, setLibraryCaption] = useState('');
  const [libraryMediaUrl, setLibraryMediaUrl] = useState<string | null>(null);
  const [libraryMediaType, setLibraryMediaType] = useState<'image' | 'video'>('image');
  const [uploadingLibraryMedia, setUploadingLibraryMedia] = useState(false);
  const [savingLibraryItem, setSavingLibraryItem] = useState(false);

  // Publishing / Scheduling State
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<any | null>(null);
  const [statusCaption, setStatusCaption] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekdays'>('none');
  const [publishingStatus, setPublishingStatus] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DATA FETCHING ---
  const fetchLeadsAndBroadcasts = useCallback(async () => {
    try {
      const [leadsRes, bcastRes] = await Promise.all([
        fetch('/api/leads?_t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/broadcast?_t=' + Date.now(), { cache: 'no-store' })
      ]);

      if (leadsRes.ok && bcastRes.ok) {
        const leadsData = await leadsRes.json();
        const bcastData = await bcastRes.json();

        const leadsList = Array.isArray(leadsData) ? leadsData : [];
        setLeads(leadsList);
        setBroadcasts(Array.isArray(bcastData) ? bcastData : []);

        const tagsSet = new Set<string>();
        leadsList.forEach((l: any) => {
          let tagsArray: string[] = [];
          try {
            tagsArray = typeof l.tags === 'string' ? JSON.parse(l.tags) : (l.tags || []);
          } catch(e) {
            tagsArray = l.tags || [];
          }
          if (Array.isArray(tagsArray)) {
            tagsArray.forEach(t => {
              if (t && !t.startsWith('flowState:')) {
                tagsSet.add(t);
              }
            });
          }
        });
        setAvailableTags(Array.from(tagsSet));
      }
    } catch (err) {
      console.error('Error fetching broadcast data:', err);
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchStatusData = useCallback(async () => {
    try {
      setFetchingStatusData(true);
      // Ejecutar cron de estados pendientes si los hay
      try {
        await fetch('/api/cron/status?_t=' + Date.now(), { cache: 'no-store' });
      } catch (e) {}

      const [libRes, schedRes, waRes] = await Promise.all([
        fetch('/api/whatsapp/status/library?_t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/whatsapp/status?_t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/whatsapp?statusOnly=true&_t=' + Date.now(), { cache: 'no-store' })
      ]);

      if (libRes.ok && schedRes.ok) {
        const libData = await libRes.json();
        const schedData = await schedRes.json();
        setStatusLibrary(Array.isArray(libData) ? libData : []);
        setStatusSchedules(Array.isArray(schedData) ? schedData : []);
      }

      if (waRes.ok) {
        const waData = await waRes.json();
        setWaStatus(waData.status || 'disconnected');
      }
    } catch (err) {
      console.error('Error fetching status data:', err);
    } finally {
      setFetchingStatusData(false);
    }
  }, []);

  useEffect(() => {
    fetchLeadsAndBroadcasts();
    fetchStatusData();
    const interval = setInterval(() => {
      fetchLeadsAndBroadcasts();
      fetchStatusData();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchLeadsAndBroadcasts, fetchStatusData]);

  // --- BROADCAST HANDLERS ---
  /** Números manuales válidos (cualquier país, con o sin +). Sin forzar 51 salvo móvil PE. */
  const parseManualNumbers = (): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const line of manualNumbers.split(/[\n,;]+/)) {
      const digits = line.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) continue;
      const norm = digits.length === 9 && digits.startsWith('9') ? '51' + digits : digits;
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push('tel:' + norm);
      }
    }
    return out;
  };

  const getFilteredTargetCount = () => {
    if (targetsType === 'all') return leads.length;
    if (targetsType === 'custom') {
      const manual = parseManualNumbers().filter(
        (m) => !leads.some((l: any) => [l.phone, l.real_phone, l.whatsapp_lid, l.id].some(
          (v) => typeof v === 'string' && v.replace(/\D/g, '') === m.slice(4)
        ))
      );
      return selectedLeadIds.length + manual.length;
    }
    if (targetsType === 'status') {
      return leads.filter(l => selectedStatuses.includes(l.status)).length;
    }
    if (targetsType === 'tags') {
      return leads.filter(l => {
        let lTags: string[] = [];
        try {
          lTags = typeof l.tags === 'string' ? JSON.parse(l.tags) : (l.tags || []);
        } catch(e) {
          lTags = l.tags || [];
        }
        return selectedTags.some(t => lTags.includes(t));
      }).length;
    }
    return 0;
  };

  const handleLeadToggle = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local inmediato sin esperar la subida
    const localPreview = URL.createObjectURL(file);
    setImageUrl(localPreview);

    setUploadingImage(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
      } else {
        throw new Error(data.error || 'Error al subir la imagen');
      }
    } catch (err: any) {
      console.error('[BroadcastPage] Error uploading image:', err);
      setErrorMsg(err.message || 'Error al subir la imagen a la campaña.');
      setImageUrl(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    const targetCount = getFilteredTargetCount();
    if (targetCount === 0) {
      setShowErrorModal('La campaña no tiene destinatarios asignados. Elige contactos, estados, etiquetas o escribe números.');
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSendCampaign = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      name: name.trim(),
      message: message.trim(),
      targetsType,
      targetValues: targetsType === 'status' ? selectedStatuses : targetsType === 'tags' ? selectedTags : targetsType === 'custom' ? [...selectedLeadIds, ...parseManualNumbers()] : [],
      mediaUrl: imageUrl || undefined
    };

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Campaña "${name}" creada y en cola de envío para ${data.totalTargets} contactos.`);
        setName('');
        setMessage('');
        setSelectedStatuses([]);
        setSelectedTags([]);
        setImageUrl(null);
        fetchLeadsAndBroadcasts();
      } else {
        throw new Error(data.error || 'Error al iniciar broadcast');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  // --- WHATSAPP STATUSES HANDLERS ---
  const handleStatusMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLibraryMedia(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload/status', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setLibraryMediaUrl(data.url);
        setLibraryMediaType(data.mediaType || 'image');
        if (!libraryTitle) {
          const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setLibraryTitle(defaultName.charAt(0).toUpperCase() + defaultName.slice(1));
        }
      } else {
        throw new Error(data.error || 'Error al subir multimedia');
      }
    } catch (err: any) {
      console.error('[Status Upload] Error:', err);
      setErrorMsg(err.message || 'Error al subir el archivo multimedia del estado.');
    } finally {
      setUploadingLibraryMedia(false);
    }
  };

  const handleSaveToLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libraryTitle.trim() || !libraryMediaUrl) {
      setErrorMsg('Debes ingresar un título y subir un archivo multimedia para guardarlo en la biblioteca.');
      return;
    }

    setSavingLibraryItem(true);
    setErrorMsg(null);

    const parsedTags = libraryTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      title: libraryTitle.trim(),
      product_name: libraryProduct.trim(),
      category: libraryCategory,
      tags: parsedTags,
      media_url: libraryMediaUrl,
      media_type: libraryMediaType,
      caption: libraryCaption.trim()
    };

    try {
      const res = await fetch('/api/whatsapp/status/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Estado "${libraryTitle}" guardado exitosamente en la biblioteca.`);
        setLibraryTitle('');
        setLibraryProduct('');
        setLibraryTags('');
        setLibraryCaption('');
        setLibraryMediaUrl(null);
        fetchStatusData();
      } else {
        throw new Error(data.error || 'Error al guardar en la biblioteca');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar en la biblioteca.');
    } finally {
      setSavingLibraryItem(false);
    }
  };

  const handleDeleteLibraryItem = (id: string, title: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: `¿Eliminar "${title}" de la Biblioteca?`,
      onConfirm: async () => {
        setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/whatsapp/status/library?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
            if (selectedLibraryItem?.id === id) {
              setSelectedLibraryItem(null);
            }
            setSuccessMsg(`Estado eliminado de la biblioteca.`);
            fetchStatusData();
          }
        } catch (err) {
          setErrorMsg('Error al eliminar estado de la biblioteca.');
        }
      }
    });
  };

  const handleSelectLibraryItemForPublish = (item: any) => {
    setSelectedLibraryItem(item);
    setStatusCaption(item.caption || '');
    setSuccessMsg(`Estado "${item.title}" seleccionado para publicar.`);
  };

  const handleExecutePublishStatus = async () => {
    setShowStatusConfirmModal(false);
    if (!selectedLibraryItem?.media_url) {
      setErrorMsg('Por favor selecciona o carga un estado antes de publicar.');
      return;
    }

    setPublishingStatus(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      action: isScheduled ? 'schedule' : 'publish_now',
      library_id: selectedLibraryItem.id || null,
      media_url: selectedLibraryItem.media_url,
      media_type: selectedLibraryItem.media_type || 'image',
      caption: statusCaption.trim(),
      scheduled_at: isScheduled ? new Date(scheduledDateTime).toISOString() : null,
      recurrence_type: isScheduled ? recurrenceType : 'none'
    };

    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(isScheduled 
          ? (recurrenceType === 'daily'
              ? `Estado programado con éxito para publicarse TODOS LOS DÍAS a las ${new Date(scheduledDateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
              : recurrenceType === 'weekdays'
                ? `Estado programado con éxito de LUNES A VIERNES a las ${new Date(scheduledDateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
                : `Estado programado con éxito para ${new Date(scheduledDateTime).toLocaleString('es-PE')}`)
          : '¡Estado publicado exitosamente en WhatsApp!'
        );
        setSelectedLibraryItem(null);
        setStatusCaption('');
        setIsScheduled(false);
        setScheduledDateTime('');
        setRecurrenceType('none');
        fetchStatusData();
      } else {
        throw new Error(data.error || 'Error al procesar la publicación del estado');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con WhatsApp para publicar el estado.');
    } finally {
      setPublishingStatus(false);
    }
  };

  const handleDeleteSchedule = (id: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: '¿Eliminar Registro de Estado?',
      onConfirm: async () => {
        setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/whatsapp/status?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
            setSuccessMsg('Registro de estado eliminado.');
            fetchStatusData();
          }
        } catch (err) {
          setErrorMsg('Error al eliminar el registro de estado.');
        }
      }
    });
  };

  // Helper badges & translations
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': 
      case 'published': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'sending': 
      case 'pending': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'failed': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'published': return 'Publicado';
      case 'sending': return 'Enviando...';
      case 'pending': return 'Programado';
      case 'failed': return 'Fallido';
      default: return status;
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const hasTz = dateStr.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateStr);
    const normalized = hasTz ? dateStr : `${dateStr}Z`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-PE', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const translateDbStatus = (status: string) => {
    switch (status) {
      case 'New': return 'Nuevo · sin atender';
      case 'Engaged': return 'En conversación';
      case 'Pending Verification': return 'Esperando pago';
      case 'Por Registrar en Web': return 'Por registrar en web';
      case 'Converted': return 'Venta cerrada';
      case 'Archived': return 'Archivado';
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#090b12] text-slate-100 p-6 lg:p-8">
      <div className="w-full space-y-6">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              {activeTab === 'broadcast' ? <Megaphone className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {activeTab === 'broadcast' ? 'Broadcast y Mensajería Masiva' : 'Estados e Historias de WhatsApp'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'broadcast' 
                  ? 'Crea campañas de difusión masiva dirigidas a grupos específicos con intervalos de seguridad anti-spam.'
                  : 'Publica y programa estados de WhatsApp, organiza tu biblioteca de productos y visualiza la vista previa en vivo.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs Selector */}
            <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('broadcast')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'broadcast'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Megaphone size={14} />
                Campañas de Difusión
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('statuses')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'statuses'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles size={14} />
                Estados de WhatsApp
              </button>
            </div>

            <button 
              onClick={() => {
                fetchLeadsAndBroadcasts();
                fetchStatusData();
              }}
              disabled={fetching || fetchingStatusData}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              title="Refrescar datos"
            >
              <RefreshCw className={`h-4 w-4 ${fetching || fetchingStatusData ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {successMsg && (
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm flex gap-3 items-center shadow-[0_4px_20px_rgba(16,185,129,0.08)] animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-sm flex gap-3 items-center shadow-[0_4px_20px_rgba(244,63,94,0.08)] animate-fade-in">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CAMPAÑAS DE DIFUSIÓN (DISTRIBUCIÓN EN 3 COLUMNAS ARMÓNICAS)        */}
        {/* ========================================================================= */}
        {activeTab === 'broadcast' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Columna 1: Formulario de Campaña - 5/12 */}
            <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-2xl relative space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Plus size={16} className="text-emerald-400" />
                Nueva Campaña de Difusión
              </h3>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nombre de la Campaña</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej. Promoción de Invierno Thermo T3"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                  />
                </div>

                {/* Filtro de Destinatarios */}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Destinatarios</label>
                    <div className="flex gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'status', label: 'Por Estado' },
                        { id: 'tags', label: 'Por Tag' },
                        { id: 'custom', label: 'Elegir' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTargetsType(t.id as any);
                            setSelectedStatuses([]);
                            setSelectedTags([]);
                            setSelectedLeadIds([]);
                          }}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition ${
                            targetsType === t.id ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                  {/* Renderizado Condicional del filtro */}
                  {targetsType === 'status' && (
                    <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Selecciona los Estados:</span>
                      {['New', 'Engaged', 'Pending Verification', 'Por Registrar en Web', 'Converted', 'Archived'].map((status) => (
                        <label key={status} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none py-0.5 hover:text-white transition">
                          <input 
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={() => handleStatusToggle(status)}
                            className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 accent-emerald-500"
                          />
                          <span>{translateDbStatus(status)}</span>
                        </label>
                      ))}
                    </div>
                  )}

                    {targetsType === 'tags' && (
                      <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-1.5 max-h-40 overflow-y-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Selecciona los Tags:</span>
                        {availableTags.map((tag) => (
                          <label key={tag} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none py-0.5 hover:text-white transition">
                            <input 
                              type="checkbox"
                              checked={selectedTags.includes(tag)}
                              onChange={() => handleTagToggle(tag)}
                              className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 accent-emerald-500"
                            />
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">{tag}</span>
                          </label>
                        ))}
                        {availableTags.length === 0 && (
                          <span className="text-xs text-slate-500 italic block py-1">Sin etiquetas registradas en clientes</span>
                        )}
                      </div>
                    )}

                    {targetsType === 'custom' && (
                      <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Elige contactos:</span>
                          <input
                            type="text"
                            placeholder="Buscar por nombre o número..."
                            value={customSearch}
                            onChange={(e) => setCustomSearch(e.target.value)}
                            className="w-full px-2.5 py-1.5 mb-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
                          />
                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                            {leads
                              .filter((l: any) => {
                                const q = customSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (l.name || '').toLowerCase().includes(q) ||
                                  [l.phone, l.real_phone, l.whatsapp_lid].some((v) => typeof v === 'string' && v.includes(q.replace(/\D/g, '')));
                              })
                              .map((l: any) => {
                                const digits = (l.real_phone || l.phone || '').toString().replace(/\D/g, '');
                                const short = digits && digits.length < 13 ? `+${digits}` : (l.whatsapp_lid ? 'ID temporal' : 'Sin número');
                                return (
                                  <label key={l.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none py-1 px-1.5 rounded-lg hover:bg-slate-800/60 transition">
                                    <input
                                      type="checkbox"
                                      checked={selectedLeadIds.includes(l.id)}
                                      onChange={() => handleLeadToggle(l.id)}
                                      className="h-3.5 w-3.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 accent-emerald-500 shrink-0"
                                    />
                                    <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {(l.name || '?').charAt(0).toUpperCase()}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium text-slate-200">{l.name || 'Sin nombre'}</span>
                                      <span className="block text-[10px] font-mono text-slate-500">{short}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            {leads.length === 0 && (
                              <span className="text-xs text-slate-500 italic block py-1">Sin contactos</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">O escribe números (cualquier país):</span>
                          <textarea
                            rows={2}
                            placeholder={'+51987654321\n+5215500000000\n+14155550132'}
                            value={manualNumbers}
                            onChange={(e) => setManualNumbers(e.target.value)}
                            spellCheck={false}
                            className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 resize-y"
                          />
                          <span className="text-[10px] text-slate-500 block mt-0.5">Uno por línea, con código de país. Los nuevos se guardan como contactos.</span>
                        </div>
                      </div>
                    )}

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                      <Users size={13} className="text-emerald-400" />
                      Destinatarios estimados:
                    </span>
                    <span className="font-bold text-white text-xs bg-emerald-500/15 px-2.5 py-0.5 rounded-full">{getFilteredTargetCount()}</span>
                  </div>
                </div>

                {/* Imagen de Campaña */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Imagen Adjunta (Opcional)</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 hover:border-emerald-500/40 bg-slate-900/40 rounded-2xl p-3 cursor-pointer text-center group transition">
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                        <span className="text-[10px] text-slate-500">Subiendo imagen...</span>
                      </div>
                    ) : imageUrl ? (
                      <div className="relative w-full flex justify-center py-1">
                        <img src={imageUrl} alt="Adjunto" className="max-h-24 rounded-lg object-contain" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setImageUrl(null);
                          }}
                          className="absolute top-0 right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-1.5">
                        <ImageIcon className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition" />
                        <span className="text-xs text-slate-400 font-medium">Seleccionar imagen (PNG, JPG, WEBP)</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Redacción de Mensaje */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mensaje de WhatsApp</label>
                  <textarea 
                    rows={5}
                    required
                    placeholder="Escribe el mensaje de la campaña aquí..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition resize-none leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Soporta emojis y saltos de línea</span>
                    <span>{message.length} caracteres</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || getFilteredTargetCount() === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Campaña Masiva
                    </>
                  )}
                </button>

              </form>
            </div>

            {/* Columna 2: Vista Previa de WhatsApp en Vivo - 3.5/12 */}
            <div className="lg:col-span-3 bg-[#0b141a] border border-[#202c33]/70 p-4 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[580px]">
              <div className="space-y-3">
                {/* Header Mockup de Chat WhatsApp */}
                <div className="flex items-center justify-between border-b border-[#202c33] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">Cliente Prospecto</h4>
                      <span className="text-[9px] text-emerald-400">en línea</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Preview</span>
                </div>

                {/* Fondo y Mensajes */}
                <div className="pt-3 flex flex-col justify-end space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[95%] bg-[#005c4b] rounded-2xl rounded-tr-none p-3 text-white shadow-md relative border border-[#005c4b]/40">
                      <div className="absolute top-0 -right-1 w-2 h-2 bg-[#005c4b]" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }}></div>
                      
                      {imageUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden bg-black/20 max-h-48 flex items-center justify-center">
                          <img src={imageUrl} alt="Adjunto" className="w-full h-full object-contain max-h-48 rounded" />
                        </div>
                      )}
                      
                      <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words">
                        {message || <span className="text-emerald-200/50 italic">Escribe un mensaje para ver cómo lo recibirá el cliente...</span>}
                      </p>
                      
                      <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-emerald-200">
                        <span>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        <svg viewBox="0 0 16 11" width="12" height="12" className="fill-current text-[#53bdeb]"><path d="M15.01 3.3L8.07 10.24a.25.25 0 01-.35 0L5.3 7.82a.25.25 0 010-.35l.85-.85a.25.25 0 01.35 0L7.9 8l5.9-5.9a.25.25 0 01.35 0l.85.85a.25.25 0 010 .35zM9 3.3L8.07 4.24a.25.25 0 01-.35 0L7.18 3.7a.25.25 0 00-.35 0l-.85.85a.25.25 0 000 .35l1.62 1.62a.25.25 0 00.35 0l1.9-1.9a.25.25 0 000-.35l-.85-.85a.25.25 0 00-.35 0z"></path></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Mockup Inferior */}
              <div className="pt-3 border-t border-[#202c33] flex items-center gap-2 text-slate-500 text-xs">
                <div className="flex-1 bg-[#1f2c34] rounded-full py-1.5 px-3 text-[10px] text-slate-400">
                  Escribe un mensaje
                </div>
                <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white">
                  <Send size={11} />
                </div>
              </div>
            </div>

            {/* Columna 3: Historial de Broadcasts - 3.5/12 */}
            <div className="lg:col-span-4 bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-2xl relative flex flex-col h-full min-h-[580px]">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-emerald-400" />
                  Historial de Campañas
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {broadcasts.length} campañas
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[520px]">
                {broadcasts.map((b) => {
                  const total = b.targets?.length || 0;
                  const processed = b.sent_count + b.failed_count;
                  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;
                  
                  return (
                    <div key={b.id} className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2.5 relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(b.status)}`}>
                            {getStatusLabel(b.status)}
                          </span>
                          <h4 className="font-bold text-white text-xs mt-1 truncate max-w-[180px]">{b.name}</h4>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">{new Date(b.created_at).toLocaleDateString('es-PE')}</span>
                      </div>

                      <p className="text-[11px] text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-slate-900 leading-relaxed italic line-clamp-2">
                        "{b.message}"
                      </p>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Total: <strong className="text-white">{total}</strong></span>
                          <span>✓ <strong className="text-emerald-400">{b.sent_count}</strong> | ✕ <strong className="text-rose-400">{b.failed_count}</strong></span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                          <div 
                            className={`h-1 rounded-full transition-all duration-500 ${
                              b.status === 'sending' ? 'bg-amber-400 animate-pulse' :
                              b.status === 'failed' ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {broadcasts.length === 0 && (
                  <div className="text-center py-20 text-slate-500 text-xs italic bg-[#0c0f1d]/20 border border-dashed border-slate-800 rounded-2xl">
                    <Megaphone className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    No has realizado ninguna campaña masiva de difusión aún.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ESTADOS E HISTORIAS DE WHATSAPP (DISTRIBUCIÓN FLUIDA Y AMPLIA)    */}
        {/* ========================================================================= */}
        {activeTab === 'statuses' && (
          <div className="space-y-6">
            
            {/* Fila Superior: Biblioteca (4 cols) + Programador (4 cols) + Vista Previa Grande (4 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* TARJETA 1: Biblioteca de Estados - 4/12 */}
              <div className="lg:col-span-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl shadow-2xl relative space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers size={16} className="text-emerald-400" />
                    Biblioteca de Estados
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
                    {statusLibrary.length} recursos
                  </span>
                </div>

                {/* Formulario de Subida a Biblioteca */}
                <form onSubmit={handleSaveToLibrary} className="space-y-3">
                  
                  {/* Media Dropzone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Subir Foto o Video</label>
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 hover:border-emerald-500/40 bg-slate-900/40 rounded-2xl p-3 cursor-pointer text-center group transition">
                      {uploadingLibraryMedia ? (
                        <div className="flex items-center gap-2 py-3">
                          <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                          <span className="text-[11px] text-slate-400">Subiendo multimedia a CRM...</span>
                        </div>
                      ) : libraryMediaUrl ? (
                        <div className="relative w-full flex flex-col items-center py-1">
                          {libraryMediaType === 'video' ? (
                            <video src={libraryMediaUrl} className="max-h-28 rounded-xl object-contain shadow" controls />
                          ) : (
                            <img src={libraryMediaUrl} alt="Preview" className="max-h-28 rounded-xl object-contain shadow" />
                          )}
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              {libraryMediaType === 'video' ? '🎬 Video' : '🖼️ Imagen'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setLibraryMediaUrl(null);
                              }}
                              className="text-[9px] text-rose-400 hover:underline"
                            >
                              Cambiar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <Upload className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition" />
                          <span className="text-xs text-slate-300 font-medium">Subir Imagen o Video (JPG, PNG, MP4)</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleStatusMediaUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Título</label>
                      <input 
                        type="text"
                        required
                        placeholder="Ej. Promo Prunex"
                        value={libraryTitle}
                        onChange={(e) => setLibraryTitle(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Producto</label>
                      <input 
                        type="text"
                        list="products-list-wide"
                        placeholder="Ej. Prunex 1"
                        value={libraryProduct}
                        onChange={(e) => setLibraryProduct(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                      />
                      <datalist id="products-list-wide">
                        {FUXION_PRODUCTS.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Categoría</label>
                      <select
                        value={libraryCategory}
                        onChange={(e) => setLibraryCategory(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                      >
                        {FUXION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Etiquetas</label>
                      <input 
                        type="text"
                        placeholder="detox, colon"
                        value={libraryTags}
                        onChange={(e) => setLibraryTags(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pie de Estado Sugerido</label>
                    <textarea
                      rows={2}
                      placeholder="Ej. ¡Limpia tu colon en solo 1 noche con Prunex! 🍃"
                      value={libraryCaption}
                      onChange={(e) => setLibraryCaption(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingLibraryItem || !libraryMediaUrl}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-800 text-emerald-400 border border-emerald-500/20 font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50"
                  >
                    {savingLibraryItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={14} />}
                    Guardar en Biblioteca
                  </button>
                </form>

                {/* Galería de Recursos */}
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recursos Guardados</span>
                  <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {statusLibrary.map((item) => {
                      const isSelected = selectedLibraryItem?.id === item.id;
                      return (
                        <div 
                          key={item.id}
                          onClick={() => handleSelectLibraryItemForPublish(item)}
                          className={`group relative rounded-xl overflow-hidden border p-2 cursor-pointer transition flex flex-col justify-between ${
                            isSelected 
                              ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]' 
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 mb-1.5 relative flex items-center justify-center">
                            {item.media_type === 'video' ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                                <Film className="h-5 w-5 text-emerald-400" />
                                <span className="absolute bottom-1 right-1 bg-slate-900/90 text-[7px] px-1 py-0.2 rounded text-slate-300 font-mono">VIDEO</span>
                              </div>
                            ) : (
                              <img src={item.media_url} alt={item.title} className="w-full h-full object-cover" />
                            )}
                            
                            {isSelected && (
                              <div className="absolute top-1 left-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                                <Check size={10} />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLibraryItem(item.id, item.title);
                              }}
                              className="absolute top-1 right-1 p-1 bg-rose-500/80 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow"
                              title="Eliminar"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>

                          <div className="space-y-0.5">
                            <h5 className="font-bold text-[11px] text-white truncate">{item.title}</h5>
                            {item.product_name && (
                              <span className="inline-block text-[8px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded truncate max-w-full">
                                {item.product_name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {statusLibrary.length === 0 && (
                      <div className="col-span-full text-center py-6 text-slate-500 text-xs italic">
                        Sin estados guardados. Sube tu primer archivo arriba.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* TARJETA 2: Publicador y Programador - 4/12 */}
              <div className="lg:col-span-4 bg-slate-950/40 border border-slate-800 p-5 rounded-3xl shadow-2xl relative space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                  <Send size={16} className="text-emerald-400" />
                  Publicar o Programar Estado
                </h3>

                {selectedLibraryItem ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {selectedLibraryItem.media_type === 'video' ? (
                          <Film className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <img src={selectedLibraryItem.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">Estado Seleccionado</span>
                        <h4 className="text-xs font-bold text-white truncate max-w-[150px]">{selectedLibraryItem.title}</h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLibraryItem(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                    💡 Selecciona un estado de la biblioteca a la izquierda para publicar.
                  </div>
                )}

                {/* Caption para el estado */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Texto del Estado (Caption de WhatsApp)
                  </label>
                  <textarea 
                    rows={4}
                    placeholder="Escribe el texto que acompañará a la foto o video..."
                    value={statusCaption}
                    onChange={(e) => setStatusCaption(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition resize-none leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Soporta emojis y saltos de línea</span>
                    <span>{statusCaption.length} caracteres</span>
                  </div>
                </div>

                {/* Toggle Programación y Frecuencia */}
                <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold text-white">¿Programar Publicación?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {isScheduled && (
                    <div className="pt-2 border-t border-slate-800 space-y-2.5 animate-fade-in">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400">Hora / Fecha de Inicio:</label>
                        <input 
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40"
                        />
                      </div>

                      {/* Selector de Recurrencia / Repetición */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Frecuencia de Repetición
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setRecurrenceType('none')}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                              recurrenceType === 'none'
                                ? 'bg-slate-800 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Una sola vez
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecurrenceType('daily')}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                              recurrenceType === 'daily'
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            🔁 Diario
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecurrenceType('weekdays')}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                              recurrenceType === 'weekdays'
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            📅 L a V
                          </button>
                        </div>
                        {recurrenceType === 'daily' && (
                          <p className="text-[9px] text-emerald-400 font-medium pt-0.5">
                            ✨ Se publicará automáticamente todos los días a esta misma hora.
                          </p>
                        )}
                        {recurrenceType === 'weekdays' && (
                          <p className="text-[9px] text-indigo-400 font-medium pt-0.5">
                            💼 Se publicará de Lunes a Viernes a esta misma hora.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Alerta si WhatsApp no está conectado */}
                {waStatus === 'disconnected' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs text-rose-400 animate-fade-in">
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                      <span><strong>WhatsApp Desconectado:</strong> Vincula tu cuenta para publicar estados.</span>
                    </span>
                    <a 
                      href="/whatsapp" 
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg font-bold text-[10px] transition shrink-0 ml-2"
                    >
                      Conectar →
                    </a>
                  </div>
                )}

                {/* Botón de Publicación */}
                <button
                  type="button"
                  disabled={publishingStatus || !selectedLibraryItem?.media_url || (isScheduled && !scheduledDateTime)}
                  onClick={() => setShowStatusConfirmModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  {publishingStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : isScheduled ? (
                    <>
                      <Clock className="h-4 w-4" />
                      {recurrenceType === 'daily' 
                        ? 'Guardar Programación Diaria' 
                        : recurrenceType === 'weekdays' 
                          ? 'Guardar Programación (L a V)' 
                          : 'Guardar Programación de Estado'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Publicar Estado Ahora en WhatsApp
                    </>
                  )}
                </button>
              </div>

              {/* TARJETA 3: Vista Previa Real Grande de Estado de WhatsApp (4/12) */}
              <div className="lg:col-span-4 bg-[#0b141a] border border-[#202c33]/70 p-4 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center">
                <div className="flex items-center justify-between w-full border-b border-[#202c33] pb-2.5 mb-3 px-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Eye size={13} className="text-emerald-400" />
                    Vista Previa en Vivo 9:16
                  </h4>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    WhatsApp Status
                  </span>
                </div>

                {/* Smartphone Frame - Expandido hacia los bordes */}
                <div className="w-full max-w-[340px] aspect-[9/16] bg-black rounded-[2.2rem] border-4 border-[#1f2c34] shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden relative flex flex-col justify-between p-4 select-none">
                  
                  {/* Background Media - Visualización 100% COMPLETA sin recortes */}
                  {selectedLibraryItem?.media_url ? (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
                      {selectedLibraryItem.media_type === 'video' ? (
                        <>
                          <video 
                            src={selectedLibraryItem.media_url} 
                            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 scale-125 pointer-events-none" 
                            autoPlay 
                            loop 
                            muted 
                          />
                          <video 
                            src={selectedLibraryItem.media_url} 
                            className="w-full h-full object-contain relative z-10" 
                            autoPlay 
                            loop 
                            muted 
                          />
                        </>
                      ) : (
                        <>
                          <img 
                            src={selectedLibraryItem.media_url} 
                            alt="" 
                            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 scale-125 pointer-events-none" 
                          />
                          <img 
                            src={selectedLibraryItem.media_url} 
                            alt="Preview" 
                            className="w-full h-full object-contain relative z-10" 
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111b21] p-4 text-center">
                      <ImageIcon className="h-10 w-10 text-slate-700 mb-2" />
                      <span className="text-[11px] text-slate-400 font-medium">Selecciona un estado de la biblioteca</span>
                      <span className="text-[9px] text-slate-600 mt-1">Se visualizará completo sin recortes</span>
                    </div>
                  )}

                  {/* Gradient Overlays para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-15"></div>

                  {/* Top Status Bar & Header */}
                  <div className="relative z-20 space-y-2">
                    {/* Story Progress Bars */}
                    <div className="flex gap-1.5 w-full">
                      <div className="h-1 flex-1 bg-white rounded-full"></div>
                      <div className="h-1 flex-1 bg-white/40 rounded-full"></div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                        NF
                      </div>
                      <div>
                        <h6 className="text-xs font-bold text-white leading-tight">NutraFlow / Mi Estado</h6>
                        <span className="text-[10px] text-white/75">Hoy, hace un momento</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Caption & Reply Simulator */}
                  <div className="relative z-20 space-y-2">
                    {statusCaption ? (
                      <p className="text-xs text-white bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center leading-relaxed break-words max-h-24 overflow-y-auto shadow-lg">
                        {statusCaption}
                      </p>
                    ) : (
                      <span className="text-[10px] text-white/40 italic block text-center">Sin pie de estado</span>
                    )}

                    <div className="w-full py-2 px-3 bg-white/10 backdrop-blur-md rounded-full border border-white/15 text-center text-[10px] text-white/90 flex items-center justify-center gap-1.5 hover:bg-white/15 transition">
                      <ArrowRight size={11} className="rotate-[-90deg]" />
                      <span>Responder</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Fila Inferior: TARJETA 4: Historial de Estados de WhatsApp (Ancho Completo) */}
            <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-2xl relative space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-emerald-400" />
                  Historial de Estados y Programaciones
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {statusSchedules.length} registros
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Multimedia</th>
                      <th className="pb-3">Caption / Texto</th>
                      <th className="pb-3">Tipo / Recurrencia</th>
                      <th className="pb-3">Estado</th>
                      <th className="pb-3">Próxima Salida / Fecha</th>
                      <th className="pb-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {statusSchedules.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/30 transition">
                        <td className="py-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center">
                            {item.media_type === 'video' ? (
                              <Film className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 max-w-sm">
                          <p className="truncate text-slate-300 text-xs" title={item.caption}>
                            {item.caption || <span className="text-slate-600 italic">Sin texto</span>}
                          </p>
                        </td>
                        <td className="py-3">
                          {item.recurrence_type === 'daily' ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 w-fit">
                              🔁 Diario
                            </span>
                          ) : item.recurrence_type === 'weekdays' ? (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1 w-fit">
                              📅 Lunes a Viernes
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                              {item.scheduled_at ? '📅 Una vez' : '⚡ Inmediato'}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          {item.status === 'failed' && (
                            <span className="block text-[9px] text-rose-400 font-medium mt-0.5 truncate max-w-[140px]" title={item.error_message || 'WhatsApp desconectado'}>
                              {item.error_message === 'Timed Out' || (item.error_message && item.error_message.includes('desconectado')) 
                                ? '⚠️ Desconectado' 
                                : (item.error_message || 'Error de conexión')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-[11px] text-slate-300 font-mono">
                          <div>
                            {formatDateTime(item.scheduled_at || item.published_at || item.created_at)}
                          </div>
                          {item.recurrence_type && item.recurrence_type !== 'none' && item.published_at && (
                            <div className="text-[9px] text-emerald-400 font-sans mt-0.5 flex items-center gap-1 font-medium">
                              <span>✓ Publicado:</span>
                              <span className="font-mono text-emerald-300">{formatDateTime(item.published_at)}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(item.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition"
                              title="Eliminar del historial"
                            >
                              <X size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLibraryItem({
                                  id: item.library_id || item.id,
                                  title: 'Estado Reutilizado',
                                  media_url: item.media_url,
                                  media_type: item.media_type,
                                  caption: item.caption
                                });
                                setStatusCaption(item.caption || '');
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-lg border border-slate-800 text-[10px] font-semibold transition"
                            >
                              Reutilizar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {statusSchedules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 italic text-xs">
                          No tienes publicaciones ni programaciones de estados registradas aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Modal de Confirmación de Broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f1224] border border-slate-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">¿Confirmar Envío Masivo?</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Estás a punto de iniciar la campaña de difusión masiva <strong className="text-white">"{name}"</strong> para <strong className="text-emerald-400 font-semibold">{getFilteredTargetCount()} contacto(s)</strong>.
            </p>
            {imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40 p-1.5 flex justify-center">
                <img src={imageUrl} alt="Confirmación" className="max-h-32 object-contain rounded" />
              </div>
            )}
            
            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-relaxed space-y-1">
              <p className="text-amber-400 font-medium">⚠️ Recomendación de Seguridad:</p>
              <p>Los mensajes se enviarán uno por uno con un intervalo aleatorio de <strong>3 a 6 segundos</strong> para proteger tu línea de WhatsApp contra penalizaciones.</p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeSendCampaign}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20"
              >
                Sí, Iniciar Envío
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Publicación de Estado */}
      {showStatusConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f1224] border border-slate-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                <Share2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {isScheduled ? '¿Confirmar Programación de Estado?' : '¿Publicar Estado en WhatsApp Ahora?'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {isScheduled ? (
                recurrenceType === 'daily' ? (
                  <>Se programará la publicación automática del estado <strong className="text-white">"{selectedLibraryItem?.title}"</strong> para repetirse <strong className="text-emerald-400 font-semibold">TODOS LOS DÍAS</strong> a partir de las <strong className="text-emerald-400 font-semibold">{new Date(scheduledDateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</strong>.</>
                ) : recurrenceType === 'weekdays' ? (
                  <>Se programará la publicación automática del estado <strong className="text-white">"{selectedLibraryItem?.title}"</strong> para repetirse <strong className="text-indigo-400 font-semibold">DE LUNES A VIERNES</strong> a las <strong className="text-indigo-400 font-semibold">{new Date(scheduledDateTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</strong>.</>
                ) : (
                  <>Se programará la publicación automática del estado <strong className="text-white">"{selectedLibraryItem?.title}"</strong> para el <strong className="text-emerald-400 font-semibold">{new Date(scheduledDateTime).toLocaleString('es-PE')}</strong>.</>
                )
              ) : (
                <>Se publicará de inmediato el estado <strong className="text-white">"{selectedLibraryItem?.title}"</strong> en tu cuenta activa de WhatsApp para todos tus contactos.</>
              )}
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowStatusConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutePublishStatus}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20"
              >
                {isScheduled ? 'Confirmar Programación' : 'Sí, Publicar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alerta de Error */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f1224] border border-slate-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">Error de Destinatarios</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {showErrorModal}
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowErrorModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Estilizado de Confirmación de Eliminación */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title={deleteConfirmModal.title}
        message={deleteConfirmModal.message}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={deleteConfirmModal.onConfirm}
        onCancel={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
