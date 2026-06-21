'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { X, Send, User, Bot, UserCheck } from 'lucide-react';

export default function CRMDashboard() {
  const [activeTab, setActiveTab] = useState<'leads' | 'gaps' | 'kb'>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [kbItems, setKbItems] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setErrorMsg(null);
      const [leadsRes, gapsRes, kbRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/knowledge/gap'),
        fetch('/api/knowledge')
      ]);
      setLeads(await leadsRes.json());
      setGaps(await gapsRes.json());
      setKbItems(await kbRes.json());
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      setChatMessages([]);
      return;
    }

    console.log('[Realtime Debug] Iniciando useEffect para Lead:', {
      id: selectedLead.id,
      name: selectedLead.name,
      phone: selectedLead.phone
    });

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        console.log(`[Realtime Debug] Obteniendo historial inicial para leadId: ${selectedLead.id}`);
        const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setChatMessages(data);
          console.log(`[Realtime Debug] Historial cargado con éxito. Mensajes: ${data.length}`);
        }
      } catch (err) {
        console.error('[Realtime Debug] Error cargando mensajes del chat:', err);
      }
    };

    fetchMessages();

    let channel: any = null;

    if (supabaseBrowser) {
      const channelName = `chat_${selectedLead.id}`;
      const filterStr = `lead_id=eq.${selectedLead.id}`;

      console.log('[Realtime Debug] Creando canal de Supabase:', {
        canal: channelName,
        filtro: filterStr,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      });

      channel = supabaseBrowser
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: filterStr,
          },
          (payload) => {
            console.log('[Realtime Debug] Cambio postgres_changes recibido en tiempo real:', payload);
            const incoming = payload.new as { id?: string; lead_id?: string; message?: string };
            console.log(`[Realtime Debug] Nuevo mensaje de lead_id=${incoming.lead_id}: "${incoming.message}"`);
            setChatMessages((prev) => {
              if (incoming.id && prev.some((m) => m.id === incoming.id)) {
                console.log('[Realtime Debug] Mensaje duplicado omitido:', incoming.id);
                return prev;
              }
              return [...prev, payload.new];
            });
          }
        );

      console.log(`[Realtime Debug] Suscribiéndose al canal "${channelName}" con filtro "${filterStr}" para el Lead ID "${selectedLead.id}"...`);

      channel.subscribe((status: string, err: any) => {
        console.log(`[Realtime Debug] Estado de suscripción para "${channelName}":`, status, err ?? '');
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime Debug] ¡Suscripción ACTIVA! Escuchando chat_messages con filtro: ${filterStr}`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Realtime Debug] Error en suscripción a canal "${channelName}":`, status, err);
        }
      });
    } else {
      console.warn('[Realtime Debug] supabaseBrowser es null — no se puede iniciar la suscripción en tiempo real.');
    }

    return () => {
      console.log(`[Realtime Debug] Limpiando suscripción para lead: ${selectedLead.id}`);
      cancelled = true;
      if (channel && supabaseBrowser) {
        supabaseBrowser.removeChannel(channel);
        console.log(`[Realtime Debug] Canal "${channel.name}" removido de forma segura.`);
      }
    };
  }, [selectedLead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !selectedLead) return;
    setChatLoading(true);
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: selectedLead.id, message: typedMessage }),
    });
    setTypedMessage('');

    const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`);
    const data = await res.json();
    if (Array.isArray(data)) setChatMessages(data);

    setChatLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0f1d] text-white p-8">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold">Panel de Control</h2>
        <div className="flex gap-2">
          {(['leads', 'gaps', 'kb'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded ${activeTab === tab ? 'bg-slate-700' : 'bg-slate-900'}`}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      
      {activeTab === 'leads' && (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400">
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`border-b border-slate-800 cursor-pointer hover:bg-slate-800 ${selectedLead?.id === lead.id ? 'bg-slate-800' : ''}`}
                  >
                    <td className="py-4">{lead.name}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedLead && (
            <div className="w-96 flex flex-col border border-slate-700 rounded-lg bg-slate-900/50 min-h-0">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedLead.name}</h3>
                  <p className="text-sm text-slate-400">{selectedLead.phone}</p>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender !== 'customer' && (
                      msg.sender === 'bot'
                        ? <Bot size={16} className="text-emerald-400 mt-1 shrink-0" />
                        : <UserCheck size={16} className="text-blue-400 mt-1 shrink-0" />
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.sender === 'customer'
                          ? 'bg-indigo-600 text-white'
                          : msg.sender === 'bot'
                            ? 'bg-slate-800 text-slate-200'
                            : 'bg-blue-900/50 text-blue-100'
                      }`}
                    >
                      {msg.message}
                    </div>
                    {msg.sender === 'customer' && <User size={16} className="text-indigo-400 mt-1 shrink-0" />}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 flex gap-2">
                <input
                  type="text"
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !typedMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg px-3 py-2"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}