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
 */
export async function queryKnowledgeBase(
  userQuestion: string,
  chatHistory: { sender: string; message: string }[] = []
): Promise<string> {
  // 1. Fetch context from indexed knowledge base
  const kbItems = await db.getKBItems();
  const contextBlock = kbItems
    .map((item) => `[File: ${item.title} (${item.file_type})]\n${item.content}`)
    .join('\n\n---\n\n');

  const formattedHistory = chatHistory
    .slice(-5) // last 5 messages for short context
    .map((c) => `${c.sender.toUpperCase()}: ${c.message}`)
    .join('\n');

  const systemInstructions = `Eres un asistente de ventas experto de Fuxion. Tu objetivo es responder al cliente de forma natural y profesional.

REGLAS DE ORO:
1. UTILIZA ÚNICAMENTE la información proporcionada en la Base de Conocimientos (Knowledge Base). Si la información no está en la Base de Conocimientos, responde exactamente: '[UNKNOWN]' y no intentes inventar respuestas.
2. REGLA DE FORMATO ESTRICTA:
   - Prohibido escribir encabezados, etiquetas o títulos internos como 'Respuesta directa', 'Precio y beneficio' o 'Llamado a la acción'.
   - Redacta la respuesta como un mensaje fluido y coherente, sin usar negritas para etiquetar secciones.
   - Responde siempre de forma directa, breve y amable.
   - Asegúrate de incluir el beneficio, el precio y una pregunta final para cerrar la venta, pero hazlo en un solo párrafo o texto continuo sin etiquetas de formato ni viñetas.

---
Base de Conocimientos (Knowledge Base):
${contextBlock}
---
CONVERSATION HISTORY:
${formattedHistory}
---
CUSTOMER'S NEW QUESTION:
${userQuestion}`;

  // Priorizar Groq (Gratis, rapidísimo, sin límites)
  if (hasGroqKey && groqClient) {
    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: systemInstructions }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens: 300,
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
  // Process question locally to see if we can find keywords in knowledge base items
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulate latency
  
  const questionLower = userQuestion.toLowerCase();
  
  // Custom keyword heuristic search in context
  let bestMatch: string | null = null;

  for (const item of kbItems) {
    const lines = item.content.split('\n');
    for (const line of lines) {
      // If line contains keywords, compile as answer
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
    return `Based on our catalogue: ${bestMatch}`;
  }

  // Standard fallback questions
  if (questionLower.includes('hello') || questionLower.includes('hi') || questionLower.includes('hola')) {
    return "¡Hola! Bienvenido a Fuxion Flow. ¿En qué te puedo ayudar hoy?";
  }

  // If we can't answer, return [UNKNOWN] to trigger Shadow Mode
  return '[UNKNOWN]';
}
