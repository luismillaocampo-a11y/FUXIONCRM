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
 * In simulated mode, returns a realistic text extraction mock.
 */
export async function analyzeMultimediaFile(
  fileName: string,
  fileType: string,
  fileBuffer: Buffer
): Promise<{ content: string; summary: string }> {
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      // Convert file buffer to Gemini Part
      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'image': 'image/jpeg', // default image mime
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
      // Fallback to mock on error
    }
  }

  // MOCK SIMULATION MODE (if key is missing or failed)
  await new Promise((resolve) => setTimeout(resolve, 1500)); // simulate latency
  
  let content = '';
  let summary = '';

  if (fileType === 'pdf') {
    content = `Manual Fuxion Flow: Pautas para productos de salud premium. Productos disponibles:
- FuxionProtein: Proteína en polvo con 25g por cucharada. Precio: $39.99. Sabores: Chocolate, Vainilla.
- FuxionCollagen: Colágeno para rejuvenecimiento. Precio: $29.99. Instrucciones: 1 cucharada diaria.
- Política de devolución: 30 días de garantía si está sellado.
- Contacto de soporte: soporte@fuxionflow.com, +1-800-FUXIONFLOW.`;
    summary = 'Manual que detalla las especificaciones de precios de FuxionProtein ($39.99) y FuxionCollagen ($29.99), y garantía de 30 días.';
  } else if (fileType === 'txt') {
    content = fileBuffer.toString('utf-8');
    summary = `Plain text content from ${fileName} with length ${content.length} characters.`;
  } else if (fileType === 'image') {
    content = `Image metadata for ${fileName}. The image displays a promotional flyer for "NutraSlim". It features a bright green bottle with a leaf icon, states "100% Organic Weight Loss", shows a price tag of $49.99, and has a discount badge of "Save 20% Today only".`;
    summary = `Promotional image for NutraSlim weight loss supplement showing $49.99 price and 20% discount.`;
  } else if (fileType === 'mp4') {
    content = `Video transcription/description for ${fileName}. A customer service representative demonstrates how to consume NutraSlim. Step 1: Take two capsules. Step 2: Drink with 250ml of warm water. Step 3: Take 30 minutes before breakfast. It highlights that the supplement works best when paired with light exercise.`;
    summary = `Instructional video explaining how to consume NutraSlim (2 capsules, 30 mins before breakfast with warm water).`;
  } else {
    content = `Generic file content extract for ${fileName}.`;
    summary = `File upload indexing for ${fileName}.`;
  }

  return { content, summary };
}

/**
 * Executes a RAG pipeline query using Gemini or simulation.
 * Returns the text response. If the AI doesn't know, it returns "[UNKNOWN]".
 * If registration data is detected, returns "[REGISTRO_DETECTADO:...]" embedded in the reply.
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
    .slice(-8) // last 8 messages for sufficient context to detect registration
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

3. Al FINAL de toda la respuesta, en una línea nueva, insertar la etiqueta de sistema (no la muestres como parte del mensaje visible, pero inclúyela):
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

  // Priorizar Groq (Gratis, rapidísimo, sin límites)
  if (hasGroqKey && groqClient) {
    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: systemInstructions }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens: 500,
      });
      return chatCompletion.choices[0]?.message?.content?.trim() || '[UNKNOWN]';
    } catch (error: any) {
      console.error('Groq query error:', error?.message);
    }
  }

  // Respaldo a Gemini si Groq falla
  if (hasApiKey && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(systemInstructions);
      const text = result.response.text().trim();
      return text;
    } catch (error) {
      console.error('Gemini query error, running simulator fallback:', error);
    }
  }

  // MOCK SIMULATION MODE (if key is missing or failed)
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulate latency
  
  const questionLower = userQuestion.toLowerCase();
  
  // Custom keyword heuristic search in context
  let bestMatch: string | null = null;

  for (const item of kbItems) {
    const lines = item.content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('price') || line.toLowerCase().includes('cost') || line.toLowerCase().includes('sell')) {
        if (questionLower.includes('price') || questionLower.includes('cost') || questionLower.includes('how much') || questionLower.includes('slim') || questionLower.includes('catalog')) {
          bestMatch = line;
          break;
        }
      }
      if (line.toLowerCase().includes('direction') || line.toLowerCase().includes('how to') || line.toLowerCase().includes('consume') || line.toLowerCase().includes('capsule')) {
        if (questionLower.includes('how to take') || questionLower.includes('instructions') || questionLower.includes('consume') || questionLower.includes('direction') || questionLower.includes('capsule')) {
          bestMatch = line;
          break;
        }
      }
      if (line.toLowerCase().includes('delivery') || line.toLowerCase().includes('ship') || line.toLowerCase().includes('lima') || line.toLowerCase().includes('peru')) {
        if (questionLower.includes('delivery') || questionLower.includes('shipping') || questionLower.includes('ship') || questionLower.includes('time') || questionLower.includes('where')) {
          bestMatch = line;
          break;
        }
      }
      if (line.toLowerCase().includes('payment') || line.toLowerCase().includes('yape') || line.toLowerCase().includes('plin') || line.toLowerCase().includes('cash')) {
        if (questionLower.includes('pay') || questionLower.includes('yape') || questionLower.includes('plin') || questionLower.includes('transfer') || questionLower.includes('cash')) {
          bestMatch = line;
          break;
        }
      }
    }
    if (bestMatch) break;
  }

  if (bestMatch) {
    return `Según nuestro catálogo: ${bestMatch} ¿Te gustaría solicitarlo hoy mismo?`;
  }

  if (questionLower.includes('hello') || questionLower.includes('hi') || questionLower.includes('hola')) {
    return '¡Hola! Bienvenido a Fuxion Perú. ¿En qué te puedo ayudar hoy? 😊';
  }

  // If we can't answer, return [UNKNOWN] to trigger Shadow Mode
  return '[UNKNOWN]';
}
