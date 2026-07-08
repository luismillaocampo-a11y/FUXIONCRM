import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';
import Groq from 'groq-sdk';

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
  const { genAI, hasApiKey } = await getGeminiClient();
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
function retrieveRelevantContext(userQuestion: string, kbItems: any[]): string {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const qNorm = normalize(userQuestion).replace(/[¿?¡!.,;:]/g, '');
  
  const stopwords = new Set([
    'que', 'cual', 'como', 'para', 'con', 'sin', 'del', 'los', 'las', 'una',
    'uno', 'por', 'hay', 'este', 'ese', 'eso', 'esa', 'mas', 'pero', 'pues',
    'porque', 'tiene', 'tienes', 'quiero', 'queria', 'quisiera', 'dame', 'dime',
    'saber', 'decir', 'informacion', 'sobre', 'acerca', 'favor', 'gracias',
    'bueno', 'bien', 'ser', 'estar', 'tengo', 'puedo', 'puede', 'deseo',
    'necesito', 'hola', 'oye', 'mira', 'me', 'te', 'le', 'nos', 'y', 'o', 'un'
  ]);

  const queryWords = qNorm
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (queryWords.length === 0) {
    return kbItems
      .map(item => `[Archivo: ${item.title}]\n${item.summary || (item.content ? item.content.slice(0, 400) : '')}`)
      .join('\n\n---\n\n');
  }

  const fragments: { source: string; content: string; score: number }[] = [];

  for (const item of kbItems) {
    const rawContent = item.content || '';
    const paragraphs = rawContent
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 10);

    for (const paragraph of paragraphs) {
      const paraNorm = normalize(paragraph);
      let score = 0;
      
      for (const w of queryWords) {
        const escapedWord = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('(?:^|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])' + escapedWord + '(?:$|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])', 'i');
        if (regex.test(paraNorm)) {
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

  if (fragments.length === 0) {
    return kbItems
      .map(item => `[Archivo: ${item.title}]\n${item.summary || (item.content ? item.content.slice(0, 400) : '')}`)
      .join('\n\n---\n\n');
  }

  fragments.sort((a, b) => b.score - a.score);

  let contextParts: string[] = [];
  let currentLength = 0;
  const maxLength = 5000;

  for (const frag of fragments) {
    const text = `[Fragmento de: ${frag.source}]\n${frag.content}`;
    if (currentLength + text.length > maxLength) {
      break;
    }
    contextParts.push(text);
    currentLength += text.length;
  }

  return contextParts.join('\n\n---\n\n');
}

export async function queryKnowledgeBase(
  userQuestion: string,
  chatHistory: { sender: string; message: string }[] = []
): Promise<string> {
  const normWord = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const qNorm = normWord(userQuestion).replace(/[¿?¡!.,;:]/g, '');

  // 1. Programmatic State Guard: Prevent payment looping
  const positiveWords = ['si', 'sí', 'claro', 'por favor', 'porfavor', 'quiero', 'dale', 'aceptar', 'ok', 'bueno', 'sii', 'siis', 'ya', 'listo', 'ya lo hice', 'ya lo mande', 'si ahora', 'ya esta', 'ya esta pago'];
  const isPositive = positiveWords.some(w => qNorm === w || qNorm.startsWith(w));

  if (isPositive && chatHistory.length > 0) {
    const recentBotMessages = [...chatHistory]
      .reverse()
      .filter(m => m.sender === 'bot' || m.sender === 'agent')
      .slice(0, 2);

    const hasSentPaymentDetails = recentBotMessages.some(m => {
      const msgLower = m.message.toLowerCase();
      return msgLower.includes('955252932') || msgLower.includes('yape') || msgLower.includes('plin') || msgLower.includes('transferenci');
    });

    if (hasSentPaymentDetails) {
      console.log('[gemini] 🛡️ Intercepted by Payment Anti-Loop Guard');
      return '¡Perfecto! Quedo super atento al envío de la captura del comprobante por aquí para registrar tu pedido de inmediato. ¡Muchas gracias!';
    }
  }

  // 1. Fetch context from indexed knowledge base
  const kbItems = await db.getKBItems();
  const contextBlock = retrieveRelevantContext(userQuestion, kbItems);

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
- Canales de pago ÚNICOS habilitados:
  • Yape al 955252932 (Luis Milla)
  • Plin al 955252932 (Luis Milla)
  • Transferencia al 955252932 (Luis Milla)

═══════════════════════════════════════════
CIERRE DE COMPRA Y CAPTURA DE DATOS — CRÍTICO
═══════════════════════════════════════════
Si el cliente responde afirmativamente al cierre (ej: "si", "sí", "quiero comprar", "pídemelo", etc.), debes avanzar de inmediato siguiendo estas reglas estrictas basándote en el HISTORIAL:

1. ¿EL CLIENTE YA ENVIÓ SU DIRECCIÓN O UBICACIÓN EN EL HISTORIAL?
   - Si NO la ha enviado: Solicita sus datos en un solo mensaje: "¡Excelente elección! Para programar tu entrega de inmediato, por favor envíame en un solo mensaje: 📍 Ciudad/Distrito, 📍 Dirección exacta y 📍 Referencia de ubicación."
   - Si SÍ la tiene (ej: el cliente ya escribió su calle, distrito o dirección en el historial): NO la vuelvas a pedir. Pasa al paso 2.

2. ¿EL HISTORIAL (BOT:) YA MUESTRA QUE SE LE ENVIARON LOS DATOS DE PAGO (YAPE/PLIN)?
   - Si el último mensaje de "BOT:" ya contiene las palabras "Yape", "Plin" o el número "955252932": NO repitas la información de pago. Responde textualmente: "¡Perfecto! Quedo super atento al envío de la captura del comprobante por aquí para registrar tu pedido de inmediato. ¡Muchas gracias!"
   - Si NO se le han enviado los datos de pago en el historial: Envíale las opciones de pago en un solo mensaje: "¡Genial! Puedes realizar el pago mediante Yape, Plin o transferencia bancaria al celular 955252932 (Luis Milla). Una vez realizado, me envías la captura de tu comprobante por aquí para agendar tu entrega. ¡Muchas gracias!"

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
🔴 REGLAS CRÍTICAS DE CONTROL Y NO REPETICIÓN (OBLIGATORIO)
═══════════════════════════════════════════
1. Si el historial de conversación muestra que el bot (BOT:) ya envió los datos de pago (Yape/Plin/celular 955252932), está ESTRICTAMENTE PROHIBIDO volver a enviar los datos de pago, la cuenta bancaria o repetir el mensaje de Yape.
2. Si el cliente dice "sí", "sí ahora", "ya lo hago", "ok", "listo" o similar después de recibir los datos de pago, tu única respuesta debe ser: "¡Perfecto! Quedo super atento al envío de la captura del comprobante por aquí para registrar tu pedido de inmediato. ¡Muchas gracias!" (¡NO envíes nada más!).
3. Si el cliente ya dio su dirección o ubicación en el historial, está ESTRICTAMENTE PROHIBIDO volver a pedirle dirección, distrito o ubicación.

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
  const { genAI, hasApiKey } = await getGeminiClient();
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
    }
  }

  // ─── Priority 2: Groq / Llama-3 (automatic failover) ───────────────────────
  if (hasGroqKey && groqClient) {
    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: systemInstructions }],
        model: 'llama-3.1-8b-instant',   // Llama 3.1 — fast, free, high quota
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

  const normalizeMock = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const qNormMock = normalizeMock(userQuestion).replace(/[¿?¡!.,;:]/g, '').trim();

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

  // 3. Buscar coincidencia por fragmentos/párrafos
  let bestScore = 0;
  let bestFragments: string[] = [];

  for (const item of kbItems) {
    const rawContent = item.content || '';
    const paragraphs = rawContent
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 10);

    for (const para of paragraphs) {
      const paraNorm = normalizeMock(para);
      const score = queryWords.filter(w => {
        const escapedWord = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('(?:^|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])' + escapedWord + '(?:$|[^a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ])', 'i');
        return regex.test(paraNorm);
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
    const answerMatch = bestPara.match(/Answer:\s*([\s\S]+)$/i);
    let snippet = answerMatch ? answerMatch[1].trim() : bestPara;
    snippet = snippet.replace(/Question:[\s\S]+?Answer:/i, '').trim();

    return `${snippet}\n\n¿Te gustaría solicitarlo hoy mismo? 😊`;
  }

  return '[UNKNOWN]';
}
