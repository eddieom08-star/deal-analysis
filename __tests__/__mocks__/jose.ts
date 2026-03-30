// Mock implementation of jose library for testing

const SECRET = new TextEncoder().encode(
  process.env.GATE_SECRET || 'test-secret-key-for-testing-only'
);

interface JWTPayload {
  email?: string;
  iat?: number;
  exp?: number;
}

// Simple JWT encoder/decoder for testing (NOT SECURE - for tests only)
class MockSignJWT {
  private payload: JWTPayload = {};
  private header: any = {};

  constructor(payload: JWTPayload) {
    this.payload = payload;
  }

  setProtectedHeader(header: any): this {
    this.header = header;
    return this;
  }

  setIssuedAt(): this {
    this.payload.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setExpirationTime(exp: string | number): this {
    if (typeof exp === 'number') {
      // Unix timestamp (seconds)
      this.payload.exp = exp;
      return this;
    }
    // Parse expiration time (e.g., "7d")
    const match = exp.match(/^(\d+)([dhms])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = {
        d: 24 * 60 * 60,
        h: 60 * 60,
        m: 60,
        s: 1,
      };
      const seconds = value * multipliers[unit];
      this.payload.exp = Math.floor(Date.now() / 1000) + seconds;
    }
    return this;
  }

  async sign(secret: Uint8Array): Promise<string> {
    // Create a simple base64-encoded token (NOT SECURE - for tests only)
    const headerB64 = Buffer.from(JSON.stringify(this.header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
    const signature = Buffer.from('test-signature').toString('base64url');
    return `${headerB64}.${payloadB64}.${signature}`;
  }
}

async function jwtVerify(token: string, secret: Uint8Array): Promise<{ payload: JWTPayload }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payloadB64 = parts[1];
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return { payload };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export { MockSignJWT as SignJWT, jwtVerify };
