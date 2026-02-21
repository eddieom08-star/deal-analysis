import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "da_session";

function getSecret(): Uint8Array {
  const secret = process.env.GATE_SECRET || process.env.ANTHROPIC_API_KEY || "fallback-dev-secret";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  // Skip auth in development
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/gate", request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/gate", request.url));
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|gate|api/auth).*)",
  ],
};
