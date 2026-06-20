import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Fuxion Flow CRM - Automatización de Ventas y Gestión de Clientes',
  description: 'Creador de flujos visual con IA, biblioteca multimedia de auto-aprendizaje y alertas automáticas de verificación de pago.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#090b11]">
      <body className="h-full flex overflow-hidden antialiased text-slate-100 select-none">
        <div className="flex h-full w-full">
          {/* Dashboard Sidebar */}
          <Sidebar />

          {/* Main Display Viewport */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090b11]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
