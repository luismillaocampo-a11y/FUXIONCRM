import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';
import Groq from 'groq-sdk';

export interface AiApiKeyConfig {
  id: string;
  provider: 'google' | 'groq' | 'openrouter' | 'openai';
  name: string;
  apiKey: string;
  model?: string;
  priority: number; // 1 a 4
  isActive: boolean;
}

export async function getAiApiKeysConfig(): Promise<AiApiKeyConfig[]> {
  try {
    const raw = await db.getSystemSetting('ai_api_keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a: AiApiKeyConfig, b: AiApiKeyConfig) => a.priority - b.priority);
      }
    }
  } catch (err) {
    console.error('Error reading ai_api_keys from DB:', err);
  }

  const keys: AiApiKeyConfig[] = [];
  try {
    const geminiDbKey = await db.getSystemSetting('gemini_api_key');
    const geminiKey = (geminiDbKey && geminiDbKey.trim().length > 0) ? geminiDbKey.trim() : (process.env.GEMINI_API_KEY || '');
    if (geminiKey) {
      keys.push({
        id: 'default-gemini',
        provider: 'google',
        name: 'Google Gemini (Principal)',
        apiKey: geminiKey,
        model: 'gemini-3.6-flash',
        priority: 1,
        isActive: true
      });
    }

    const groqDbKey = await db.getSystemSetting('groq_api_key');
    const groqKey = (groqDbKey && groqDbKey.trim().length > 0) ? groqDbKey.trim() : (process.env.GROQ_API_KEY || '');
    if (groqKey) {
      keys.push({
        id: 'default-groq',
        provider: 'groq',
        name: 'Groq Llama-3 (Respaldo)',
        apiKey: groqKey,
        model: 'llama-3.3-70b-versatile',
        priority: 2,
        isActive: true
      });
    }
  } catch (e) {
    console.error('Error constructing default AI keys:', e);
  }

  return keys;
}

async function getGeminiClient(): Promise<{ genAI: GoogleGenerativeAI | null; hasApiKey: boolean }> {
  try {
    const dbKey = await db.getSystemSetting('gemini_api_key');
    if (dbKey && dbKey.trim().length > 0) {
      return {
        genAI: new GoogleGenerativeAI(dbKey.trim()),
        hasApiKey: true
      };
    }
  } catch (err) {
    console.error('Error fetching gemini_api_key from DB:', err);
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (apiKey && apiKey.trim().length > 0) {
    return {
      genAI: new GoogleGenerativeAI(apiKey.trim()),
      hasApiKey: true
    };
  }

  return { genAI: null, hasApiKey: false };
}


/**
 * Summarizes/Extracts text from uploaded files (multimodal support)
 */
export async function analyzeMultimediaFile(
  fileName: string,
  fileType: string,
  fileBuffer: Buffer
): Promise<{ content: string; summary: string }> {
  const { genAI, hasApiKey } = await getGeminiClient();
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'image': 'image/jpeg',
        'mp4': 'video/mp4'
      };

      const mimeType = mimeTypes[fileType] || 'application/octet-stream';
      const filePart = {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType
        }
      };

      const prompt = `
        You are indexing this file into the Fuxion Flow CRM Knowledge Base.
        Analyze the file and provide:
        1. An exhaustive extraction of all facts, numbers, names, guidelines, and prices.
        2. A concise 2-sentence summary of what this file is about.
        Format your response as:
        [FACTS]
        (Extracted facts here)
        [SUMMARY]
        (Concise summary here)
      `;

      const result = await model.generateContent([prompt, filePart]);
      const text = result.response.text();

      let content = text;
      let summary = `Indexed facts from ${fileName}`;

      if (text.includes('[SUMMARY]')) {
        const parts = text.split('[SUMMARY]');
        content = parts[0].replace('[FACTS]', '').trim();
        summary = parts[1].trim();
      }

      return { content, summary };
    } catch (error) {
      console.error('Gemini extraction error, falling back to mock:', error);
    }
  }

  // MOCK SIMULATION MODE
  await new Promise((resolve) => setTimeout(resolve, 1500));

  let content = '';
  let summary = '';

  if (fileType === 'txt') {
    content = fileBuffer.toString('utf-8');
    const cleanLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 5 && !/^(NUNCA|REGLA|INSTRUCCION|PROHIBIDO)/i.test(l));
    summary = cleanLines.length > 0 ? cleanLines[0].slice(0, 200) : content.slice(0, 200);
  } else if (fileType === 'pdf') {
    content = `Manual Fuxion: Productos, precios y políticas. Archivo: ${fileName}`;
    summary = `Documento PDF con información de productos Fuxion.`;
  } else if (fileType === 'image') {
    content = `Imagen promocional: ${fileName}.`;
    summary = `Imagen de producto Fuxion.`;
  } else if (fileType === 'mp4') {
    content = `Video de demostración: ${fileName}.`;
    summary = `Video instruccional de Fuxion.`;
  } else {
    content = `Archivo: ${fileName}.`;
    summary = `Archivo subido: ${fileName}.`;
  }

  return { content, summary };
}

/**
 * Transcribe un archivo de audio (OGG/MP3/WAV) a texto en español utilizando Gemini 2.0 Flash
 */
