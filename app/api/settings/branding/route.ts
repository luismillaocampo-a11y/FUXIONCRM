import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companyName = await db.getSystemSetting('client_company_name') || 'Fuxion Flow';
    const logoUrl = await db.getSystemSetting('client_logo_url') || '';
    const lockedSetting = await db.getSystemSetting('company_name_locked');
    const isLocked = lockedSetting === null || lockedSetting === 'true' || lockedSetting === '1';
    const vendorCredit = 'Desarrollado por L. Milla'; // Permanente e inamovible

    return NextResponse.json({
      companyName,
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
      await db.setSystemSetting('client_company_name', String(companyName).trim() || 'Fuxion Flow');
    }

    if (logoUrl !== undefined && logoUrl !== null) {
      await db.setSystemSetting('client_logo_url', String(logoUrl).trim());
    }

    // Asegurar firma inamovible
    await db.setSystemSetting('vendor_brand_credit', 'Desarrollado por L. Milla');

    const currentCompanyName = await db.getSystemSetting('client_company_name') || 'Fuxion Flow';

    return NextResponse.json({
      success: true,
      companyName: currentCompanyName,
      logoUrl: logoUrl || '',
      vendorCredit: 'Desarrollado por L. Milla',
      companyNameLocked: isLocked
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
