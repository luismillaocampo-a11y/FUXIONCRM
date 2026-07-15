'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const FlowCanvas = dynamic(() => import('@/components/flows/FlowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col h-full items-center justify-center bg-[#080a14] text-slate-400">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mx-auto"></div>
        <p className="text-xs font-semibold">Cargando Editor de Flujos...</p>
      </div>
    </div>
  )
});

export default function FlowPage() {
  return <FlowCanvas />;
}
