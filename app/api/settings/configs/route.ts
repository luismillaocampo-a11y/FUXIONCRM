import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CONFIG_KEYS = [
  'whatsapp_api_url',
  'whatsapp_api_key',
  'whatsapp_instance',
  'gemini_api_key',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'admin_email',
  'ai_enabled'
];

export async function GET() {
  try {
    const configs: { [key: string]: string | null } = {};

    for (const key of CONFIG_KEYS) {
      let dbValue = await db.getSystemSetting(key);
      
      // Fallback to process.env if not set in DB
      if (dbValue === null) {
        if (key === 'whatsapp_api_url') dbValue = process.env.EVOLUTION_API_URL || '';
        else if (key === 'whatsapp_api_key') dbValue = process.env.EVOLUTION_API_KEY || '';
        else if (key === 'whatsapp_instance') dbValue = process.env.EVOLUTION_API_INSTANCE || '';
        else if (key === 'gemini_api_key') dbValue = process.env.GEMINI_API_KEY || '';
        else if (key === 'smtp_host') dbValue = process.env.SMTP_HOST || '';
        else if (key === 'smtp_port') dbValue = process.env.SMTP_PORT || '';
        else if (key === 'smtp_user') dbValue = process.env.SMTP_USER || '';
        else if (key === 'smtp_pass') dbValue = process.env.SMTP_PASS || '';
        else if (key === 'smtp_from') dbValue = process.env.SMTP_FROM || '';
        else if (key === 'admin_email') dbValue = process.env.ADMIN_EMAIL || '';
        else if (key === 'ai_enabled') {
          dbValue = typeof globalThis.AI_GLOBALLY_ENABLED === 'undefined' 
            ? 'true' 
            : String(globalThis.AI_GLOBALLY_ENABLED);
        }
      }
      configs[key] = dbValue;
    }

    return NextResponse.json({ success: true, configs });
  } catch (err: any) {
    console.error('[api/settings/configs] GET error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const settings = body.settings || {};

    for (const [key, value] of Object.entries(settings)) {
      if (CONFIG_KEYS.includes(key)) {
        const valStr = String(value);
        await db.setSystemSetting(key, valStr);
        
        // Sync the in-memory global state if it's the global AI switch
        if (key === 'ai_enabled') {
          globalThis.AI_GLOBALLY_ENABLED = valStr === 'true';
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    console.error('[api/settings/configs] POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
