import { NextResponse } from "next/server";
import { isEmailAllowed, verifyCode, createSessionToken, GATE_COOKIE_NAME } from "@/lib/auth/gate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim()?.toLowerCase();
  const code = body?.code?.trim();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  if (!verifyCode(email, code)) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const token = await createSessionToken(email);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return response;
}
