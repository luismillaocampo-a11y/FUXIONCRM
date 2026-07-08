'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, Key, Mail, Bot, Save, RefreshCw, CheckCircle, AlertTriangle, 
  MessageSquare, ToggleLeft, ToggleRight, Info, ShieldCheck
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'ai' | 'smtp' | 'system'>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // System settings state
  const [configs, setConfigs] = useState({
    whatsapp_api_url: '',
    whatsapp_api_key: '',
    whatsapp_instance: '',
    gemini_api_key: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    admin_email: '',
    ai_enabled: 'true'
  });

  const fetchConfigs = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/settings/configs');
      const data = await res.json();
      if (data.success && data.configs) {
        setConfigs({
          whatsapp_api_url: data.configs.whatsapp_api_url || '',
          whatsapp_api_key: data.configs.whatsapp_api_key || '',
          whatsapp_instance: data.configs.whatsapp_instance || '',
          gemini_api_key: data.configs.gemini_api_key || '',
          smtp_host: data.configs.smtp_host || '',
          smtp_port: data.configs.smtp_port || '',
          smtp_user: data.configs.smtp_user || '',
          smtp_pass: data.configs.smtp_pass || '',
          smtp_from: data.configs.smtp_from || '',
          admin_email: data.configs.admin_email || '',
          ai_enabled: data.configs.ai_enabled || 'true'
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setSuccessMsg('Configuraciones guardadas y aplicadas en caliente con éxito.');
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#090b12] text-slate-100 p-8">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
              <Settings className="h-6 w-6 animate-[spin_8s_linear_infinite]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Configuración del Sistema</h1>
              <p className="text-sm text-slate-400 mt-0.5">Administra las credenciales, llaves de API, correo SMTP y parámetros generales en tiempo real.</p>
            </div>
          </div>
          <button 
            onClick={fetchConfigs}
            disabled={fetching}
            className="p-2 rounded-xl bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            title="Refrescar configuraciones"
          >
            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Dynamic Alerts */}
        {successMsg && (
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm flex gap-3 items-center shadow-[0_4px_20px_rgba(16,185,129,0.08)] animate-fade-in">
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-sm flex gap-3 items-center shadow-[0_4px_20px_rgba(244,63,94,0.08)] animate-fade-in">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {fetching ? (
          <div className="py-24 text-center space-y-4">
            <RefreshCw className="h-10 w-10 animate-spin text-emerald-400 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">Obteniendo configuraciones de la base de datos...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Tabs Selector */}
            <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-900/80 backdrop-blur-xl">
              {[
                { id: 'whatsapp', label: 'WhatsApp API', icon: MessageSquare },
                { id: 'ai', label: 'Inteligencia Artificial', icon: Bot },
                { id: 'smtp', label: 'Servidor Correo SMTP', icon: Mail },
                { id: 'system', label: 'Ajustes Generales', icon: Settings }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                      isActive 
                        ? 'bg-slate-800 text-white border border-slate-700 shadow-xl' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-emerald-400' : ''} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Config Panels */}
            <div className="bg-slate-950/40 backdrop-blur-md border border-slate-850 p-8 rounded-3xl shadow-2xl relative">
              
              {/* WHATSAPP API TAB */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Integración de API de WhatsApp</h3>
                    <p className="text-xs text-slate-400">Configura la API de Evolution o WhatsApp Cloud API oficial para respuestas a gran escala y webhooks.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">URL de API de WhatsApp</label>
                      <input 
                        type="url"
                        placeholder="https://su-servidor-api.com"
                        value={configs.whatsapp_api_url}
                        onChange={(e) => handleInputChange('whatsapp_api_url', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/20"
                      />
                      <span className="text-[10px] text-slate-500 block leading-relaxed">Punto de enlace (Endpoint) de la API externa para el envío de mensajes. Si no está configurada, el sistema utilizará la conexión local Baileys (QR).</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">API Key / Token Permanente</label>
                      <input 
                        type="password"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={configs.whatsapp_api_key}
                        onChange={(e) => handleInputChange('whatsapp_api_key', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/20 font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Instancia / ID Teléfono</label>
                      <input 
                        type="text"
                        placeholder="ej: mi-instancia-crm"
                        value={configs.whatsapp_instance}
                        onChange={(e) => handleInputChange('whatsapp_instance', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30 flex gap-3 text-xs leading-relaxed text-slate-400">
                    <Info className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-white block">Información de Conectividad</span>
                      Al activar este módulo, el CRM canalizará los mensajes masivos y manuales a través de la API provista. El Webhook configurado en tu servidor de Evolution API o Meta Cloud API enviará los eventos entrantes a <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300 font-mono">/api/webhook/whatsapp</code> de forma transparente.
                    </div>
                  </div>
                </div>
              )}

              {/* INTELIGENCIA ARTIFICIAL TAB */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Motores de Inteligencia Artificial (RAG)</h3>
                    <p className="text-xs text-slate-400">Controla la clave principal del bot conversacional de Gemini para el auto-aprendizaje y respuestas automáticas.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Google Gemini API Key</label>
                    <input 
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={configs.gemini_api_key}
                      onChange={(e) => handleInputChange('gemini_api_key', e.target.value)}
                      className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition focus:ring-1 focus:ring-emerald-500/20 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 block leading-relaxed">
                      Obtén tu API key gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline font-medium">Google AI Studio</a>. Se utiliza el modelo premium ultra-rápido <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300 font-mono">gemini-2.0-flash</code>.
                    </span>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">Respuestas Automáticas Globales</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Controla si el Bot de IA responde autónomamente a los clientes.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange('ai_enabled', configs.ai_enabled === 'true' ? 'false' : 'true')}
                        className={`p-1 rounded-xl transition ${configs.ai_enabled === 'true' ? 'text-emerald-400' : 'text-slate-500'}`}
                      >
                        {configs.ai_enabled === 'true' ? (
                          <ToggleRight size={44} className="hover:scale-105 transition" />
                        ) : (
                          <ToggleLeft size={44} className="hover:scale-105 transition" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30 flex gap-3 text-xs leading-relaxed text-slate-400">
                    <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0 animate-pulse" />
                    <div>
                      <span className="font-semibold text-white block">Protección Anti-Bucle de Pago Integrada</span>
                      El motor cuenta con un guardián programático que detecta cuando un cliente ya ha recibido los detalles de pago y detiene automáticamente las respuestas de la IA cuando el cliente confirma la transferencia, solicitando únicamente el comprobante de pago para validación del equipo humano.
                    </div>
                  </div>
                </div>
              )}

              {/* SMTP MAIL TAB */}
              {activeTab === 'smtp' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Servidor SMTP de Correo Notificador</h3>
                    <p className="text-xs text-slate-400">Configura el envío de alertas automáticas por correo electrónico cuando se requiere intervención manual de un agente.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Servidor SMTP Host</label>
                      <input 
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={configs.smtp_host}
                        onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Puerto SMTP</label>
                      <input 
                        type="text"
                        placeholder="587"
                        value={configs.smtp_port}
                        onChange={(e) => handleInputChange('smtp_port', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Usuario SMTP</label>
                      <input 
                        type="text"
                        placeholder="su-correo@gmail.com"
                        value={configs.smtp_user}
                        onChange={(e) => handleInputChange('smtp_user', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Contraseña SMTP (App Password)</label>
                      <input 
                        type="password"
                        placeholder="••••••••••••••••"
                        value={configs.smtp_pass}
                        onChange={(e) => handleInputChange('smtp_pass', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Email de Remite (From)</label>
                      <input 
                        type="text"
                        placeholder='"Alertas CRM" <su-correo@gmail.com>'
                        value={configs.smtp_from}
                        onChange={(e) => handleInputChange('smtp_from', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SYSTEM TAB */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Ajustes Generales del Sistema</h3>
                    <p className="text-xs text-slate-400">Parámetros operativos de la administración, destinos de notificaciones y urls del CRM.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Correo Electrónico del Administrador</label>
                      <input 
                        type="email"
                        placeholder="admin@sudominio.com"
                        value={configs.admin_email}
                        onChange={(e) => handleInputChange('admin_email', e.target.value)}
                        className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition"
                      />
                      <span className="text-[10px] text-slate-500 block leading-relaxed">Dirección donde llegarán los correos de alerta cuando el bot requiera asistencia manual (dudas no resueltas).</span>
                    </div>

                    <div className="space-y-2 flex flex-col justify-end">
                      <div className="p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-350 block mb-1">Nota de Seguridad de la Base de Datos</span>
                        Si la base de datos Supabase está habilitada en las variables generales, estas configuraciones se sincronizarán directamente en la nube. De lo contrario, se guardarán en tu base de datos SQLite local encapsulada en <code className="text-emerald-300 font-mono">db.sqlite</code>.
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Form Actions Footer */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-4 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 transform active:scale-95 disabled:scale-100"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Guardando Cambios...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar y Aplicar Ajustes
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
