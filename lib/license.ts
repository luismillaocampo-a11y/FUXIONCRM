import crypto from 'crypto';
import os from 'os';
import { db } from '@/lib/db';

const MASTER_SECRET_KEY = process.env.LICENSE_MASTER_SECRET || 'MILLA_NUTRAFLOW_CRM_SECRET_2026_PRO';

export type PlanType = 'BASICO' | 'PRO';

export interface LicensePayload {
  companyName: string;
  plan: PlanType;
  issuedAt: string;
  signature: string;
}

export interface LicenseStatus {
  isValid: boolean;
  companyName: string;
  plan: PlanType;
  machineId: string;
  locked: boolean;
  message?: string;
}

/**
 * Genera una huella digital única (Hardware Machine ID) basada en la CPU y arquitectura de la PC
 */
export function getMachineHardwareId(): string {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'GENERIC_CPU';
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  const rawData = `${hostname}-${platform}-${arch}-${cpuModel}`;
  return crypto.createHash('md5').update(rawData).digest('hex').substring(0, 16).toUpperCase();
}

/**
 * Genera una firma criptográfica HMAC SHA-256 para un nombre de empresa y tipo de plan
 */
export function generateLicenseSerial(companyName: string, plan: PlanType): string {
  const cleanCompany = companyName.trim().toUpperCase();
  const planTag = plan === 'PRO' ? 'PRO' : 'BAS';
  
  const payloadToSign = `${cleanCompany}:${planTag}`;
  const hmac = crypto.createHmac('sha256', MASTER_SECRET_KEY).update(payloadToSign).digest('hex').toUpperCase();

  const part1 = hmac.substring(0, 4);
  const part2 = hmac.substring(4, 8);
  const part3 = hmac.substring(8, 12);
  const part4 = hmac.substring(12, 16);

  return `NF-${planTag}-${part1}-${part2}-${part3}-${part4}`;
}

/**
 * Valida si un serial ingresado pertenece a un nombre de empresa y tipo de plan usando la firma maestra
 */
export function verifySerialFormat(companyName: string, serialKey: string): { isValid: boolean; plan: PlanType } {
  if (!serialKey || typeof serialKey !== 'string') {
    return { isValid: false, plan: 'BASICO' };
  }

  const cleanSerial = serialKey.trim().toUpperCase();
  const cleanCompany = companyName.trim().toUpperCase();

  // Detectar plan del prefijo
  let detectedPlan: PlanType = 'BASICO';
  if (cleanSerial.startsWith('NF-PRO-')) {
    detectedPlan = 'PRO';
  } else if (cleanSerial.startsWith('NF-BAS-')) {
    detectedPlan = 'BASICO';
  } else {
    return { isValid: false, plan: 'BASICO' };
  }

  const expectedSerial = generateLicenseSerial(cleanCompany, detectedPlan);
  
  return {
    isValid: cleanSerial === expectedSerial,
    plan: detectedPlan
  };
}

/**
 * Obtiene el estado actual de la licencia instalada en la base de datos del CRM
 */
export async function getActiveLicenseStatus(): Promise<LicenseStatus> {
  const currentMachineId = getMachineHardwareId();
  const companyName = (await db.getSystemSetting('client_company_name')) || 'Fuxion Flow';
  const savedSerial = await db.getSystemSetting('license_key');
  const savedPlan = (await db.getSystemSetting('license_plan')) as PlanType || 'PRO'; // Por defecto activo durante desarrollo
  const locked = (await db.getSystemSetting('company_name_locked')) === 'true';

  if (!savedSerial) {
    return {
      isValid: true, // Permitir uso por defecto, pero con limites si no hay serial
      companyName,
      plan: savedPlan,
      machineId: currentMachineId,
      locked: false,
      message: 'Licencia en modo de desarrollo'
    };
  }

  const verification = verifySerialFormat(companyName, savedSerial);

  return {
    isValid: verification.isValid,
    companyName,
    plan: verification.plan,
    machineId: currentMachineId,
    locked: locked,
    message: verification.isValid ? 'Licencia Comercial Activa' : 'Serial Inválido o Modificado'
  };
}
