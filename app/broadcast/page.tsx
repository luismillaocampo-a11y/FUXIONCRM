'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Megaphone, Plus, Users, Send, AlertTriangle, 
  CheckCircle2, RefreshCw, Clock, MessageSquare, ListFilter, Play, Loader2,
  Image, X
} from 'lucide-react';

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [targetsType, setTargetsType] = useState<'all' | 'status' | 'tags'>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // List of all unique tags from database
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Modales de Confirmación y Alerta
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState<string | null>(null);

  // Estados de Imagen y Vista Previa
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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

        // Extraer etiquetas únicas disponibles
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
      console.error('Error fetching data:', err);
      setErrorMsg('Error al recargar el historial de campañas.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchLeadsAndBroadcasts();
    // Refrescar cada 5 segundos para actualizar barras de progreso de envíos activos
    const interval = setInterval(fetchLeadsAndBroadcasts, 5000);
    return () => clearInterval(interval);
  }, [fetchLeadsAndBroadcasts]);

  // Contar cuántos clientes coinciden con el filtro actual
  const getFilteredTargetCount = () => {
    if (targetsType === 'all') return leads.length;
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
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    const targetCount = getFilteredTargetCount();
    if (targetCount === 0) {
      setShowErrorModal('La campaña no tiene destinatarios asignados. Por favor, selecciona al menos un estado o etiqueta que contenga contactos.');
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
      targetValues: targetsType === 'status' ? selectedStatuses : targetsType === 'tags' ? selectedTags : [],
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'sending': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'failed': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'sending': return 'Enviando...';
      case 'failed': return 'Fallido';
      default: return 'Pendiente';
    }
  };

  const translateDbStatus = (status: string) => {
    switch (status) {
      case 'New': return 'Nuevo/Prospecto';
      case 'Engaged': return 'Interactuando';
      case 'Pending Verification': return 'Esperando pago';
      case 'Por Registrar en Web': return 'Por Registrar en Web';
      case 'Converted': return 'Venta Confirmada';
      default: return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#090b12] text-slate-100 p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Broadcast y Mensajería Masiva</h1>
              <p className="text-sm text-slate-400 mt-0.5">Crea campañas de difusión masiva dirigidas a grupos específicos con intervalos de seguridad.</p>
            </div>
          </div>
          <button 
            onClick={fetchLeadsAndBroadcasts}
            disabled={fetching}
            className="p-2 rounded-xl bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Formulario de Campaña - 5/12 */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-3xl shadow-2xl relative">
              <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-850 pb-3 flex items-center gap-2">
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
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Destinatarios</label>
                  <div className="flex gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'status', label: 'Por Estado' },
                      { id: 'tags', label: 'Por Tag' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTargetsType(t.id as any);
                          setSelectedStatuses([]);
                          setSelectedTags([]);
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
                    <div className="p-3.5 bg-slate-900/40 rounded-2xl border border-slate-850 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Selecciona los Estados:</span>
                      {['New', 'Engaged', 'Pending Verification', 'Por Registrar en Web', 'Converted'].map((status) => (
                        <label key={status} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none py-1 hover:text-white transition">
                          <input 
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={() => handleStatusToggle(status)}
                            className="h-4 w-4 rounded border-slate-850 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500"
                          />
                          <span>{translateDbStatus(status)}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {targetsType === 'tags' && (
                    <div className="p-3.5 bg-slate-900/40 rounded-2xl border border-slate-850 space-y-2 max-h-48 overflow-y-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Selecciona los Tags:</span>
                      {availableTags.map((tag) => (
                        <label key={tag} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none py-1 hover:text-white transition">
                          <input 
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => handleTagToggle(tag)}
                            className="h-4 w-4 rounded border-slate-850 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500"
                          />
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">{tag}</span>
                        </label>
                      ))}
                      {availableTags.length === 0 && (
                        <span className="text-xs text-slate-500 italic block py-2">Sin etiquetas registradas en clientes</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Users size={14} className="text-emerald-400" />
                      Destinatarios estimados:
                    </span>
                    <span className="font-bold text-white text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-full">{getFilteredTargetCount()}</span>
                  </div>
                </div>

                {/* Imagen de Campaña */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Imagen de Campaña (Opcional)</label>
                  <div className="flex gap-3 items-center">
                    <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 hover:border-emerald-500/40 bg-slate-900/40 rounded-2xl p-4 cursor-pointer text-center group transition">
                      {uploadingImage ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 text-emerald-450 animate-spin" />
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
                            className="absolute top-0 right-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow-lg"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2">
                          <Image className="h-5 w-5 text-slate-500 group-hover:text-emerald-450 transition mb-1" />
                          <span className="text-[10px] font-semibold text-slate-400">Seleccionar o soltar imagen</span>
                          <span className="text-[8px] text-slate-600 mt-0.5">PNG, JPG, WEBP (Máx. 5MB)</span>
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
                </div>

                {/* Redacción de Mensaje */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mensaje de WhatsApp</label>
                  <textarea 
                    rows={6}
                    required
                    placeholder="Escribe tu mensaje aquí..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40 transition resize-none leading-relaxed"
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

            {/* Vista Previa de WhatsApp */}
            <div className="bg-[#0b141a] border border-[#202c33]/40 p-5 rounded-3xl shadow-xl relative overflow-hidden bg-repeat" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '400px' }}>
              <div className="absolute inset-0 bg-[#0b141a]/92 z-0"></div>
              
              <div className="relative z-10 space-y-3">
                <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block border-b border-[#202c33]/80 pb-2">Vista Previa de WhatsApp</h4>
                
                <div className="flex justify-end">
                  {/* Globo de mensaje saliente estilo WhatsApp */}
                  <div className="max-w-[90%] bg-[#002f27] rounded-2xl rounded-tr-none px-3.5 py-2.5 text-white shadow relative border-t border-[#005c4b]/30">
                    {/* Rabillo de WhatsApp */}
                    <div className="absolute top-0 -right-1 w-2.5 h-2.5 bg-[#002f27]" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }}></div>
                    
                    {imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-[#005c4b]/30 bg-[#002f27]/30 max-h-48 flex items-center justify-center">
                        <img src={imageUrl} alt="Adjunto" className="w-full h-full object-contain max-h-48 rounded" />
                      </div>
                    )}
                    
                    <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-all">
                      {message || <span className="text-slate-500 italic">Escribe un mensaje para previsualizar...</span>}
                    </p>
                    
                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[8px] text-emerald-300">
                      <span>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      <svg viewBox="0 0 16 11" width="13" height="13" className="fill-current text-[#53bdeb]"><path d="M15.01 3.3L8.07 10.24a.25.25 0 01-.35 0L5.3 7.82a.25.25 0 010-.35l.85-.85a.25.25 0 01.35 0L7.9 8l5.9-5.9a.25.25 0 01.35 0l.85.85a.25.25 0 010 .35zM9 3.3L8.07 4.24a.25.25 0 01-.35 0L7.18 3.7a.25.25 0 00-.35 0l-.85.85a.25.25 0 000 .35l1.62 1.62a.25.25 0 00.35 0l1.9-1.9a.25.25 0 000-.35l-.85-.85a.25.25 0 00-.35 0z"></path></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Campañas - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-3xl shadow-2xl relative flex flex-col h-full">
              <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-850 pb-3 flex items-center gap-2">
                <Clock size={16} className="text-emerald-400" />
                Historial de Broadcasts Enviados
              </h3>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[640px]">
                {broadcasts.map((b) => {
                  const total = b.targets?.length || 0;
                  const processed = b.sent_count + b.failed_count;
                  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;
                  
                  return (
                    <div key={b.id} className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-3 relative group">
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(b.status)}`}>
                            {getStatusLabel(b.status)}
                          </span>
                          <h4 className="font-bold text-white text-sm mt-1.5">{b.name}</h4>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(b.created_at).toLocaleString('es-PE')}</span>
                      </div>

                      <p className="text-xs text-slate-350 bg-slate-950/40 p-3 rounded-xl border border-slate-900 leading-relaxed italic whitespace-pre-wrap">
                        "{b.message}"
                      </p>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users size={12} className="text-emerald-400" />
                            Total: <strong className="text-white">{total}</strong>
                          </span>
                          <span className="flex gap-2">
                            <span>Exitosos: <strong className="text-emerald-400">{b.sent_count}</strong></span>
                            <span>Fallidos: <strong className="text-rose-400">{b.failed_count}</strong></span>
                          </span>
                        </div>

                        {/* Barra de progreso */}
                        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
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
                  <div className="text-center py-24 text-slate-500 italic bg-[#0c0f1d]/20 border border-dashed border-slate-800 rounded-2xl">
                    <Megaphone className="h-10 w-10 text-slate-650 mx-auto mb-3" />
                    No has realizado ninguna campaña masiva de difusión aún.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Modal de Confirmación Premium */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f1224] border border-slate-800 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-amber-405">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">¿Confirmar Envío Masivo?</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              Estás a punto de iniciar la campaña de difusión masiva <strong className="text-white">"${name}"</strong> para <strong className="text-emerald-400 font-semibold">${getFilteredTargetCount()} contacto(s)</strong>.
            </p>
            {imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40 p-1.5 flex justify-center">
                <img src={imageUrl} alt="Confirmación" className="max-h-32 object-contain rounded" />
              </div>
            )}
            
            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-relaxed space-y-1">
              <p className="text-amber-400 font-medium">⚠️ Recomendación de Seguridad:</p>
              <p>Los mensajes se enviarán uno por uno con un intervalo aleatorio de <strong>3 a 6 segundos</strong>. Esto imita la conducta humana y protege tu línea de WhatsApp contra penalizaciones de spam.</p>
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
