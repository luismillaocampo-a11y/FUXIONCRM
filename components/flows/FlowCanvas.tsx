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
  MarkerType,
  ReactFlowProvider,
  useReactFlow
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
      <p className="text-xs text-slate-400 whitespace-pre-wrap italic">
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
            <span className="text-[9px] text-slate-500 font-mono font-bold">#{idx + 1}</span>
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

// 6. NODO ESPERAR (WAIT DELAY)
function WaitDelayNode({ data }: any) {
  return (
    <div className="bg-[#2a1b11] border border-amber-600/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-amber-600/20 pb-2 mb-2">
        <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">⏳ Esperar</span>
      </div>
      <p className="text-xs font-semibold text-slate-300">Pausar flujo por:</p>
      <p className="text-xs bg-slate-950/60 p-2 rounded-lg mt-1 text-amber-300 font-mono">
        {data.delayHours || '24'} horas
      </p>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 7. NODO ENVIAR CUPÓN (COUPON)
function CouponNode({ data }: any) {
  return (
    <div className="bg-[#241118] border border-rose-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">🎁 Cupón Promocional</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between bg-slate-950/60 p-1.5 rounded">
          <span className="text-slate-400">Código:</span>
          <span className="font-mono font-bold text-rose-300">{data.code || 'FUXION10'}</span>
        </div>
        <div className="flex justify-between bg-slate-950/60 p-1.5 rounded">
          <span className="text-slate-400">Validez:</span>
          <span className="text-rose-300">{data.expiryHours || '48'} horas</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 8. NODO CAMBIAR ESTADO (UPDATE STATUS)
function UpdateStatusNode({ data }: any) {
  const translateStatus = (status: string) => {
    switch (status) {
      case 'New': return 'Nuevo/Prospecto';
      case 'Engaged': return 'Interactuando/info enviada';
      case 'Pending Verification': return 'Esperando pago';
      case 'Converted': return 'Venta Confirmada';
      case 'Por Registrar en Web': return 'Registrar en Web/Por Despachar';
      default: return status;
    }
  };

  return (
    <div className="bg-[#111c2a] border border-cyan-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">📊 Cambiar Estado</span>
      </div>
      <p className="text-xs font-semibold text-slate-300">Nuevo estado en CRM:</p>
      <p className="text-xs bg-slate-950/60 p-2 rounded-lg mt-1 text-cyan-300 font-bold">
        {translateStatus(data.status || 'Engaged')}
      </p>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 9. NODO ALERTAR AGENTE (ALERT AGENT)
function AlertAgentNode({ data }: any) {
  return (
    <div className="bg-[#241111] border border-red-500/40 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-red-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">🔔 Alerta al Agente</span>
      </div>
      <p className="text-xs text-slate-400 truncate italic">
        {data.message || 'Enviar alerta de atención manual'}
      </p>
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
}

// 10. NODO ACCIÓN DE IA (GEMINI PROMPT OVERRIDE)
function AiActionNode({ data }: any) {
  return (
    <div className="bg-[#1a1528] border border-violet-500/50 rounded-xl p-4 w-60 shadow-lg text-slate-200">
      <Handle type="target" position={Position.Top} id="input" />
      <div className="flex items-center justify-between border-b border-violet-500/20 pb-2 mb-2">
        <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1">
          🤖 Acción de IA
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono font-bold">Gemini</span>
      </div>
      <p className="text-[10px] text-slate-400 font-semibold mb-1">Instrucción / Prompt:</p>
      <p className="text-xs text-slate-300 bg-slate-950/70 p-2 rounded-lg italic line-clamp-3 border border-slate-900">
        {data.prompt || 'Responder dudas usando la Base de Conocimientos...'}
      </p>
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
  deliveryEngine: DeliveryEngineNode,
  waitDelay: WaitDelayNode,
  coupon: CouponNode,
  updateStatus: UpdateStatusNode,
  alertAgent: AlertAgentNode,
  aiAction: AiActionNode
};

// Componente auxiliar para evitar pérdida de cursor y scroll en áreas de texto controladas
function ControlledTextArea({
  value,
  onChange,
  placeholder,
  className,
  rows = 12
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    onChange(val);
  };

  return (
    <textarea
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      rows={rows}
    />
  );
}

function FlowBuilder() {
  const { getViewport, screenToFlowPosition } = useReactFlow();

  // Muted Light Mode state observer
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains('light');
      setIsLightMode(isL);
    };
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Lista de flujos
  const [flows, setFlows] = useState<any[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string>('');
  const [systemActiveFlowId, setSystemActiveFlowId] = useState<string>('');

  // Elementos de React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // Configuración del Elemento seleccionado
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [flowName, setFlowName] = useState('Flujo de Ventas FUXION CRM');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const messageTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Estado de la Simulación
  const [showSimulator, setShowSimulator] = useState(false);
  const [simMessages, setSimMessages] = useState<any[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [simLeadTags, setSimLeadTags] = useState<string[]>(['interested']);

  // Carga de los flujos
  const loadFlowsList = async (setEditorState = false) => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);

      if (data.activeFlow) {
        setSystemActiveFlowId(data.activeFlow.id);
        if (setEditorState) {
          setActiveFlowId(data.activeFlow.id);
          setFlowName(data.activeFlow.name);
          setNodes(data.activeFlow.nodes || []);
          setEdges(data.activeFlow.edges || []);
        }
      } else {
        setSystemActiveFlowId('');
        if (setEditorState && data.flows && data.flows.length > 0) {
          const f = data.flows[0];
          setActiveFlowId(f.id);
          setFlowName(f.name);
          setNodes(f.nodes || []);
          setEdges(f.edges || []);
        }
      }
    } catch (err) {
      console.error('Error al cargar flujos:', err);
    }
  };

  useEffect(() => {
    loadFlowsList(true);
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
  const addNodeToCanvas = (type: 'trigger' | 'message' | 'buttons' | 'logicJump' | 'deliveryEngine' | 'waitDelay' | 'coupon' | 'updateStatus' | 'alertAgent' | 'aiAction') => {
    const id = `node-${Date.now()}`;
    let label = '';
    let initialData: any = {};

    switch (type) {
      case 'trigger':
        label = 'Disparador Iniciar';
        initialData = { keyword: 'hola, empezar, inicio, menu' };
        break;
      case 'message':
        label = 'Mensaje';
        initialData = { message: '¡Hola! Bienvenido a Fuxion Perú. ¿Te gustaría conocer sobre nuestro té termogénico Thermo T3 o nuestra bebida digestiva Prunex1?' };
        break;
      case 'buttons':
        label = 'Botones Interactivos';
        initialData = { buttons: ['Información de Productos', 'Tiempos de Envío', 'Hablar con Asesor'] };
        break;
      case 'logicJump':
        label = 'Condición de Etiquetas';
        initialData = { tag: 'interested' };
        break;
      case 'deliveryEngine':
        label = 'Programador de Entrega';
        initialData = { format: 'standard' };
        break;
      case 'waitDelay':
        label = 'Esperar';
        initialData = { delayHours: 24, message: 'Hola, te escribimos para hacer un seguimiento de tu consulta sobre Fuxion Perú. ¿Te quedó alguna duda sobre el Thermo T3 o el Prunex1? 😊' };
        break;
      case 'coupon':
        label = 'Cupón Promocional';
        initialData = { code: 'FUXION10', product: 'Thermo T3 o Prunex1', expiryHours: 48, message: '🎁 *¡Oferta exclusiva para ti!*\n\nComo parte de nuestra comunidad Fuxion Perú, tienes acceso a un descuento especial en *Thermo T3 o Prunex1*.\n\n🏷️ Usa el código: *FUXION10*\n⏰ Válido por las próximas 48 horas.\n\n¡Escríbenos ahora para aprovechar esta oferta! 🔥' };
        break;
      case 'updateStatus':
        label = 'Cambiar Estado';
        initialData = { status: 'Engaged' };
        break;
      case 'alertAgent':
        label = 'Alerta al Agente';
        initialData = { message: '⚠️ Un cliente en WhatsApp requiere atención manual sobre Thermo T3 / Prunex1.' };
        break;
      case 'aiAction':
        label = 'Acción de IA (Gemini)';
        initialData = { prompt: 'Actúa como un Asesor Nutricional experto de Fuxion Perú. Saluda con empatía, consulta el malestar principal del cliente y recomiéndale Prunex 1 o Thermo T3 usando la Base de Conocimientos (máximo 35 palabras).' };
        break;
    }

    let posX = 250;
    let posY = 200;

    if (typeof window !== 'undefined') {
      try {
        if (screenToFlowPosition) {
          const center = screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          });
          posX = center.x - 120;
          posY = center.y - 60;
        } else {
          const { x: viewX, y: viewY, zoom } = getViewport();
          const width = window.innerWidth || 1024;
          const height = window.innerHeight || 768;
          posX = (-viewX + (width / 2) - 120) / zoom;
          posY = (-viewY + (height / 2) - 60) / zoom;
        }
      } catch (err) {
        const { x: viewX, y: viewY, zoom } = getViewport();
        const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const height = typeof window !== 'undefined' ? window.innerHeight : 768;
        posX = (-viewX + (width / 2) - 120) / (zoom || 1);
        posY = (-viewY + (height / 2) - 60) / (zoom || 1);
      }
    }

    const newNode = {
      id,
      type,
      position: { x: posX, y: posY },
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
  const handleSaveFlow = async (makeActive?: boolean) => {
    setSaveLoading(true);
    setSaveError(null);
    try {
      const flowId = activeFlowId || `flow-${Date.now()}`;
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: flowId,
          name: flowName,
          nodes,
          edges,
          ...(makeActive !== undefined && { makeActive })
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveFlowId(flowId);
        if (makeActive === true) {
          setSystemActiveFlowId(flowId);
        } else if (makeActive === false) {
          setSystemActiveFlowId('');
        }
        loadFlowsList(false);
        setShowSaveSuccess(true);
        setTimeout(() => {
          setShowSaveSuccess(false);
        }, 3000);
      } else {
        setSaveError(data.error || 'Error al guardar el flujo');
      }
    } catch (err) {
      console.error(err);
      setSaveError('La petición falló.');
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
    setFlowName('Flujo de Ventas FUXION CRM');
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

    // 5. NODO ESPERAR (WAIT DELAY)
    else if (node.type === 'waitDelay') {
      const delay = node.data.delayHours || 24;
      setSimMessages(prev => [...prev, {
        sender: 'system',
        text: `⏳ [CRM] Temporizador de seguimiento programado por ${delay} horas.`
      }]);
      if (node.data.message) {
        setSimMessages(prev => [...prev, {
          sender: 'system',
          text: `📝 [CRM] Mensaje de seguimiento configurado: "${node.data.message}"`
        }]);
      }
      
      const edge = edges.find(e => e.source === node.id);
      if (edge) {
        setSimMessages(prev => [...prev, { sender: 'system', text: `⌛ Simulando expiración de tiempo... reanudando flujo.` }]);
        setTimeout(() => executeSimulationStep(edge.target), 1500);
      } else {
        setCurrentNodeId(null);
      }
    }

    // 6. NODO CUPÓN (COUPON)
    else if (node.type === 'coupon') {
      const code = node.data.code || 'FUXION10';
      const product = node.data.product || 'Thermo T3';
      const expiry = node.data.expiryHours || 48;
      const text = node.data.message || `¡Aquí tienes tu cupón de descuento del 10% en tu ${product}! Código: ${code} (Válido por ${expiry} horas)`;
      
      setSimMessages(prev => [...prev, {
        sender: 'bot',
        text
      }]);

      const edge = edges.find(e => e.source === node.id);
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1200);
      } else {
        setCurrentNodeId(null);
      }
    }

    // 7. NODO CAMBIAR ESTADO (UPDATE STATUS)
    else if (node.type === 'updateStatus') {
      const rawStatus = node.data.status || 'Engaged';
      const statusLabels: Record<string, string> = {
        'New': 'Nuevo/Prospecto',
        'Engaged': 'Interactuando/info enviada',
        'Pending Verification': 'Esperando pago',
        'Por Registrar en Web': 'Por Registrar en Web/Por Despachar',
        'Converted': 'Venta Confirmada'
      };
      const readable = statusLabels[rawStatus] || rawStatus;

      setSimMessages(prev => [...prev, {
        sender: 'system',
        text: `📊 [CRM] Estado del lead actualizado a: "${readable}"`
      }]);

      const edge = edges.find(e => e.source === node.id);
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1000);
      } else {
        setCurrentNodeId(null);
      }
    }

    // 8. NODO ALERTA AL AGENTE (ALERT AGENT)
    else if (node.type === 'alertAgent') {
      const alertMsg = node.data.message || 'El cliente tiene dudas con el pago de su Thermo T3.';
      setSimMessages(prev => [...prev, {
        sender: 'system',
        text: `🔔 [CRM] Alerta enviada al Agente: "${alertMsg}"`
      }]);

      const edge = edges.find(e => e.source === node.id);
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1000);
      } else {
        setCurrentNodeId(null);
      }
    }

    // 9. NODO ACCIÓN DE IA (GEMINI PROMPT OVERRIDE)
    else if (node.type === 'aiAction') {
      setSimMessages(prev => [...prev, {
        sender: 'bot',
        text: `🤖 [IA Gemini]: "¡Hola! Con mucho gusto te asesoro. Para combatir la pesadez digestiva de forma natural, te recomiendo el Prunex 1 de Fuxion. ¿Te gustaría coordinar el envío a tu dirección hoy mismo?"`
      }]);

      const edge = edges.find(e => e.source === node.id);
      if (edge) {
        setTimeout(() => executeSimulationStep(edge.target), 1200);
      } else {
        setCurrentNodeId(null);
      }
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

  // Componente de renderizado personalizado para los nodos en el minimapa (Miniatura Realista)
  const CustomMiniMapNode = useCallback(({ x, y, width, height, selected, id }: any) => {
    const node = nodes.find((n: any) => n.id === id);
    if (!node) {
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill="#0f172a"
          stroke="#1e293b"
          strokeWidth={1}
        />
      );
    }

    let bg = isLightMode ? '#ffffff' : '#0f172a';
    let stroke = isLightMode ? '#aacbcb' : '#1e293b';
    let icon = '';
    let title = '';

    switch (node.type) {
      case 'trigger':
        bg = isLightMode ? '#fff7ed' : '#1e1515';
        stroke = isLightMode ? '#f97316' : 'rgba(249, 115, 22, 0.4)';
        icon = '⚡';
        title = 'Disparador';
        break;
      case 'message':
        bg = isLightMode ? '#eff6ff' : '#11192a';
        stroke = isLightMode ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)';
        icon = '💬';
        title = 'Mensaje';
        break;
      case 'buttons':
        bg = isLightMode ? '#f0fdf4' : '#11241a';
        stroke = isLightMode ? '#10b981' : 'rgba(16, 185, 129, 0.4)';
        icon = '🔘';
        title = 'Botones';
        break;
      case 'logicJump':
        bg = isLightMode ? '#faf5ff' : '#1e132c';
        stroke = isLightMode ? '#a855f7' : 'rgba(168, 85, 247, 0.4)';
        icon = '🔀';
        title = 'Condición';
        break;
      case 'deliveryEngine':
        bg = isLightMode ? '#fefce8' : '#242111';
        stroke = isLightMode ? '#eab308' : 'rgba(234, 179, 8, 0.4)';
        icon = '🚚';
        title = 'Envío';
        break;
      case 'waitDelay':
        bg = isLightMode ? '#fffbeb' : '#2a1b11';
        stroke = isLightMode ? '#f59e0b' : 'rgba(217, 119, 6, 0.4)';
        icon = '⏳';
        title = 'Esperar';
        break;
      case 'coupon':
        bg = isLightMode ? '#fff1f2' : '#241118';
        stroke = isLightMode ? '#f43f5e' : 'rgba(244, 63, 94, 0.4)';
        icon = '🎁';
        title = 'Cupón';
        break;
      case 'updateStatus':
        bg = isLightMode ? '#f0f9ff' : '#111c2a';
        stroke = isLightMode ? '#06b6d4' : 'rgba(6, 182, 212, 0.4)';
        icon = '📊';
        title = 'Estado';
        break;
      case 'alertAgent':
        bg = isLightMode ? '#fef2f2' : '#241111';
        stroke = isLightMode ? '#ef4444' : 'rgba(239, 68, 68, 0.4)';
        icon = '🔔';
        title = 'Alerta';
        break;
      case 'aiAction':
        bg = isLightMode ? '#f3e8ff' : '#1a1528';
        stroke = isLightMode ? '#8b5cf6' : 'rgba(139, 92, 246, 0.4)';
        icon = '🤖';
        title = 'Acción IA';
        break;
    }

    const strokeColor = selected ? (isLightMode ? stroke : stroke.replace('0.4', '1')) : stroke;
    const strokeWidth = selected ? 2.5 : 1.5;

    return (
      <g>
        {/* Fondo y borde del nodo */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill={bg}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />

        {/* Encabezado del nodo (Icono + Título) */}
        <text
          x={x + 8}
          y={y + 18}
          fill={selected ? '#ffffff' : '#cbd5e1'}
          fontSize={9}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {icon} {title}
        </text>

        {/* Divisor de encabezado */}
        <line
          x1={x + 8}
          y1={y + 24}
          x2={x + width - 8}
          y2={y + 24}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray="2,2"
        />

        {/* Previsualización del contenido del nodo */}
        {node.type === 'trigger' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={14} rx={3} fill="rgba(249, 115, 22, 0.05)" stroke="rgba(249, 115, 22, 0.2)" strokeWidth={0.5} />
            <text x={x + 12} y={y + 40} fill="rgba(249, 115, 22, 0.8)" fontSize={7} fontFamily="monospace" fontWeight="bold">
              {node.data.keyword ? (node.data.keyword.substring(0, 18) + (node.data.keyword.length > 18 ? '...' : '')) : 'palabra clave'}
            </text>
          </g>
        )}

        {node.type === 'message' && (
          <g>
            <rect x={x + 8} y={y + 32} width={width - 16} height={4} rx={1.5} fill="rgba(255,255,255,0.08)" />
            <rect x={x + 8} y={y + 40} width={width - 32} height={4} rx={1.5} fill="rgba(255,255,255,0.08)" />
            <rect x={x + 8} y={y + 48} width={width - 24} height={4} rx={1.5} fill="rgba(255,255,255,0.08)" />
          </g>
        )}

        {node.type === 'buttons' && (
          <g>
            {(node.data.buttons || []).slice(0, 3).map((btn: string, idx: number) => (
              <rect
                key={idx}
                x={x + 8}
                y={y + 30 + (idx * 11)}
                width={width - 16}
                height={8}
                rx={2}
                fill="rgba(16, 185, 129, 0.05)"
                stroke="rgba(16, 185, 129, 0.15)"
                strokeWidth={0.5}
              />
            ))}
          </g>
        )}

        {node.type === 'logicJump' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={11} rx={2.5} fill="rgba(168, 85, 247, 0.05)" stroke="rgba(168, 85, 247, 0.15)" strokeWidth={0.5} />
            <text x={x + 11} y={y + 38} fill="rgba(168, 85, 247, 0.8)" fontSize={6} fontFamily="sans-serif">
              Etiqueta: {node.data.tag || 'ninguna'}
            </text>
            <rect x={x + 8} y={y + 45} width={(width - 20) / 2} height={7} rx={1.5} fill="rgba(16, 185, 129, 0.12)" />
            <rect x={x + 12 + (width - 20) / 2} y={y + 45} width={(width - 20) / 2} height={7} rx={1.5} fill="rgba(239, 68, 68, 0.12)" />
          </g>
        )}

        {node.type === 'deliveryEngine' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={9} rx={2} fill="rgba(234, 179, 8, 0.05)" />
            <rect x={x + 12} y={y + 33} width={10} height={3} rx={0.5} fill="rgba(234, 179, 8, 0.3)" />
            <rect x={x + 26} y={y + 33} width={width - 38} height={3} rx={0.5} fill="rgba(234, 179, 8, 0.15)" />

            <rect x={x + 8} y={y + 42} width={width - 16} height={9} rx={2} fill="rgba(234, 179, 8, 0.05)" />
            <rect x={x + 12} y={y + 45} width={10} height={3} rx={0.5} fill="rgba(234, 179, 8, 0.3)" />
            <rect x={x + 26} y={y + 45} width={width - 38} height={3} rx={0.5} fill="rgba(234, 179, 8, 0.15)" />
          </g>
        )}

        {node.type === 'waitDelay' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={14} rx={3} fill="rgba(217, 119, 6, 0.05)" stroke="rgba(217, 119, 6, 0.2)" strokeWidth={0.5} />
            <text x={x + 12} y={y + 40} fill="rgba(217, 119, 6, 0.8)" fontSize={7} fontFamily="monospace" fontWeight="bold">
              {node.data.delayHours || '24'} horas
            </text>
          </g>
        )}

        {node.type === 'coupon' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={14} rx={3} fill="rgba(244, 63, 94, 0.05)" stroke="rgba(244, 63, 94, 0.2)" strokeWidth={0.5} />
            <text x={x + 12} y={y + 40} fill="rgba(244, 63, 94, 0.8)" fontSize={7} fontFamily="monospace" fontWeight="bold">
              {node.data.code || 'FUXION10'}
            </text>
          </g>
        )}

        {node.type === 'updateStatus' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={14} rx={3} fill="rgba(6, 182, 212, 0.05)" stroke="rgba(6, 182, 212, 0.2)" strokeWidth={0.5} />
            <text x={x + 12} y={y + 40} fill="rgba(6, 182, 212, 0.8)" fontSize={7} fontFamily="sans-serif" fontWeight="bold">
              {node.data.status || 'Engaged'}
            </text>
          </g>
        )}

        {node.type === 'alertAgent' && (
          <g>
            <rect x={x + 8} y={y + 30} width={width - 16} height={14} rx={3} fill="rgba(239, 68, 68, 0.05)" stroke="rgba(239, 68, 68, 0.2)" strokeWidth={0.5} />
            <text x={x + 12} y={y + 40} fill="rgba(239, 68, 68, 0.8)" fontSize={6} fontFamily="sans-serif" fontWeight="bold">
              {node.data.message ? (node.data.message.substring(0, 18) + '...') : 'Alerta'}
            </text>
          </g>
        )}
      </g>
    );
  }, [nodes]);

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
            {showSaveSuccess && (
              <span className="text-xs font-semibold text-emerald-400 transition-all animate-pulse duration-300">
                ¡Cambio exitoso!
              </span>
            )}
            <button
              onClick={() => startSimulation()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 transition"
            >
              <Play className="h-3.5 w-3.5" />
              Simular Flujo
            </button>
            <button
              onClick={() => handleSaveFlow()}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-500 text-white border border-slate-700 transition"
            >
              <Save className="h-3.5 w-3.5 text-slate-400" />
              Guardar Cambios
            </button>
            <button
              onClick={() => handleSaveFlow(activeFlowId !== systemActiveFlowId)}
              disabled={saveLoading}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white transition-all ${activeFlowId === systemActiveFlowId
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_12px_rgba(16,185,129,0.15)]'
                : 'bg-gray-500 hover:bg-gray-600 shadow-[0_4px_12px_rgba(107,114,128,0.15)]'
                }`}
            >
              <Save className="h-3.5 w-3.5" />
              {activeFlowId === systemActiveFlowId ? 'Flujo Activo' : 'Activar Flujo'}
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
            deleteKeyCode={['Delete', 'Backspace']}
            fitView
            colorMode={isLightMode ? 'light' : 'dark'}
          >
            <Controls
              style={{
                backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                border: isLightMode ? '1px solid #aacbcb' : '1px solid #1e293b',
                borderRadius: '8px',
                boxShadow: isLightMode ? '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                ['--xy-controls-button-background' as any]: isLightMode ? '#ffffff' : '#0f172a',
                ['--xy-controls-button-background-hover' as any]: isLightMode ? '#f1f5f9' : '#1e293b',
                ['--xy-controls-button-color' as any]: isLightMode ? '#475569' : '#94a3b8',
                ['--xy-controls-button-color-hover' as any]: isLightMode ? '#0f172a' : '#f8fafc',
                ['--xy-controls-border-color' as any]: 'transparent',
              }}
            />
            <MiniMap
              style={{
                backgroundColor: isLightMode ? '#ffffff' : '#0f172a',
                border: isLightMode ? '1px solid #aacbcb' : '1px solid #1e293b',
                borderRadius: '8px',
                boxShadow: isLightMode ? '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
              }}
              nodeColor={() => '#f59e0b'}
              maskColor={isLightMode ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.6)'}
              nodeComponent={CustomMiniMapNode}
            />
            <Background color={isLightMode ? '#9cc6c6' : '#334155'} gap={16} size={1} />

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
                onClick={() => addNodeToCanvas('aiAction')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg transition font-semibold"
              >
                <span className="text-base">🤖</span>
                Acción de IA (Gemini)
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

              <button
                onClick={() => addNodeToCanvas('waitDelay')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-lg transition"
              >
                <span className="text-base">⏳</span>
                Esperar (Delay)
              </button>

              <button
                onClick={() => addNodeToCanvas('coupon')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition"
              >
                <span className="text-base">🎁</span>
                Cupón Promocional
              </button>

              <button
                onClick={() => addNodeToCanvas('updateStatus')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition"
              >
                <span className="text-base">📊</span>
                Cambiar Estado
              </button>

              <button
                onClick={() => addNodeToCanvas('alertAgent')}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition"
              >
                <span className="text-base">🔔</span>
                Alerta al Agente
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
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${activeFlowId === f.id
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
                  <ControlledTextArea
                    rows={12}
                    value={selectedNode.data.message || ''}
                    onChange={(val) => updateNodeData({ message: val })}
                    placeholder="Escribe el mensaje de WhatsApp que recibirá el cliente..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 font-sans leading-relaxed"
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

            {/* CONFIGURACIÓN ESPERAR (WAIT DELAY) */}
            {selectedNode.type === 'waitDelay' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horas de Espera</label>
                  <input
                    type="number"
                    value={selectedNode.data.delayHours || 24}
                    onChange={(e) => updateNodeData({ delayHours: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensaje de Seguimiento</label>
                  <p className="text-[9px] text-slate-500">Este mensaje se enviará automáticamente por WhatsApp una vez cumplido el tiempo.</p>
                  <ControlledTextArea
                    rows={8}
                    value={selectedNode.data.message || ''}
                    onChange={(val) => updateNodeData({ message: val })}
                    placeholder="Mensaje de seguimiento..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 font-sans leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN ENVIAR CUPÓN (COUPON) */}
            {selectedNode.type === 'coupon' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Código del Cupón</label>
                  <input
                    type="text"
                    value={selectedNode.data.code || ''}
                    onChange={(e) => updateNodeData({ code: e.target.value })}
                    placeholder="Ej. FUXION10"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Producto Destacado</label>
                  <input
                    type="text"
                    value={selectedNode.data.product || ''}
                    onChange={(e) => updateNodeData({ product: e.target.value })}
                    placeholder="Ej. Thermo T3 o Prunex1"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horas de Validez</label>
                  <input
                    type="number"
                    value={selectedNode.data.expiryHours || 48}
                    onChange={(e) => updateNodeData({ expiryHours: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensaje Personalizado</label>
                  <ControlledTextArea
                    rows={10}
                    value={selectedNode.data.message || ''}
                    onChange={(val) => updateNodeData({ message: val })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-rose-500/50 font-sans leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN CAMBIAR ESTADO */}
            {selectedNode.type === 'updateStatus' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seleccionar Nuevo Estado</label>
                  <select
                    value={selectedNode.data.status || 'Engaged'}
                    onChange={(e) => updateNodeData({ status: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="New">Nuevo/Prospecto</option>
                    <option value="Engaged">Interactuando/info enviada</option>
                    <option value="Pending Verification">Esperando pago</option>
                    <option value="Por Registrar en Web">Por Registrar en Web/Por Despachar</option>
                    <option value="Converted">Venta Confirmada</option>
                  </select>
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN ALERTA AL AGENTE */}
            {selectedNode.type === 'alertAgent' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensaje de la Alerta</label>
                  <ControlledTextArea
                    rows={8}
                    value={selectedNode.data.message || ''}
                    onChange={(val) => updateNodeData({ message: val })}
                    placeholder="Ej. El cliente tiene dudas con el pago de su Thermo T3."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-red-500/50 font-sans leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* CONFIGURACIÓN ACCIÓN DE IA */}
            {selectedNode.type === 'aiAction' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                    🤖 Prompt de IA Personalizado
                  </label>
                  <p className="text-[10px] text-slate-400">Instrucciones específicas que seguirá Gemini únicamente en este paso del flujo.</p>
                  <ControlledTextArea
                    rows={8}
                    value={selectedNode.data.prompt || ''}
                    onChange={(val) => updateNodeData({ prompt: val })}
                    placeholder="Ej. Actúa como asesor comercial, saluda y recomienda Prunex 1..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500/50 font-sans leading-relaxed"
                  />
                </div>
                <div className="p-3 bg-violet-950/20 border border-violet-500/20 rounded-lg text-xs space-y-1.5 text-slate-300">
                  <p className="font-semibold text-violet-300">💡 Tip de Uso</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Este nodo pausará las respuestas rígidas y le dará a Gemini el control temporal con estas instrucciones antes de continuar al siguiente nodo del flujo.
                  </p>
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
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${has
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
                  <div className={`flex flex-col max-w-[85%] ${msg.sender === 'customer' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}>
                    <span className="text-[9px] text-slate-500 capitalize mb-1 px-1">{msg.sender === 'customer' ? 'Cliente' : 'Asistente'}</span>
                    <div className={`p-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${msg.sender === 'customer'
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

export default function FlowBuilderWrapper() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}
