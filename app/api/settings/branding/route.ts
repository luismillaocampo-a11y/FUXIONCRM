import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companyName = await db.getSystemSetting('client_company_name') || 'Asistente Virtual';
    const logoUrl = await db.getSystemSetting('client_logo_url') || '';
    const lockedSetting = await db.getSystemSetting('company_name_locked');
    const isLocked = lockedSetting === null || lockedSetting === 'true' || lockedSetting === '1';
    const vendorCredit = 'Creado por Lz MiLLa'; // Permanente e inamovible

    return NextResponse.json({
      companyName: companyName === 'Fuxion Flow' ? 'Asistente Virtual' : companyName,
      logoUrl,
      vendorCredit,
      companyNameLocked: isLocked
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, logoUrl } = body;

    const lockedSetting = await db.getSystemSetting('company_name_locked');
    const isLocked = lockedSetting === null || lockedSetting === 'true' || lockedSetting === '1';

    // Solo actualizar el Nombre de la Empresa si NO está bloqueado por la licencia
    if (!isLocked && companyName !== undefined && companyName !== null) {
      await db.setSystemSetting('client_company_name', String(companyName).trim() || 'Asistente Virtual');
    }

    if (logoUrl !== undefined && logoUrl !== null) {
      await db.setSystemSetting('client_logo_url', String(logoUrl).trim());
    }

    // Asegurar firma inamovible
    await db.setSystemSetting('vendor_brand_credit', 'Creado por Lz MiLLa');

    const rawName = await db.getSystemSetting('client_company_name');
    const currentCompanyName = (!rawName || rawName === 'Fuxion Flow') ? 'Asistente Virtual' : rawName;

    return NextResponse.json({
      success: true,
      companyName: currentCompanyName,
      logoUrl: logoUrl || '',
      vendorCredit: 'Creado por Lz MiLLa',
      companyNameLocked: isLocked
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
