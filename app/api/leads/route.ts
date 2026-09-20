import { NextResponse } from 'next/server';
import { db, isValidLeadStatus } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const leads = await db.getLeads();
    return NextResponse.json(leads);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    let { id, name, phone, real_phone, whatsapp_lid, status, tags, bot_active } = body;

    // Clean phone number to digits only (e.g. remove "+", spaces, dashes)
    let cleanPhone = phone ? phone.toString().replace(/\D/g, '') : '';
    if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
      cleanPhone = '51' + cleanPhone;
    }

    // real_phone: número real del contacto (para leads solo-LID). Normalizar igual.
    let cleanRealPhone: string | null = real_phone ? real_phone.toString().replace(/\D/g, '') : null;
    if (cleanRealPhone && cleanRealPhone.length === 9 && cleanRealPhone.startsWith('9')) {
      cleanRealPhone = '51' + cleanRealPhone;
    }
    // Un real_phone con longitud de LID no es un teléfono: descartarlo
    if (cleanRealPhone && cleanRealPhone.length >= 13) {
      cleanRealPhone = null;
    }

    const cleanLid = whatsapp_lid ? whatsapp_lid.toString().replace(/\D/g, '') || null : null;
    
    // Standardize ID to be the clean phone number if it's a new lead (starts with lead-)
    let cleanId = (id && id.toString().startsWith('lead-') && cleanPhone) ? cleanPhone : id;
    if (cleanId && typeof cleanId === 'string' && cleanId.length === 9 && cleanId.startsWith('9')) {
      cleanId = '51' + cleanId;
    }

    if (!cleanId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    if (status !== undefined && status !== null && status !== '' && !isValidLeadStatus(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const updatedLead = await db.upsertLead({
      id: cleanId,
      name,
      phone: cleanPhone || phone,
      real_phone: cleanRealPhone,
      whatsapp_lid: cleanLid,
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
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
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
