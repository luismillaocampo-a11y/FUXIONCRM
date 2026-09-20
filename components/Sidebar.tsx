'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import ActivationModal from './ActivationModal';
import {
  LayoutDashboard, GitFork, MessageSquare, Activity,
  Bot, BotOff, AlertTriangle, CheckCircle2, Loader2, Megaphone, Settings, LogOut, Share2
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  // --- Global AI toggle state ---
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null); // null = loading
  const [toggling, setToggling] = useState(false);

  // --- Manual mode indicator state ---
  const [manualLeadsCount, setManualLeadsCount] = useState(0);

  const links = [
    { href: '/?tab=leads', label: 'Bandeja de Entrada', icon: MessageSquare },
    { href: '/?tab=kanban', label: 'Embudo Kanban', icon: LayoutDashboard },
    { href: '/flows', label: 'Creador de Flujos', icon: GitFork },
    { href: '/broadcast', label: 'Mensajes Masivos', icon: Megaphone },
    { href: '/whatsapp', label: 'Conexión WhatsApp', icon: MessageSquare },
    { href: '/social', label: 'Conexión Redes Sociales', icon: Share2 },
    { href: '/settings', label: 'Configuración', icon: Settings }
  ];

  // --- Branding State ---
  const [branding, setBranding] = useState({
    companyName: 'Fuxion Flow',
    logoUrl: '',
    vendorCredit: 'Desarrollado por L. Milla'
  });

  // --- License State ---
  const [isLicenseValid, setIsLicenseValid] = useState<boolean>(true);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);

  // --- WhatsApp Connection State ---
  const [whatsappStatus, setWhatsappStatus] = useState<string>('disconnected');

  // Fetch global AI setting, manual leads count, branding, license and WhatsApp status
  const fetchStatus = useCallback(async () => {
    try {
      const [settingsRes, leadsRes, brandingRes, licenseRes, waRes] = await Promise.all([
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/settings/branding', { cache: 'no-store' }),
        fetch('/api/license/activate', { cache: 'no-store' }),
        fetch('/api/whatsapp?statusOnly=true', { cache: 'no-store' })
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setAiEnabled(settingsData.ai_enabled);
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (Array.isArray(leadsData)) {
          const manualCount = leadsData.filter((l: any) => l.bot_active === false || l.bot_active === 0).length;
          setManualLeadsCount(manualCount);
        }
      }

      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding({
          companyName: brandingData.companyName || 'Asistente Virtual',
          logoUrl: brandingData.logoUrl || '',
          vendorCredit: 'Creado por Lz MiLLa'
        });
      }

      if (licenseRes.ok) {
        const licenseData = await licenseRes.json();
        // Sin bypass por localStorage: el estado lo decide el servidor local.
        // Se muestra el registro si está bloqueada o si aún no tiene empresa.
        if (licenseData.isValid === false || !licenseData.companyName) {
          setIsLicenseValid(false);
          setShowActivationModal(true);
        } else {
          setIsLicenseValid(true);
          setShowActivationModal(false);
        }
      }

      if (waRes.ok) {
        const waData = await waRes.json();
        setWhatsappStatus(waData.status || 'disconnected');
      }
    } catch (err) {
      console.error('[Sidebar] Error fetching status:', err);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/login') return;
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('crm_font_size') || 'compact';
      document.documentElement.classList.remove('font-size-compact', 'font-size-medium', 'font-size-large');
      document.documentElement.classList.add(`font-size-${savedFontSize}`);
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus, pathname]);

  // Toggle global AI on/off
  const handleToggleAI = async () => {
    if (toggling || aiEnabled === null) return;
    setToggling(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: !aiEnabled })
      });
      if (res.ok) {
        const data = await res.json();
        setAiEnabled(data.ai_enabled);
      }
    } catch (err) {
      console.error('[Sidebar] Error toggling AI:', err);
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('[Sidebar] Error logging out:', err);
    }
  };

  // --- Indicator logic ---
  type StatusMode = 'loading' | 'ai_off' | 'manual' | 'ok';

  const getStatus = (): StatusMode => {
    if (aiEnabled === null) return 'loading';
    if (!aiEnabled) return 'ai_off';
    if (manualLeadsCount > 0) return 'manual';
    return 'ok';
  };

  const status = getStatus();

  const statusConfig = {
    loading: {
      dot: 'bg-slate-500',
      dotAnimation: 'animate-pulse',
      label: 'Cargando...',
      sub: 'Verificando sistema',
    },
    ok: {
      dot: 'bg-emerald-400',
      dotAnimation: 'glow-active',
      label: 'Bot Activo',
      sub: 'Sistema operando normal',
    },
    manual: {
      dot: 'bg-amber-400',
      dotAnimation: 'animate-pulse',
      label: 'Modo Manual Activo',
      sub: `${manualLeadsCount} cliente${manualLeadsCount !== 1 ? 's' : ''} esperando respuesta`,
    },
    ai_off: {
      dot: 'bg-rose-500',
      dotAnimation: '',
      label: 'IA Desactivada',
      sub: 'Respuestas automáticas pausadas',
    },
  };

  const current = statusConfig[status];

  // --- Toggle button styles ---
  const toggleBtnClass = aiEnabled
    ? // ON: green glowing button
      'group flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.08)] hover:shadow-[0_0_18px_rgba(16,185,129,0.15)]'
    : // OFF: red/rose dimmed button
      'group flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 hover:border-rose-400/50 shadow-[0_0_12px_rgba(239,68,68,0.05)] hover:shadow-[0_0_18px_rgba(239,68,68,0.12)]';

  if (pathname === '/login') {
    return null;
  }

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0">
      {/* Cabecera de la Marca Personalizable */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
        <img 
          src={branding.logoUrl || '/logo-av.png'} 
          alt="Logo AV" 
          className="w-10 h-10 object-contain rounded-xl" 
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-sm text-white tracking-tight truncate" title={branding.companyName || 'Asistente Virtual'}>
            {branding.companyName || 'Asistente Virtual'}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase truncate">
            Creado por Lz MiLLa
          </p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          let isActive = pathname === link.href;
          if (link.href.startsWith('/?')) {
            const linkParams = new URLSearchParams(link.href.split('?')[1]);
            const linkTab = linkParams.get('tab');
            isActive = pathname === '/' && currentTab === linkTab;
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Estado del Sistema + WhatsApp + Toggle Global IA */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-2">
        {/* Tarjeta Destacada de Conexión de WhatsApp */}
        <Link 
          href="/whatsapp"
          className={`block p-3 rounded-2xl border transition-all duration-300 group ${
            whatsappStatus === 'connected' || whatsappStatus === 'open'
              ? 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
              : 'bg-rose-950/30 hover:bg-rose-950/50 border-rose-500/40 hover:border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.12)]'
          }`}
          title="Ver Panel de Conexión de WhatsApp"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                whatsappStatus === 'connected' || whatsappStatus === 'open'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              }`} />
              <span className={`text-xs font-bold leading-tight ${
                whatsappStatus === 'connected' || whatsappStatus === 'open'
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }`}>
                {whatsappStatus === 'connected' || whatsappStatus === 'open' ? 'WhatsApp En Línea' : 'WhatsApp Desconectado'}
              </span>
            </div>
            <MessageSquare size={13} className={whatsappStatus === 'connected' || whatsappStatus === 'open' ? 'text-emerald-400' : 'text-rose-400'} />
          </div>
          
          <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
            {whatsappStatus === 'connected' || whatsappStatus === 'open'
              ? '✨ Sincronizado y recibiendo mensajes.'
              : '⚠️ Toca aquí para vincular el QR y activar el bot.'}
          </p>
        </Link>

        {/* Indicador dinámico de estado */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
          <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${current.dot} ${current.dotAnimation}`} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 leading-tight">{current.label}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{current.sub}</p>
          </div>
          {status === 'manual' && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 ml-auto" />
          )}
          {status === 'ok' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60 flex-shrink-0 ml-auto" />
          )}
        </div>

        {/* Botón Apagado/Encendido General del Bot */}
        <button
          onClick={handleToggleAI}
          disabled={toggling || aiEnabled === null}
          title={aiEnabled ? 'Apagar Bot general (pausa todas las respuestas IA)' : 'Encender Bot general'}
          aria-label={aiEnabled ? 'Apagar Bot general' : 'Encender Bot general'}
          className={`${toggleBtnClass} disabled:opacity-50 disabled:cursor-not-allowed justify-center cursor-pointer`}
        >
          {toggling || aiEnabled === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
          ) : aiEnabled ? (
            <BotOff className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <Bot className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="flex-1 text-center leading-tight">
            {toggling ? 'Cambiando...' : aiEnabled === null ? 'Cargando...' : aiEnabled ? 'Apagar Bot' : 'Encender Bot'}
          </span>
        </button>

        {/* Selector de Escala de Fuente Profesional */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 pl-1">
            <span className="text-xs">Aa</span> Tamaño:
          </span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('crm_font_size', 'compact');
                  document.documentElement.classList.remove('font-size-medium', 'font-size-large');
                  document.documentElement.classList.add('font-size-compact');
                }
              }}
              title="Tamaño Normal / Compacto (100%)"
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              100%
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('crm_font_size', 'medium');
                  document.documentElement.classList.remove('font-size-compact', 'font-size-large');
                  document.documentElement.classList.add('font-size-medium');
                }
              }}
              title="Tamaño Medio (+12%)"
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              112%
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('crm_font_size', 'large');
                  document.documentElement.classList.remove('font-size-compact', 'font-size-medium');
                  document.documentElement.classList.add('font-size-large');
                }
              }}
              title="Tamaño Grande (+25% con compensación de espacio)"
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              125%
            </button>
          </div>
        </div>

        {/* Botón Cerrar Sesión */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/15 active:scale-95 cursor-pointer mt-2"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 text-left leading-tight">Cerrar Sesión</span>
        </button>
      </div>

      {/* Modal Bloqueante de Licencia Comercial */}
      <ActivationModal
        isOpen={showActivationModal}
        canClose={false}
        onClose={() => setShowActivationModal(false)}
        onActivated={() => {
          setShowActivationModal(false);
          setIsLicenseValid(true);
          window.location.reload();
        }}
      />
    </aside>
  );
}
