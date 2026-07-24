import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySerialFormat, getMachineHardwareId } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companyName = (await db.getSystemSetting('client_company_name')) || 'Fuxion Flow';
    const licenseKey = await db.getSystemSetting('license_key') || '';
    const licensePlan = await db.getSystemSetting('license_plan') || 'PRO';
    const locked = (await db.getSystemSetting('company_name_locked')) === 'true';
    const machineId = getMachineHardwareId();

    return NextResponse.json({
      companyName,
      licenseKey,
      licensePlan,
      locked,
      machineId
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, serialKey } = body;

    if (!companyName || !serialKey) {
      return NextResponse.json({
        success: false,
        error: 'Debes ingresar el Nombre de tu Empresa y el Serial Key.'
      }, { status: 400 });
    }

    const verification = verifySerialFormat(companyName, serialKey);

    if (!verification.isValid) {
      return NextResponse.json({
        success: false,
        error: 'El Serial Key ingresado es inválido o no corresponde al Nombre de Empresa registrado.'
      }, { status: 400 });
    }

    const machineId = getMachineHardwareId();

    // Guardar y sellar la licencia en SQLite
    await db.setSystemSetting('client_company_name', String(companyName).trim());
    await db.setSystemSetting('license_key', String(serialKey).trim().toUpperCase());
    await db.setSystemSetting('license_plan', verification.plan);
    await db.setSystemSetting('license_machine_id', machineId);
    await db.setSystemSetting('company_name_locked', 'true');
    await db.setSystemSetting('vendor_brand_credit', 'Desarrollado por L. Milla');

    return NextResponse.json({
      success: true,
      message: `¡Licencia ${verification.plan} activada exitosamente para ${companyName}!`,
      plan: verification.plan,
      companyName: String(companyName).trim(),
      machineId
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
