import { NextRequest, NextResponse } from 'next/server';
import { parseRecipe } from '@/lib/parser';
import { parseWithClaude } from '@/lib/claudeParser';

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const parsed = await parseWithClaude(rawText);
        return NextResponse.json({ ...parsed, aiParsed: true });
      } catch (err) {
        console.warn('Claude parsing failed, falling back to manual parser:', err);
      }
    }

    const parsed = parseRecipe(rawText);
    return NextResponse.json({ ...parsed, aiParsed: false });
  } catch {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
