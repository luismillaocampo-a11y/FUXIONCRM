'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Key, Link as LinkIcon, 
  Save, CheckCircle2, AlertCircle, Copy, Sparkles, RefreshCw, Share2
} from 'lucide-react';

function InstagramHeaderIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-white fill-none stroke-current stroke-[2.5]`} viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function FacebookHeaderIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-white fill-current`} viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.45 5.518 3.715 7.215V22l3.35-1.84c.93.258 1.91.401 2.935.401 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.191 12.443l-2.583-2.756-5.034 2.756 5.534-5.875 2.646 2.756 4.97-2.756-5.534 5.875z"/>
    </svg>
  );
}

export default function SocialConnectionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [instagramToken, setInstagramToken] = useState('');
  const [instagramVerifyToken, setInstagramVerifyToken] = useState('nutraflow_instagram_token');
  const [facebookToken, setFacebookToken] = useState('');
  const [facebookVerifyToken, setFacebookVerifyToken] = useState('nutraflow_facebook_token');
  const [igConfigured, setIgConfigured] = useState(false);
  const [fbConfigured, setFbConfigured] = useState(false);
  const [igMasked, setIgMasked] = useState('');
  const [fbMasked, setFbMasked] = useState('');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      // Endpoint correcto con auth + máscara de secretos (el /api/settings simple solo maneja ai_enabled)
      const res = await fetch('/api/settings/configs', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const configs = data.configs || {};
        const masked = data.masked || {};
        const configured = data.configured || {};
        if (configs.instagram_verify_token) setInstagramVerifyToken(configs.instagram_verify_token);
        if (configs.facebook_verify_token) setFacebookVerifyToken(configs.facebook_verify_token);
        setIgMasked(masked.instagram_access_token || '');
        setFbMasked(masked.facebook_access_token || '');
        setIgConfigured(!!configured.instagram_access_token);
        setFbConfigured(!!configured.facebook_access_token);
        // Access tokens nunca vienen en claro: input queda vacío, placeholder muestra máscara
        setInstagramToken('');
        setFacebookToken('');
      }
    } catch (e) {
      console.error('Error cargando tokens sociales:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const settings: Record<string, string> = {
        instagram_verify_token: instagramVerifyToken.trim(),
        facebook_verify_token: facebookVerifyToken.trim()
      };
      // Solo enviar access tokens si el usuario escribió uno nuevo (evita sobreescribir con vacío/máscara)
      if (instagramToken.trim() && !instagramToken.includes('****')) {
        settings.instagram_access_token = instagramToken.trim();
      }
      if (facebookToken.trim() && !facebookToken.includes('****')) {
        settings.facebook_access_token = facebookToken.trim();
      }
      const res = await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setMsg({ type: 'success', text: '¡Configuración de Instagram y Facebook guardada correctamente!' });
        setInstagramToken('');
        setFacebookToken('');
        fetchTokens();
      } else {
        setMsg({ type: 'error', text: data.error || 'Error al guardar la configuración' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://su-crm.com';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07090e] text-slate-100 font-sans">
        {/* Cabecera Principal */}
        <header className="h-16 shrink-0 border-b border-slate-800 bg-[#0c0f1d] px-8 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] rounded-xl text-white shadow-md">
              <InstagramHeaderIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Conexión Instagram Direct & Facebook Messenger</h1>
              <p className="text-[10px] text-slate-400">Recibe y responde mensajes de tus redes sociales en una sola bandeja unificada.</p>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl">
          {msg && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
              msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* TARJETA GUÍA DE CONEXIÓN META */}
          <div className="p-5 rounded-2xl border border-indigo-500/30 bg-[#0f1424] text-slate-200 text-xs space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-2 font-bold text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm">Guía Paso a Paso: Cómo Vincular Instagram Direct & Facebook Messenger</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline"
              >
                {showGuide ? 'Ocultar Guía' : 'Ver Guía Completa'}
              </button>
            </div>

            {showGuide && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed pt-1">
                <div className="space-y-2.5 p-3.5 bg-[#141b30] rounded-xl border border-indigo-500/20">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Paso 1: Crear App & Generar Token en Meta
                  </span>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-300">
                    <li>Ingresa a <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold hover:text-indigo-300">developers.facebook.com</a> e inicia sesión con tu Facebook.</li>
                    <li>Crea una App del tipo <strong>Negocios (Business)</strong>.</li>
                    <li>Agrega el producto <strong>Messenger</strong> o <strong>Instagram Graph API</strong>.</li>
                    <li>En <i>Generación de Tokens</i>, selecciona tu Página de Facebook y concede permisos de mensajería (`pages_messaging`, `instagram_manage_messages`).</li>
                    <li>Copia el <strong>Page Access Token</strong> (empieza con <code>EAABw...</code>) y pégalo abajo.</li>
                  </ol>
                </div>

                <div className="space-y-2.5 p-3.5 bg-[#141b30] rounded-xl border border-indigo-500/20">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                    Paso 2: Activar Webhook de Entrada
                  </span>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-300">
                    <li>Copia la <strong>URL de Webhook</strong> correspondiente (Instagram o Facebook) usando los botones de abajo.</li>
                    <li>En Meta for Developers → <strong>Webhooks</strong>, pega la URL.</li>
                    <li>Ingresa el <strong>Token de Verificación</strong> (por defecto: <code>fuxion_verify_token</code>).</li>
                    <li>Activa los eventos <code>messages</code> y <code>messaging_postbacks</code>.</li>
                    <li>¡Listo! Los mensajes recibidos en tus páginas llegarán de inmediato a la bandeja unificada de tu CRM.</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-400">Cargando tokens de redes sociales...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* BLOQUE 1: INSTAGRAM DIRECT */}
              <div className="p-6 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] rounded-xl text-white shadow-md">
                      <InstagramHeaderIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Instagram Direct DMs</h2>
                      <p className="text-xs text-slate-400">API oficial Meta Graph v18.0</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    {igConfigured ? 'Conectado' : 'Pendiente Token'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-pink-400" />
                      Page Access Token (Instagram Direct)
                    </label>
                    <input
                      type="password"
                      value={instagramToken}
                      onChange={(e) => setInstagramToken(e.target.value)}
                      placeholder={igMasked || 'EAABwz...'}
                      className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition font-mono"
                    />
                    {igConfigured && !instagramToken && (
                      <p className="text-[10px] text-emerald-400">✓ Token guardado ({igMasked}). Déjalo vacío para conservarlo, o pega uno nuevo para reemplazar.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                      Token de Verificación (úsalo en Meta for Developers)
                    </label>
                    <input
                      type="text"
                      value={instagramVerifyToken}
                      onChange={(e) => setInstagramVerifyToken(e.target.value)}
                      placeholder="nutraflow_instagram_token"
                      className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-pink-400" />
                      URL de Webhook de Instagram (Copiar a Meta for Developers)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${baseUrl}/api/webhook/instagram`}
                        className="flex-1 px-3.5 py-2 bg-[#14192b] border border-slate-800 rounded-xl text-xs text-slate-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${baseUrl}/api/webhook/instagram`, 'ig_url')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedField === 'ig_url' ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOQUE 2: FACEBOOK MESSENGER */}
              <div className="p-6 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#0084FF] rounded-xl text-white shadow-md">
                      <FacebookHeaderIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Facebook Messenger</h2>
                      <p className="text-xs text-slate-400">API oficial Meta Graph v18.0</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {fbConfigured ? 'Conectado' : 'Pendiente Token'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-400" />
                      Page Access Token (Facebook Messenger)
                    </label>
                    <input
                      type="password"
                      value={facebookToken}
                      onChange={(e) => setFacebookToken(e.target.value)}
                      placeholder={fbMasked || 'EAABwz...'}
                      className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono"
                    />
                    {fbConfigured && !facebookToken && (
                      <p className="text-[10px] text-emerald-400">✓ Token guardado ({fbMasked}). Déjalo vacío para conservarlo, o pega uno nuevo para reemplazar.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      Token de Verificación (úsalo en Meta for Developers)
                    </label>
                    <input
                      type="text"
                      value={facebookVerifyToken}
                      onChange={(e) => setFacebookVerifyToken(e.target.value)}
                      placeholder="nutraflow_facebook_token"
                      className="w-full px-3.5 py-2.5 bg-[#14192b] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                      URL de Webhook de Facebook (Copiar a Meta for Developers)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${baseUrl}/api/webhook/facebook`}
                        className="flex-1 px-3.5 py-2 bg-[#14192b] border border-slate-800 rounded-xl text-xs text-slate-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${baseUrl}/api/webhook/facebook`, 'fb_url')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedField === 'fb_url' ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Guardando Conexión...' : 'Guardar Configuración Social'}</span>
                </button>
              </div>
            </form>
          )}
        </main>
    </div>
  );
}
