import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { db } from '@/lib/db';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700']
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700', '800']
});

export const metadata: Metadata = {
  title: 'Asistente Virtual - Creado por Lz MiLLa',
  description: 'Sistema de Gestión y Automatización Operativa para Ventas por WhatsApp',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rawAccent = await db.getSystemSetting('appearance_accent') || 'neon-glass';
  const accent = (rawAccent === 'emerald' ? 'emerald' : 'neon-glass');
  const mode = await db.getSystemSetting('appearance_mode') || 'dark';

  return (
    <html lang="es" suppressHydrationWarning className={`h-full bg-[#0c0f1d] theme-${accent} ${mode} ${inter.variable} ${plusJakartaSans.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var a = localStorage.getItem('crm_theme_accent');
                var m = localStorage.getItem('crm_theme_mode');
                if (a === 'neon-glass' || a === 'emerald') {
                  document.documentElement.classList.remove('theme-emerald', 'theme-neon-glass');
                  document.documentElement.classList.add('theme-' + a);
                }
                if (m === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                } else if (m === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch(e) {}
            `
          }}
        />
      </head>
      <body suppressHydrationWarning className="h-full flex overflow-hidden antialiased subpixel-antialiased text-slate-100 select-none font-sans">
        <div className="flex h-full w-full">
          {/* Dashboard Sidebar */}
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>

          {/* Main Display Viewport */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0c0f1d]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
