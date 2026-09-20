import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWhatsAppMessageDynamic } from '@/lib/whatsapp-sender';
import { requireSession, requireActiveLicense, isAllowedMediaUrl } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_BROADCAST_TARGETS = 500;
const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 4000;
const VALID_TARGETS_TYPES = ['all', 'status', 'tags', 'custom'] as const;

/** Normaliza un número manual: conserva el código de país tal como se escribió. */
function normalizeManualPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  // Solo el formato móvil peruano de 9 dígitos recibe el 51 automático
  if (digits.length === 9 && digits.startsWith('9')) return '51' + digits;
  return digits;
}

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const list = await db.getBroadcasts();
    const parsedList = list.map((b: any) => {
      let msg = b.message || '';
      let mediaUrl = '';
      const mediaMatch = msg.match(/\n\[media:(.*?)\]$/);
      if (mediaMatch) {
        mediaUrl = mediaMatch[1];
        msg = msg.replace(/\n\[media:(.*?)\]$/, '');
      }
      return {
        ...b,
        message: msg,
        mediaUrl: mediaUrl || null
      };
    });
    return NextResponse.json(parsedList);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  const lic = await requireActiveLicense();
  if ('response' in lic) return lic.response;
  try {
    const body = await request.json();
    const { name, message, targetsType, targetValues, mediaUrl } = body;

    if (!name || !message || !targetsType) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (name, message, targetsType)' }, { status: 400 });
    }

    if (typeof name !== 'string' || typeof message !== 'string' || typeof targetsType !== 'string') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const cleanName = name.trim().slice(0, MAX_NAME_LENGTH);
    const cleanMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!cleanName || !cleanMessage) {
      return NextResponse.json({ error: 'Nombre y mensaje no pueden estar vacíos' }, { status: 400 });
    }

    if (!(VALID_TARGETS_TYPES as readonly string[]).includes(targetsType)) {
      return NextResponse.json({ error: 'targetsType inválido' }, { status: 400 });
    }

    const values = Array.isArray(targetValues) ? targetValues.filter((v) => typeof v === 'string').slice(0, MAX_BROADCAST_TARGETS) : [];
    if (targetsType !== 'all' && values.length === 0) {
      return NextResponse.json({ error: 'targetValues vacío o inválido' }, { status: 400 });
    }

    if (mediaUrl !== undefined && mediaUrl !== null && mediaUrl !== '') {
      if (!isAllowedMediaUrl(mediaUrl)) {
        return NextResponse.json({ error: 'mediaUrl inválida (solo https o imagen subida al CRM)' }, { status: 400 });
      }
    }

    const dbMessage = mediaUrl ? cleanMessage + `\n[media:${mediaUrl}]` : cleanMessage;

    // 1. Obtener los leads que coincidan con el target
    const allLeads = await db.getLeads();
    let targetLeads = [];

    if (targetsType === 'all') {
      targetLeads = allLeads;
    } else if (targetsType === 'status') {
      targetLeads = allLeads.filter((l: any) => values.includes(l.status));
    } else if (targetsType === 'tags') {
      targetLeads = allLeads.filter((l: any) => {
        const lTags = Array.isArray(l.tags) ? l.tags : [];
        return values.some((t: string) => lTags.includes(t));
      });
    } else if (targetsType === 'custom') {
      const wanted = new Set(values);
      const seen = new Set<string>();
      const push = (l: any) => {
        if (l && l.id && !seen.has(l.id)) {
          seen.add(l.id);
          targetLeads.push(l);
        }
      };
      // 1. IDs de leads existentes
      for (const l of allLeads) {
        if (wanted.has(l.id)) push(l);
      }
      // 2. Números manuales "tel:<digitos>" (cualquier país): se vinculan o se dan de alta
  for (const v of values) {
      if (typeof v !== 'string' || !v.startsWith('tel:')) continue;
      const digits = normalizeManualPhone(v.slice(4));
      if (!digits) continue;
      // LID (14+) conocido o coincidente con whatsapp_lid; el resto es teléfono (incluye AR 13)
      const sameDigits = (x: unknown) => typeof x === 'string' && x.replace(/\D/g, '') === digits;
        const found = allLeads.find(
          (l: any) => sameDigits(l.phone) || sameDigits(l.real_phone) || sameDigits(l.whatsapp_lid) || sameDigits(l.id)
        );
        if (found) {
          push(found);
          continue;
        }
        try {
          const isShort = digits.length < 14;
          const created = await db.upsertLead({
            id: digits,
            name: `WhatsApp +${digits}`,
            phone: digits,
            real_phone: isShort ? digits : null,
            whatsapp_lid: isShort ? null : digits,
            status: 'New',
            tags: ['broadcast'],
            bot_active: true
          });
          if (created) {
            push(created);
            allLeads.push(created);
          }
        } catch (e) {
          // Choque de UNIQUE (carrera u otro formato del mismo número): reintentar vincular
          const retry = allLeads.find(
            (l: any) => sameDigits(l.phone) || sameDigits(l.real_phone) || sameDigits(l.whatsapp_lid)
          );
          if (retry) push(retry);
          else console.warn(`[api/broadcast] No se pudo dar de alta ${digits}:`, e);
        }
      }
    }

    if (targetLeads.length === 0) {
      return NextResponse.json({ success: false, error: 'No se encontraron clientes que coincidan con los criterios de selección.' }, { status: 400 });
    }

    if (targetLeads.length > MAX_BROADCAST_TARGETS) {
      targetLeads = targetLeads.slice(0, MAX_BROADCAST_TARGETS);
    }

    const broadcastId = `bcast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const targetsList = targetLeads.map((l: any) => l.id);

    // 2. Guardar en la base de datos como 'sending'
    const broadcastRecord = await db.saveBroadcast({
      id: broadcastId,
      name: cleanName,
      message: dbMessage,
      targets: targetsList,
      status: 'sending',
      sent_count: 0,
      failed_count: 0
    });

    // 3. Ejecutar el envío en segundo plano (asincrónico)
    // Si la campaña muere con error fatal, marcarla 'failed' para no dejarla en 'sending' eterno.
    runBroadcastInBackground(broadcastId, targetsList, cleanMessage).catch(async (err) => {
      console.error(`[api/broadcast] Fatal error running campaign ${broadcastId}:`, err);
      try {
        const b = await db.getBroadcastById(broadcastId);
        await db.saveBroadcast({
          id: broadcastId,
          name: b?.name || 'Campaña',
          message: b?.message || cleanMessage,
          targets: targetsList,
          status: 'failed',
          sent_count: b?.sent_count || 0,
          failed_count: targetsList.length,
        });
      } catch (markErr) {
        console.error(`[api/broadcast] No se pudo marcar failed la campaña ${broadcastId}:`, markErr);
      }
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
  let dbMsg = broadcast?.message || message;
  let mediaUrl = undefined;
  const mediaMatch = dbMsg.match(/\n\[media:(.*?)\]$/);
  if (mediaMatch) {
    mediaUrl = mediaMatch[1];
    dbMsg = dbMsg.replace(/\n\[media:(.*?)\]$/, '');
  }

  for (let i = 0; i < targets.length; i++) {
    const leadId = targets[i];
    const lead = await db.getLeadById(leadId);
    if (!lead) {
      console.warn(`[Broadcast ${broadcastId}] Lead ${leadId} no encontrado, omitiendo.`);
      failed++;
      continue;
    }

    // Resolver destino igual que el envío individual: real_phone > phone > whatsapp_lid.
    // Enviar un LID crudo como "teléfono" es la causa típica del 0 ✓ / N ✕.
    // LID = 14+ dígitos (los móviles AR de 13 son números reales) o match con whatsapp_lid.
    const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
    const lidDigits = digits(lead.whatsapp_lid);
    const lidEvidence = lidDigits.length >= 14 ? lidDigits : '';
    const isLid = (v: unknown) => {
      const d = digits(v);
      if (!d) return false;
      if (lidEvidence && d === lidEvidence) return true;
      return d.length >= 14;
    };
    let dest = '';
    if (lead.real_phone && !isLid(lead.real_phone)) dest = lead.real_phone;
    else if (lead.phone && !isLid(lead.phone)) dest = lead.phone;
    else if (lead.whatsapp_lid) dest = lead.phone && isLid(lead.phone) ? lead.phone : lead.whatsapp_lid;
    else if (lead.phone) dest = lead.phone;
    if (!dest) {
      console.warn(`[Broadcast ${broadcastId}] Lead ${leadId} sin destino válido, omitiendo.`);
      failed++;
      continue;
    }

    // JID exacto: LID si el destino es el whatsapp_lid conocido o (sin número
    // corto en el lead) un valor largo típico de LID. Los internacionales
    // reales casi nunca llegan a 14 dígitos.
    const destDigits = dest.replace(/\D/g, '');
    const hasShort = [lead.real_phone, lead.phone].some(
      (v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 7 && !isLid(v)
    );
    const isLidDest = isLid(dest) || (!hasShort && destDigits.length >= 14);
    const jidOverride = isLidDest ? `${destDigits}@lid` : `${destDigits}@s.whatsapp.net`;

    try {
      console.log(`[Broadcast ${broadcastId}] Enviando mensaje a ${lead.name} (${dest} → ${jidOverride}) (${i + 1}/${targets.length})...`);
      
      // Enviar mensaje real dinámicamente (Meta, Evolution o Baileys)
      await sendWhatsAppMessageDynamic(dest, dbMsg, mediaUrl, jidOverride);
      
      // Registrar mensaje en el chat del lead para mantener el historial
      await db.addMessage(leadId, 'agent', mediaUrl ? `${dbMsg}\n\n📎 Imagen adjunta: ${mediaUrl}` : dbMsg);
      
      sent++;
    } catch (err: any) {
      console.error(`[Broadcast ${broadcastId}] Error al enviar a ${leadId} (${dest}):`, err?.message || err);
      failed++;
    }

    // Actualizar progreso en la base de datos
    const dbMessageProgress = mediaUrl ? dbMsg + `\n[media:${mediaUrl}]` : dbMsg;
    await db.saveBroadcast({
      id: broadcastId,
      name,
      message: dbMessageProgress,
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
