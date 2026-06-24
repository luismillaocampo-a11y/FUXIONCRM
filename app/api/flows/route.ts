import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const flows = await db.getFlows();
    const activeFlow = await db.getActiveFlow();
    return NextResponse.json({ flows, activeFlow });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, nodes, edges, makeActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing flow id' }, { status: 400 });
    }

    let savedFlow = null;
    if (name && nodes && edges) {
      savedFlow = await db.saveFlow(id, name, nodes, edges);
    }

    if (makeActive !== undefined) {
      if (makeActive) {
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
