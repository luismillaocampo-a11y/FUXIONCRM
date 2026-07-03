import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Global in-memory state for AI automation switch.
// Defaults to true (AI enabled). Resets on server restart.
declare global {
  // eslint-disable-next-line no-var
  var AI_GLOBALLY_ENABLED: boolean | undefined;
}

function getAiEnabled(): boolean {
  if (typeof globalThis.AI_GLOBALLY_ENABLED === 'undefined') {
    globalThis.AI_GLOBALLY_ENABLED = true;
  }
  return globalThis.AI_GLOBALLY_ENABLED;
}

/**
 * GET /api/settings
 * Returns the current global AI automation state.
 */
export async function GET() {
  return NextResponse.json({ ai_enabled: getAiEnabled() });
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

    globalThis.AI_GLOBALLY_ENABLED = body.ai_enabled;
    console.log(`[settings] Global AI automation set to: ${body.ai_enabled}`);

    return NextResponse.json({ success: true, ai_enabled: getAiEnabled() });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
