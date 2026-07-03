import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';
import Groq from 'groq-sdk';

const apiKey = process.env.GEMINI_API_KEY || '';
const hasApiKey = Boolean(apiKey);

// Initialize Gemini SDK if API key is present
const genAI = hasApiKey ? new GoogleGenerativeAI(apiKey) : null;

let groqClient: any = null;
let hasGroqKey = false;
if (process.env.GROQ_API_KEY) {
  try {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    hasGroqKey = true;
    console.log('Groq SDK initialized successfully');
  } catch (e) {
    console.error('Groq init error:', e);
  }
}

/**
 * Summarizes/Extracts text from uploaded files (multimodal support)
 */
export async function analyzeMultimediaFile(
  fileName: string,
  fileType: string,
  fileBuffer: Buffer
): Promise<{ content: string; summary: string }> {
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    summary = `Contenido de texto de ${fileName} — ${content.length} caracteres indexados.`;
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
 * Executes a RAG pipeline query using Groq (primary) or Gemini (fallback).
 * Falls back to smart Spanish KB search mock if both APIs fail.
 * Returns "[UNKNOWN]" when no answer can be found.
 * Returns "[REGISTRO_DETECTADO:...]" embedded when registration data is captured.
 */
export async function queryKnowledgeBase(
  userQuestion: string,
  chatHistory: { sender: string; message: string }[] = []
): Promise<string> {
  // 1. Fetch context from indexed knowledge base
  const kbItems = await db.getKBItems();
  const contextBlock = kbItems
    .map((item) => `[Archivo: ${item.title} (${item.file_type})]\n${item.content}`)
    .join('\n\n---\n\n');

  const formattedHistory = chatHistory
    .slice(-8)
    .map((c) => `${c.sender.toUpperCase()}: ${c.message}`)
    .join('\n');

  const systemInstructions = `Eres un asesor comercial experto de Fuxion Perú. Tu único objetivo es CERRAR VENTAS de forma ágil y directa.

═══════════════════════════════════════════
REGLA SUPREMA — RESTRICCIÓN DE CONOCIMIENTO
═══════════════════════════════════════════
La Base de Conocimientos es de lectura INTERNA EXCLUSIVA. JAMÁS copies, pegues ni transcribas fragmentos extensos, listas de ingredientes o textos técnicos al chat. Úsala solo para diagnosticar y recomendar de forma ultra resumida.
Si la información NO está en la Base de Conocimientos, responde EXACTAMENTE: [UNKNOWN]

═══════════════════════════════════════════
ESTILO DE RESPUESTA OBLIGATORIO
═══════════════════════════════════════════
- Máximo 2 a 3 líneas por mensaje. Directo, empático, orientado a la acción.
- Sin etiquetas internas, encabezados ni divisiones técnicas visibles.
- Emojis permitidos con moderación para hacer el mensaje dinámico.
- CADA recomendación de producto DEBE terminar con una pregunta de cierre (CTA).
  Ejemplos: "¿Te gustaría solicitarlo hoy mismo?", "¿Lo programamos para entregártelo?", "¿Deseas que te arme el pedido ahora?"

═══════════════════════════════════════════
LOGÍSTICA Y PAGOS
═══════════════════════════════════════════
- Tiempo de entrega estándar: 24 a 48 horas.
- Al confirmar interés del cliente, solicitar en UN SOLO mensaje: Ciudad/Distrito, Dirección exacta y referencia de ubicación.
- Canales de pago ÚNICOS habilitados:
  • Yape al 955252932 (Luis Milla)
  • Plin al 955252932 (Luis Milla)
  • Transferencia al 955252932 (Luis Milla)

═══════════════════════════════════════════
PROGRAMA DE FIDELIZACIÓN (HERRAMIENTA DE ENGANCHE)
═══════════════════════════════════════════
El cliente recibe 1 producto GRATIS al acumular:
  • 80 puntos en compras regulares (equivale a 4 cajas) en máx. 12 semanas.
  • 60 puntos en Club Autoenvío (equivale a 3 cajas) en máx. 12 semanas.
Canje: automático en la web oficial. El cliente inicia sesión, agrega al carrito y el sistema le permite elegir su caja gratis antes de pagar.
Usa este programa como herramienta de enganche cuando el cliente dude o pregunte por descuentos.

═══════════════════════════════════════════
PROTOCOLO DE REGISTRO OFICIAL — CRÍTICO
═══════════════════════════════════════════
Si el cliente acepta el registro oficial de Cliente Preferente, solicita en UN SOLO mensaje:
"Para activar tu cuenta oficial necesito: 1️⃣ Nombres y Apellidos completos 2️⃣ Número de DNI 3️⃣ Número de Celular 4️⃣ Correo electrónico"

DETECCIÓN AUTOMÁTICA DE DATOS DE REGISTRO:
Cuando el cliente proporcione los 4 datos (nombre completo, DNI, celular, correo) en su mensaje o en mensajes recientes del historial, DEBES:

1. Responder con este mensaje EXACTO de confirmación (cópialo tal cual, sin modificar):
"¡Excelente! Ya recibí tus datos completos. Los estoy pasando al sistema de validación para activar tu cuenta oficial de Cliente Preferente. Mantente muy atento a tu celular porque en unos minutos te vamos a llamar para confirmar tu código de seguridad y dejar activada tu caja de regalo hoy mismo. ¡Muchas gracias!"

2. Agregar en el siguiente renglón (separado por salto de línea) la pregunta:
"Mientras procesamos tu registro y te llamamos, ¿cómo te gustaría dejar programado el pago de tu pedido de hoy? ¿Por Yape o transferencia?"

3. Al FINAL de toda la respuesta, en una línea nueva, insertar la etiqueta de sistema:
[REGISTRO_DETECTADO:{nombre}|{dni}|{celular}|{correo}]
Sustituye {nombre}, {dni}, {celular}, {correo} con los datos reales que el cliente proporcionó.

═══════════════════════════════════════════
GESTIÓN DE CONVERSACIÓN
═══════════════════════════════════════════
- NO repetir información ya dada en el historial.
- Avanzar siempre hacia el cierre de venta.
- Si el usuario pregunta algo fuera de la KB: [UNKNOWN]

---
BASE DE CONOCIMIENTOS (SOLO LECTURA INTERNA — NO TRANSCRIBIR AL CLIENTE):
${contextBlock}
---
HISTORIAL DE CONVERSACIÓN:
${formattedHistory}
---
NUEVO MENSAJE DEL CLIENTE:
${userQuestion}`;

  // ─── Priority 1: Gemini (primary engine) ────────────────────────────────────
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(systemInstructions);
      const text = result.response.text().trim();
      console.log('[gemini] Gemini response OK');
      return text;
    } catch (error: any) {
      const msg: string = error?.message || String(error);
      const isQuotaError =
        error?.status === 429 ||
        msg.includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('too many requests') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('resource_exhausted');

      if (isQuotaError) {
        console.warn('[gemini] ⚠️ Gemini 429/quota exceeded — switching to Groq/Llama-3 automatically');
      } else {
        console.error('[gemini] Gemini error:', msg, '— trying Groq fallback');
      }
      // Fall through to Groq regardless of error type
    }
  }

  // ─── Priority 2: Groq / Llama-3 (automatic failover) ───────────────────────
  if (hasGroqKey && groqClient) {
    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: systemInstructions }],
        model: 'llama3-8b-8192',   // Llama 3 — fast, free, high quota
        temperature: 0.2,
        max_tokens: 500,
      });
      const result = chatCompletion.choices[0]?.message?.content?.trim() || '[UNKNOWN]';
      console.log('[gemini] Groq/Llama-3 fallback response OK');
      return result;
    } catch (error: any) {
      console.error('[gemini] Groq fallback also failed:', error?.message);
    }
  }

  // ─── SMART MOCK (no API key / both APIs failed) ───────────────────────────
  // Searches the actual KB content using Spanish keyword matching.
  console.warn('[gemini] No API available — using smart KB mock');
  await new Promise((resolve) => setTimeout(resolve, 600));

  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const qNorm = normalize(userQuestion).replace(/[¿?¡!.,;:]/g, '');

  // Saludos
  const greetingWords = ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello', 'saludos', 'buen dia'];
  if (greetingWords.some(g => qNorm.includes(g))) {
    return '¡Hola! Bienvenido a Fuxion Perú 😊 ¿En qué puedo ayudarte hoy? ¿Buscas algún producto en especial?';
  }

  // Stopwords to ignore when extracting query keywords
  const stopwords = new Set([
    'que', 'cual', 'como', 'para', 'con', 'sin', 'del', 'los', 'las', 'una',
    'uno', 'por', 'hay', 'este', 'ese', 'eso', 'esa', 'mas', 'pero', 'pues',
    'porque', 'tiene', 'tienes', 'quiero', 'queria', 'quisiera', 'dame', 'dime',
    'saber', 'decir', 'informacion', 'sobre', 'acerca', 'favor', 'gracias',
    'bueno', 'bien', 'ser', 'estar', 'tengo', 'puedo', 'puede', 'deseo',
    'necesito', 'hola', 'oye', 'mira', 'hay', 'me', 'te', 'le', 'nos'
  ]);

  const queryWords = qNorm
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (queryWords.length === 0) {
    return '¡Hola! ¿En qué producto Fuxion puedo ayudarte hoy? 😊';
  }

  // Search KB content: score each line by how many query words it contains
  let bestScore = 0;
  let bestLines: string[] = [];

  for (const item of kbItems) {
    const lines = item.content
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 8);

    for (const line of lines) {
      const lineNorm = normalize(line);
      const score = queryWords.filter(w => lineNorm.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestLines = [line];
      } else if (score === bestScore && score > 0 && bestLines.length < 3) {
        bestLines.push(line);
      }
    }
  }

  if (bestScore > 0) {
    // Return a condensed answer from the best matching lines
    const snippet = bestLines
      .slice(0, 2)
      .join(' ')
      .replace(/\s+/g, ' ')
      .substring(0, 280);
    return `${snippet}\n\n¿Te gustaría solicitarlo hoy mismo? 😊`;
  }

  // Nothing found — trigger shadow mode
  return '[UNKNOWN]';
}
