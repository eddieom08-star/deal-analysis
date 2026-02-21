import { SignJWT, jwtVerify } from "jose";
import { readFileSync } from "fs";
import { join } from "path";

const COOKIE_NAME = "da_session";
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY = "7d";

// In-memory fallback for serverless edge cases - each instance holds codes
// This works for typical email auth flow where send/verify happen close in time
const codeCache = new Map<string, { code: string; expiresAt: number; token: string }>();

function getSecret(): Uint8Array {
  const secret = process.env.GATE_SECRET || process.env.ANTHROPIC_API_KEY || "fallback-dev-secret";
  return new TextEncoder().encode(secret);
}

export function getAllowedEmails(): string[] {
  try {
    const filePath = join(process.cwd(), "allowed-emails.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as { emails: string[] };
    return data.emails.map((e) => e.toLowerCase().trim());
  } catch {
    return [];
  }
}

export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  return allowed.includes(email.toLowerCase().trim());
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeCode(email: string, code: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  // Create a signed token containing the code and expiry
  const token = await new SignJWT({
    email: normalizedEmail,
    code,
    type: 'auth_code'
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + Math.floor(CODE_EXPIRY_MS / 1000))
    .sign(getSecret());

  // Store in cache as fallback for same-instance verification
  codeCache.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
    token
  });

  return token;
}

export async function verifyCode(email: string, code: string, token?: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try cache first (works if same instance)
  const cached = codeCache.get(normalizedEmail);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      codeCache.delete(normalizedEmail);
      return false;
    }
    if (cached.code === code) {
      codeCache.delete(normalizedEmail);
      return true;
    }
  }

  // If token provided, verify it (works across instances)
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload.type !== 'auth_code') return false;
      if (payload.email !== normalizedEmail) return false;
      if (payload.code !== code) return false;
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase().trim() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

export const GATE_COOKIE_NAME = COOKIE_NAME;
