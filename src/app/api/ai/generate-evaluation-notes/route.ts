import 'server-only';
import { NextResponse } from 'next/server';
import { runEvaluationFlow } from '@/ai/flows/generate-evaluation-notes';

export const runtime = 'nodejs';         // مهم مع Genkit/OpenTelemetry
export const dynamic = 'force-dynamic';  // لا تعمل SSG

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const result = await runEvaluationFlow(payload);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('generate-evaluation-notes error:', err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
