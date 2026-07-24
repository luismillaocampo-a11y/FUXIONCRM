'use client';

import React, { useState } from 'react';
import { 
  TrendingUp, Download, Bot, CheckCircle2, 
  Users, ArrowUpRight, BarChart2, ShieldCheck, Sparkles
} from 'lucide-react';

interface AnalyticsViewProps {
  leads: any[];
  leadStats: {
    total: number;
    newToday: number;
    inNegotiation: number;
    converted: number;
    conversionRate: number;
  };
}

export default function AnalyticsView({ leads, leadStats }: AnalyticsViewProps) {
  const [downloading, setDownloading] = useState(false);

  // Calcular métricas
  const totalLeads = leads.length || 1;
  const botActiveCount = leads.filter(l => l.bot_active).length;
  const botActivePercent = Math.round((botActiveCount / totalLeads) * 100);

  const convertedCount = leads.filter(l => l.status === 'Converted').length;
  const pendingCount = leads.filter(l => l.status === 'Pending Verification' || l.status === 'Por Registrar en Web').length;
  const engagedCount = leads.filter(l => l.status === 'Engaged').length;
  const newCount = leads.filter(l => l.status === 'New').length;

  const conversionRate = Math.round((convertedCount / totalLeads) * 100);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/reports/export');
      if (!response.ok) throw new Error('Error al generar el reporte');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Nutraflow_Clientes_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error al descargar reporte:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabecera del Módulo con Botón de Exportación Destacado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#0c0f1d] via-[#11162a] to-[#0c0f1d] border border-slate-800 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-wide">Analítica Comercial & Conversión</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Tiempo Real
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Resumen estadístico del desempeño de la Inteligencia Artificial y conversión de prospectos.
          </p>
        </div>

        <button
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 shrink-0"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generando Excel...' : '📊 Exportar Clientes a Excel'}</span>
        </button>
      </div>

      {/* Tarjetas KPI de Rendimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tasa de Conversión */}
        <div className="p-5 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Tasa de Conversión</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{conversionRate}%</span>
            <span className="text-[10px] font-bold text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> {convertedCount} ventas
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${conversionRate}%` }} />
          </div>
        </div>

        {/* KPI 2: Cobertura del Bot IA */}
        <div className="p-5 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Automatización IA</span>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{botActivePercent}%</span>
            <span className="text-[10px] font-bold text-indigo-400 flex items-center">
              <Sparkles className="w-3 h-3" /> {botActiveCount} de {totalLeads}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${botActivePercent}%` }} />
          </div>
        </div>

        {/* KPI 3: Verificación Pendiente */}
        <div className="p-5 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Por Confirmar Pago</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{pendingCount}</span>
            <span className="text-[10px] font-bold text-amber-400">requieren revisión</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((pendingCount / totalLeads) * 100)}%` }} />
          </div>
        </div>

        {/* KPI 4: Total de Contactos */}
        <div className="p-5 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Base de Contactos</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{leads.length}</span>
            <span className="text-[10px] text-slate-400">registrados</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Visualización del Embudo de Ventas */}
      <div className="p-6 bg-[#0c0f1d] border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Progresión del Embudo Comercial
        </h3>

        <div className="space-y-3 pt-2">
          {/* Etapa 1: Nuevos */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-300">1. Nuevos Contactos</span>
              <span className="text-slate-400">{newCount} ({Math.round((newCount / totalLeads) * 100)}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-lg overflow-hidden p-0.5 border border-slate-800">
              <div className="bg-blue-500/80 h-full rounded-md transition-all duration-500" style={{ width: `${Math.max(5, Math.round((newCount / totalLeads) * 100))}%` }} />
            </div>
          </div>

          {/* Etapa 2: En Conversación */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-300">2. En Evaluación / Conversación</span>
              <span className="text-slate-400">{engagedCount} ({Math.round((engagedCount / totalLeads) * 100)}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-lg overflow-hidden p-0.5 border border-slate-800">
              <div className="bg-indigo-500/80 h-full rounded-md transition-all duration-500" style={{ width: `${Math.max(5, Math.round((engagedCount / totalLeads) * 100))}%` }} />
            </div>
          </div>

          {/* Etapa 3: Pago Pendiente */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-300">3. Verificación de Pago</span>
              <span className="text-slate-400">{pendingCount} ({Math.round((pendingCount / totalLeads) * 100)}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-lg overflow-hidden p-0.5 border border-slate-800">
              <div className="bg-amber-500/80 h-full rounded-md transition-all duration-500" style={{ width: `${Math.max(5, Math.round((pendingCount / totalLeads) * 100))}%` }} />
            </div>
          </div>

          {/* Etapa 4: Ventas Confirmadas */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-emerald-400 font-bold">4. Ventas Confirmadas</span>
              <span className="text-emerald-400 font-bold">{convertedCount} ({conversionRate}%)</span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-lg overflow-hidden p-0.5 border border-slate-800">
              <div className="bg-emerald-500 h-full rounded-md transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]" style={{ width: `${Math.max(5, conversionRate)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
