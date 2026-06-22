import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Limpieza en segundo plano de números de prueba '1415...' para mantener la base de datos limpia
    try {
      const client = (db as any).supabase;
      if (client) {
        client.from('chat_messages').delete().like('lead_id', '1415%').then(() => {
          client.from('leads').delete().like('phone', '1415%').then(() => {});
          client.from('leads').delete().like('id', '1415%').then(() => {});
        });
      }
    } catch (cleanErr) {
      console.warn('Error in background test leads cleanup:', cleanErr);
    }

    const leads = await db.getLeads();
    return NextResponse.json(leads);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { id, name, phone, status, tags, bot_active } = body;

    // Clean phone number to digits only (e.g. remove "+", spaces, dashes)
    let cleanPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }
    
    // Standardize ID to be the clean phone number if it's a new lead (starts with lead-)
    let cleanId = (id && id.toString().startsWith('lead-') && cleanPhone) ? cleanPhone : id;
    if (cleanId && typeof cleanId === 'string' && cleanId.length === 9 && cleanId.startsWith('9')) {
      cleanId = '51' + cleanId;
    }

    if (!cleanId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const updatedLead = await db.upsertLead({
      id: cleanId,
      name,
      phone: cleanPhone || phone,
      status,
      tags,
      bot_active
    });

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error: any) {
    console.error('Lead update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId parameter' }, { status: 400 });
    }

    await db.deleteLead(leadId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Lead delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
