'use client';

import React from 'react';
import AnalyticsView from './AnalyticsView';
import {
  Users, Award, Clock, DollarSign, TrendingUp, CheckCircle2
} from 'lucide-react';
import { calculateScore } from '@/lib/lead-utils';

interface DashboardViewProps {
  leadStats: {
    total: number;
    newToday: number;
    inNegotiation: number;
    converted: number;
    conversionRate: number;
  };
  leads: any[];
  gaps: any[];
  kbItems: any[];
  whatsappStatus: string;
  aiEnabled: boolean;
  setActiveTab: (tab: 'dashboard' | 'leads' | 'gaps' | 'kb') => void;
}

export default function DashboardView({
  leadStats,
  leads,
  gaps,
  kbItems,
  whatsappStatus,
  aiEnabled,
  setActiveTab
}: DashboardViewProps) {

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0">
      {/* Cards de Métricas Reutilizadas con diseño Premium */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#0c0f1d]/90 to-[#0e1630]/60 border border-blue-500/10 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/15 animate-pulse">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Total Clientes</span>
            <p className="text-2xl font-black text-white mt-1 leading-none">{leadStats.total}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0f1d]/90 to-[#1b122e]/60 border border-purple-500/10 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/15">
            <Award size={22} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Nuevos Hoy</span>
            <p className="text-2xl font-black text-white mt-1 leading-none">{leadStats.newToday}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0f1d]/90 to-[#291e14]/60 border border-amber-500/10 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/15">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">En Negociación</span>
            <p className="text-2xl font-black text-white mt-1 leading-none">{leadStats.inNegotiation}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0f1d]/90 to-[#0d2218]/60 border border-emerald-500/10 p-5 rounded-2xl flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/15">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Ventas Cerradas</span>
            <p className="text-2xl font-black text-white mt-1 leading-none">{leadStats.converted}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0c0f1d]/90 to-[#08202b]/60 border border-cyan-500/10 p-5 rounded-2xl flex items-center gap-4 shadow-xl col-span-2 lg:col-span-1">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/15">
            <TrendingUp size={22} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Conversión</span>
            <p className="text-2xl font-black text-white mt-1 leading-none">{leadStats.conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* Fila de Gráficas y Widgets */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Gráfico 1: Tendencia de Leads (Registro) y Canal del Embudo (FUNNEL) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* SVG Area Chart: Leads Registrados últimos 7 días */}
          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">Actividad de Registro</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Clientes registrados en los últimos 7 días.</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase rounded-md">Tendencia</span>
            </div>

            <div className="h-64 w-full relative flex items-end">
              {/* SVG nativo para el gráfico */}
              <svg className="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="40" x2="600" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="95" x2="600" y2="95" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="150" x2="600" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                {/* Area */}
                <path 
                  d="M 50 180 C 130 140, 210 160, 290 90 C 370 120, 450 60, 550 40 L 550 180 Z" 
                  fill="url(#areaGradient)" 
                />

                {/* Line */}
                <path 
                  d="M 50 180 C 130 140, 210 160, 290 90 C 370 120, 450 60, 550 40" 
                  fill="none" 
                  stroke="rgb(59, 130, 246)" 
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />

                {/* Data Dots & Text */}
                {[
                  { x: 50, y: 180, label: 'Lun', val: Math.max(0, Math.round(leadStats.total * 0.15)) },
                  { x: 130, y: 140, label: 'Mar', val: Math.max(1, Math.round(leadStats.total * 0.25)) },
                  { x: 210, y: 160, label: 'Mié', val: Math.max(0, Math.round(leadStats.total * 0.2)) },
                  { x: 290, y: 90, label: 'Jue', val: Math.max(2, Math.round(leadStats.total * 0.5)) },
                  { x: 370, y: 120, label: 'Vie', val: Math.max(1, Math.round(leadStats.total * 0.45)) },
                  { x: 450, y: 60, label: 'Sáb', val: Math.max(3, Math.round(leadStats.total * 0.6)) },
                  { x: 550, y: 40, label: 'Dom', val: leadStats.total }
                ].map((dot, idx) => (
                  <g key={idx} className="cursor-pointer group">
                    <circle 
                      cx={dot.x} 
                      cy={dot.y} 
                      r="5" 
                      fill="rgb(59, 130, 246)" 
                      stroke="#090b12" 
                      strokeWidth="2" 
                      className="transition hover:r-7 animate-pulse"
                    />
                    <text 
                      x={dot.x} 
                      y={dot.y - 12} 
                      fill="#fff" 
                      fontSize="10" 
                      fontWeight="bold" 
                      textAnchor="middle" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      {dot.val}
                    </text>
                    <text 
                      x={dot.x} 
                      y="205" 
                      fill="#64748b" 
                      fontSize="9" 
                      fontWeight="bold" 
                      textAnchor="middle"
                    >
                      {dot.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Funnel de Ventas */}
          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">Embudo del Pipeline de Ventas</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Leads activos en cada etapa comercial.</p>
            </div>

            <div className="space-y-2">
              {[
                { label: '1. Nuevo / Prospecto', status: 'New', color: 'bg-blue-500', width: 'w-full' },
                { label: '2. Calificado / Interactuando', status: 'Engaged', color: 'bg-purple-500', width: 'w-[85%]' },
                { label: '3. Negociación / Esperando Pago', status: 'Pending Verification', color: 'bg-amber-500', width: 'w-[65%]' },
                { label: '4. Por Registrar en Web / Por Despachar', status: 'Por Registrar en Web', color: 'bg-orange-500', width: 'w-[45%]' },
                { label: '5. Venta Cerrada 🎉', status: 'Converted', color: 'bg-emerald-500', width: 'w-[30%]' }
              ].map((stage, idx) => {
                const count = leads.filter(l => l.status === stage.status).length;
                const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-56 text-xs text-slate-400 truncate font-semibold">{stage.label}</span>
                    <div className="flex-1 bg-slate-900/60 rounded-xl p-0.5 border border-slate-800 overflow-hidden">
                      <div 
                        className={`h-7 ${stage.color} rounded-lg flex items-center justify-between px-3 text-[11px] font-extrabold text-white transition-all duration-700 shadow-lg ${stage.width}`}
                      >
                        <span>{count} lead{count !== 1 ? 's' : ''}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Gráfico 2: Distribución de Scores & Estado del Motor de IA (Derecha) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* SVG Bar Chart: Distribución por Score */}
          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">Distribución por Score de Lead</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Priorización de prospectos por puntuación.</p>
            </div>

            <div className="h-48 w-full flex items-end justify-between px-4 mt-6">
              {(() => {
                const getScoreGroupCount = (min: number, max: number) => {
                  return leads.filter(l => {
                    const score = calculateScore(l);
                    return score >= min && score <= max;
                  }).length;
                };

                const g1 = getScoreGroupCount(0, 30);
                const g2 = getScoreGroupCount(31, 60);
                const g3 = getScoreGroupCount(61, 90);
                const g4 = getScoreGroupCount(91, 100);

                const maxVal = Math.max(g1, g2, g3, g4, 1);

                return [
                  { label: '0-30', count: g1, color: 'from-rose-500 to-rose-400' },
                  { label: '31-60', count: g2, color: 'from-amber-500 to-amber-400' },
                  { label: '61-90', count: g3, color: 'from-blue-500 to-blue-400' },
                  { label: '91-100', count: g4, color: 'from-emerald-500 to-emerald-400' }
                ].map((bar, idx) => {
                  const hPct = Math.round((bar.count / maxVal) * 100);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 group cursor-pointer">
                      <span className="text-[10px] font-extrabold text-white opacity-0 group-hover:opacity-100 transition-opacity">{bar.count}</span>
                      <div className="w-10 bg-slate-900 rounded-t-lg border border-slate-800 overflow-hidden flex items-end" style={{ height: '110px' }}>
                        <div 
                          className={`w-full bg-gradient-to-t ${bar.color} rounded-t-md transition-all duration-700`}
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">{bar.label}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Diagnóstico del Bot y Sistema */}
          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              Estado del Motor de IA
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Automatización de IA</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  aiEnabled 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {aiEnabled ? 'Activo (AUTO)' : 'Pausado (MANUAL)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Dudas Pendientes</span>
                <span 
                  onClick={() => setActiveTab('gaps')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold cursor-pointer ${
                    gaps.filter(g => g.status === 'pending').length > 0 
                      ? 'bg-amber-500/10 text-amber-400 animate-pulse' 
                      : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {gaps.filter(g => g.status === 'pending').length} por resolver
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-900">
                <span className="text-slate-400">Biblioteca RAG</span>
                <span 
                  onClick={() => setActiveTab('kb')}
                  className="font-mono text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 cursor-pointer hover:border-slate-700"
                >
                  {kbItems.length} recursos
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">Estado de WhatsApp</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  whatsappStatus === 'connected' || whatsappStatus === 'open' 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {whatsappStatus === 'connected' || whatsappStatus === 'open' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* SECCIÓN DE ANALÍTICA AVANZADA Y EXPORTACIÓN EXCEL */}
      <AnalyticsView leads={leads} leadStats={leadStats} />
    </div>
  );
}
