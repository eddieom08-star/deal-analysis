import {
  getAllowedEmails,
  isEmailAllowed,
  generateCode,
  storeCode,
  verifyCode,
  createSessionToken,
  verifySessionToken,
  GATE_COOKIE_NAME,
} from '@/lib/auth/gate';
import { TEST_EMAIL, INVALID_EMAIL } from '../../setup';

// Mock file system for allowed-emails.json
jest.mock('fs', () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({
      emails: ['eddieom08@gmail.com'],
    })
  ),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('Auth Gate Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllowedEmails', () => {
    it('should return array of allowed emails', () => {
      const emails = getAllowedEmails();
      expect(emails).toEqual(['eddieom08@gmail.com']);
    });

    it('should normalize emails to lowercase', () => {
      const emails = getAllowedEmails();
      emails.forEach((email) => {
        expect(email).toBe(email.toLowerCase());
      });
    });
  });

  describe('isEmailAllowed', () => {
    it('should return true for allowed email', () => {
      expect(isEmailAllowed(TEST_EMAIL)).toBe(true);
    });

    it('should return false for disallowed email', () => {
      expect(isEmailAllowed(INVALID_EMAIL)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isEmailAllowed('EDDIEOM08@GMAIL.COM')).toBe(true);
    });

    it('should handle emails with whitespace', () => {
      expect(isEmailAllowed('  eddieom08@gmail.com  ')).toBe(true);
    });
  });

  describe('generateCode', () => {
    it('should generate 6-digit code', () => {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should generate different codes on subsequent calls', () => {
      const codes = new Set([generateCode(), generateCode(), generateCode(), generateCode()]);
      expect(codes.size).toBeGreaterThan(1);
    });

    it('should generate codes in valid range', () => {
      for (let i = 0; i < 10; i++) {
        const code = generateCode();
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('storeCode', () => {
    it('should return a JWT verify token', async () => {
      const token = await storeCode(TEST_EMAIL, '123456');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should store code in memory cache for same-instance verification', async () => {
      const code = '654321';
      await storeCode(TEST_EMAIL, code);

      // Should be verifiable without a token (using cache)
      const result = await verifyCode(TEST_EMAIL, code);
      expect(result).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      const code = '111222';
      await storeCode('EDDIEOM08@GMAIL.COM', code);

      // Verify with lowercase should work
      const result = await verifyCode('eddieom08@gmail.com', code);
      expect(result).toBe(true);
    });
  });

  describe('verifyCode', () => {
    it('should return true for valid code via cache', async () => {
      const code = '123456';
      await storeCode(TEST_EMAIL, code);

      const result = await verifyCode(TEST_EMAIL, code);
      expect(result).toBe(true);
    });

    it('should return true for valid code via JWT token', async () => {
      const code = '789012';
      const token = await storeCode(TEST_EMAIL, code);

      // Verify using the token (simulates cross-instance)
      const result = await verifyCode(TEST_EMAIL, code, token);
      expect(result).toBe(true);
    });

    it('should return false for wrong code', async () => {
      const storedCode = '123456';
      await storeCode(TEST_EMAIL, storedCode);

      const result = await verifyCode(TEST_EMAIL, '654321');
      expect(result).toBe(false);
    });

    it('should return false when no code stored and no token', async () => {
      // Use a code that no previous test has stored for this email
      const result = await verifyCode('nobody@example.com', '999888');
      expect(result).toBe(false);
    });

    it('should return false for invalid JWT token', async () => {
      // Use a code not previously stored in cache for this email
      const result = await verifyCode(TEST_EMAIL, '777888', 'invalid.jwt.token');
      expect(result).toBe(false);
    });

    it('should return false for wrong email in JWT token', async () => {
      const code = '123456';
      const token = await storeCode(TEST_EMAIL, code);

      // Try to verify with different email
      const result = await verifyCode('other@example.com', code, token);
      expect(result).toBe(false);
    });

    it('should return false for wrong code with valid JWT token', async () => {
      const code = '123456';
      const token = await storeCode(TEST_EMAIL, code);

      const result = await verifyCode(TEST_EMAIL, '654321', token);
      expect(result).toBe(false);
    });

    it('should consume code from cache after verification', async () => {
      const code = '123456';
      await storeCode(TEST_EMAIL, code);

      // First verification should succeed
      const first = await verifyCode(TEST_EMAIL, code);
      expect(first).toBe(true);

      // Second verification via cache should fail (code consumed)
      const second = await verifyCode(TEST_EMAIL, code);
      expect(second).toBe(false);
    });

    it('should normalize email to lowercase', async () => {
      const code = '123456';
      await storeCode('eddieom08@gmail.com', code);

      const result = await verifyCode('EDDIEOM08@GMAIL.COM', code);
      expect(result).toBe(true);
    });
  });

  describe('createSessionToken', () => {
    it('should create valid JWT token', async () => {
      const token = await createSessionToken(TEST_EMAIL);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should normalize email in token', async () => {
      const token = await createSessionToken('EDDIEOM08@GMAIL.COM');
      const verified = await verifySessionToken(token);
      expect(verified?.email).toBe('eddieom08@gmail.com');
    });
  });

  describe('verifySessionToken', () => {
    it('should verify valid token', async () => {
      const token = await createSessionToken(TEST_EMAIL);
      const result = await verifySessionToken(token);
      expect(result).not.toBeNull();
      expect(result?.email).toBe(TEST_EMAIL);
    });

    it('should return null for invalid token', async () => {
      const result = await verifySessionToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for malformed token', async () => {
      const result = await verifySessionToken('not-a-jwt');
      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const result = await verifySessionToken('');
      expect(result).toBeNull();
    });
  });

  describe('GATE_COOKIE_NAME', () => {
    it('should export cookie name constant', () => {
      expect(GATE_COOKIE_NAME).toBe('da_session');
    });
  });
});
