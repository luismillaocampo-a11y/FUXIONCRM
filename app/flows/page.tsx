'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Panel,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Save, Play, Plus, Trash2, ArrowLeft, Settings, 
  HelpCircle, Calendar, Bot, MessageSquare, AlertCircle, 
  ChevronRight, RefreshCw, Send, Check, X
} from 'lucide-react';
import Link from 'next/link';

// --- COMPONENTES DE NODOS PERSONALIZADOS ---

// 1. NODO DISPARADOR (TRIGGER)
function TriggerNode({ data }: any) {
  return (
    <div className="bg-[#1e1515] border border-orange-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <div className="flex items-center justify-between border-b border-orange-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">⚡ Disparador</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/10">Palabra Clave</span>
      </div>
      <p className="text-xs font-semibold text-slate-300">Cuando el cliente dice:</p>
      <p className="text-xs bg-slate-950/60 p-2 rounded-lg mt-1 text-orange-200 font-mono italic">
        {data.keyword || 'cualquier mensaje entrante'}
      </p>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 2. NODO ENVIAR MENSAJE (MESSAGE)
function MessageNode({ data }: any) {
  return (
    <div className="bg-[#11192a] border border-blue-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">💬 Enviar Mensaje</span>
      </div>
      <p className="text-xs text-slate-400 truncate-3-lines italic">
        {data.message || 'Sin mensaje configurado.'}
      </p>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 3. NODO BOTONES DE SELECCIÓN (INTERACTIVE BUTTONS)
function ButtonsNode({ data }: any) {
  const buttonsList = data.buttons || [];
  
  return (
    <div className="bg-[#11241a] border border-emerald-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">🔘 Botones de Opción</span>
      </div>
      
      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-2">Lista de opciones:</p>
      <div className="space-y-1.5">
        {buttonsList.map((btn: string, idx: number) => (
          <div key={idx} className="relative flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded border border-slate-800 text-xs">
            <span className="text-slate-300">{btn}</span>
            <span className="text-[9px] text-slate-500 font-mono font-bold">#{idx+1}</span>
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`btn-${idx}`} 
              style={{ top: '50%', right: -12 }} 
            />
          </div>
        ))}
        {buttonsList.length === 0 && (
          <p className="text-[10px] text-slate-500 italic">Sin botones agregados.</p>
        )}
      </div>
    </div>
  );
}

// 4. NODO CONDICIÓN LÓGICA (LOGIC JUMP)
function LogicJumpNode({ data }: any) {
  return (
    <div className="bg-[#1e132c] border border-purple-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">🔀 Condición Lógica</span>
      </div>
      <p className="text-xs text-slate-300">
        ¿Cliente tiene etiqueta?:
      </p>
      <div className="inline-block px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-mono mt-1">
        {data.tag || 'ninguna'}
      </div>

      <div className="mt-4 space-y-2 border-t border-purple-500/10 pt-2 text-xs">
        <div className="relative flex justify-between items-center py-0.5">
          <span className="text-emerald-400 font-semibold">Sí, tiene etiqueta</span>
          <Handle type="source" position={Position.Right} id="yes" style={{ top: '25%', right: -12 }} />
        </div>
        <div className="relative flex justify-between items-center py-0.5">
          <span className="text-red-400 font-semibold">No, sin etiqueta</span>
          <Handle type="source" position={Position.Right} id="no" style={{ top: '75%', right: -12 }} />
        </div>
      </div>
    </div>
  );
}

// 5. NODO PROGRAMADOR DE ENTREGA (DELIVERY ENGINE)
function DeliveryEngineNode({ data }: any) {
  // Cálculo dinámico para la previsualización del componente
  const getDeliveryDates = () => {
    const today = new Date();
    
    const d24 = new Date(today);
    d24.setDate(today.getDate() + 1);
    
    const d48 = new Date(today);
    d48.setDate(today.getDate() + 2);

    const options = { weekday: 'short', month: 'short', day: 'numeric' } as const;
    return {
      t24: d24.toLocaleDateString('es-ES', options),
      t48: d48.toLocaleDateString('es-ES', options)
    };
  };

  const dates = getDeliveryDates();

  return (
    <div className="bg-[#242111] border border-yellow-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-yellow-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">🚚 Programar Envío</span>
      </div>
      <p className="text-[10px] text-slate-400 mb-2">Ofrece opciones de entrega dinámicas basadas en la fecha actual:</p>
      
      <div className="space-y-1 text-[11px] font-mono text-yellow-200/90 bg-slate-950/60 p-2 rounded-lg">
        <div className="flex justify-between">
          <span>• Rango 24 Horas:</span>
          <span className="font-bold capitalize">{dates.t24}</span>
        </div>
        <div className="flex justify-between">
          <span>• Rango 48 Horas:</span>
          <span className="font-bold capitalize">{dates.t48}</span>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// Mapeo de tipos de nodo
const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  buttons: ButtonsNode,
  logicJump: LogicJumpNode,
  deliveryEngine: DeliveryEngineNode
};

export default function FlowBuilder() {
  // Lista de flujos
  const [flows, setFlows] = useState<any[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string>('');
  
  // Elementos de React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  
  // Configuración del Elemento seleccionado
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [flowName, setFlowName] = useState('Flujo de Ventas Fuxion Flow');
  const [saveLoading, setSaveLoading] = useState(false);

  // Estado de la Simulación
  const [showSimulator, setShowSimulator] = useState(false);
  const [simMessages, setSimMessages] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [simLeadTags, setSimLeadTags] = useState<string[]>(['interested']); 

  // Carga inicial de los flujos
  const loadFlowsList = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);
      
      if (data.activeFlow) {
        setActiveFlowId(data.activeFlow.id);
        setFlowName(data.activeFlow.name);
        setNodes(data.activeFlow.nodes || []);
        setEdges(data.activeFlow.edges || []);
      } else if (data.flows && data.flows.length > 0) {
        const f = data.flows[0];
        setActiveFlowId(f.id);
        setFlowName(f.name);
        setNodes(f.nodes || []);
        setEdges(f.edges || []);
      }
    } catch (err) {
      console.error('Error al cargar flujos:', err);
    }
  };

  useEffect(() => {
    loadFlowsList();
  }, []);

  // Mantener actualizado el nodo seleccionado
  useEffect(() => {
    if (selectedNode) {
      const node = nodes.find(n => n.id === selectedNode.id);
      if (node) {
        setSelectedNode(node);
      }
    }
  }, [nodes]);

  // Conectar nodos en el canvas
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep', 
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' } 
    }, eds)),
    [setEdges]
  );

  // Clic en un nodo del canvas
  const onNodeClick = useCallback((event: any, node: any) => {
    setSelectedNode(node);
  }, []);

  // Actualizar datos del nodo seleccionado
  const updateNodeData = (newData: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData
            }
          };
        }
        return node;
      })
    );
  };

  // Crear nodo en el canvas
  const addNodeToCanvas = (type: 'trigger' | 'message' | 'buttons' | 'logicJump' | 'deliveryEngine') => {
    const id = `node-${Date.now()}`;
    let label = '';
    let initialData: any = {};

    switch (type) {
      case 'trigger':
        label = 'Disparador Iniciar';
        initialData = { keyword: 'hola, empezar, inicio' };
        break;
      case 'message':
        label = 'Mensaje';
        initialData = { message: 'Gracias por escribirnos. ¿En qué podemos ayudarte?' };
        break;
      case 'buttons':
        label = 'Botones Interactivos';
        initialData = { buttons: ['Ver Productos', 'Consultar Envíos', 'Hablar con Asesor'] };
        break;
      case 'logicJump':
        label = 'Condición de Etiquetas';
        initialData = { tag: 'interested' };
        break;
      case 'deliveryEngine':
        label = 'Programador de Entrega';
        initialData = { format: 'standard' };
        break;
    }

    const newNode = {
      id,
      type,
      position: { x: 100 + Math.random() * 200, y: 150 + Math.random() * 100 },
      data: { label, ...initialData }
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  // Eliminar nodo seleccionado
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  // Guardar flujo en BD
  const handleSaveFlow = async (makeActive: boolean = false) => {
    setSaveLoading(true);
    const flowId = activeFlowId || `flow-${Date.now()}`;
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: flowId,
          name: flowName,
          nodes,
          edges,
          makeActive
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveFlowId(flowId);
        loadFlowsList();
        alert(makeActive ? '¡Flujo activado y publicado!' : '¡Borrador de flujo guardado!');
      } else {
        alert(data.error || 'Error al guardar el flujo');
      }
    } catch (err) {
      console.error(err);
      alert('La petición falló.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Cargar otro flujo seleccionado
  const handleLoadFlow = (flow: any) => {
    setActiveFlowId(flow.id);
    setFlowName(flow.name);
    setNodes(flow.nodes || []);
    setEdges(flow.edges || []);
    setSelectedNode(null);
  };

  // Crear flujo nuevo en blanco
  const handleCreateNewFlow = () => {
    const id = `flow-${Date.now()}`;
    setActiveFlowId(id);
    setFlowName('Flujo de Ventas Fuxion Flow');
    setNodes([
      { id: '1', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Disparador Iniciar', keyword: 'hola, empezar' } }
    ]);
    setEdges([]);
    setSelectedNode(null);
  };

  // --- INTÉRPRETE Y SIMULADOR DE AUTOMATIZACIONES ---
  
  const startSimulation = () => {
    setShowSimulator(true);
    setSimMessages([]);
    
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (triggerNode) {
      setCurrentNodeId(triggerNode.id);
      setSimMessages([
        { sender: 'system', text: `Simulación iniciada. Palabra clave requerida: "${triggerNode.data.keyword}"` }
      ]);
    } else {
      setSimMessages([
        { sender: 'system', text: 'Error: No se encontró ningún elemento Disparador en el lienzo.' }
      ]);
      setCurrentNodeId(null);
    }
  };

  const executeSimulationStep = (nextNodeId: string, inputOrChoiceIndex?: number) => {
    const node = nodes.find(n => n.id === nextNodeId);
    if (!node) {
      setSimMessages(prev => [...prev, { sender: 'system', text: 'Fin del flujo de conversación alcanzado o conexión ausente.' }]);
      setCurrentNodeId(null);
      return;
    }

    setCurrentNodeId(node.id);

    // 1. ENVIAR MENSAJE
    if (node.type === 'message') {
      setSimMessages(prev => [...prev, { sender: 'bot', text: node.data.message }]);
      const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'output');
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1000);
      } else {
        const fallbackEdge = edges.find(e => e.source === node.id); 
        if (fallbackEdge) {
          setTimeout(() => executeSimulationStep(fallbackEdge.target), 1000);
        } else {
          setCurrentNodeId(null);
        }
      }
    }

    // 2. INTERACTIVE BUTTONS
    else if (node.type === 'buttons') {
      setSimMessages(prev => [...prev, { 
        sender: 'bot', 
        text: 'Selecciona una de las siguientes opciones:', 
        options: node.data.buttons || [] 
      }]);
    }

    // 3. LOGIC JUMP
    else if (node.type === 'logicJump') {
      const tagToCheck = node.data.tag || '';
      const hasTag = simLeadTags.includes(tagToCheck);
      
      setSimMessages(prev => [...prev, { 
        sender: 'system', 
        text: `Comprobando etiqueta: "${tagToCheck}". Etiquetas actuales: [${simLeadTags.join(', ')}]. Coincide = ${hasTag ? 'SÍ' : 'NO'}` 
      }]);

      const handleId = hasTag ? 'yes' : 'no';
      const edge = edges.find(e => e.source === node.id && e.sourceHandle === handleId);
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1200);
      } else {
        setSimMessages(prev => [...prev, { sender: 'system', text: `Falta conectar la salida para la ruta "${handleId}"` }]);
        setCurrentNodeId(null);
      }
    }

    // 4. MOTOR DE ENTREGAS
    else if (node.type === 'deliveryEngine') {
      const today = new Date();
      const d24 = new Date(today); d24.setDate(today.getDate() + 1);
      const d48 = new Date(today); d48.setDate(today.getDate() + 2);
      const options = { weekday: 'short', month: 'short', day: 'numeric' } as const;
      
      const t24 = d24.toLocaleDateString('es-ES', options);
      const t48 = d48.toLocaleDateString('es-ES', options);

      setSimMessages(prev => [...prev, { 
        sender: 'bot', 
        text: `Calculamos tus fechas estimadas de envío. Elige el horario conveniente para ti:`,
        options: [`Rango 24 Horas (Entrega el ${t24})`, `Rango 48 Horas (Entrega el ${t48})`]
      }]);
    }
  };

  // Recibir texto del cliente en simulador
  const handleSimSendMessage = (text: string) => {
    if (!text.trim()) return;
    
    setSimMessages(prev => [...prev, { sender: 'customer', text }]);

    if (currentNodeId) {
      const node = nodes.find(n => n.id === currentNodeId);
      
      if (node && node.type === 'trigger') {
        const keywords = (node.data.keyword || '').split(',').map((k: string) => k.trim().toLowerCase());
        const matches = keywords.some((k: string) => text.toLowerCase().includes(k));
        
        if (matches) {
          setSimMessages(prev => [...prev, { sender: 'system', text: '✅ ¡Palabra clave de disparo identificada!' }]);
          const edge = edges.find(e => e.source === node.id);
          if (edge) {
            setTimeout(() => executeSimulationStep(edge.target), 800);
          } else {
            setSimMessages(prev => [...prev, { sender: 'system', text: 'El nodo Disparador no tiene conexiones de salida.' }]);
          }
        } else {
          setSimMessages(prev => [...prev, { sender: 'bot', text: `Error: La frase no coincide con las palabras clave. Intenta escribiendo "${keywords[0] || 'hola'}"` }]);
        }
      } 
      else {
        setSimMessages(prev => [...prev, { sender: 'system', text: 'El bot está esperando que selecciones uno de los botones.' }]);
      }
    } else {
      setSimMessages(prev => [...prev, { sender: 'system', text: 'Haz clic en "Iniciar desde Disparador" abajo para arrancar la conversación.' }]);
    }
  };

  // Clic en las opciones de botón del simulador
  const handleSimChoiceSelect = (choice: string, index: number) => {
    setSimMessages(prev => [...prev, { sender: 'customer', text: choice }]);
    
    if (currentNodeId) {
      const node = nodes.find(n => n.id === currentNodeId);
      
      if (node && node.type === 'buttons') {
        const handleId = `btn-${index}`;
        const edge = edges.find(e => e.source === node.id && e.sourceHandle === handleId);
        
        if (edge) {
          setTimeout(() => executeSimulationStep(edge.target), 800);
        } else {
          setSimMessages(prev => [...prev, { sender: 'system', text: `Conexión ausente para el botón seleccionado: "${choice}"` }]);
          setCurrentNodeId(null);
        }
      } 
      else if (node && node.type === 'deliveryEngine') {
        setSimMessages(prev => [...prev, { 
          sender: 'bot', 
          text: `¡Entendido! Seleccionaste: "${choice}". Registramos tu solicitud.` 
        }]);
        
        const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'output');
        if (edge) {
          setTimeout(() => executeSimulationStep(edge.target), 1000);
        } else {
          setCurrentNodeId(null);
        }
      }
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full relative">
      {/* Panel del Lienzo del Creador de Flujos */}
      <div className="flex-1 flex flex-col h-full bg-[#080a14] relative">
        {/* Barra superior de controles */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-[#0c0f1d] shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Atrás al Dashboard
            </Link>
            <div className="flex flex-col">
              <input
                type="text"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white focus:outline-none border-b border-transparent focus:border-slate-700"
              />
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Espacio de trabajo activo</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => startSimulation()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 transition"
            >
              <Play className="h-3.5 w-3.5" />
              Simular Flujo
            </button>
            <button
              onClick={() => handleSaveFlow(false)}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition"
            >
              <Save className="h-3.5 w-3.5 text-slate-400" />
              Guardar borrador
            </button>
            <button
              onClick={() => handleSaveFlow(true)}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
            >
              <Save className="h-3.5 w-3.5" />
              Activar Flujo
            </button>
          </div>
        </header>

        {/* Lienzo del Lienzo de React Flow */}
        <div className="flex-1 w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls className="!bg-slate-900 !border-slate-800 !text-white !fill-white" />
            <MiniMap className="!bg-slate-950/90 !border-slate-800" nodeColor={() => '#1e293b'} />
            <Background color="#334155" gap={16} size={1} />
            
            {/* Panel de Elementos a Agregar */}
            <Panel position="top-left" className="bg-[#0c0f1d]/90 border border-slate-800 p-4 rounded-xl shadow-2xl flex flex-col gap-2.5 z-10 w-52 backdrop-blur">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-850 pb-1.5">Agregar Elementos</h4>
              
              <button
                onClick={() => addNodeToCanvas('trigger')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-orange-400 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded-lg transition"
              >
                <span className="text-base">⚡</span>
                Disparador
              </button>

              <button
                onClick={() => addNodeToCanvas('message')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg transition"
              >
                <span className="text-base">💬</span>
                Enviar Mensaje
              </button>

              <button
                onClick={() => addNodeToCanvas('buttons')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition"
              >
                <span className="text-base">🔘</span>
                Botones
              </button>

              <button
                onClick={() => addNodeToCanvas('logicJump')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 rounded-lg transition"
              >
                <span className="text-base">🔀</span>
                Condición Lógica
              </button>

              <button
                onClick={() => addNodeToCanvas('deliveryEngine')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/20 rounded-lg transition"
              >
                <span className="text-base">🚚</span>
                Programar Envío
              </button>
            </Panel>

            {/* Listado de Flujos Guardados */}
            <Panel position="top-right" className="bg-[#0c0f1d]/90 border border-slate-800 p-3 rounded-xl shadow-2xl flex gap-2 items-center z-10 backdrop-blur">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Flujos del Sistema:</span>
              <div className="flex gap-1">
                {flows.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => handleLoadFlow(f)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      activeFlowId === f.id 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border border-transparent hover:text-slate-200'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
                <button
                  onClick={handleCreateNewFlow}
                  className="px-2 py-1 bg-slate-850 hover:bg-slate-800 rounded border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 text-xs"
                >
                  + Nuevo
                </button>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Editor de Propiedades del Nodo (Barra Lateral Derecha) */}
      {selectedNode && (
        <div className="w-80 border-l border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0 z-10 relative">
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Configuración del Elemento</h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ID del Elemento:</span>
              <p className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-900 mt-1">{selectedNode.id}</p>
            </div>

            {/* CONFIGURACIÓN DISPARADOR */}
            {selectedNode.type === 'trigger' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Palabras Clave de Disparo</label>
                  <p className="text-[10px] text-slate-500 leading-normal mb-1">Palabras clave separadas por comas que inician el flujo automático (ej. hola, ayuda, comenzar).</p>
                  <input
                    type="text"
                    value={selectedNode.data.keyword || ''}
                    onChange={(e) => updateNodeData({ keyword: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN ENVIAR MENSAJE */}
            {selectedNode.type === 'message' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Texto del Mensaje</label>
                  <textarea
                    rows={6}
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateNodeData({ message: e.target.value })}
                    placeholder="Escribe el mensaje de WhatsApp que recibirá el cliente..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN BOTONES */}
            {selectedNode.type === 'buttons' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Botones Interactivos</label>
                  <p className="text-[10px] text-slate-500 leading-normal mb-2">Cada opción creará un conector de salida independiente en el nodo del lienzo.</p>
                  
                  <div className="space-y-2">
                    {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={btn}
                          onChange={(e) => {
                            const newBtns = [...selectedNode.data.buttons];
                            newBtns[index] = e.target.value;
                            updateNodeData({ buttons: newBtns });
                          }}
                          className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                        />
                        <button
                          onClick={() => {
                            const newBtns = selectedNode.data.buttons.filter((_: any, i: number) => i !== index);
                            updateNodeData({ buttons: newBtns });
                          }}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded border border-transparent hover:border-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    <button
                      onClick={() => {
                        const newBtns = [...(selectedNode.data.buttons || []), `Nueva Opción`];
                        updateNodeData({ buttons: newBtns });
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-800 hover:border-slate-750 hover:bg-slate-900/40 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-300 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Agregar Opción de Botón
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN CONDICIÓN LÓGICA */}
            {selectedNode.type === 'logicJump' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validación de Etiqueta</label>
                  <p className="text-[10px] text-slate-500 leading-normal mb-1">Si el cliente posee esta etiqueta en el CRM, el flujo seguirá el conector "Sí, tiene etiqueta", de lo contrario irá al conector "No".</p>
                  <input
                    type="text"
                    value={selectedNode.data.tag || ''}
                    onChange={(e) => updateNodeData({ tag: e.target.value })}
                    placeholder="Ej. VIP, caliente, promo"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN PROGRAMADOR DE ENTREGA */}
            {selectedNode.type === 'deliveryEngine' && (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lógica del Programador de Entrega</label>
                  <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-xs space-y-2 text-slate-300 leading-relaxed">
                    <p className="font-semibold text-yellow-400 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-yellow-400" />
                      Cálculo de Fechas Automático
                    </p>
                    <p>Este elemento calcula las fechas sugeridas de envío según el día real de la consulta del cliente:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                      <li>Entrega 24h: <code className="text-[10px] text-slate-200">Fecha Actual + 1 día</code></li>
                      <li>Entrega 48h: <code className="text-[10px] text-slate-200">Fecha Actual + 2 días</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botón de eliminación */}
          <div className="p-4 border-t border-slate-850 bg-slate-950/20">
            <button
              onClick={deleteSelectedNode}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar Elemento
            </button>
          </div>
        </div>
      )}

      {/* MODAL DEL SIMULADOR DE FLUJOS (SOBRE LIENZO) */}
      {showSimulator && (
        <div className="w-96 border-l border-slate-800 bg-[#0c0f1d] flex flex-col h-full shrink-0 absolute right-0 top-0 shadow-2xl z-20 animate-slide-in">
          {/* Cabecera */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">Simulador de Conversación</h3>
                <p className="text-[9px] text-slate-500">Prueba la lógica visual del lienzo en tiempo real</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowSimulator(false);
                setCurrentNodeId(null);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Variables de etiquetas */}
          <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Etiquetas simuladas del Cliente:</span>
              <span className="text-[9px] text-slate-500">(Alternar para bifurcar condiciones)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {['VIP', 'interested', 'hot-lead'].map((tag) => {
                const has = simLeadTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      if (has) setSimLeadTags(prev => prev.filter(t => t !== tag));
                      else setSimLeadTags(prev => [...prev, tag]);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                      has 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow' 
                        : 'bg-slate-800 text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Log de Chat */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0c16]">
            {simMessages.map((msg, index) => (
              <div key={index} className="flex flex-col">
                {msg.sender === 'system' ? (
                  <div className="mx-auto my-1.5 px-3 py-1 rounded bg-slate-900 border border-slate-800/80 text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-slate-500" />
                    {msg.text}
                  </div>
                ) : (
                  <div className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'customer' ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}>
                    <span className="text-[9px] text-slate-500 capitalize mb-1 px-1">{msg.sender === 'customer' ? 'Cliente' : 'Asistente'}</span>
                    <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      msg.sender === 'customer' 
                        ? 'bg-slate-800 text-slate-200 rounded-tr-none border border-slate-700/50' 
                        : 'bg-emerald-600/15 text-emerald-100 rounded-tl-none border border-emerald-500/20'
                    }`}>
                      {msg.text}
                    </div>

                    {/* Botones Interactivos de Opción en el simulador */}
                    {msg.options && (
                      <div className="mt-2.5 flex flex-col gap-1.5 w-full">
                        {msg.options.map((opt: string, optIdx: number) => (
                          <button
                            key={optIdx}
                            onClick={() => handleSimChoiceSelect(opt, optIdx)}
                            className="w-full text-left px-3 py-2 bg-slate-950/80 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-400 border border-slate-850 hover:border-emerald-500/30 rounded-lg text-xs font-semibold transition flex justify-between items-center"
                          >
                            <span>{opt}</span>
                            <ChevronRight className="h-3 w-3 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Caja de entrada del simulador */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2">
            {currentNodeId && nodes.find(n => n.id === currentNodeId)?.type === 'trigger' && (
              <div className="p-2.5 bg-orange-500/5 border border-orange-500/10 rounded-lg text-[10px] text-orange-400/90 leading-relaxed mb-1">
                💡 Escribe un mensaje que contenga la palabra clave del disparador para iniciar la secuencia de conversación.
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Responder al simulador..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSimSendMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={() => startSimulation()}
                className="px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                title="Reiniciar Simulación"
              >
                Reset
              </button>
            </div>
            
            <button
              onClick={() => {
                const trigger = nodes.find(n => n.type === 'trigger');
                if (trigger) {
                  executeSimulationStep(trigger.id);
                }
              }}
              className="w-full py-1.5 border border-dashed border-slate-800 hover:border-blue-500/20 hover:bg-blue-500/5 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-blue-400 transition"
            >
              🚀 Forzar inicio sin validar Disparador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
