"use client";

import { useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

type WhatsAppSession = {
  status: string | null;
  qrCode: string | null;
};

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleDisconnectSession = async () => {
    setShowDisconnectModal(false);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error || data?.message || 'No se pudo desconectar la sesión');
      }
      // Tras cerrar, generar el QR nuevo automáticamente para vincular otro número
      await requestFreshQr();
    } catch (err: any) {
      setError(err.message || 'Error al desconectar la sesión');
    } finally {
      setLoading(false);
    }
  };

  const requestFreshQr = async () => {
    setLoading(true);
    setError(null);

    try {
      const refreshResponse = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      });

      const refreshData = await refreshResponse.json();
      if (!refreshResponse.ok || !refreshData.success) {
        throw new Error(refreshData?.error || refreshData?.message || 'No se pudo generar nuevo QR');
      }

      if (refreshData?.qrcode) {
        setSession({
          status: refreshData?.status ?? 'connecting',
          qrCode: refreshData.qrcode
        });
      }

      stopAllPolling();
      pollRef.current = window.setInterval(() => fetchQrSession({ single: true }), 2000);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const pollRef = useRef<number | null>(null);
  const keepAliveRef = useRef<number | null>(null);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => fetchQrSession({ single: true }), 2000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startKeepAlive = () => {
    if (keepAliveRef.current) return;
    keepAliveRef.current = window.setInterval(() => fetchQrSession({ single: true, statusOnly: true }), 30000);
  };

  const stopKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  };

  const stopAllPolling = () => {
    stopPolling();
    stopKeepAlive();
  };

  const fetchQrSession = async (options?: { single?: boolean; statusOnly?: boolean }) => {
    if (!options?.single) setLoading(true);
    if (!options?.single) setError(null);

    try {
      const url = options?.statusOnly ? '/api/whatsapp?statusOnly=true' : '/api/whatsapp';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        // En lugar de detener permanentemente el polling, registrar el error y permitir reintentos
        throw new Error(data?.error || data?.message || 'Esperando inicialización de WhatsApp...');
      }

      setError(null);
      setSession(prev => ({
        status: data?.status ?? prev?.status ?? null,
        qrCode: options?.statusOnly ? (prev?.qrCode ?? null) : (data?.qrcode ?? null)
      }));

      // Si se logró conectar, pasar a polling de mantenimiento (cada 30s)
      if (data?.status === 'connected' || data?.status === 'open') {
        stopPolling();
        startKeepAlive();
      } else if (data?.status === 'disconnected') {
        stopKeepAlive();
        startPolling();
      }
    } catch (err: any) {
      console.warn('[WhatsAppPage] Advertencia en polling de QR:', err.message || err);
    } finally {
      if (!options?.single) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrSession();
    startPolling();

    return () => {
      stopAllPolling();
    };
  }, []);

  const isConnected = session?.status === 'connected' || session?.status === 'open';
  const isConnecting = session?.status === 'connecting';
  const statusLabel = isConnected 
    ? 'Conectada' 
    : isConnecting 
      ? 'Conectando / Generando QR' 
      : session?.status ?? 'Desconectada';
  const statusClass = isConnected ? 'text-emerald-400' : isConnecting ? 'text-amber-400' : 'text-rose-400';
  const connectionMessage = isConnected 
    ? 'Sesión activa. Todo el CRM (Bandeja, Masivos, Estados) está conectado y sincronizado.' 
    : isConnecting 
      ? 'Esperando escaneo del código QR...' 
      : 'Inicia la sesión escaneando el código QR con WhatsApp.';

  return (
    <div className="min-h-screen p-8 bg-[#090b12] text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-8 shadow-2xl shadow-black/20">
          <h1 className="text-3xl font-semibold mb-2">Panel de Conexión WhatsApp</h1>
          <p className="text-sm text-slate-400 mb-6">
            Vincula tu cuenta de WhatsApp una sola vez. Esta única conexión alimenta todo el CRM: Bandeja de Entrada, Auto-respuestas de IA, Difusiones Masivas y Estados de WhatsApp.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              {!isConnected && (
                <button
                  type="button"
                  onClick={requestFreshQr}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {loading ? 'Generando QR...' : 'Regenerar código QR'}
                </button>
              )}

              {isConnected && (
                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600/90 hover:bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-rose-600/20"
                >
                  Cerrar Sesión de WhatsApp
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-3 text-sm">
              <div className="text-slate-400 uppercase tracking-[0.2em] text-[10px] mb-1">Estado de Conexión</div>
              <div className={`text-lg font-semibold flex items-center gap-2 ${statusClass}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {session ? statusLabel : 'Desconectada'}
              </div>
              <div className="text-xs text-slate-400 mt-1">{connectionMessage}</div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 text-center">
            {isConnected ? (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/30 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-emerald-300">¡WhatsApp Vinculado Exitosamente!</h3>
                <p className="mt-2 text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  Tu número de WhatsApp está sincronizado con el CRM de forma permanente. Puedes recibir mensajes de clientes, activar el bot de IA, enviar campañas de difusión masiva y publicar estados de WhatsApp.
                </p>
              </div>
            ) : session?.qrCode ? (
              <div className="space-y-4">
                <div className="mb-2 text-sm font-semibold text-slate-300">
                  📱 Abre WhatsApp en tu celular &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                </div>
                <div className="inline-block rounded-3xl border border-slate-800 bg-white p-6 shadow-2xl">
                  <img
                    src={session.qrCode}
                    alt="Código QR de WhatsApp"
                    className="h-72 w-72 rounded-xl bg-white object-contain"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  El código QR se detecta automáticamente una vez escaneado. No necesitas presionar nada más.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-20 text-sm text-slate-500">
                Iniciando motor de WhatsApp y generando código QR...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL ESTILIZADO DE CONFIRMACIÓN DE DESCONEXIÓN */}
      <ConfirmModal
        isOpen={showDisconnectModal}
        title="¿Desconectar WhatsApp?"
        message="Se cerrará la sesión actual y se generará un código QR nuevo para vincular otro número. El bot dejará de responder hasta vincular."
        confirmText="Desconectar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDisconnectSession}
        onCancel={() => setShowDisconnectModal(false)}
      />
    </div>
  );
}
