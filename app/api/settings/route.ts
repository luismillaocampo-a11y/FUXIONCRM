import { NextResponse } from 'next/server';
import { getAiGloballyEnabled, setAiGloballyEnabled } from '@/lib/ai-settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 * Returns the current global AI automation state (persisted in SQLite).
 */
export async function GET() {
  const ai_enabled = await getAiGloballyEnabled();
  return NextResponse.json({ ai_enabled });
}

/**
 * POST /api/settings
 * Body: { ai_enabled: boolean }
 * Updates the global AI automation state.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.ai_enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'ai_enabled must be a boolean' },
        { status: 400 }
      );
    }

    await setAiGloballyEnabled(body.ai_enabled);
    console.log(`[settings] Global AI automation set to: ${body.ai_enabled}`);

    return NextResponse.json({ success: true, ai_enabled: body.ai_enabled });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
