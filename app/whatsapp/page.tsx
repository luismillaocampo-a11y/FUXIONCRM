"use client";

import { useEffect, useRef, useState } from 'react';

type WhatsAppSession = {
  status: string | null;
  qrCode: string | null;
};

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    keepAliveRef.current = window.setInterval(() => fetchQrSession({ single: true }), 30000);
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

  const fetchQrSession = async (options?: { single?: boolean }) => {
    if (!options?.single) setLoading(true);
    if (!options?.single) setError(null);

    try {
      const response = await fetch('/api/whatsapp');
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || 'No se pudo generar el código QR');
      }

      setSession({
        status: data?.status ?? null,
        qrCode: data?.qrcode ?? null
      });

      // Keep polling until the socket reaches connected/open.
      if (data?.status === 'connected' || data?.status === 'open') {
        stopPolling();
        startKeepAlive();
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
      stopAllPolling();
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
  const statusLabel = isConnected ? 'Conectada' : session?.status ?? 'Desconectada';
  const statusClass = isConnected ? 'text-emerald-400' : 'text-rose-400';
  const connectionMessage = isConnected ? 'Sesión activa, manteniendo conexión.' : 'Inicia la sesión con el QR.';

  return (
    <div className="min-h-screen p-8 bg-[#090b12] text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-8 shadow-2xl shadow-black/20">
          <h1 className="text-3xl font-semibold mb-2">Panel de WhatsApp</h1>
          <p className="text-sm text-slate-400 mb-6">
            Genera un código QR para configurar la sesión de WhatsApp. El estado mostrará si la sesión está conectada o desconectada.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
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
                      throw new Error(refreshData?.error || refreshData?.message || 'No se pudo reiniciar la sesión');
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
                }}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Generando QR...' : 'Generar código QR'}
              </button>

              {isConnected && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp y desconectar el dispositivo?')) return;
                    setLoading(true);
                    setError(null);
                    try {
                      const closeResponse = await fetch('/api/whatsapp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'close' })
                      });
                      const closeData = await closeResponse.json();
                      if (!closeResponse.ok || !closeData.success) {
                        throw new Error(closeData?.error || closeData?.message || 'No se pudo cerrar la sesión');
                      }
                      setSession({
                        status: 'disconnected',
                        qrCode: null
                      });
                      stopAllPolling();
                    } catch (err: any) {
                      setError(err.message || 'Error al cerrar sesión');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cerrar Sesión de WhatsApp
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm">
              <div className="text-slate-400 uppercase tracking-[0.2em] text-[10px] mb-1">Estado</div>
              <div className={`text-lg font-semibold ${statusClass}`}>{session ? statusLabel : 'Desconectada'}</div>
              <div className="text-xs text-slate-500 mt-1">{connectionMessage}</div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 text-center">
            <div className="mb-4 text-sm text-slate-400">Vista previa del código QR</div>
            {session?.qrCode ? (
              session.qrCode.startsWith('data:image/') ? (
                <div className="inline-block rounded-3xl border border-slate-800 bg-slate-950 p-6">
                  <img
                    src={session.qrCode}
                    alt="Código QR de WhatsApp"
                    className="h-72 w-72 rounded-xl bg-white p-4 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-left">
                  <div className="mb-3 text-sm text-slate-300">QR simulado recibido como texto:</div>
                  <pre className="whitespace-pre-wrap break-words rounded-2xl bg-slate-900/90 p-4 text-xs text-slate-200 font-mono max-h-[288px] overflow-auto">
                    {session.qrCode}
                  </pre>
                </div>
              )
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-20 text-sm text-slate-500">
                No hay código QR generado aún. Presiona el botón para obtener uno.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
