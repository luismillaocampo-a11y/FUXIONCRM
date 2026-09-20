import { db } from './db';

declare global {
  // eslint-disable-next-line no-var
  var AI_GLOBALLY_ENABLED: boolean | undefined;
}

export async function getAiGloballyEnabled(): Promise<boolean> {
  if (typeof globalThis.AI_GLOBALLY_ENABLED === 'boolean') {
    return globalThis.AI_GLOBALLY_ENABLED;
  }

  try {
    const stored = await db.getSystemSetting('ai_enabled');
    const enabled = stored === null || stored === '' ? true : stored === 'true';
    globalThis.AI_GLOBALLY_ENABLED = enabled;
    return enabled;
  } catch {
    globalThis.AI_GLOBALLY_ENABLED = true;
    return true;
  }
}

export async function setAiGloballyEnabled(enabled: boolean): Promise<void> {
  globalThis.AI_GLOBALLY_ENABLED = enabled;
  await db.setSystemSetting('ai_enabled', enabled ? 'true' : 'false');
}
