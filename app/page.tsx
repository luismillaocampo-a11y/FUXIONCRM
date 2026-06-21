'use client';
import React, { useState, useEffect } from 'react';
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

  const fetchData = async () => {
    try {
      const [leadsRes, gapsRes, kbRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/knowledge/gap'),
        fetch('/api/knowledge')
      ]);
      const leadsData = await leadsRes.json();
      const gapsData = await gapsRes.json();
      const kbData = await kbRes.json();
      
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setGaps(Array.isArray(gapsData) ? gapsData : []);
      setKbItems(Array.isArray(kbData) ? kbData : []);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!selectedLead) {
      setChatMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const res = await fetch(`/api/chat/messages?leadId=${encodeURIComponent(selectedLead.id)}`);
      const data = await res.json();
      if (Array.isArray(data)) setChatMessages(data);
    };
    fetchMessages();

    const channel = supabaseBrowser
      ?.channel(`chat_${selectedLead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        if (payload.new.lead_id === selectedLead.id) {
          setChatMessages((prev) => [...prev, payload.new]);
        }
      })
      .subscribe();

    return () => { supabaseBrowser?.removeChannel(channel!); };
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
              <thead><tr className="text-slate-400"><th>Nombre</th><th>Teléfono</th></tr></thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="border-b border-slate-800 cursor-pointer hover:bg-slate-800">
                    <td className="py-4">{lead.name}</td><td>{lead.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedLead && (
            <div className="w-96 flex flex-col border border-slate-700 rounded-lg bg-slate-900/50">
              <div className="p-4 border-b border-slate-700 flex justify-between">
                <h3 className="font-semibold">{selectedLead.name}</h3>
                <button onClick={() => setSelectedLead(null)}><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.sender === 'customer' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 flex gap-2">
                <input value={typedMessage} onChange={(e) => setTypedMessage(e.target.value)} className="flex-1 bg-slate-800 rounded px-3 py-2" placeholder="Escribe..." />
                <button type="submit" disabled={chatLoading} className="bg-indigo-600 px-3 py-2 rounded"><Send size={18} /></button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}