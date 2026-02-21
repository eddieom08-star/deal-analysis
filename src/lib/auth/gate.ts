import { SignJWT, jwtVerify } from "jose";
import { readFileSync } from "fs";
import { join } from "path";
import { put, head } from "@vercel/blob";

const COOKIE_NAME = "da_session";
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY = "7d";

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

export async function storeCode(email: string, code: string): Promise<void> {
  const key = `auth-code/${email.toLowerCase().trim()}`;
  const data = JSON.stringify({
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
  });

  await put(key, data, {
    access: "public",
    addRandomSuffix: false,
  });
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const key = `auth-code/${email.toLowerCase().trim()}`;

  try {
    const blob = await head(key);
    if (!blob?.url) return false;

    const response = await fetch(blob.url);
    const data = await response.json() as { code: string; expiresAt: number };

    if (Date.now() > data.expiresAt) {
      return false;
    }

    if (data.code !== code) return false;

    return true;
  } catch {
    return false;
  }
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
