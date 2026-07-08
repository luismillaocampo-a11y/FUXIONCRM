'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, Key, Mail, Bot, Save, RefreshCw, CheckCircle, AlertTriangle, 
  MessageSquare, ToggleLeft, ToggleRight, Info, ShieldCheck, User, Lock, 
  Palette, Grid, Upload, ChevronRight, BookOpen
} from 'lucide-react';

type SectionType = 'overview' | 'profile' | 'security' | 'appearance' | 'whatsapp' | 'ai' | 'smtp' | 'system';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const fetchConfigs = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/settings/configs');
      const data = await res.json();
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
          admin_email: data.configs.admin_email || '',
          ai_enabled: data.configs.ai_enabled || 'true',
          display_name: data.configs.display_name || 'Andy Cruz',
          user_avatar: data.configs.user_avatar || '',
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
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [key]: value
    }));
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: configs })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Configuraciones guardadas y aplicadas con éxito.');
        window.setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        throw new Error(data.error || 'Error al guardar');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con la API.');
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
            <h1 className="text-lg font-bold text-white">Settings</h1>
            <p className="text-xs text-slate-400 mt-0.5">Everything in one place — your account and your workspace. Pick a section to manage it.</p>
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
              <span>Overview</span>
            </button>
          </div>

          {/* Account Sub-category */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase block pl-3">Account</span>
            <div className="space-y-1">
              {[
                { id: 'profile', label: 'Your profile', icon: User },
                { id: 'security', label: 'Login & security', icon: Lock },
                { id: 'appearance', label: 'Appearance', icon: Palette }
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
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase block pl-3">Workspace</span>
            <div className="space-y-1">
              {[
                { id: 'whatsapp', label: 'WhatsApp Connection', icon: MessageSquare },
                { id: 'ai', label: 'AI Settings', icon: Bot },
                { id: 'smtp', label: 'SMTP Mail Server', icon: Mail },
                { id: 'system', label: 'General Settings', icon: Settings }
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
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-500 font-mono">active</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Panel Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#07090e]">
          
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs flex gap-3 items-center shadow-[0_4px_20px_rgba(16,185,129,0.05)]">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs flex gap-3 items-center shadow-[0_4px_20px_rgba(244,63,94,0.05)]">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-400 flex-shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

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
                      <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-extrabold text-base">
                        {configs.display_name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white">{configs.display_name}</h2>
                        <p className="text-xs text-slate-400">{configs.admin_email || 'admin@sudominio.com'}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 tracking-wider uppercase">Owner</span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'whatsapp', label: 'WhatsApp API', icon: MessageSquare, desc: 'Conexión a Meta o Evolution API' },
                      { id: 'ai', label: 'AI Settings', icon: Bot, desc: 'Gestión de Gemini API Key y RAG' },
                      { id: 'smtp', label: 'SMTP Mail Server', icon: Mail, desc: 'Servidor de envío de alertas' },
                      { id: 'profile', label: 'Your Profile', icon: User, desc: 'Edita tu alias y datos de cuenta' },
                      { id: 'security', label: 'Login & Security', icon: Lock, desc: 'Cambia tu contraseña' },
                      { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Tema oscuro / claro y colores' }
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

              {/* 2. PROFILE VIEW */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Your profile</h2>
                    <p className="text-xs text-slate-400">Edita cómo apareces ante el equipo de ventas. Tu alias y avatar se muestran en las barras principales.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4 pb-6 border-b border-[#1e2330]">
                      <div className="h-14 w-14 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-extrabold text-lg">
                        {configs.display_name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <button 
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs font-semibold text-white hover:bg-[#1f2431] transition cursor-pointer"
                        >
                          <Upload size={13} />
                          <span>Upload photo</span>
                        </button>
                        <p className="text-[10px] text-slate-500">PNG, JPG or WebP. Up to 2 MB.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Display name</label>
                        <input 
                          type="text"
                          value={configs.display_name}
                          onChange={(e) => handleInputChange('display_name', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Email</label>
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
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Role</span>
                        <span className="text-white font-medium">user (Administrator)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Joined</span>
                        <span className="text-white font-medium">29 de junio de 2026</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Save changes</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 3. SECURITY VIEW */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Login & security</h2>
                    <p className="text-xs text-slate-400">Administra y actualiza las contraseñas de acceso y las sesiones activas en tus dispositivos.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    <span className="text-xs font-bold text-white block mb-4">Password</span>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">Current password</label>
                          <input 
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">New password</label>
                          <input 
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1">
                          <label className="text-xs font-medium text-slate-300 block">Confirm new password</label>
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
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                        >
                          Update password
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#1e2330] space-y-4">
                      <div>
                        <span className="text-xs font-bold text-white block">Active sessions</span>
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
                          Sign out of all devices
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
                    <h2 className="text-base font-bold text-white mb-1">Appearance</h2>
                    <p className="text-xs text-slate-400">Elige el tema visual del CRM y los colores de énfasis aplicados en los botones, menús y barras activas.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    
                    {/* Theme Mode Selector */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-white block">Mode</span>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'light', label: 'Light Mode', desc: 'Vista clásica clara' },
                          { id: 'dark', label: 'Dark Mode', desc: 'Fondo oscuro premium' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleAppearanceUpdate(m.id as any, selectedAccent)}
                            className={`p-4 rounded-xl border text-left transition duration-300 ${
                              selectedMode === m.id 
                                ? 'bg-indigo-500/10 border-indigo-500/50 shadow-md' 
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
                      <span className="text-xs font-bold text-white block">Accent color</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'violet', label: 'Violet', color: 'bg-violet-600', text: 'Confidente y expresivo.' },
                          { id: 'emerald', label: 'Emerald (Fuxion)', color: 'bg-emerald-600', text: 'Color de crecimiento oficial.' },
                          { id: 'cobalt', label: 'Cobalt', color: 'bg-blue-600', text: 'Limpio y corporativo.' },
                          { id: 'amber', label: 'Amber', color: 'bg-amber-600', text: 'Cálido y amigable.' },
                          { id: 'rose', label: 'Rose', color: 'bg-rose-600', text: 'Moderno y atrevido.' }
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
                        <h2 className="text-base font-bold text-white mb-1">WhatsApp Connection</h2>
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
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                          >
                            <Save size={13} />
                            <span>Save WhatsApp Settings</span>
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Instruction accordion side block */}
                    <div className="w-full lg:w-80 space-y-4">
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-indigo-400" />
                          <span className="text-xs font-bold text-white">Setup Instructions</span>
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
                    <h2 className="text-base font-bold text-white mb-1">AI Settings</h2>
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

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Save AI Settings</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 7. SMTP VIEW */}
              {activeSection === 'smtp' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">SMTP Mail Server</h2>
                    <p className="text-xs text-slate-400">Configura tus servidores de salida de correo para el envío de alertas automáticas.</p>
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

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Save SMTP Settings</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 8. SYSTEM VIEW */}
              {activeSection === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">General Settings</h2>
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
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Save General Settings</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
