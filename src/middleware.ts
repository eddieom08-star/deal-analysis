import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

const TEAM_DOMAIN = process.env.CLOUDFLARE_TEAM_DOMAIN;

export async function middleware(request: NextRequest) {
  // Skip auth in development
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // Skip if no team domain configured
  if (!TEAM_DOMAIN) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("CF_Authorization")?.value ||
    request.headers.get("Cf-Access-Jwt-Assertion");

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`),
    );

    await jwtVerify(token, JWKS, {
      issuer: `https://${TEAM_DOMAIN}`,
    });

    return NextResponse.next();
  } catch {
    return new NextResponse("Invalid token", { status: 403 });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