export async function transcribeAudioFile(
  audioInput: Buffer | string,
  mimeType: string = 'audio/ogg'
): Promise<string | null> {
  const { genAI, hasApiKey } = await getGeminiClient();
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const base64Data = typeof audioInput === 'string'
        ? audioInput.replace(/^data:audio\/[^;]+;base64,/, '')
        : audioInput.toString('base64');

      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType
        }
      };

      const prompt = `Transcribe de forma exacta y fiel el mensaje hablado de este audio de voz enviada por un cliente en WhatsApp. Retorna ÚNICAMENTE el texto limpio en español entre comillas dobles, sin comentarios adicionales ni explicaciones.`;

      const result = await model.generateContent([prompt, filePart]);
      const text = result.response.text().trim();
      return text.replace(/^["']|["']$/g, '');
    } catch (error) {
      console.error('[Gemini STT] Error transcribiendo audio:', error);
    }
  }
  return null;
}

/**
 * Limpia texto de chat para búsqueda y prompts de IA.
 * Los mensajes con fotos/videos guardan data-URIs base64 gigantes: una sola
 * "palabra" de 100KB revienta `new RegExp` (SyntaxError) y mata la respuesta,
 * además de quemar tokens si llega al prompt. Se reemplazan por marcadores.
 */
function stripMediaBlobs(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return (
    text
      // data:image/jpeg;base64,/9j/...  ->  [foto]
      .replace(/data:(image|video|audio)\/[^;,\s]+;base64,[A-Za-z0-9+/=]+/g, ' [foto] ')
      // URLs http(s) larguísimas (raro, pero por seguridad)
      .replace(/https?:\/\/\S{500,}/g, ' [enlace] ')
  );
}

/** Versión corta y segura de un mensaje para el prompt del LLM. */
function shortenForPrompt(text: string, max = 800): string {
  const clean = stripMediaBlobs(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

/**
 * Respuesta segura cuando la IA falla o se filtra razonamiento interno.
 * Nunca contiene <think>, prompts ni tags internos visibles.
 */
export const AI_SAFE_FALLBACK =
  '¡Hola! Gracias por tu mensaje 😊 ¿En qué te puedo ayudar hoy?';

const PROMPT_LEAK_MARKERS = [
  'tono de voz y comunicaci',
  'reglas adicionales del negocio',
  'protocolo de registro oficial',
  'base de conocimientos',
  'historial de conversaci',
  'nuevo mensaje del cliente',
  'here\'s a thinking process',
  'here is a thinking process',
  'analyze user input',
  'identify intent',
  'user role/context',
  'key constraints',
  'conversation history',
  'concision extrema',
];

/**
 * Sanitiza CUALQUIER respuesta IA antes de guardarla o enviarla por WhatsApp/Meta.
 * - Elimina <think>/<thinking>/<thought> (abiertos o cerrados, con o sin cierre).
 * - Detecta eco del system-prompt y lo reemplaza por fallback seguro.
 * - Preserva [UNKNOWN] y [REGISTRO_DETECTADO:...] para la lógica interna
 *   (el caller debe quitarlos con stripInternalTagsForSending antes de enviar).
 * Defensa en profundidad: se aplica dentro de queryKnowledgeBase Y en la capa de envío.
 */
export function sanitizeAiReply(raw: unknown): string {
  if (typeof raw !== 'string') return AI_SAFE_FALLBACK;
  let text = raw;

  // 1. Preservar tags internos temporalmente
  const registroTags = text.match(/\[REGISTRO_DETECTADO:[^\]]+\]/g) || [];
  const hasUnknownToken = text.includes('[UNKNOWN]');

  // Si es solo [UNKNOWN] (+ posible registro), devolverlo intacto para el flujo de gaps
  const withoutRegistroForCheck = text.replace(/\[REGISTRO_DETECTADO:[^\]]+\]/g, ' ').trim();
  if (withoutRegistroForCheck === '[UNKNOWN]') {
    return registroTags.length > 0 ? `[UNKNOWN] ${registroTags.join(' ')}` : '[UNKNOWN]';
  }

  // 2. Eliminar bloques de razonamiento (reasoning models: DeepSeek-R1, Qwen3, etc.)
  text = text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, ' ')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, ' ')
    .replace(/<\/?think[^>]*>/gi, ' ')
    .replace(/<\/?thinking[^>]*>/gi, ' ')
    .replace(/<\/?thought[^>]*>/gi, ' ');

  // 3. Quitar blobs base64 que a veces ecoa el modelo
  text = stripMediaBlobs(text);

  // 4. Detectar eco del system-prompt: si aparecen ≥2 marcadores, es fuga, no respuesta
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let markerHits = 0;
  for (const m of PROMPT_LEAK_MARKERS) {
    if (lower.includes(m)) markerHits++;
  }
  const hasDividers = text.includes('═══') || text.includes('───');
  if (markerHits >= 2 || (hasDividers && markerHits >= 1) || lower.includes("here's a thinking process")) {
    console.warn('[sanitizeAiReply] 🛡️ Fuga de prompt/razonamiento detectada y bloqueada.');
    return registroTags.length > 0
      ? `${AI_SAFE_FALLBACK} ${registroTags.join(' ')}`
      : AI_SAFE_FALLBACK;
  }

  // 5. Quitar marcadores internos de indexación que nunca deben salir al cliente
  text = text
    .replace(/\[FACTS\]/gi, ' ')
    .replace(/\[SUMMARY\]/gi, ' ')
    .replace(/\[Producto\/Documento:[^\]]+\]/gi, ' ')
    .replace(/\[Informaci[oó]n de:[^\]]+\]/gi, ' ')
    .replace(/\[RESUMEN GENERAL[^\]]*\]/gi, ' ');

  // 6. [UNKNOWN] embebido en texto largo: no enviar el token, solo el texto
  // Si el texto es casi solo el token, tratarlo como UNKNOWN real
  text = text.replace(/\[REGISTRO_DETECTADO:[^\]]+\]/g, ' ');
  if (hasUnknownToken) {
    const tmp = text.replace(/\[UNKNOWN\]/g, ' ').trim();
    if (tmp.length < 5) {
      return registroTags.length > 0 ? `[UNKNOWN] ${registroTags.join(' ')}` : '[UNKNOWN]';
    }
    text = tmp;
  }

  // 7. Normalizar espacios y limitar tamaño WhatsApp (4096, usamos 2000 por seguridad)
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  if (!text) {
    return registroTags.length > 0 ? `${AI_SAFE_FALLBACK} ${registroTags.join(' ')}` : AI_SAFE_FALLBACK;
  }
  if (text.length > 2000) text = text.slice(0, 2000).trim() + '…';

  // 8. Re-adjuntar registro al final para que el caller lo detecte
  if (registroTags.length > 0) text = `${text} ${registroTags.join(' ')}`;
  return text;
}

