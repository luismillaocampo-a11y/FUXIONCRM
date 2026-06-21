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

  // --- NUEVO USEEFFECT CORREGIDO DENTRO DEL COMPONENTE ---
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
        if (!cancelled && Array.isArray(data)) {
          setChatMessages(data);
        }
      } catch (err) {
        console.error('Error cargando mensajes:', err);
      }
    };

    fetchMessages();

    let channel: any = null;

    if (supabaseBrowser) {
      channel = supabaseBrowser
        .channel(`chat_${selectedLead.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload: any) => {
            const incoming = payload.new;
            if (incoming.lead_id === selectedLead.id) {
              setChatMessages((prev) => [...prev, incoming]);
            }
          }
        )
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (channel && supabaseBrowser) {
        supabaseBrowser.removeChannel(channel);
      }
    };
  }, [selectedLead]);
  // -------------------------------------------------------

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

  // ... (aquí mantienes todo el resto de tu return actual) ...
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0f1d] text-white p-8">
      {/* ... mantén tu HTML original aquí ... */}
    </div>
  );
}