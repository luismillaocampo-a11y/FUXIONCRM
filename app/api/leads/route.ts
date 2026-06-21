import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
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
    const cleanPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    
    // Standardize ID to be the clean phone number if it's a new lead (starts with lead-)
    const cleanId = (id && id.toString().startsWith('lead-') && cleanPhone) ? cleanPhone : id;

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
