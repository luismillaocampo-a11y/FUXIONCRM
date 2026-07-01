import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

// Obtain secure CRON_API_KEY from environment variables or fallback to a default secret
const CRON_API_KEY = process.env.CRON_API_KEY || 'default-secret-key';

async function handleCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const token = searchParams.get('api_key') || (authHeader ? authHeader.replace('Bearer ', '') : null);

    // Secure authentication check
    if (!token || token !== CRON_API_KEY) {
      console.warn('[Cron/Followup] Unauthorized access attempt blocked.');
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key' }, { status: 401 });
    }

    console.log('[Cron/Followup] Starting followup task execution...');
    
    // Fetch all leads
    const allLeads = await db.getLeads();
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const processedLeads: { id: string; phone: string; name: string }[] = [];

    for (const lead of allLeads) {
      // Skip if lead is already converted
      if (lead.status === 'Converted') continue;

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

      // Check if lead was updated more than 24 hours ago
      if (now - updatedAtMs < twentyFourHours) {
        continue;
      }

      // Retrieve chat history to verify last message sender
      const messages = await db.getMessages(lead.id);
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
          rescueMessage = `Hola ${leadName}, vi que estuviste consultando sobre nuestros productos y me quedé con la duda de si te quedó alguna consulta pendiente. ¿Te gustaría ayuda para concretar tu pedido o necesitas más información?`;
        }
        
        console.log(`[Followup] Enviando mensaje de rescate a ${lead.phone} para el lead ${lead.id}`);
        
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
