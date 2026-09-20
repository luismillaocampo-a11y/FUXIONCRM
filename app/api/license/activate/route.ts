import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import {
  ensureActivated,
  getInstallId,
  getMachineHardwareId,
  releaseHardwareBinding,
} from '@/lib/license';

export const dynamic = 'force-dynamic';

/**
 * GET /api/license/activate
 * Estado de licencia (auto-activación en primer arranque, sin seriales).
 */
export async function GET() {
  try {
    const status = await ensureActivated();
    let locked = false;
    try {
      locked = ((await db.getSystemSetting('company_name_locked')) || '') === 'true';
    } catch {
      locked = false;
    }
    return NextResponse.json({
      isValid: status.state === 'active' || status.state === 'grace',
      state: status.state,
      companyName: status.companyName,
      licensePlan: status.plan,
      locked,
      machineId: status.machineId,
      installId: status.installId,
      seats: status.seats,
      graceDays: status.graceDays,
      graceUntil: status.graceUntil,
      lastCheckin: status.lastCheckin,
      serverConfigured: status.serverConfigured,
      message: status.message,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/license/activate
 * Acciones (con sesión):
 * - { action: 'set-company', companyName } → registra y sella la empresa (una vez).
 * - { action: 'release' } → libera el amarre a esta PC (cambio de equipo legítimo).
 * - { action: 'checkin' } → fuerza verificación inmediata contra el servidor.
 */
export async function POST(request: Request) {
  const auth = requireSession(request);
  if ('response' in auth) return auth.response;
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'set-company') {
      const companyName = typeof body.companyName === 'string' ? body.companyName.trim().slice(0, 120) : '';
      if (!companyName) {
        return NextResponse.json({ success: false, error: 'Debes ingresar el nombre de tu empresa.' }, { status: 400 });
      }
      const locked = (await db.getSystemSetting('company_name_locked')) === 'true';
      const current = (await db.getSystemSetting('client_company_name')) || '';
      // El nombre por defecto de fábrica ('Fuxion Flow'/vacío) siempre se puede reemplazar una vez
      const isFactoryDefault = !current || current === 'Fuxion Flow';
      if (locked && !isFactoryDefault && current !== companyName) {
        return NextResponse.json({ success: false, error: 'El nombre de empresa ya está sellado.' }, { status: 400 });
      }
      await db.setSystemSetting('client_company_name', companyName);
      await db.setSystemSetting('company_name_locked', 'true');
      await db.setSystemSetting('vendor_brand_credit', 'Desarrollado por L. Milla');
      // Asegurar vinculación en el mismo acto
      await getInstallId();
      const status = await ensureActivated();
      return NextResponse.json({ success: true, message: `Empresa registrada: ${companyName}`, state: status.state });
    }

    if (action === 'release') {
      await releaseHardwareBinding();
      const status = await ensureActivated();
      return NextResponse.json({
        success: true,
        message: 'Amarre liberado. Esta PC se revinculará al siguiente arranque.',
        installId: status.installId,
      });
    }

    if (action === 'checkin') {
      const status = await ensureActivated();
      return NextResponse.json({
        success: status.state === 'active' || status.state === 'grace',
        state: status.state,
        message: status.message,
        lastCheckin: status.lastCheckin,
      });
    }

    return NextResponse.json({ success: false, error: 'Acción inválida.' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[license/activate] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export { getMachineHardwareId };
