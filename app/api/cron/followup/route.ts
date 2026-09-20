import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';
import { isCronAuthorized, cronUnauthorized } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Tope anti-spam por ejecución: evita oleadas masivas si el cron se atasca
const MAX_FOLLOWUPS_PER_RUN = 50;

async function handleCron(request: Request) {
  try {
    // Secure authentication check: sesión válida o CRON_API_KEY (sin fallback público)
    if (!isCronAuthorized(request)) {
      console.warn('[Cron/Followup] Unauthorized access attempt blocked.');
      return cronUnauthorized();
    }

    console.log('[Cron/Followup] Starting followup task execution...');
    
    // Fetch all leads
    const allLeads = await db.getLeads();
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const processedLeads: { id: string; phone: string; name: string }[] = [];

    for (const lead of allLeads) {
      if (processedLeads.length >= MAX_FOLLOWUPS_PER_RUN) {
        console.log(`[Followup] Tope de ${MAX_FOLLOWUPS_PER_RUN} alcanzado, resto queda para el próximo tick.`);
        break;
      }

      // Skip if lead is already converted
      if (lead.status === 'Converted') continue;

      // No molestar leads en modo manual (bot pausado por el operador)
      if (lead.bot_active === 0 || lead.bot_active === false) continue;

      // Robust parsing of updated_at column
      let isoStr = lead.updated_at;
      if (!isoStr) continue;
      
      if (typeof isoStr === 'string') {
        if (!isoStr.includes('T')) {
          isoStr = isoStr.replace(' ', 'T');
        }
        if (!isoStr.endsWith('Z') && !isoStr.match(/[+-]\d{2}:?\d{2}$/)) {
          isoStr += 'Z';
        }
      }
      const updatedAtMs = new Date(isoStr).getTime();
      if (Number.isNaN(updatedAtMs)) continue;

      // Check if lead was updated more than 24 hours ago
      if (now - updatedAtMs < twentyFourHours) {
        continue;
      }

      // Retrieve chat history to verify last message sender
      let messages: Array<{ sender: string }>;
      try {
        messages = await db.getMessages(lead.id);
      } catch (msgErr) {
        console.error(`[Followup] No se pudo leer mensajes de ${lead.id}, omitiendo.`);
        continue;
      }
      if (messages.length === 0) continue;

      const lastMsg = messages[messages.length - 1];
      
      // Send rescue followup ONLY if the last message was from 'bot' or 'agent'
      // (This avoids bothering the customer if they were the last ones to write and are waiting for us)
      if (lastMsg && (lastMsg.sender === 'bot' || lastMsg.sender === 'agent')) {
        const leadName = lead.name ? lead.name.trim() : '';
        const isGenericName = !leadName || leadName.toLowerCase().includes('whatsapp') || /^[+\d\s]+$/.test(leadName);

        let rescueMessage = '';
        if (isGenericName) {
          rescueMessage = 'Hola, vi que estuviste consultando sobre nuestros productos y me quedé con la duda de si te quedó alguna consulta pendiente. ¿Te gustaría ayuda para concretar tu pedido o necesitas más información?';
        } else {
          rescueMessage = `Hola ${leadName.slice(0, 60)}, vi que estuviste consultando sobre nuestros productos y me quedé con la duda de si te quedó alguna consulta pendiente. ¿Te gustaría ayuda para concretar tu pedido o necesitas más información?`;
        }
        
        console.log(`[Followup] Enviando mensaje de rescate a ${lead.phone} para el lead ${lead.id}`);
        
        try {
          // Send WhatsApp message using the service
          await whatsappService.sendMessageToPhone(lead.phone, rescueMessage);
          
          // Log the follow-up message to the chat history
          await db.addMessage(lead.id, 'bot', rescueMessage);
          
          // Update updated_at of the lead so we don't spam them in subsequent cron ticks
          await db.upsertLead({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            bot_active: lead.bot_active
          });

          processedLeads.push({ id: lead.id, phone: lead.phone, name: lead.name });
        } catch (sendErr) {
          // Un fallo no aborta el resto de la campaña
          console.error(`[Followup] Falló envío a ${lead.id}, continúa con el siguiente:`, sendErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cron executed successfully. Sent follow-up to ${processedLeads.length} leads.`,
      processed: processedLeads
    });

  } catch (error: any) {
    console.error('[Cron/Followup] Error running followup cron:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
