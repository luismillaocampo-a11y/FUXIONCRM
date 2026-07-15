'use client';

import React from 'react';
import { Upload, FileCode, Plus, RefreshCw, Trash2, FileText, Image, Video } from 'lucide-react';

interface KnowledgeBaseViewProps {
  uploadTitle: string;
  setUploadTitle: (title: string) => void;
  uploadFileType: string;
  setUploadFileType: (type: string) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploading: boolean;
  kbItems: any[];
  handleFileUpload: (e: React.FormEvent) => void;
  handleDeleteKB: (id: string) => void;
}

export default function KnowledgeBaseView({
  uploadTitle,
  setUploadTitle,
  uploadFileType,
  setUploadFileType,
  uploadFile,
  setUploadFile,
  uploading,
  kbItems,
  handleFileUpload,
  handleDeleteKB
}: KnowledgeBaseViewProps) {
  return (
    <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-0">
      {/* Formulario de Subida */}
      <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
        <form onSubmit={handleFileUpload} className="p-6 bg-[#0c0f1d] border border-slate-800/80 rounded-xl flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-400" />
            Indexar Nuevo Recurso
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Título del Recurso</label>
            <input
              type="text"
              placeholder="Ej. Lista de Precios"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo de Archivo</label>
            <select
              value={uploadFileType}
              onChange={(e) => setUploadFileType(e.target.value)}
              className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="txt">Texto Plano (.txt)</option>
              <option value="pdf">Documento PDF (.pdf)</option>
              <option value="image">Imagen (.png, .jpg, .jpeg)</option>
              <option value="mp4">Video (.mp4)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Seleccionar Archivo</label>
            <div className="border border-dashed border-slate-800 hover:border-slate-700/80 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition relative bg-slate-950/20">
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadFile(file);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileCode className="h-8 w-8 text-slate-500 mb-2" />
              <span className="text-[10px] text-slate-400 text-center">
                {uploadFile ? uploadFile.name : 'Arrastra un archivo o haz clic'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!uploadFile || uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-650 text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.1)]"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Indexando con Gemini...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Indexar en Biblioteca
              </>
            )}
          </button>
        </form>
      </div>

      {/* Cuadrícula de Recursos */}
      <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 xl:grid-cols-2 gap-6 self-start">
        {kbItems.map((item) => (
          <div key={item.id} className="p-6 bg-[#0c0f1d] border border-slate-800/80 rounded-xl flex flex-col gap-4 relative group">
            <button
              onClick={() => handleDeleteKB(item.id)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 opacity-0 group-hover:opacity-100 transition duration-200"
              title="Eliminar Recurso"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <div className="flex gap-4 items-center">
              <div className={`p-3 rounded-lg border ${
                item.file_type === 'pdf' ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                item.file_type === 'image' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' :
                item.file_type === 'mp4' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              }`}>
                {item.file_type === 'pdf' && <FileText className="h-5 w-5" />}
                {item.file_type === 'image' && <Image className="h-5 w-5" />}
                {item.file_type === 'mp4' && <Video className="h-5 w-5" />}
                {item.file_type === 'txt' && <FileText className="h-5 w-5" />}
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                <p className="text-[10px] text-slate-500 font-mono">Formato: {item.file_type.toUpperCase()}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-900/60 text-xs flex flex-col gap-1.5">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Resumen de Gemini:</p>
              <p className="text-slate-300 leading-relaxed italic">"{item.summary}"</p>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-900 text-xs flex flex-col gap-1.5">
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Datos de RAG Extraídos:</p>
              <pre className="text-slate-405 leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-36">
                {item.content}
              </pre>
            </div>
          </div>
        ))}

        {kbItems.length === 0 && (
          <div className="col-span-2 text-center py-24 text-slate-500 bg-[#0c0f1d] border border-slate-800/80 rounded-xl italic">
            No hay recursos subidos aún. Completa el formulario de la izquierda.
          </div>
        )}
      </div>
    </div>
  );
}
