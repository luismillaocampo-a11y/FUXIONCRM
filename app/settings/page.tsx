'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Key, Mail, Bot, Save, RefreshCw, CheckCircle, AlertTriangle, 
  MessageSquare, ToggleLeft, ToggleRight, Info, ShieldCheck, User, Lock, 
  Palette, Grid, Upload, ChevronRight, BookOpen, Plus, Trash2, Sparkles, 
  Layers, X, Check
} from 'lucide-react';

type SectionType = 'overview' | 'profile' | 'security' | 'appearance' | 'whatsapp' | 'ai' | 'smtp' | 'system' | 'branding';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Branding States
  const [brandingCompanyName, setBrandingCompanyName] = useState('Fuxion Flow');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar si es una imagen
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (.png, .jpg, .svg)');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBrandingLogoUrl(dataUrl);
        setSuccessMsg('¡Logo cargado desde tu equipo! Recuerda presionar Guardar Marca.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // SMTP Test State
  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Guardar configuraciones de forma silenciosa antes de probar
      await handleSubmit(undefined, { silent: true });

      const res = await fetch('/api/settings/test-email', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        setTimeout(() => setSuccessMsg(null), 10000);
      } else {
        setErrorMsg(data.error || 'Error al enviar el correo de prueba');
        setTimeout(() => setErrorMsg(null), 10000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor de prueba');
      setTimeout(() => setErrorMsg(null), 10000);
    } finally {
      setTestingEmail(false);
    }
  };

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/settings/branding');
      const data = await res.json();
      if (data.companyName) setBrandingCompanyName(data.companyName);
      if (data.logoUrl) setBrandingLogoUrl(data.logoUrl);
    } catch (e) {
      console.error('Error fetching branding:', e);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: brandingCompanyName,
          logoUrl: brandingLogoUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('¡Configuración de Marca y Logo actualizada correctamente!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Error saving branding:', e);
    } finally {
      setSavingBranding(false);
    }
  };

  // Appearance Local Settings (to show change updates in real-time)
  const [selectedMode, setSelectedMode] = useState<'light' | 'dark'>('dark');
  const [selectedAccent, setSelectedAccent] = useState<'violet' | 'emerald' | 'cobalt' | 'amber' | 'rose'>('emerald');

  // System settings state
  const [configs, setConfigs] = useState({
    whatsapp_api_url: '',
    whatsapp_api_key: '',
    whatsapp_instance: '',
    whatsapp_business_id: '',
    whatsapp_verify_token: 'fuxion_verify_token',
    gemini_api_key: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    admin_email: '',
    ai_enabled: 'true',
    display_name: 'Andy Cruz',
    user_avatar: '',
    appearance_mode: 'dark',
    appearance_accent: 'emerald'
  });

  // AI Behavior Rules State
  const [aiRules, setAiRules] = useState<Array<{ id: string; title: string; instruction: string; category: string; is_active: boolean }>>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleInstruction, setNewRuleInstruction] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('Tono y Estilo');
  const [selectedRuleCategoryFilter, setSelectedRuleCategoryFilter] = useState('Todas');

  const fetchAIRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/settings/ai-rules');
      const data = await res.json();
      if (data.success && data.rules) {
        setAiRules(data.rules);
      }
    } catch (err) {
      console.error('Error fetching AI rules:', err);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim() || !newRuleInstruction.trim()) return;

    try {
      const res = await fetch('/api/settings/ai-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRuleTitle.trim(),
          instruction: newRuleInstruction.trim(),
          category: newRuleCategory
        })
      });
      const data = await res.json();
      if (data.success && data.rule) {
        setAiRules(prev => [...prev, data.rule]);
        setNewRuleTitle('');
        setNewRuleInstruction('');
        setShowAddRuleModal(false);
        setSuccessMsg('¡Nueva regla de comportamiento guardada correctamente!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error creating rule:', err);
    }
  };

  const handleToggleRuleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setAiRules(prev => prev.map(r => r.id === id ? { ...r, is_active: nextStatus } : r));

    try {
      await fetch('/api/settings/ai-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: nextStatus })
      });
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
  };

  const handleDeleteRuleItem = async (id: string) => {
    setAiRules(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/settings/ai-rules?id=${id}`, { method: 'DELETE' });
      setSuccessMsg('Regla eliminada.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  const fetchConfigs = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/settings/configs');
      const data = await res.json();
      
      let loggedInName = 'Usuario';
      let loggedInEmail = 'admin@sudominio.com';
      let loggedInAvatar = '';
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.success && meData.user) {
          loggedInName = meData.user.name || 'Usuario';
          loggedInEmail = meData.user.email || 'admin@sudominio.com';
          loggedInAvatar = meData.user.avatarUrl || '';
        }
      } catch (meErr) {
        console.error('Error fetching auth me profile details:', meErr);
      }

      if (data.success && data.configs) {
        const loadedConfigs = {
          whatsapp_api_url: data.configs.whatsapp_api_url || '',
          whatsapp_api_key: data.configs.whatsapp_api_key || '',
          whatsapp_instance: data.configs.whatsapp_instance || '',
          whatsapp_business_id: data.configs.whatsapp_business_id || '',
          whatsapp_verify_token: data.configs.whatsapp_verify_token || 'fuxion_verify_token',
          gemini_api_key: data.configs.gemini_api_key || '',
          smtp_host: data.configs.smtp_host || '',
          smtp_port: data.configs.smtp_port || '',
          smtp_user: data.configs.smtp_user || '',
          smtp_pass: data.configs.smtp_pass || '',
          smtp_from: data.configs.smtp_from || '',
          admin_email: loggedInEmail,
          ai_enabled: data.configs.ai_enabled || 'true',
          display_name: loggedInName,
          user_avatar: loggedInAvatar || data.configs.user_avatar || '',
          appearance_mode: data.configs.appearance_mode || 'dark',
          appearance_accent: data.configs.appearance_accent || 'emerald'
        };
        setConfigs(loadedConfigs);
        setSelectedMode(loadedConfigs.appearance_mode as any);
        setSelectedAccent(loadedConfigs.appearance_accent as any);
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
      setErrorMsg('No se pudieron cargar las configuraciones del sistema.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchAIRules();
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.avatarUrl) {
        setConfigs(prev => ({
          ...prev,
          user_avatar: data.avatarUrl
        }));
        setSuccessMsg('Foto de perfil actualizada con éxito.');
        window.setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        throw new Error(data.error || 'Error al subir la imagen');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAppearanceUpdate = (mode: 'light' | 'dark', accent: 'violet' | 'emerald' | 'cobalt' | 'amber' | 'rose') => {
    setSelectedMode(mode);
    setSelectedAccent(accent);
    setConfigs(prev => ({
      ...prev,
      appearance_mode: mode,
      appearance_accent: accent
    }));
  };

  const handleSubmit = async (e?: React.FormEvent, options?: { silent?: boolean }) => {
    if (e) e.preventDefault();
    setLoading(true);
    if (!options?.silent) {
      setSuccessMsg(null);
      setErrorMsg(null);
    }

    try {
      const res = await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: configs })
      });
      const data = await res.json();
      if (data.success) {
        if (!options?.silent) {
          setSuccessMsg('Configuraciones guardadas y aplicadas con éxito.');
          window.setTimeout(() => setSuccessMsg(null), 10000);
        }
        // Apply theme color immediately to browser HTML node
        document.documentElement.className = `h-full bg-[#090b11] theme-${configs.appearance_accent} ${configs.appearance_mode}`;
      } else {
        throw new Error(data.error || 'Error al guardar');
      }
    } catch (err: any) {
      if (!options?.silent) {
        setErrorMsg(err.message || 'Error al conectar con la API.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07090e] text-slate-100">
      
      {/* Top Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#1e2330] bg-[#0c0e17]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/15">
            <Settings className="h-5 w-5 animate-[spin_10s_linear_infinite]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Configuración</h1>
            <p className="text-xs text-slate-400 mt-0.5">Todo en un solo lugar — tu cuenta y tu espacio de trabajo. Elige una sección para administrarla.</p>
          </div>
        </div>
        <button 
          onClick={fetchConfigs}
          disabled={fetching}
          className="p-2.5 rounded-xl bg-[#161922] border border-[#2a3040] text-slate-400 hover:text-slate-200 transition hover:bg-[#1f2431] disabled:opacity-50"
          title="Refrescar configuraciones"
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Internal Sidebar Menu */}
        <div className="w-64 bg-[#0a0c13] border-r border-[#1e2330] p-6 space-y-6 overflow-y-auto">
          
          <div className="space-y-1.5">
            <button
              onClick={() => setActiveSection('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                activeSection === 'overview' 
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131722]'
              }`}
            >
              <Grid size={15} />
              <span>Resumen</span>
            </button>
          </div>

          {/* Account Sub-category */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase block pl-3">Cuenta</span>
            <div className="space-y-1">
              {[
                { id: 'profile', label: 'Tu perfil', icon: User },
                { id: 'security', label: 'Seguridad e ingreso', icon: Lock },
                { id: 'appearance', label: 'Apariencia', icon: Palette }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                      isActive 
                        ? 'bg-[#161a29] text-indigo-400 font-semibold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#131722]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'appearance' && (
                      <span className="text-[10px] text-slate-500 capitalize">{selectedMode}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workspace Sub-category */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase block pl-3">Espacio de trabajo</span>
            <div className="space-y-1">
              {[
                { id: 'branding', label: 'Marca & Identidad del Negocio', icon: Sparkles },
                { id: 'whatsapp', label: 'Conexión de WhatsApp', icon: MessageSquare },
                { id: 'ai', label: 'Ajustes de IA', icon: Bot },
                { id: 'smtp', label: 'Servidor de Correo SMTP', icon: Mail },
                { id: 'system', label: 'Ajustes Generales', icon: Settings }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                      isActive 
                        ? 'bg-[#161a29] text-indigo-400 font-semibold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#131722]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'smtp' && configs.smtp_host && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-500 font-mono">activo</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Panel Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#07090e] relative">

          {fetching ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
              <p className="text-slate-400 text-xs font-medium">Obteniendo configuraciones de la base de datos...</p>
            </div>
          ) : (
            <div className="max-w-4xl w-full">
              
              {/* 1. OVERVIEW VIEW */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* User Header Block */}
                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {configs.user_avatar ? (
                        <img 
                          src={configs.user_avatar} 
                          alt="Avatar" 
                          className="h-12 w-12 rounded-full object-cover border border-[#1e2330]" 
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-extrabold text-base">
                          {configs.display_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h2 className="text-base font-bold text-white">{configs.display_name}</h2>
                        <p className="text-xs text-slate-400">{configs.admin_email || 'admin@sudominio.com'}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 tracking-wider uppercase">Propietario</span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'whatsapp', label: 'API de WhatsApp', icon: MessageSquare, desc: 'Conexión a Meta o Evolution API' },
                      { id: 'ai', label: 'Ajustes de IA', icon: Bot, desc: 'Gestión de Gemini API Key y RAG' },
                      { id: 'smtp', label: 'Servidor SMTP', icon: Mail, desc: 'Servidor de envío de alertas' },
                      { id: 'profile', label: 'Tu Perfil', icon: User, desc: 'Edita tu alias y datos de cuenta' },
                      { id: 'security', label: 'Seguridad e Ingreso', icon: Lock, desc: 'Cambia tu contraseña' },
                      { id: 'appearance', label: 'Apariencia', icon: Palette, desc: 'Tema oscuro / claro y colores' }
                    ].map((card) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          onClick={() => setActiveSection(card.id as any)}
                          className="p-5 bg-[#0f111a] border border-[#1e2330] hover:border-[#2a3040] rounded-xl text-left transition duration-300 hover:bg-[#131622] group"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 rounded-lg text-indigo-400 group-hover:text-indigo-300">
                              <Icon size={16} />
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition transform group-hover:translate-x-0.5" />
                          </div>
                          <span className="text-xs font-bold text-white block mb-0.5">{card.label}</span>
                          <span className="text-[10px] text-slate-400 block">{card.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BRANDING & BUSINESS IDENTITY VIEW */}
              {activeSection === 'branding' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Marca & Identidad del Negocio</h2>
                    <p className="text-xs text-slate-400">Personaliza el logo de tu empresa para que aparezca en la barra lateral del CRM.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    {/* Previsualización en Tiempo Real */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-2">Previsualización de tu Cabecera Lateral</label>
                      <div className="w-64 p-3 bg-[#0c0f1d] border border-slate-800 rounded-xl flex items-center gap-3">
                        {brandingLogoUrl ? (
                          <img 
                            src={brandingLogoUrl} 
                            alt="Logo" 
                            className="w-9 h-9 rounded-xl object-contain bg-slate-900 p-1 border border-slate-800" 
                          />
                        ) : (
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Sparkles className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h1 className="font-bold text-sm text-white truncate">{brandingCompanyName || 'Tu Empresa'}</h1>
                          <p className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase truncate">
                            Desarrollado por L. Milla
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Formulario */}
                    <div className="space-y-4 pt-4 border-t border-[#1e2330]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-300 block">Nombre de tu Empresa / Negocio</label>
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
                            <Lock size={10} /> Fijado por Licencia
                          </span>
                        </div>
                        <input 
                          type="text"
                          value={brandingCompanyName}
                          disabled
                          readOnly
                          className="w-full px-3 py-2.5 bg-[#12141c] border border-[#232838] rounded-lg text-xs text-slate-400 cursor-not-allowed font-semibold shadow-inner"
                        />
                        <span className="text-[10px] text-slate-500 block">El nombre de la empresa queda sellado permanentemente con el serial de la licencia y la placa madre del equipo.</span>
                      </div>

                      {/* Cargar Logo desde la Computadora (1-Clic) */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300 block">Logo de tu Empresa / Negocio</label>
                        
                        <input
                          type="file"
                          ref={logoFileInputRef}
                          onChange={handleLogoFileUpload}
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                          className="hidden"
                        />

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                          >
                            <Upload size={14} />
                            <span>Subir Logo desde mi Computadora</span>
                          </button>
                          
                          {brandingLogoUrl && (
                            <button
                              type="button"
                              onClick={() => setBrandingLogoUrl('')}
                              className="text-xs text-rose-400 hover:text-rose-300 font-medium underline"
                            >
                              Quitar logo actual
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">Formatos recomendados: PNG o JPG con fondo transparente o cuadrado.</span>
                      </div>

                      {/* Opción Avanzada: URL directa */}
                      <div className="pt-2">
                        <details className="text-xs text-slate-500 cursor-pointer">
                          <summary className="hover:text-slate-400 font-medium mb-2">Opción avanzada (Usar enlace URL externo)</summary>
                          <input 
                            type="text"
                            value={brandingLogoUrl}
                            onChange={(e) => setBrandingLogoUrl(e.target.value)}
                            placeholder="https://su-dominio.com/logo.png"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono mt-1"
                          />
                        </details>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={handleSaveBranding}
                        disabled={savingBranding}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition disabled:opacity-50"
                      >
                        <Save size={13} />
                        <span>{savingBranding ? 'Guardando...' : 'Guardar Marca'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PROFILE VIEW */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Tu perfil</h2>
                    <p className="text-xs text-slate-400">Edita cómo apareces ante el equipo de ventas. Tu alias y avatar se muestran en las barras principales.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4 pb-6 border-b border-[#1e2330]">
                      {configs.user_avatar ? (
                        <img 
                          src={configs.user_avatar} 
                          alt="Avatar" 
                          className="h-14 w-14 rounded-full object-cover border border-[#1e2330]" 
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-extrabold text-lg">
                          {configs.display_name.charAt(0)}
                        </div>
                      )}
                      <div className="space-y-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button 
                          type="button"
                          onClick={triggerFileSelect}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs font-semibold text-white hover:bg-[#1f2431] transition cursor-pointer"
                        >
                          <Upload size={13} />
                          <span>Subir foto</span>
                        </button>
                        <p className="text-[10px] text-slate-500">PNG, JPG o WebP. Hasta 2 MB.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Nombre en pantalla</label>
                        <input 
                          type="text"
                          value={configs.display_name}
                          onChange={(e) => handleInputChange('display_name', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Correo electrónico</label>
                        <input 
                          type="email"
                          value={configs.admin_email || 'admin@sudominio.com'}
                          disabled
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-500 focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e2330] grid grid-cols-2 gap-4 text-xs text-slate-400">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Rol</span>
                        <span className="text-white font-medium">Usuario (Administrador)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Registrado el</span>
                        <span className="text-white font-medium">29 de junio de 2026</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Guardar cambios</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 3. SECURITY VIEW */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Seguridad e ingreso</h2>
                    <p className="text-xs text-slate-400">Administra y actualiza las contraseñas de acceso y las sesiones activas en tus dispositivos.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    <span className="text-xs font-bold text-white block mb-4">Contraseña</span>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">Contraseña actual</label>
                          <input 
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">Nueva contraseña</label>
                          <input 
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">Confirmar nueva contraseña</label>
                          <input 
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => alert('Contraseña actualizada con éxito (Simulado).')}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                        >
                          Actualizar contraseña
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#1e2330] space-y-4">
                      <div>
                        <span className="text-xs font-bold text-white block">Sesiones activas</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Dispositivos donde tienes iniciada sesión actualmente.</p>
                      </div>
                      <div className="p-4 bg-[#161922]/50 border border-[#2a3040] rounded-lg flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Esta computadora (Windows / Chrome)</span>
                        </div>
                        <button 
                          onClick={() => {
                            alert('Cerrando sesión de otros dispositivos...');
                            window.location.href = '/login';
                          }}
                          className="px-3 py-1 bg-[#1c202d] border border-[#2c3347] hover:bg-[#252c3f] rounded-lg text-[10px] font-semibold text-white transition"
                        >
                          Cerrar sesión en todos los dispositivos
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 4. APPEARANCE VIEW */}
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Apariencia</h2>
                    <p className="text-xs text-slate-400">Elige el tema visual del CRM y los colores de énfasis aplicados en los botones, menús y barras activas.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    
                    {/* Theme Mode Selector */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-white block">Tema</span>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'light', label: 'Modo Claro', desc: 'Vista clásica clara' },
                          { id: 'dark', label: 'Modo Oscuro', desc: 'Fondo oscuro premium' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleAppearanceUpdate(m.id as any, selectedAccent)}
                            className={`p-4 rounded-xl border text-left transition duration-300 ${
                              selectedMode === m.id 
                                ? 'bg-[#181d2f] border-indigo-500 shadow-md' 
                                : 'bg-[#161922] border-[#2a3040] hover:bg-[#1a1f2b]'
                            }`}
                          >
                            <span className="text-xs font-semibold text-white block">{m.label}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Accent Color Selector */}
                    <div className="space-y-3 pt-6 border-t border-[#1e2330]">
                      <span className="text-xs font-bold text-white block">Color de énfasis</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'violet', label: 'Violeta', color: 'bg-violet-600', text: 'Elegante y creativo.' },
                          { id: 'emerald', label: 'Esmeralda (Fuxion)', color: 'bg-emerald-600', text: 'Color de crecimiento oficial.' },
                          { id: 'cobalt', label: 'Cobalto', color: 'bg-blue-600', text: 'Limpio y profesional.' },
                          { id: 'amber', label: 'Ámbar', color: 'bg-amber-600', text: 'Cálido y dinámico.' },
                          { id: 'rose', label: 'Rosa', color: 'bg-rose-600', text: 'Moderno y llamativo.' }
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleAppearanceUpdate(selectedMode, c.id as any)}
                            className={`p-4 rounded-xl border text-left transition duration-300 relative overflow-hidden ${
                              selectedAccent === c.id 
                                ? 'bg-[#181d2f] border-indigo-500 shadow-md' 
                                : 'bg-[#161922] border-[#2a3040] hover:bg-[#1a1f2b]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`h-3 w-3 rounded-full ${c.color}`} />
                              <span className="text-xs font-bold text-white">{c.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{c.text}</p>
                            {selectedAccent === c.id && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Aplicar Apariencia</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 5. WHATSAPP CONNECTION VIEW */}
              {activeSection === 'whatsapp' && (
                <div className="space-y-6">
                  
                  {/* Outer Grid to display settings and help together */}
                  <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Form block */}
                    <div className="flex-1 space-y-6">
                      <div>
                        <h2 className="text-base font-bold text-white mb-1">Conexión de WhatsApp</h2>
                        <p className="text-xs text-slate-400">Conecta tu cuenta de Meta WhatsApp Business API o Evolution API para automatizaciones avanzadas.</p>
                      </div>

                      <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        
                        {/* URL API */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">URL de API de WhatsApp</label>
                          <input 
                            type="url"
                            placeholder="https://graph.facebook.com"
                            value={configs.whatsapp_api_url}
                            onChange={(e) => handleInputChange('whatsapp_api_url', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Token */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Permanent Access Token (Meta) / API Key (Evolution)</label>
                          <input 
                            type="password"
                            placeholder="EAAGb342r..."
                            value={configs.whatsapp_api_key}
                            onChange={(e) => handleInputChange('whatsapp_api_key', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition font-mono"
                          />
                        </div>

                        {/* Instancia / Phone ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Phone Number ID (Meta) / Instancia (Evolution)</label>
                          <input 
                            type="text"
                            placeholder="100234567890123"
                            value={configs.whatsapp_instance}
                            onChange={(e) => handleInputChange('whatsapp_instance', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Business Account ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">WhatsApp Business Account ID (Opcional - Meta)</label>
                          <input 
                            type="text"
                            placeholder="100234567890456"
                            value={configs.whatsapp_business_id}
                            onChange={(e) => handleInputChange('whatsapp_business_id', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Webhook Token Verify */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Webhook Verify Token</label>
                          <input 
                            type="text"
                            placeholder="fuxion_verify_token"
                            value={configs.whatsapp_verify_token}
                            onChange={(e) => handleInputChange('whatsapp_verify_token', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition font-mono"
                          />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                          <button
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                          >
                            <Save size={13} />
                            <span>Guardar Ajustes de WhatsApp</span>
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Instruction accordion side block */}
                    <div className="w-full lg:w-80 space-y-4">
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-indigo-400" />
                          <span className="text-xs font-bold text-white">Instrucciones de Configuración</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Sigue estos pasos para conectar tu Meta WhatsApp Business API:
                        </p>

                        <div className="space-y-3 text-[10px] text-slate-400">
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">1. Crea una app de Meta</span>
                            Crea una cuenta en developers.facebook.com y crea una aplicación tipo "Negocios" agregando el producto "WhatsApp".
                          </div>
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">2. Obtén tus credenciales</span>
                            Copia tu ID de número de teléfono y pégalo arriba como "Phone Number ID". Genera un Token de Acceso Permanente.
                          </div>
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">3. Configura el Webhook</span>
                            En Meta, ingresa la URL de tu CRM seguida de <code className="bg-slate-900 px-1 py-0.2 rounded text-indigo-300 font-mono">/api/webhook/whatsapp</code> y usa el Verify Token de arriba.
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 6. AI SETTINGS VIEW */}
              {activeSection === 'ai' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Ajustes de IA</h2>
                    <p className="text-xs text-slate-400">Configura la clave principal de Gemini y los parámetros globales de automatización.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300 block">Google Gemini API Key</label>
                      <input 
                        type="password"
                        placeholder="••••••••••••••••••••••••••••"
                        value={configs.gemini_api_key}
                        onChange={(e) => handleInputChange('gemini_api_key', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                      <span className="text-[10px] text-slate-500 block">Consigue tu clave en Google AI Studio de manera gratuita.</span>
                    </div>

                    <div className="pt-4 border-t border-[#1e2330] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Respuestas Automáticas de IA</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Si se desactiva, el bot solo se activará si el cliente entra a un flujo visual.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange('ai_enabled', configs.ai_enabled === 'true' ? 'false' : 'true')}
                        className={`transition ${configs.ai_enabled === 'true' ? 'text-indigo-400' : 'text-slate-500'}`}
                      >
                        {configs.ai_enabled === 'true' ? (
                          <ToggleRight size={38} />
                        ) : (
                          <ToggleLeft size={38} />
                        )}
                      </button>
                    </div>

                    {/* SECCIÓN INTERACTIVA DE REGLAS DE COMPORTAMIENTO (DIRECTIVAS DE IA) */}
                    <div className="pt-6 border-t border-[#1e2330] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles size={15} className="text-violet-400" />
                            Directivas & Reglas de Comportamiento de IA
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Define parámetros dinámicos (instrucciones, tono, límites y reglas de venta) que Gemini acatará en tiempo real sin modificar código.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddRuleModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
                        >
                          <Plus size={14} />
                          <span>Agregar Regla</span>
                        </button>
                      </div>

                      {/* Filtros de Categoría */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {['Todas', 'Tono y Estilo', 'Reglas de Venta', 'Logística y Pagos', 'Promociones', 'Restricciones'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedRuleCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                              selectedRuleCategoryFilter === cat
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                : 'bg-[#161922] text-slate-400 border border-[#2a3040] hover:text-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Lista de Tarjetas de Reglas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                        {aiRules
                          .filter(r => selectedRuleCategoryFilter === 'Todas' || r.category === selectedRuleCategoryFilter)
                          .map((rule) => (
                            <div
                              key={rule.id}
                              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                                rule.is_active
                                  ? 'bg-[#161927] border-violet-500/30'
                                  : 'bg-[#131620]/60 border-[#222838] opacity-60'
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    {rule.category || 'General'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRuleActive(rule.id, rule.is_active)}
                                      className={`text-xs font-semibold px-2 py-0.5 rounded transition ${
                                        rule.is_active
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                                      }`}
                                    >
                                      {rule.is_active ? 'ON' : 'OFF'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRuleItem(rule.id)}
                                      className="p-1 text-slate-500 hover:text-red-400 transition"
                                      title="Eliminar regla"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                <h4 className="text-xs font-bold text-slate-200">{rule.title}</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed italic bg-[#0c0e18] p-2 rounded-lg border border-slate-900">
                                  "{rule.instruction}"
                                </p>
                              </div>
                            </div>
                          ))}
                        {aiRules.length === 0 && (
                          <div className="col-span-full p-6 text-center bg-[#161922] border border-[#2a3040] rounded-xl text-slate-400 text-xs">
                            No hay reglas configuradas aún. Haz clic en "Agregar Regla" para añadir la primera directiva.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Guardar Ajustes de IA</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* MODAL PARA AGREGAR NUEVA REGLA DE IA */}
              {showAddRuleModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0f111a] border border-[#1e2330] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between border-b border-[#1e2330] pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-violet-400" />
                        <h3 className="text-sm font-bold text-white">Nueva Regla de IA</h3>
                      </div>
                      <button
                        onClick={() => setShowAddRuleModal(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <form onSubmit={handleCreateRule} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Título de la Regla</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Formato Corto de Mensajes"
                          value={newRuleTitle}
                          onChange={(e) => setNewRuleTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Categoría</label>
                        <select
                          value={newRuleCategory}
                          onChange={(e) => setNewRuleCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        >
                          <option value="Tono y Estilo">Tono y Estilo</option>
                          <option value="Reglas de Venta">Reglas de Venta</option>
                          <option value="Logística y Pagos">Logística y Pagos</option>
                          <option value="Promociones">Promociones</option>
                          <option value="Restricciones">Restricciones</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Instrucción / Parámetro</label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Ej. Nunca dar listas de ingredientes. Responder en máximo 30 palabras de forma empática."
                          value={newRuleInstruction}
                          onChange={(e) => setNewRuleInstruction(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2330]">
                        <button
                          type="button"
                          onClick={() => setShowAddRuleModal(false)}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white rounded-lg transition shadow-md"
                        >
                          Guardar Regla
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 7. SMTP VIEW */}
              {activeSection === 'smtp' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Servidor SMTP</h2>
                    <p className="text-xs text-slate-400">Configura tus servidores de salida de correo para el envío de alertas automáticas.</p>
                  </div>

                  {/* TARJETA INFORMATIVA GUÍA SMTP */}
                  <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 font-bold text-indigo-300">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Guía de Configuración Rápida para Gmail & Correos Corporativos</span>
                    </div>

                    <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed pl-1">
                      <p>
                        <strong className="text-white">1. Si usas Gmail (Recomendado):</strong>
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-300">
                        <li><strong>Host:</strong> <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">smtp.gmail.com</code> | <strong>Puerto:</strong> <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">587</code></li>
                        <li><strong>Contraseña SMTP:</strong> Google bloquea las contraseñas normales por seguridad. Debes usar una <strong>Contraseña de Aplicación (16 caracteres)</strong> generada gratis en tu cuenta de Google (<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold hover:text-indigo-300">myaccount.google.com/apppasswords</a>).</li>
                      </ul>

                      <p className="pt-1">
                        <strong className="text-white">2. Si usas Outlook / Hotmail:</strong> Host: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">smtp.office365.com</code> | Puerto: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">587</code>
                      </p>

                      <p className="pt-1">
                        <strong className="text-white">3. Pruebas en 1 Clic:</strong> Al terminar de llenar tus datos, haz clic en <strong>"🧪 Enviar Correo de Prueba"</strong> para confirmar que recibes la alerta en tu correo.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-medium text-slate-300 block">Host SMTP</label>
                        <input 
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={configs.smtp_host}
                          onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Puerto</label>
                        <input 
                          type="text"
                          placeholder="587"
                          value={configs.smtp_port}
                          onChange={(e) => handleInputChange('smtp_port', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Usuario SMTP</label>
                        <input 
                          type="text"
                          placeholder="su-correo@gmail.com"
                          value={configs.smtp_user}
                          onChange={(e) => handleInputChange('smtp_user', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Contraseña SMTP</label>
                        <input 
                          type="password"
                          placeholder="••••••••••••"
                          value={configs.smtp_pass}
                          onChange={(e) => handleInputChange('smtp_pass', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300 block">Email Remite (From)</label>
                      <input 
                        type="text"
                        placeholder='"Alertas FUXION" <alertas@gmail.com>'
                        value={configs.smtp_from}
                        onChange={(e) => handleInputChange('smtp_from', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#1e2330]">
                      <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={testingEmail || loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1c2333] hover:bg-[#252e42] border border-indigo-500/30 text-xs font-bold text-indigo-300 rounded-lg transition disabled:opacity-50"
                      >
                        <Mail size={13} className={testingEmail ? 'animate-bounce text-emerald-400' : ''} />
                        <span>{testingEmail ? 'Enviando Prueba...' : '🧪 Enviar Correo de Prueba'}</span>
                      </button>

                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Guardar Ajustes SMTP</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 8. SYSTEM VIEW */}
              {activeSection === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Ajustes Generales</h2>
                    <p className="text-xs text-slate-400">Configuraciones de administración y notificaciones operacionales.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300 block">Correo del Administrador</label>
                      <input 
                        type="email"
                        placeholder="admin@sudominio.com"
                        value={configs.admin_email}
                        onChange={(e) => handleInputChange('admin_email', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                      <span className="text-[10px] text-slate-500">Dirección donde se enviarán las alertas automáticas de vacíos de conocimiento (gaps).</span>
                    </div>

                    <div className="p-4 bg-[#161922]/50 border border-[#2a3040] rounded-lg text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-semibold text-slate-350 block mb-1">Base de datos en uso:</span>
                      El sistema está operando con almacenamiento híbrido en caliente. Si las variables globales de Supabase están configuradas en el entorno, los datos de los Ajustes se guardarán de forma centralizada en la base de datos de PostgreSQL en la nube. De lo contrario, se guardarán de forma local en tu base de datos SQLite encapsulada en <code className="text-indigo-300 font-mono">db.sqlite</code>.
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Guardar Ajustes Generales</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* BANNER FLOTANTE DE NOTIFICACIÓN PROFESIONAL EN EL ESPACIO INFERIOR */}
      {(successMsg || errorMsg) && (
        <div className="fixed bottom-6 right-8 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start justify-between gap-3 ${
            successMsg 
              ? 'bg-[#0c1a15]/95 border-emerald-500/40 text-emerald-200 shadow-emerald-500/10' 
              : 'bg-[#1f0f16]/95 border-rose-500/40 text-rose-200 shadow-rose-500/10'
          }`}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {successMsg ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">
                  {successMsg ? 'Operación Exitosa' : 'Aviso del Sistema'}
                </h4>
                <p className="text-xs leading-relaxed break-words font-medium text-slate-200">
                  {successMsg || errorMsg}
                </p>
              </div>
            </div>

            <button
              onClick={() => { setSuccessMsg(null); setErrorMsg(null); }}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition shrink-0 hover:bg-white/10"
              title="Cerrar notificación"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
