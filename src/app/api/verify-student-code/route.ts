import { NextResponse } from "next/server";

// Force Node runtime so process.env works everywhere (dev/preview/prod)
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { code } = await req.json();

  const expected =
    process.env.SIGNUP_STUDENT_CODE ??
    (process.env.NODE_ENV !== "production" ? "sy0-701" : undefined); // dev fallback

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured: SIGNUP_STUDENT_CODE is not set." },
      { status: 500 }
    );
  }

  const normalize = (s: unknown) => String(s ?? "").trim().toLowerCase();

  if (normalize(code) === normalize(expected)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "Invalid student access code." },
    { status: 401 }
  );
}
