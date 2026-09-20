import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

const MAX_FLOWS = 100;
const MAX_NODES = 300;
const MAX_EDGES = 600;
const MAX_NAME_LENGTH = 150;
const MAX_ID_LENGTH = 128;
const MAX_BODY_BYTES = 500 * 1024;

function validateFlowGraph(nodes: unknown, edges: unknown): string | null {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return 'nodes y edges deben ser arreglos';
  }
  if (nodes.length > MAX_NODES || edges.length > MAX_EDGES) {
    return `Flujo demasiado grande (máx ${MAX_NODES} nodos, ${MAX_EDGES} conexiones)`;
  }
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n || typeof n !== 'object') return 'Nodo inválido';
    const node = n as Record<string, unknown>;
    if (typeof node.id !== 'string' || !node.id || node.id.length > MAX_ID_LENGTH) return 'Nodo sin id válido';
    if (ids.has(node.id)) return `Nodo duplicado: ${node.id}`;
    ids.add(node.id);
    if (typeof node.type !== 'string' || !node.type) return `Nodo ${node.id} sin tipo`;
    const pos = node.position as { x?: unknown; y?: unknown } | undefined;
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      return `Nodo ${node.id} sin posición válida`;
    }
    if (node.data !== undefined && (typeof node.data !== 'object' || node.data === null)) {
      return `Nodo ${node.id} con data inválida`;
    }
  }
  for (const e of edges) {
    if (!e || typeof e !== 'object') return 'Conexión inválida';
    const edge = e as Record<string, unknown>;
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') return 'Conexión sin origen/destino';
    if (!ids.has(edge.source) || !ids.has(edge.target)) return 'Conexión a nodo inexistente';
    if (edge.source === edge.target) return 'Conexión circular no permitida';
  }
  return null;
}

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const flows = await db.getFlows();
    const activeFlow = await db.getActiveFlow();
    return NextResponse.json({ flows, activeFlow });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { id, name, nodes, edges, makeActive } = body;

    if (!id || typeof id !== 'string' || id.length > MAX_ID_LENGTH) {
      return NextResponse.json({ error: 'Missing flow id' }, { status: 400 });
    }

    if (JSON.stringify(body).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Flujo demasiado grande' }, { status: 413 });
    }

    let savedFlow = null;
    if (name !== undefined || nodes !== undefined || edges !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: 'Nombre de flujo inválido' }, { status: 400 });
      }
      const graphError = validateFlowGraph(nodes, edges);
      if (graphError) {
        return NextResponse.json({ error: graphError }, { status: 400 });
      }
      const existing = await db.getFlows();
      if (existing.length >= MAX_FLOWS && !existing.some((f: { id: string }) => f.id === id)) {
        return NextResponse.json({ error: `Límite de ${MAX_FLOWS} flujos` }, { status: 400 });
      }
      savedFlow = await db.saveFlow(id, name.trim(), nodes, edges);
    }

    if (makeActive !== undefined) {
      if (typeof makeActive !== 'boolean') {
        return NextResponse.json({ error: 'makeActive inválido' }, { status: 400 });
      }
      if (makeActive) {
        const flow = await db.getFlowById(id);
        if (!flow) {
          return NextResponse.json({ error: 'Flow no encontrado' }, { status: 404 });
        }
        await db.setActiveFlow(id);
      } else {
        await db.deactivateFlow(id);
      }
    }

    return NextResponse.json({ success: true, flow: savedFlow });
  } catch (error: any) {
    console.error('Flow save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del flujo' }, { status: 400 });
    }

    const activeFlow = await db.getActiveFlow();
    if (activeFlow && activeFlow.id === id) {
      return NextResponse.json({
        error: 'No se puede eliminar el flujo porque está activo en el sistema. Desactívalo primero.'
      }, { status: 400 });
    }

    await db.deleteFlow(id);
    return NextResponse.json({ success: true, message: 'Flujo eliminado correctamente.' });
  } catch (error: any) {
    console.error('Flow delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
