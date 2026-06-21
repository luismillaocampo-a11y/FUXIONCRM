'use client';
import React, { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { X, Send, User, Bot, UserCheck, Loader2 } from 'lucide-react';

export default function CRMDashboard() {
  const [activeTab, setActiveTab] = useState<'leads' | 'gaps' | 'kb'>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Nuevo estado de carga
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      console.log('Datos recibidos en el cliente:', data); // Verás esto en F12
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ... (mantén tu useEffect de chatMessages y handleSendMessage igual) ...

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0f1d] text-white p-8">
      {/* Header igual */}
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold">Panel de Control</h2>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
      ) : activeTab === 'leads' && (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 overflow-x-auto">
            {leads.length === 0 ? (
              <p className="text-slate-500">No se encontraron clientes.</p>
            ) : (
              <table className="w-full text-left">
                <thead><tr className="text-slate-400 border-b border-slate-800"><th>Nombre</th><th>Teléfono</th></tr></thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="border-b border-slate-800 cursor-pointer hover:bg-slate-800">
                      <td className="py-4">{lead.name || 'Sin nombre'}</td><td>{lead.phone || 'Sin teléfono'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* ... (mantén tu panel de chat igual) ... */}
        </div>
      )}
    </div>
  );
}