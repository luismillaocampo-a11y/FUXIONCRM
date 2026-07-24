'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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

  // Fetch global AI setting, manual leads count and branding
  const fetchStatus = useCallback(async () => {
    try {
      const [settingsRes, leadsRes, brandingRes] = await Promise.all([
        fetch('/api/settings', { cache: 'no-store' }),
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/settings/branding', { cache: 'no-store' })
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
          companyName: brandingData.companyName || 'Fuxion Flow',
          logoUrl: brandingData.logoUrl || '',
          vendorCredit: 'Desarrollado por L. Milla'
        });
      }
    } catch (err) {
      console.error('[Sidebar] Error fetching status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

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

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0">
      {/* Cabecera de la Marca Personalizable */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
        {branding.logoUrl ? (
          <img 
            src={branding.logoUrl} 
            alt="Logo" 
            className="w-9 h-9 rounded-xl object-contain bg-slate-900/80 p-1 border border-slate-800" 
          />
        ) : (
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-sm text-white tracking-tight truncate" title={branding.companyName}>
            {branding.companyName}
          </h1>
          <p className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase truncate">
            Desarrollado por L. Milla
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

      {/* Estado del Sistema + Toggle Global IA */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-1">
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

        {/* Botón toggle global IA */}
        <button
          onClick={handleToggleAI}
          disabled={toggling || aiEnabled === null}
          title={aiEnabled ? 'Haz clic para desactivar respuestas automáticas de IA' : 'Haz clic para activar respuestas automáticas de IA'}
          className={toggleBtnClass}
          aria-label={aiEnabled ? 'Desactivar IA global' : 'Activar IA global'}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
          ) : aiEnabled ? (
            <Bot className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:scale-110" />
          ) : (
            <BotOff className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:scale-110" />
          )}
          <span className="flex-1 text-left leading-tight">
            {aiEnabled === null
              ? 'Cargando...'
              : aiEnabled
              ? 'IA Activa — Clic para pausar'
              : 'IA Pausada — Clic para activar'}
          </span>
          {/* Status pill */}
          {aiEnabled !== null && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 transition-all ${
              aiEnabled
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {aiEnabled ? 'ON' : 'OFF'}
            </span>
          )}
        </button>

        {/* Botón Cerrar Sesión */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-rose-450 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/15 active:scale-95 cursor-pointer mt-2"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 text-left leading-tight">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
