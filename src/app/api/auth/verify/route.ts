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

  // Get verify token from cookie (use substring to avoid splitting on '=' in token value)
  const cookies = request.headers.get('cookie') || '';
  const verifyTokenCookie = cookies
    .split(';')
    .find(c => c.trim().startsWith('da_verify_token='));
  const verifyToken = verifyTokenCookie
    ? verifyTokenCookie.trim().substring('da_verify_token='.length)
    : undefined;

  if (!(await verifyCode(email, code, verifyToken))) {
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

  // Clear the verify token
  response.cookies.delete("da_verify_token");

  return response;
}
