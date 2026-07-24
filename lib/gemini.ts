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
      return msgLower.includes('yape') || msgLower.includes('plin') || msgLower.includes('transferenci') || msgLower.includes('banco') || msgLower.includes('cuenta');
    });

    if (hasSentPaymentDetails) {
      console.log('[gemini] 🛡️ Intercepted by Payment Anti-Loop Guard');
      return '¡Perfecto! Quedo super atento al envío de la captura del comprobante por aquí para registrar tu pedido de inmediato. ¡Muchas gracias!';
    }
  }

  // 1. Fetch context from indexed knowledge base
  const kbItems = await db.getKBItems();
  const contextBlock = retrieveRelevantContext(userQuestion, kbItems);

  // 2. Fetch custom AI behavior rules from database
  let customRulesText = 'No hay reglas personalizadas configuradas.';
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
    .map((c) => `${c.sender.toUpperCase()}: ${c.message}`)
    .join('\n');

  const systemInstructions = `Eres un Asesor Comercial Experto y Asertivo. Tu único objetivo es resolver la necesidad del cliente y CERRAR VENTAS en WhatsApp de forma ágil, empática y 100% segura.

═══════════════════════════════════════════
🔴 REGLAS ESTRICTAS Y GUARDIÁN ANTI-REPETICIÓN (OBLIGATORIO)
═══════════════════════════════════════════
1. ${hasAlreadyGreeted ? '⚠️ EL BOT/FLUJO YA SALUDÓ AL CLIENTE HACE UN MOMENTO. ¡PROHIBIDO VOLVER A SALUDAR! No digas "Hola", "Buenas" ni bienvenida. Responde DIRECTAMENTE a la pregunta.' : 'SALUDO INICIAL: Si es el primer mensaje, saluda de forma ultra breve y empática.'}
2. ${hasAlreadySentPayment ? '⚠️ LOS DATOS DE PAGO YA FUERON ENVIADOS EN EL CHAT RECIENTE. ¡NO LOS VUELVAS A ENVIAR! Si el cliente confirma pago, solicita únicamente la captura del comprobante.' : 'DATOS DE PAGO: Si el cliente confirma compra, envía los métodos de pago configurados en las reglas.'}
3. MÁXIMO 35 PALABRAS POR MENSAJE. Sé ultra directo, conciso y fácil de leer en celular.
4. 1 SOLO PRODUCTO POR MENSAJE. Jamás abrumes recomendando múltiples productos de golpe.
5. NO REPETIR INFORMACIÓN: Si el flujo o el bot ya explicó un producto o beneficio en los últimos mensajes, no recites la misma descripción comercial; responde estrictamente a la duda puntual del cliente.
6. LENGUAJE MÉDICO Y LEGAL SEGURO: Prohibido diagnosticar o decir que un producto "cura" enfermedades. Usa ÚNICAMENTE conectores seguros: "apoya a", "ayuda a", "contribuye a".
7. Si la información solicitada NO está en la Base de Conocimientos con total certeza, responde EXACTAMENTE: [UNKNOWN] (esto derivará a Dudas de IA).

═══════════════════════════════════════════
⚙️ DIRECTIVAS PERSONALIZADAS CONFIGURADAS DESDE EL PANEL
═══════════════════════════════════════════
${customRulesText}

═══════════════════════════════════════════
💡 FLUJO OBLIGATORIO DE RESPUESTA EN 4 PASOS
═══════════════════════════════════════════
Cada mensaje de venta debe estructurarse estrictamente así:
1. EMPATÍA CORTA: (Ej: "Te entiendo perfectamente", "Comprendo lo que buscas").
2. 1 PRODUCTO IDEAL: Presenta únicamente el producto estrella para su necesidad.
3. 1 BENEFICIO CLAVE: Explica su beneficio principal con lenguaje seguro ("ayuda a...").
4. PREGUNTA DE CIERRE PARA CALIFICAR O COMPRAR: (Ej: "¿Sufres de esto de forma continua?", "¿Te lo coordinamos para enviártelo hoy?").

═══════════════════════════════════════════
📋 PROTOCOLO DE REGISTRO OFICIAL
═══════════════════════════════════════════
Si el cliente acepta registrarse, solicita sus datos requeridos.
Al recibirlos, responde confirmando la validación y añade al final de la respuesta:
[REGISTRO_DETECTADO:{nombre}|{dni}|{celular}|{correo}]

---
BASE DE CONOCIMIENTOS (SOLO LECTURA INTERNA):
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
