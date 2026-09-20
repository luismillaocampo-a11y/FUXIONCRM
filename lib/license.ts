import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';
import { db } from '@/lib/db';

export type PlanType = 'BASICO' | 'PRO';
export type LicenseState = 'active' | 'grace' | 'blocked' | 'unactivated';

export interface LicenseStatus {
  state: LicenseState;
  companyName: string;
  plan: PlanType;
  installId: string;
  machineId: string;
  seats: number;
  graceDays: number;
  /** ISO hasta cuándo hay gracia offline (null si no aplica). */
  graceUntil: string | null;
  lastCheckin: string | null;
  serverConfigured: boolean;
  message?: string;
}

const GRACE_DAYS_DEFAULT = 15;
const CHECKIN_TIMEOUT_MS = 8000;
const APP_VERSION = '0.4.2';

function getGraceDays(): number {
  const raw = Number(process.env.LICENSE_GRACE_DAYS || GRACE_DAYS_DEFAULT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : GRACE_DAYS_DEFAULT;
}

function getServerUrl(): string {
  return (process.env.LICENSE_SERVER_URL || '').trim().replace(/\/$/, '');
}

function getVendorContact(): string {
  return (process.env.LICENSE_VENDOR_CONTACT || '').trim() || 'quien te instaló el sistema';
}

/** Ejecuta un comando y devuelve stdout (vacío si falla). Solo Windows. */
function tryExec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, windowsHide: true }).toString();
  } catch {
    return '';
  }
}

let cachedHw: { id: string; source: string } | null = null;

/**
 * Huella de hardware v2 (sin llaves manuales):
 * 1) UUID de placa base (wmic), 2) serial de disco, 3) hostname+CPU (fallback).
 * Pensada para Windows/Electron. Devuelve 16 HEX mayúsculas (compatible con la UI).
 */
export function getMachineHardwareId(): string {
  return getHardwareFingerprint().id;
}

export function getHardwareFingerprint(): { id: string; source: string } {
  if (cachedHw) return cachedHw;

  // 1. UUID de placa base
  const mbOut = tryExec('wmic csproduct get uuid');
  const mbMatch = mbOut.match(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/);
  if (mbMatch && !/^0+-0+-0+-0+-0+$/.test(mbMatch[0])) {
    cachedHw = { id: fingerprintOf(`MB:${mbMatch[0]}:${os.platform()}:${os.arch()}`), source: 'placa-base' };
    return cachedHw;
  }

  // 2. Serial de disco
  const diskOut = tryExec('wmic diskdrive get serialnumber');
  const diskSerial = diskOut
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^serialnumber$/i.test(l))[0];
  if (diskSerial && diskSerial.length >= 4) {
    cachedHw = { id: fingerprintOf(`DISK:${diskSerial}:${os.hostname()}:${os.arch()}`), source: 'disco' };
    return cachedHw;
  }

  // 3. Fallback clásico (hostname + CPU)
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'GENERIC_CPU';
  cachedHw = {
    id: fingerprintOf(`${os.hostname()}-${os.platform()}-${os.arch()}-${cpuModel}`),
    source: 'hostname-cpu',
  };
  return cachedHw;
}

function fingerprintOf(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16).toUpperCase();
}

