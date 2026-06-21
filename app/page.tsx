'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { 
  Search, Plus, X, Send, User, Bot, MessageSquare, 
  Trash2, Upload, FileText, Image, Video, HelpCircle, 
  AlertCircle, CheckCircle2, UserCheck, ToggleLeft, ToggleRight,
  RefreshCw, FileCode, Check, Clock
} from 'lucide-react';

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

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setChatMessages(data);
      } catch (err) {
        console.error('Failed to fetch chat messages:', err);
      }
    };

    fetchMessages();

    if (!supabaseBrowser) {
      console.warn('[Realtime] supabaseBrowser is null — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return;
    }

    const channel = supabaseBrowser
      .channel(`chat_${selectedLead.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `lead_id=eq.${selectedLead.id}`,
        },
        (payload) => {
          console.log('[Realtime] postgres_changes INSERT received:', payload);
          const incoming = payload.new as { id?: string };
          setChatMessages((prev) => {
            if (incoming.id && prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] subscription status:', status, err ?? '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] listening on chat_messages where lead_id=eq.' + selectedLead.id);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Realtime] subscription failed:', status, err);
        }
      });

    return () => {
      cancelled = true;
      supabaseBrowser.removeChannel(channel);
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