import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export const VALID_AI_PROVIDERS = ['google', 'groq', 'openrouter', 'openai'] as const;
export const MAX_AI_KEY_LENGTH = 500;
export const MAX_AI_MODEL_LENGTH = 120;
export const AI_TEST_TIMEOUT_MS = 15000;

export function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(t) };
}

function cleanErr(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  return msg.slice(0, 200);
}

/**
 * Prueba una clave de proveedor IA en vivo. No loguea ni devuelve la clave.
 * Devuelve { success, message?, error? }.
 */
export async function testProviderKey(
  provider: string,
  apiKey: string,
  model?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanKey = String(apiKey || '').trim().slice(0, MAX_AI_KEY_LENGTH);
  if (!cleanKey) {
    return { success: false, error: 'API Key no proporcionada o vacía.' };
  }
  if (cleanKey.includes('****')) {
    return { success: false, error: 'Clave enmascarada: ingresa una nueva clave.' };
  }
  const cleanModel = typeof model === 'string' && model.trim() ? model.trim().slice(0, MAX_AI_MODEL_LENGTH) : undefined;

  if (provider === 'google') {
    const t = withTimeout(AI_TEST_TIMEOUT_MS);
    try {
      const genAI = new GoogleGenerativeAI(cleanKey);
      const selectedModel = cleanModel || 'gemini-3.6-flash';
      const aiModel = genAI.getGenerativeModel({ model: selectedModel });
      const result = await Promise.race([
        aiModel.generateContent('Responde únicamente "OK".'),
        new Promise<never>((_, reject) => t.signal.addEventListener('abort', () => reject(new Error('Timeout')))),
      ]);
      const text = result.response.text();
      return {
        success: true,
        message: `Conexión exitosa con Google Gemini (${selectedModel}).`,
        error: undefined,
      };
    } catch (err: unknown) {
      console.warn('[ai/test] Google test failed');
      return { success: false, error: `Error de Google Gemini: ${cleanErr(err, 'Clave inválida o sin cuota disponible.')}` };
    } finally {
      t.done();
    }
  }

  if (provider === 'groq') {
    const t = withTimeout(AI_TEST_TIMEOUT_MS);
    try {
      const groq = new Groq({ apiKey: cleanKey, timeout: AI_TEST_TIMEOUT_MS });

      let activeModel = cleanModel || 'llama-3.3-70b-versatile';
      try {
        const modelsList = await groq.models.list();
        const availableIds = (modelsList.data || []).map((m: { id: string }) => m.id);

        if (availableIds.length > 0) {
          const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
          const match = preferred.find(p => availableIds.includes(p));
          if (match) activeModel = match;
          else activeModel = availableIds[0];
        }
      } catch (listErr: unknown) {
        const msg = listErr instanceof Error ? listErr.message : 'desconocido';
        console.warn('[Groq Test] No se pudo listar modelos, usando modelo por defecto:', msg.slice(0, 120));
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: 'Responde únicamente "OK"' }],
        model: activeModel,
        max_tokens: 10
      });
      void completion;
      return {
        success: true,
        message: `Conexión exitosa con Groq (${activeModel}).`,
      };
    } catch (err: unknown) {
      console.warn('[ai/test] Groq test failed');
      return { success: false, error: `Error de Groq: ${cleanErr(err, 'Clave inválida o sin cuota.')}` };
    } finally {
      t.done();
    }
  }

  if (provider === 'openrouter') {
    const t = withTimeout(AI_TEST_TIMEOUT_MS);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nutraflow.crm',
          'X-Title': 'NutraFlow CRM'
        },
        body: JSON.stringify({
          model: cleanModel || 'openrouter/auto',
          messages: [{ role: 'user', content: 'Responde OK' }],
          max_tokens: 10
        }),
        signal: t.signal
      });
      if (response.ok) {
        return {
          success: true,
          message: `Conexión exitosa con OpenRouter (${cleanModel || 'Auto'}).`,
        };
      } else {
        const errData = await response.text();
        return {
          success: false,
          error: `Error de OpenRouter (HTTP ${response.status}): ${errData.slice(0, 200)}`
        };
      }
    } catch (err: unknown) {
      return { success: false, error: `Error al contactar OpenRouter: ${cleanErr(err, 'desconocido')}` };
    } finally {
      t.done();
    }
  }

  if (provider === 'openai') {
    const t = withTimeout(AI_TEST_TIMEOUT_MS);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: cleanModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Responde OK' }],
          max_tokens: 10
        }),
        signal: t.signal
      });
      if (response.ok) {
        return {
          success: true,
          message: `Conexión exitosa con OpenAI (${cleanModel || 'gpt-4o-mini'}).`,
        };
      } else {
        const errData = await response.text();
        return {
          success: false,
          error: `Error de OpenAI (HTTP ${response.status}): ${errData.slice(0, 200)}`
        };
      }
    } catch (err: unknown) {
      return { success: false, error: `Error al contactar OpenAI: ${cleanErr(err, 'desconocido')}` };
    } finally {
      t.done();
    }
  }

  return { success: false, error: 'Proveedor de IA no reconocido.' };
}
