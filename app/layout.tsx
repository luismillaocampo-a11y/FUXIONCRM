import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'FUXION CRM',
  description: 'Creador de flujos visual con IA, biblioteca multimedia de auto-aprendizaje y alertas automáticas de verificación de pago.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accent = await db.getSystemSetting('appearance_accent') || 'emerald';
  const mode = await db.getSystemSetting('appearance_mode') || 'dark';

  return (
    <html lang="en" suppressHydrationWarning className={`h-full bg-[#090b11] theme-${accent} ${mode}`}>
      <body suppressHydrationWarning className="h-full flex overflow-hidden antialiased text-slate-100 select-none">
        <div className="flex h-full w-full">
          {/* Dashboard Sidebar */}
          <Suspense fallback={<div className="w-64 bg-[#0c0f1d] border-r border-slate-800 shrink-0" />}>
            <Sidebar />
          </Suspense>

          {/* Main Display Viewport */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090b11]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
