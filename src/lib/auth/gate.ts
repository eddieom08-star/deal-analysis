import { SignJWT, jwtVerify } from "jose";
import { readFileSync } from "fs";
import { join } from "path";

const COOKIE_NAME = "da_session";
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY = "7d";

// In-memory store for pending codes (per-instance; fine for single-serverless-function usage)
const pendingCodes = new Map<string, { code: string; expiresAt: number }>();

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

export function storeCode(email: string, code: string): void {
  pendingCodes.set(email.toLowerCase().trim(), {
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
  });
}

export function verifyCode(email: string, code: string): boolean {
  const entry = pendingCodes.get(email.toLowerCase().trim());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    pendingCodes.delete(email.toLowerCase().trim());
    return false;
  }
  if (entry.code !== code) return false;
  pendingCodes.delete(email.toLowerCase().trim());
  return true;
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
