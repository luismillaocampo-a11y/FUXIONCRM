// Utilidades de leads compartidas (cliente y servidor, sin dependencias Node).
// Fuente única para: variantes de teléfono, ids asociados, formato y
// traducción de estados, y lead scoring. Antes triplicadas en
// app/page.tsx, LeadsView, KanbanView y DashboardView.

export const IDENTITY_MAPPING: { [key: string]: string[] } = {
  '51955252932': ['51955252932', '955252932'],
  '955252932': ['51955252932', '955252932'],
  '51900401930': ['51900401930', '900401930'],
  '900401930': ['51900401930', '900401930']
};

export function getPhoneVariants(input: string): string[] {
  if (!input || typeof input !== 'string') return [];
  const variants = new Set<string>();
  variants.add(input);

  const clean = input.replace(/\D/g, '');
  if (clean) {
    variants.add(clean);
    let nineDigits = clean;
    if (clean.startsWith('51') && clean.length >= 11) {
      nineDigits = clean.substring(2);
    }
    if (nineDigits.length === 9) {
      variants.add(nineDigits);
      variants.add('51' + nineDigits);
      variants.add('+51' + nineDigits);
      variants.add('+51 ' + nineDigits);
    }
  }
  return Array.from(variants);
}

export function getAssociatedIds(lead: any): string[] {
  if (!lead) return [];
  const ids = new Set<string>();
  if (typeof lead === 'string') {
    getPhoneVariants(lead).forEach((v) => ids.add(v));
    return Array.from(ids);
  }
  if (lead.id) {
    getPhoneVariants(lead.id).forEach((v) => ids.add(v));
    ids.add(lead.id);
  }
  if (lead.phone) {
    getPhoneVariants(lead.phone).forEach((v) => ids.add(v));
    ids.add(lead.phone);
  }
  if (lead.whatsapp_lid) {
    getPhoneVariants(lead.whatsapp_lid).forEach((v) => ids.add(v));
    ids.add(lead.whatsapp_lid);
  }

  const staticEquivs = IDENTITY_MAPPING[lead.id] || (lead.phone && IDENTITY_MAPPING[lead.phone]);
  if (staticEquivs) {
    staticEquivs.forEach((id) => ids.add(id));
  }

  const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
  if (cleanPhone) {
    ids.add(cleanPhone);
    const nineDigits = cleanPhone.startsWith('51') && cleanPhone.length > 2 ? cleanPhone.substring(2) : cleanPhone;
    if (nineDigits.length === 9) {
      ids.add(nineDigits);
      ids.add('51' + nineDigits);
    }
  }
  return Array.from(ids);
}

/** Extrae dígitos de un JID de WhatsApp (con auto-prefijo 51 para móviles PE). */
export function getPhoneFromWhatsappId(id: string): string | null {
  if (!id || typeof id !== 'string') return null;
  const raw = id.split('@')[0] || '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) {
    digits = '51' + digits;
  }
  return digits.length > 0 ? digits : null;
}

/** Un LID de WhatsApp mide 14+ dígitos; teléfonos reales (incluso AR 13) miden 13 o menos. */
export function isLidDigits(cleanDigits: string, knownLid = ''): boolean {
  if (!cleanDigits) return false;
  if (knownLid.length >= 14 && cleanDigits === knownLid) return true;
  return cleanDigits.length >= 14;
}

function resolveRealPhone(lead: any, allLeads: any[] = []): string {
  const knownLid = typeof lead.whatsapp_lid === 'string' ? lead.whatsapp_lid.replace(/\D/g, '') : '';
  const lidEvidence = knownLid.length >= 14 ? knownLid : '';
  const candidates = [lead.real_phone, lead.phone, lead.id, lead.whatsapp_lid].filter(
    (v) => typeof v === 'string' && v.replace(/\D/g, '')
  );
  for (const c of candidates) {
    const d = c.replace(/\D/g, '');
    if (d.length === 0) continue;
    if (lidEvidence ? d !== lidEvidence && d.length < 14 : d.length < 14) return c;
  }
  // 2. Buscar hermano con el mismo LID que sí tenga teléfono corto
  const lidValues = candidates.map((c) => c.replace(/\D/g, '')).filter((d) => d.length >= 14);
  if (lidValues.length > 0 && Array.isArray(allLeads)) {
    for (const other of allLeads) {
      if (!other || other.id === lead.id) continue;
      const otherVals = [other.id, other.phone, other.whatsapp_lid]
        .filter((v) => typeof v === 'string')
        .map((v) => v.replace(/\D/g, ''));
      const linked = lidValues.some((lid) => otherVals.includes(lid));
      if (!linked) continue;
      const short = [other.real_phone, other.phone].filter(
        (v) => typeof v === 'string' && v.replace(/\D/g, '') && v.replace(/\D/g, '').length < 14
      );
      if (short.length > 0) return short[0];
    }
  }
  const lid = candidates.map((c) => c.replace(/\D/g, '')).find((d) => d.length >= 14);
  return lid ? `LID:${lid}` : '';
}

export function formatLeadPhone(lead: any, allLeads: any[] = []): string {
  if (!lead) return 'Sin teléfono';
  const resolved = resolveRealPhone(lead, allLeads);

  if (resolved.startsWith('LID:')) {
    const lid = resolved.slice(4);
    return `ID temporal ···${lid.slice(-6)}`;
  }

  const cleanDigits = resolved.replace(/\D/g, '');
  if (!cleanDigits) return 'Sin teléfono';

  if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
    return `+51 ${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6)}`;
  }
  if (cleanDigits.length === 11 && cleanDigits.startsWith('519')) {
    const nine = cleanDigits.slice(2);
    return `+51 ${nine.slice(0, 3)} ${nine.slice(3, 6)} ${nine.slice(6)}`;
  }
  if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
    return `+${cleanDigits}`;
  }
  return `+${cleanDigits}`;
}

/**
 * Traduce el estado interno (inglés, clave de BD) a español accionable para la UI.
 * Los valores en BD no cambian; solo lo que ve el usuario.
 */
export function translateLeadStatus(status: unknown): string {
  switch (status) {
    case 'New':
      return 'Nuevo · sin atender';
    case 'Engaged':
      return 'En conversación';
    case 'Pending Verification':
      return 'Esperando pago';
    case 'Por Registrar en Web':
      return 'Por registrar en web';
    case 'Converted':
      return 'Venta cerrada';
    case 'Archived':
      return 'Archivado';
    default:
      return typeof status === 'string' && status ? status : 'Nuevo · sin atender';
  }
}

function safeTagsOf(lead: any): string[] {
  try {
    const t = typeof lead?.tags === 'string' ? JSON.parse(lead.tags) : lead?.tags || [];
    return Array.isArray(t) ? t : [];
  } catch {
    return Array.isArray(lead?.tags) ? lead.tags : [];
  }
}

/** Puntaje de intención de compra 0-100 (misma fórmula en todo el CRM). */
export function calculateScore(lead: any): number {
  if (!lead) return 0;
  let score = 0;
  const tagsList = safeTagsOf(lead).filter((t) => typeof t === 'string');

  if (tagsList.includes('hot-lead')) score += 25;
  if (tagsList.includes('interested') || tagsList.includes('interesado')) score += 10;
  if (tagsList.includes('needs-verification') || tagsList.includes('ready-to-buy')) score += 15;

  if (lead.status === 'Pending Verification') score += 20;
  if (lead.status === 'Por Registrar en Web') score += 30;
  if (lead.status === 'Converted') score += 50;

  if (lead.unread_count > 0) score += 10;

  return Math.min(score, 100);
}