async function getSetting(key: string): Promise<string | null> {
  try {
    return await db.getSystemSetting(key);
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.setSystemSetting(key, value);
}

/** ID único de instalación (se crea solo en el primer arranque). */
export async function getInstallId(): Promise<string> {
  let id = await getSetting('install_id');
  if (!id) {
    id = crypto.randomUUID();
    await setSetting('install_id', id);
    await setSetting('install_activated_at', new Date().toISOString());
  }
  return id;
}

interface CheckinResponse {
  status?: 'active' | 'blocked';
  seats?: number;
  plan?: PlanType;
  message?: string;
  server_time?: string;
}

/** Avisa al servidor (si hay URL). Nunca lanza: devuelve null si no hay red/servidor. */
async function checkinWithServer(payload: {
  install_id: string;
  hwid: string;
  app_version: string;
  company: string;
}): Promise<CheckinResponse | null> {
  const base = getServerUrl();
  if (!base) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CHECKIN_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as CheckinResponse;
      return data && typeof data === 'object' ? data : null;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

/**
 * Asegura y evalúa la licencia (auto-activación en primer arranque).
 * - Sin servidor: candado local (HW actual vs HW del primer arranque).
 * - Con servidor: veredicto remoto + gracia offline si no hay red.
 * Nunca lanza: ante cualquier fallo de lectura, devuelve estado seguro local.
 */
export async function ensureActivated(): Promise<LicenseStatus> {
  const graceDays = getGraceDays();
  const serverConfigured = getServerUrl() !== '';
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let installId = '';
  let companyName = '';
  let plan: PlanType = 'PRO';
  let storedHw = '';
  try {
    installId = await getInstallId();
    companyName = (await getSetting('client_company_name')) || '';
    const savedPlan = await getSetting('license_plan');
    if (savedPlan === 'BASICO' || savedPlan === 'PRO') plan = savedPlan;
    storedHw = (await getSetting('license_hwid')) || '';
  } catch (e) {
    return {
      state: 'unactivated',
      companyName: '',
      plan: 'PRO',
      installId: '',
      machineId: getMachineHardwareId(),
      seats: 1,
      graceDays,
      graceUntil: null,
      lastCheckin: null,
      serverConfigured,
      message: 'No se pudo leer la licencia local.',
    };
  }

  const currentHw = getMachineHardwareId();

  // Vinculación automática en primer arranque (sin llaves manuales)
  if (!storedHw) {
    await setSetting('license_hwid', currentHw);
    storedHw = currentHw;
  }

  const base: Omit<LicenseStatus, 'state' | 'message'> = {
    companyName,
    plan,
    installId,
    machineId: currentHw,
    seats: 1,
    graceDays,
    graceUntil: null,
    lastCheckin: (await getSetting('license_last_checkin').catch(() => null)) as string | null,
    serverConfigured,
  };

  const isCloud = Boolean(
    process.env.K_SERVICE || 
    process.env.CLOUD_RUN || 
    process.env.VERCEL || 
    process.env.USE_SUPABASE === 'true'
  );

  // Candado local: la carpeta fue copiada a otra PC (solo en entorno local/escritorio)
  if (!isCloud && storedHw !== currentHw) {
    return {
      ...base,
      state: 'blocked',
      message: `Esta instalación fue movida a otra PC. Contacta a ${getVendorContact()} con tu ID de instalación para reactivarla.`,
    };
  }

  if (isCloud || !serverConfigured) {
    const activeCompany = companyName || 'Luis Milla';
    return { 
      ...base, 
      companyName: activeCompany,
      state: 'active', 
      message: isCloud ? 'Licencia Cloud activa' : (companyName ? 'Licencia local activa' : 'Sin empresa registrada') 
    };
  }

  // Check-in remoto (no bloqueante ante fallos de red)
  const remote = await checkinWithServer({
    install_id: installId,
    hwid: currentHw,
    app_version: APP_VERSION,
    company: companyName,
  });

  if (remote) {
    await setSetting('license_last_checkin', nowIso).catch(() => {});
    if (typeof remote.seats === 'number' && remote.seats > 0) {
      // Solo informativo en v1 (el servidor decide el veredicto)
    }
    if (remote.plan === 'BASICO' || remote.plan === 'PRO') {
      plan = remote.plan;
      await setSetting('license_plan', plan).catch(() => {});
    }
    if (remote.status === 'blocked') {
      return {
        ...base,
        plan,
        lastCheckin: nowIso,
        state: 'blocked',
        message: remote.message || `Licencia bloqueada. Contacta a ${getVendorContact()}.`,
      };
    }
    return {
      ...base,
      plan,
      lastCheckin: nowIso,
      state: 'active',
      message: remote.message || 'Licencia verificada en línea',
    };
  }

  // Sin red: gracia desde el último check-in (o desde la activación)
  const activatedAt = (await getSetting('install_activated_at').catch(() => null)) as string | null;
  const refIso = base.lastCheckin || activatedAt || nowIso;
  const refMs = new Date(refIso).getTime();
  const graceUntilMs = (Number.isNaN(refMs) ? now : refMs) + graceDays * 24 * 60 * 60 * 1000;
  const graceUntil = new Date(graceUntilMs).toISOString();
  if (now <= graceUntilMs) {
    return {
      ...base,
      state: 'grace',
      graceUntil,
      message: `Sin conexión al servidor de licencias. Gracia hasta ${new Date(graceUntilMs).toLocaleDateString('es-PE')}.`,
    };
  }
  return {
    ...base,
    state: 'blocked',
    graceUntil,
    message: 'Gracia offline vencida sin contactar al servidor. Conecta a internet para revalidar.',
  };
}

/** Alias de compatibilidad con el código existente. */
export async function getActiveLicenseStatus(): Promise<{
  isValid: boolean;
  companyName: string;
  plan: PlanType;
  machineId: string;
  locked: boolean;
  state: LicenseState;
  installId: string;
  message?: string;
}> {
  const s = await ensureActivated();
  let locked = false;
  try {
    locked = ((await db.getSystemSetting('company_name_locked')) || '') === 'true';
  } catch {
    locked = false;
  }
  return {
    isValid: s.state === 'active' || s.state === 'grace',
    companyName: s.companyName,
    plan: s.plan,
    machineId: s.machineId,
    locked,
    state: s.state,
    installId: s.installId,
    message: s.message,
  };
}

/**
 * Libera el amarre a esta PC (para cambio de equipo legítimo).
 * En modo con servidor, el servidor manda en el próximo check-in.
 */
export async function releaseHardwareBinding(): Promise<void> {
  await db.setSystemSetting('license_hwid', '');
}
