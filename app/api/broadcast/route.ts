import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await db.getBroadcasts();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, message, targetsType, targetValues } = body;

    if (!name || !message || !targetsType) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (name, message, targetsType)' }, { status: 400 });
    }

    // 1. Obtener los leads que coincidan con el target
    const allLeads = await db.getLeads();
    let targetLeads = [];

    if (targetsType === 'all') {
      targetLeads = allLeads;
    } else if (targetsType === 'status') {
      targetLeads = allLeads.filter((l: any) => targetValues.includes(l.status));
    } else if (targetsType === 'tags') {
      targetLeads = allLeads.filter((l: any) => {
        let lTags = l.tags || [];
        return targetValues.some((t: string) => lTags.includes(t));
      });
    } else if (targetsType === 'custom') {
      targetLeads = allLeads.filter((l: any) => targetValues.includes(l.id));
    }

    if (targetLeads.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron clientes que coincidan con los criterios de selección.' }, { status: 400 });
    }

    const broadcastId = `bcast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const targetsList = targetLeads.map((l: any) => l.id);

    // 2. Guardar en la base de datos como 'sending'
    const broadcastRecord = await db.saveBroadcast({
      id: broadcastId,
      name,
      message,
      targets: targetsList,
      status: 'sending',
      sent_count: 0,
      failed_count: 0
    });

    // 3. Ejecutar el envío en segundo plano (asincrónico)
    runBroadcastInBackground(broadcastId, targetsList, message).catch(err => {
      console.error(`[api/broadcast] Fatal error running campaign ${broadcastId}:`, err);
    });

    return NextResponse.json({ success: true, broadcast: broadcastRecord, totalTargets: targetsList.length });
  } catch (err: any) {
    console.error('[api/broadcast] POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function runBroadcastInBackground(broadcastId: string, targets: string[], message: string) {
  console.log(`[Broadcast ${broadcastId}] Iniciando campaña masiva a ${targets.length} contactos...`);

  let sent = 0;
  let failed = 0;

  // Cargar nombre e historial de la base de datos
  const broadcast = await db.getBroadcastById(broadcastId);
  const name = broadcast?.name || 'Campaña';

  for (let i = 0; i < targets.length; i++) {
    const leadId = targets[i];
    const lead = await db.getLeadById(leadId);
    if (!lead || !lead.phone) {
      failed++;
      continue;
    }

    try {
      console.log(`[Broadcast ${broadcastId}] Enviando mensaje a ${lead.name} (+${lead.phone}) (${i + 1}/${targets.length})...`);
      
      // Enviar mensaje real dinámicamente (Meta, Evolution o Baileys)
      await sendWhatsAppMessageDynamic(lead.phone, message);
      
      // Registrar mensaje en el chat del lead para mantener el historial
      await db.addMessage(leadId, 'agent', message);
      
      sent++;
    } catch (err) {
      console.error(`[Broadcast ${broadcastId}] Error al enviar a ${leadId}:`, err);
      failed++;
    }

    // Actualizar progreso en la base de datos
    await db.saveBroadcast({
      id: broadcastId,
      name,
      message,
      targets,
      status: i === targets.length - 1 ? 'completed' : 'sending',
      sent_count: sent,
      failed_count: failed
    });

    // Retraso de seguridad aleatorio entre 3 y 6 segundos para imitar comportamiento humano
    if (i < targets.length - 1) {
      const delay = 3000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.log(`[Broadcast ${broadcastId}] Campaña finalizada. Enviados: ${sent}, Fallados: ${failed}.`);
}
