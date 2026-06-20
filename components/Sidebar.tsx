'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GitFork, BookOpen, AlertTriangle, Settings, Activity } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Panel de Clientes', icon: LayoutDashboard },
    { href: '/flows', label: 'Creador de Flujos', icon: GitFork }
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0">
      {/* Cabecera de la Marca */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2.5">
        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-semibold text-white tracking-tight">Fuxion Flow</h1>
          <p className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">Automatización CRM</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
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

      {/* Estado del Sistema */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 glow-active"></div>
          <div>
            <p className="text-xs font-medium text-slate-300">Modo Manual Activo</p>
            <p className="text-[10px] text-slate-500">Sistema operando normal</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