/**
 * Texto realmente visible para el cliente: sin ningún tag interno.
 * Úsalo justo antes de sendMessageToPhone / sendSocialMessage / addMessage(bot).
 */
export function stripInternalTagsForSending(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\[REGISTRO_DETECTADO:[^\]]+\]/g, '')
    .replace(/\[UNKNOWN\]/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think[^>]*>/gi, '')
    .replace(/<\/?thinking[^>]*>/gi, '')
    .trim();
}

const normLite = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Extrae nombres de producto del catálogo (KB): líneas PRODUCTO: y viñetas
 * del tarifario "- Nombre (...): S/". Ordenados de largo a corto para match exacto.
 */
function extractCatalogNames(kbItems: any[]): string[] {
  const names = new Set<string>();
  for (const item of kbItems || []) {
    const text = `${item?.title || ''}\n${item?.content || ''}\n${item?.summary || ''}`;
    for (const line of text.split('\n')) {
      const t = line.trim();
      let m = t.match(/^PRODUCTO:\s*(.+)$/i);
      if (m) {
        const name = m[1].split('|')[0].trim().slice(0, 80);
        if (name.length >= 3) names.add(name);
        continue;
      }
      m = t.match(/^-\s*([^(]+?)\s*(?:\(|:)/);
      // Solo viñetas con precio (evita "Envío gratis..." como falso producto)
      if (m && /S\/|\$|precio/i.test(t)) {
        const name = m[1].trim().slice(0, 80);
        if (name.length >= 3 && /[a-zA-Z]/.test(name)) names.add(name);
      }
    }
  }
  return [...names].sort((a, b) => b.length - a.length);
}

/**
 * Detecta qué producto del catálogo recomienda una respuesta del bot.
 * Devuelve el nombre tal cual aparece en catálogo, o null.
 */
export async function detectRecommendedProduct(reply: string): Promise<string | null> {
  try {
    if (!reply || typeof reply !== 'string') return null;
    const clean = stripMediaBlobs(reply);
    if (clean.trim() === '[UNKNOWN]' || clean.includes('[REGISTRO_DETECTADO')) return null;
    const items = await db.getKBItems();
    const names = extractCatalogNames(items);
    if (names.length === 0) return null;
    const normReply = ` ${normLite(clean)} `;
    for (const name of names) {
      const n = normLite(name);
      if (n.length < 3 || n.length > 60) continue;
      // Nombre completo con bordes de palabra (evita "vera" en "primavera")
      const re = safeWordRegex(n);
      if (re && re.test(normReply)) return name;
      // Fallback: primera palabra significativa (ej. "prunex" en "Prunex 1")
      const first = n.split(/\s+/).filter((w) => w.length >= 4)[0] || '';
      if (first) {
        const reFirst = safeWordRegex(first);
        if (reFirst && reFirst.test(normReply)) return name;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Registra en el lead el producto recomendado (Fase 1 de pedidos).
 * Nunca lanza: corre en segundo plano tras responder.
 */
export async function logRecommendedProduct(leadId: string, reply: string): Promise<void> {
  try {
    if (!leadId || !reply) return;
    const product = await detectRecommendedProduct(reply);
    if (product) {
      await db.setLeadLastProduct(leadId, product);
    }
  } catch {
    /* silencioso por diseño */
  }
}

const QTY_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

/** Parsea "129.50" / "129,50" / "1,299.50" a número (últimos 2 dígitos = decimales). */
function parsePrice(raw: string): number {
  const s = raw.trim();
  if (/[.,]\d{2}$/.test(s)) {
    return Number(s.slice(0, -3).replace(/[.,]/g, '') + '.' + s.slice(-2));
  }
  return Number(s.replace(',', '.'));
}

/**
 * Precios del tarifario: nombre normalizado -> precio. Solo viñetas con S/.
 */
export async function getCatalogPrices(): Promise<Map<string, { name: string; price: number }>> {
  const out = new Map<string, { name: string; price: number }>();
  try {
    const items = await db.getKBItems();
    for (const item of items || []) {
      const text = `${item?.content || ''}\n${item?.summary || ''}`;
      for (const line of text.split('\n')) {
        const t = line.trim();
        const m = t.match(/^-\s*([^(]+?)\s*(?:\([^)]*\))?\s*:\s*S\/\s*([\d.,]+)/i);
        // Solo viñetas con precio (evita "Envío gratis..." como falso producto)
        if (!m || !/S\//i.test(t)) continue;
        const name = m[1].trim().slice(0, 80);
        const price = parsePrice(m[2]);
        if (name.length >= 3 && Number.isFinite(price) && price > 0 && price < 100000) {
          out.set(normLite(name), { name, price });
        }
      }
    }
  } catch {
    /* sin catálogo: sin precios */
  }
  return out;
}

/**
 * Extrae cantidad del último mensaje del cliente (dígitos o palabras uno..doce).
 * Ignora precios (S/), años, DNIs (8 dígitos) y teléfonos (7+ dígitos).
 */
function parseQtyFromText(text: string): number | null {
  const norm = ` ${normLite(stripMediaBlobs(text))} `;
  // Palabras: tomar la ÚLTIMA mención (intención más reciente)
  let qty: number | null = null;
  const words = norm.split(/[^a-z0-9]+/);
  for (const w of words) {
    if (QTY_WORDS[w] !== undefined) qty = QTY_WORDS[w];
  }
  // Dígitos con contexto de cantidad: "quiero 2", "2 prunex", "x2", "2 unidades/cajas"
  const digitRe =
    /(?:quiero|quieres|dame|deme|necesito|pido|pedido|separame|apuntame|anotame|llevo|me\s+das|son?)\s+(\d{1,2})\b|(\d{1,2})\s*(?:x|unidades?|cajas?|packs?|sobres?|frascos?|botellas?|latas?|bolsas?)\b/gi;
  let m: RegExpExecArray | null;
  // Evitar precios: si el número va precedido de s/, soles, $ o precio, se ignora
  while ((m = digitRe.exec(norm)) !== null) {
    const num = Number(m[1] || m[2]);
    if (!Number.isFinite(num) || num < 1 || num > 30) continue;
    const before = norm.slice(Math.max(0, (m.index || 0) - 12), m.index || 0);
    if (/s\/|soles?|\$|precio|codigo/i.test(before)) continue;
    qty = num;
  }
  // Dígitos sueltos 1-30 que no parezcan DNI/teléfono/año
  const loose = norm.match(/(?<![\d.,])(\d{1,2})(?![\d.,])/g) || [];
  for (const raw of loose) {
    const num = Number(raw);
    if (num < 1 || num > 30) continue;
    const idx = norm.indexOf(raw);
    const before = norm.slice(Math.max(0, idx - 12), idx);
    const after = norm.slice(idx + raw.length, idx + raw.length + 12);
    if (/s\/|soles?|\$|precio/i.test(before)) continue;
    if (/\d/.test(after.charAt(0)) || /\d/.test(before.slice(-1))) continue; // parte de número largo
    if (/año|ano\s|19\d\d|20\d\d/.test(before + raw)) continue;
    qty = num; // última mención válida gana
  }
  return qty;
}

/**
 * Fase 2: congela el pedido al detectar pago (producto + cantidad + total).
 * Se llama tras marcar Pending Verification. Nunca lanza.
 * Devuelve resumen o null si falta producto, cantidad o precio.
 */
export async function snapshotOrderForLead(leadId: string): Promise<{ product: string; qty: number; total: number } | null> {
  try {
    if (!leadId) return null;
    const lead = await db.getLeadById(leadId);
    if (!lead) return null;
    let product: string | null =
      typeof lead.last_product === 'string' && lead.last_product.trim() ? lead.last_product.trim() : null;
    if (!product) {
      // Reintentar detectando en las últimas respuestas del bot
      const msgs = await db.getMessages(lead.id || leadId);
      const botTexts = msgs
        .filter((m: any) => m.sender === 'bot' || m.sender === 'agent')
        .slice(-4)
        .map((m: any) => String(m.message || ''));
      for (let i = botTexts.length - 1; i >= 0; i--) {
        const found = await detectRecommendedProduct(botTexts[i]);
        if (found) {
          product = found;
          await db.setLeadLastProduct(lead.id || leadId, found);
          break;
        }
      }
    }
    if (!product) return null;

    const prices = await getCatalogPrices();
    const key = normLite(product);
    let priceEntry = prices.get(key);
    if (!priceEntry) {
      const first = key.split(/\s+/).filter((w) => w.length >= 4)[0] || '';
      for (const [k, v] of prices) {
        if (first && (k === first || k.startsWith(first + ' ') || k.includes(` ${first}`))) {
          priceEntry = v;
          break;
        }
      }
    }
    if (!priceEntry) return null;

    const msgs = await db.getMessages(lead.id || leadId);
    const customerTexts = msgs
      .filter((m: any) => m.sender === 'customer')
      .slice(-8)
      .map((m: any) => String(m.message || ''));
    let qty: number | null = null;
    for (let i = customerTexts.length - 1; i >= 0; i--) {
      const q = parseQtyFromText(customerTexts[i]);
      if (q !== null) {
        qty = q;
        break;
      }
    }
    if (qty === null) return null;

    const total = Math.round(qty * priceEntry.price * 100) / 100;
    await db.setLeadLastOrder(lead.id || leadId, qty, total);
    console.log(`[pedidos] Pedido congelado para ${leadId}: ${product} x${qty} = S/ ${total}`);
    return { product, qty, total };
  } catch {
    return null;
  }
}

/** Construye un RegExp literal seguro; si la palabra es inusable, devuelve null. */
function safeWordRegex(word: string): RegExp | null {
  if (!word || word.length > 60) return null;
  try {
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp('(?:^|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])' + escapedWord + '(?:$|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])', 'i');
  } catch {
    return null;
  }
}

/**
 * Executes a RAG pipeline query using Groq (primary) or Gemini (fallback).
 * Falls back to smart Spanish KB search mock if both APIs fail.
 * Returns "[UNKNOWN]" when no answer can be found.
 * Returns "[REGISTRO_DETECTADO:...]" embedded when registration data is captured.
 */
function retrieveRelevantContext(
  userQuestion: string, 
  kbItems: any[], 
  chatHistory: { sender: string; message: string }[] = []
): string {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const stopwords = new Set([
    'que', 'cual', 'como', 'para', 'con', 'sin', 'del', 'los', 'las', 'una',
    'uno', 'por', 'hay', 'este', 'ese', 'eso', 'esa', 'mas', 'pero', 'pues',
    'porque', 'tiene', 'tienes', 'quiero', 'queria', 'quisiera', 'dame', 'dime',
    'saber', 'decir', 'informacion', 'sobre', 'acerca', 'favor', 'gracias',
    'bueno', 'bien', 'ser', 'estar', 'tengo', 'puedo', 'puede', 'deseo',
    'necesito', 'hola', 'oye', 'mira', 'me', 'te', 'le', 'nos', 'y', 'o', 'un'
  ]);

  // Multi-Turn RAG: Extraer términos de búsqueda tanto de la pregunta como del historial reciente
  // (historial sanitizado: sin blobs base64 que revientan el RegExp)
  const recentHistoryText = chatHistory
    .slice(-4)
    .map((m) => stripMediaBlobs(m.message))
    .join(' ');
  const fullSearchText = `${stripMediaBlobs(userQuestion)} ${recentHistoryText}`;

  const queryWords = normalize(fullSearchText)
    .replace(/[¿?¡!.,;:]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  const fragments: { source: string; content: string; score: number }[] = [];

  for (const item of kbItems) {
    const rawContent = item.content || item.summary || '';
    const paragraphs = rawContent
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 5);

    for (const paragraph of paragraphs) {
      const paraNorm = normalize(paragraph);
      let score = 0;
      
      for (const w of queryWords) {
        const regex = safeWordRegex(w);
        if (regex && regex.test(paraNorm)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        fragments.push({
          source: item.title,
          content: paragraph,
          score
        });
      }
    }
  }

  // Si no hay fragmentos con alta puntuación, incluir el catálogo general completo indexado
  if (fragments.length === 0) {
    return kbItems
      .map(item => `[Producto/Documento: ${item.title}]\n${item.summary || (item.content ? item.content.slice(0, 500) : '')}`)
      .join('\n\n---\n\n');
  }

  fragments.sort((a, b) => b.score - a.score);

  const contextParts: string[] = [];
  let currentLength = 0;
  const maxLength = 6000;

  for (const frag of fragments) {
    const text = `[Información de: ${frag.source}]\n${frag.content}`;
    if (currentLength + text.length > maxLength) {
      break;
    }
    contextParts.push(text);
    currentLength += text.length;
  }

  // Siempre adjuntar un resumen general de productos para permitir razonamiento de combos
  const catalogSummary = kbItems
    .slice(0, 20)
    .map(item => `• ${item.title}: ${item.summary || (item.content ? item.content.slice(0, 150) : '')}`)
    .join('\n');

  return `${contextParts.join('\n\n---\n\n')}\n\n[RESUMEN GENERAL DEL CATÁLOGO]:\n${catalogSummary}`;
}

export async function queryKnowledgeBase(
  userQuestion: string,
  chatHistory: { sender: string; message: string }[] = []
): Promise<string> {
  const normWord = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const qNorm = normWord(userQuestion).replace(/[¿?¡!.,;:]/g, '');

  // 1. Programmatic State Guard: Prevent payment looping solo para afirmaciones posteriores
  const positiveWords = ['si', 'sí', 'claro', 'por favor', 'porfavor', 'dale', 'aceptar', 'ok', 'bueno', 'sii', 'siis', 'ya lo hice', 'ya lo mande', 'ya deposite', 'ya transferi'];
  const isPositive = positiveWords.some(w => qNorm === w || (qNorm.startsWith(w) && qNorm.length < 25));

  if (isPositive && chatHistory.length > 0) {
    const recentBotMessages = [...chatHistory]
      .reverse()
      .filter(m => m.sender === 'bot' || m.sender === 'agent')
      .slice(0, 2);

    const hasSentPaymentDetails = recentBotMessages.some(m => {
      const msgLower = (m.message || '').toLowerCase();
      return msgLower.includes('yape') || msgLower.includes('plin') || msgLower.includes('transferenci') || msgLower.includes('banco') || msgLower.includes('cuenta');
    });

    if (hasSentPaymentDetails) {
      console.log('[gemini] 🛡️ Intercepted by Payment Anti-Loop Guard');
      return '¡Perfecto! Quedo super atento al envío de la captura o foto del comprobante por aquí para verificar tu pago y registrar tu pedido de inmediato. ¡Muchas gracias!';
    }
  }

  // 1. Fetch context from indexed knowledge base AND Active Flow Nodes con Multi-Turn RAG
  const kbItems = await db.getKBItems();
  
  // Integrar dinámicamente los textos, precios y ofertas de los Nodos del Flujo Visual
  try {
    const flows = await db.getFlows();
    const activeFlows = (flows || []).filter((f: any) => f.is_active);
    for (const flow of activeFlows) {
      if (Array.isArray(flow.nodes)) {
        for (const node of flow.nodes) {
          if (node.data?.message && typeof node.data.message === 'string' && node.data.message.trim().length > 5) {
            kbItems.push({
              title: `Nodo de Flujo (${flow.name || 'Principal'} - ${node.id})`,
              content: node.data.message,
              summary: node.data.message.slice(0, 300)
            });
          }
        }
      }
    }
  } catch (flowErr) {
    console.warn('[gemini] Error loading flow nodes into RAG:', flowErr);
  }

  const contextBlock = retrieveRelevantContext(userQuestion, kbItems, chatHistory);

  // 2. Fetch custom AI behavior rules from database
  let customRulesText = 'No hay reglas adicionales configuradas.';
  try {
    const aiRules = await db.getAIRules();
    const activeRules = (aiRules || []).filter((r: any) => r.is_active);
    if (activeRules.length > 0) {
      customRulesText = activeRules
        .map((r: any, idx: number) => `${idx + 1}. [${r.category || 'General'}] ${r.title}: ${r.instruction}`)
        .join('\n');
    }
  } catch (err) {
    console.error('Error loading AI rules from DB:', err);
  }

  // 3. Scan recent history for anti-repetition Context Guard
  const recentBotMsgs = chatHistory
    .filter(m => m.sender === 'bot' || m.sender === 'agent')
    .slice(-4);

  const hasAlreadyGreeted = recentBotMsgs.some(m => {
    const lower = m.message.toLowerCase();
    return lower.includes('hola') || lower.includes('bienvenido') || lower.includes('buenas');
  });

  const hasAlreadySentPayment = recentBotMsgs.some(m => {
    const lower = m.message.toLowerCase();
    return lower.includes('yape') || lower.includes('plin') || lower.includes('transferencia') || lower.includes('banco') || lower.includes('cuenta');
  });

  const formattedHistory = chatHistory
    .slice(-8)
    .map((c) => `${c.sender.toUpperCase()}: ${shortenForPrompt(c.message)}`)
    .join('\n');

  const systemInstructions = `Eres un Asesor Comercial Humano Experto, Cálido, Empático y con Sentido Común para WhatsApp.
Tu objetivo es atender al cliente de manera natural, directa y agradable, sin sonar como un robot ni saturarlo con menús en cada mensaje.

═══════════════════════════════════════════
🌿 TONO DE VOZ Y COMUNICACIÓN NATURAL
═══════════════════════════════════════════
1. RESPUESTAS CORTAS Y PRECISAS (Estilo WhatsApp real):
   - Responde puntualmente lo que el cliente pregunta (precios, beneficios, cómo tomar, envíos o formas de pago).
   - Sé breve y conversacional (1 a 3 párrafos cortos como máximo). Evita textos largos o explicaciones innecesarias.

2. ¿CUÁNDO USAR OPCIONES / MENÚS?
   - ⚠️ NO OBLIGUES AL CLIENTE CON MENÚS EN CADA RESPUESTA.
   - Solo sugiere opciones breves si el cliente está explorando o muy indeciso (ej: "Si gustas te puedo detallar los beneficios de Thermo T3 o Prunex1").
   - Si el cliente ya está avanzando en su compra (pidiendo números de cuenta, preguntando por envíos o enviando comprobantes), NO incluyas listas de opciones como "¿Cómo deseas continuar?". Sé 100% resolutivo.

3. PAGOS Y COMPROBANTES:
   - Si pregunta por métodos de pago o número para yapear/transferir, da el dato directo y pídele amablemente que te pase la captura: "El número para Yape o Plin es 955252932. Al realizarlo me envías la captura por aquí para confirmar tu pedido 😊".
   - Si ya envió el comprobante o está en proceso de pago, agradécele y confirma los datos de entrega de forma natural.

4. CONTROL DE SALUDOS:
   - ${hasAlreadyGreeted ? '⚠️ YA SE SALUDÓ AL CLIENTE. NO vuelvas a decir Hola/Bienvenido. Ve directo al grano.' : 'Saluda de forma cálida y breve.'}
   - ${hasAlreadySentPayment ? '⚠️ LOS DATOS DE PAGO YA FUERON ENVIADOS. Solicita únicamente la captura del comprobante si aún no la envió.' : ''}

5. LENGUAJE SEGURO Y ÉTICO:
   - No prometas curas médicas mágicas. Usa términos como "ayuda a", "apoya a", "favorece tu bienestar".
   - ÚNICAMENTE responde [UNKNOWN] si la pregunta es totalmente ajena al negocio (política internacional, deportes no relacionados, etc.).

═══════════════════════════════════════════
⚙️ REGLAS ADICIONALES DEL NEGOCIO
═══════════════════════════════════════════
${customRulesText}

═══════════════════════════════════════════
📋 PROTOCOLO DE REGISTRO OFICIAL
═══════════════════════════════════════════
Si el cliente proporciona sus datos de envío/registro, responde confirmando y añade al final:
[REGISTRO_DETECTADO:{nombre}|{dni}|{celular}|{correo}]

---
BASE DE CONOCIMIENTOS (CATÁLOGO Y DOCUMENTOS):
${contextBlock}
---
HISTORIAL DE CONVERSACIÓN RECIENTE:
${formattedHistory}
---
NUEVO MENSAJE DEL CLIENTE:
${userQuestion}`;

  // ─── Dynamic AI Key Cascade Execution (Priorities 1 to 4) ──────────────────────
  const aiKeys = await getAiApiKeysConfig();
  const activeKeys = aiKeys.filter(k => k.isActive && k.apiKey && k.apiKey.trim().length > 0);

  for (const keyConfig of activeKeys) {
    try {
      console.log(`[ai-cascade] Intentando proveedor #${keyConfig.priority}: ${keyConfig.name} (${keyConfig.provider})`);

      // Micro-human cadence delay (1.2s - 2.2s) for anti-ban rate safety
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 1000));

      if (keyConfig.provider === 'google') {
        const genAI = new GoogleGenerativeAI(keyConfig.apiKey.trim());
        const selectedModel = keyConfig.model || 'gemini-2.0-flash';
        const model = genAI.getGenerativeModel({ model: selectedModel });
        const result = await model.generateContent(systemInstructions);
        const text = result.response.text().trim();
        if (text) {
          console.log(`[ai-cascade] ✅ Respuesta exitosa con Google Gemini (${selectedModel})`);
          return sanitizeAiReply(text);
        }
      }

      if (keyConfig.provider === 'groq') {
        const groqClient = new Groq({ apiKey: keyConfig.apiKey.trim() });
        const selectedModel = keyConfig.model || 'llama-3.3-70b-versatile';
        
        try {
          const chatCompletion = await groqClient.chat.completions.create({
            messages: [{ role: 'user', content: systemInstructions }],
            model: selectedModel,
            temperature: 0.2,
            max_tokens: 500,
          });
          const result = chatCompletion.choices[0]?.message?.content?.trim();
          if (result) {
            console.log(`[ai-cascade] ✅ Respuesta exitosa con Groq (${selectedModel})`);
            return sanitizeAiReply(result);
          }
        } catch (groqErr: any) {
          // Si el modelo específico no existe o cambió, intentar listar los activos de la cuenta
          if (groqErr?.message?.includes('model_not_found') || groqErr?.status === 404) {
            console.warn(`[ai-cascade] ⚠️ Modelo ${selectedModel} no disponible en Groq. Buscando modelo activo alternativo...`);
            const modelsList = await groqClient.models.list();
            const availableIds = (modelsList.data || []).map((m: any) => m.id);
            if (availableIds.length > 0) {
              const fallbackModel = availableIds[0];
              console.log(`[ai-cascade] 🔄 Reintentando con modelo disponible: ${fallbackModel}`);
              const retryCompletion = await groqClient.chat.completions.create({
                messages: [{ role: 'user', content: systemInstructions }],
                model: fallbackModel,
                temperature: 0.2,
                max_tokens: 500,
              });
              const retryResult = retryCompletion.choices[0]?.message?.content?.trim();
              if (retryResult) return sanitizeAiReply(retryResult);
            }
          }
          throw groqErr;
        }
      }

      if (keyConfig.provider === 'openrouter') {
        const selectedModel = keyConfig.model || 'openrouter/auto';
        const modelsArray = selectedModel === 'openrouter/auto' 
          ? ["google/gemma-2-9b-it:free", "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free", "openrouter/auto"]
          : [selectedModel, "openrouter/auto"];

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${keyConfig.apiKey.trim()}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nutraflow.crm",
            "X-Title": "NutraFlow CRM"
          },
          body: JSON.stringify({
            models: modelsArray,
            messages: [{ role: "user", content: systemInstructions }],
            max_tokens: 500,
            temperature: 0.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data?.choices?.[0]?.message?.content?.trim();
          if (reply) {
            console.log(`[ai-cascade] ✅ Respuesta exitosa con OpenRouter (${data.model || selectedModel})`);
            return sanitizeAiReply(reply);
          }
        } else {
          const errText = await response.text();
          console.warn(`[ai-cascade] ⚠️ OpenRouter HTTP ${response.status}: ${errText}`);
        }
      }

      if (keyConfig.provider === 'openai') {
        const selectedModel = keyConfig.model || 'gpt-4o-mini';
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${keyConfig.apiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: "user", content: systemInstructions }],
            max_tokens: 500,
            temperature: 0.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data?.choices?.[0]?.message?.content?.trim();
          if (reply) {
            console.log(`[ai-cascade] ✅ Respuesta exitosa con OpenAI (${selectedModel})`);
            return sanitizeAiReply(reply);
          }
        } else {
          const errText = await response.text();
          console.warn(`[ai-cascade] ⚠️ OpenAI HTTP ${response.status}: ${errText}`);
        }
      }

    } catch (error: any) {
      console.warn(`[ai-cascade] ⚠️ Proveedor #${keyConfig.priority} (${keyConfig.name}) falló/excedió límite: ${error?.message || error}. Probando siguiente prioridad...`);
    }
  }

  // ─── SMART MOCK (no API key / both APIs failed) ───────────────────────────
  // Searches the actual KB content using Spanish keyword matching.
  console.warn('[gemini] No API available — using smart KB mock');
  await new Promise((resolve) => setTimeout(resolve, 600));

  const normalizeMock = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const qNormMock = normalizeMock(stripMediaBlobs(userQuestion)).replace(/[¿?¡!.,;:]/g, '').trim();

  // 1. Detectar respuestas cortas afirmativas/negativas basadas en el historial
  const positiveWordsMock = ['si', 'sí', 'claro', 'por favor', 'porfavor', 'quiero', 'dale', 'aceptar', 'ok', 'bueno', 'sii', 'siis'];
  const negativeWordsMock = ['no', 'gracias', 'despues', 'luego', 'cancelar', 'no gracias'];

  const isPositiveMock = positiveWordsMock.some(w => qNormMock === w);
  const isNegativeMock = negativeWordsMock.some(w => qNormMock === w);

  if ((isPositiveMock || isNegativeMock) && chatHistory.length > 0) {
    const lastBotMessage = [...chatHistory].reverse().find(m => m.sender === 'bot' || m.sender === 'agent')?.message || '';
    const lastBotLower = lastBotMessage.toLowerCase();
    
    if (lastBotLower.includes('solicitarlo hoy mismo') || lastBotLower.includes('programar la compra') || lastBotLower.includes('programado el pago')) {
      if (isPositiveMock) {
        return '¡Excelente! Para activar tu cuenta oficial de Cliente Preferente y programar tu entrega necesito los siguientes datos en un solo mensaje:\n\n1️⃣ Nombres y Apellidos completos\n2️⃣ Número de DNI\n3️⃣ Número de Celular\n4️⃣ Correo electrónico';
      } else {
        return 'Entendido. Quedo atento a cuando desees realizar tu pedido o si tienes alguna otra consulta. ¡Que tengas un excelente día! 😊';
      }
    }
  }

  // 2. Saludos
  const greetingWords = ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello', 'saludos', 'buen dia', 'hla'];
  if (greetingWords.some(g => qNormMock.split(/\s+/).includes(g))) {
    return '¡Hola! Bienvenido a Fuxion Perú 😊 ¿En qué puedo ayudarte hoy? ¿Buscas algún producto en especial?';
  }

  const stopwords = new Set([
    'que', 'cual', 'como', 'para', 'con', 'sin', 'del', 'los', 'las', 'una',
    'uno', 'por', 'hay', 'este', 'ese', 'eso', 'esa', 'mas', 'pero', 'pues',
    'porque', 'tiene', 'tienes', 'quiero', 'queria', 'quisiera', 'dame', 'dime',
    'saber', 'decir', 'informacion', 'sobre', 'acerca', 'favor', 'gracias',
    'bueno', 'bien', 'ser', 'estar', 'tengo', 'puedo', 'puede', 'deseo',
    'necesito', 'hola', 'oye', 'mira', 'me', 'te', 'le', 'nos', 'y', 'o', 'un'
  ]);

  const queryWords = qNormMock
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (queryWords.length === 0) {
    return '¡Hola! ¿En qué producto Fuxion puedo ayudarte hoy? 😊';
  }

  // 3. Buscar coincidencia por fragmentos/párrafos, títulos y resúmenes
  let bestScore = 0;
  let bestFragments: string[] = [];

  for (const item of kbItems) {
    const rawContent = (item.title || '') + '\n' + (item.summary || '') + '\n' + (item.content || '');
    const paragraphs = rawContent
      .split(/\n+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 5);

    for (const para of paragraphs) {
      const paraNorm = normalizeMock(para);
      const score = queryWords.filter(w => {
        const regex = safeWordRegex(w);
        return regex ? regex.test(paraNorm) : false;
      }).length;

      if (score > bestScore) {
        bestScore = score;
        bestFragments = [para];
      } else if (score === bestScore && score > 0 && bestFragments.length < 2) {
        bestFragments.push(para);
      }
    }
  }

  if (bestScore > 0) {
    const bestPara = bestFragments[0];
    const isInternalRule = /^(NUNCA|REGLA|INSTRUCCION|PROHIBIDO|Contenido de texto)/i.test(bestPara.trim());
    if (!isInternalRule) {
      const answerMatch = bestPara.match(/Answer:\s*([\s\S]+)$/i);
      let snippet = answerMatch ? answerMatch[1].trim() : bestPara;
      snippet = snippet.replace(/Question:[\s\S]+?Answer:/i, '').trim();

      // Limpiar etiquetas internas como RESPUESTA_CORTA_VENDEDORA:, BENEFICIO:, SINTOMAS_CLAVE:, etc.
      snippet = snippet.replace(/^(RESPUESTA_CORTA_VENDEDORA|PRODUCTO|BENEFICIO|SINTOMAS_CLAVE|PRESENTACION|DESCRIPCIÓN|DESCRIPCION):\s*/i, '').trim();

      return sanitizeAiReply(`${snippet}\n\n¿Te gustaría solicitarlo hoy mismo? 😊`);
    }
  }

  // Fallback seguro cuando la pregunta no coincide con productos o es una consulta general
  return 'Con gusto te ayudo con información sobre nuestros productos Fuxion. 😊 ¿Buscas algún producto en especial o te gustaría ver las opciones del menú?';
}
