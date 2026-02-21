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
import { put, head } from '@vercel/blob';
import { TEST_EMAIL, INVALID_EMAIL } from '../../setup';

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  head: jest.fn(),
}));

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
      const code1 = generateCode();
      const code2 = generateCode();
      // This might occasionally fail due to randomness, but very unlikely
      const codes = new Set([code1, code2, generateCode(), generateCode()]);
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
    it('should store code in Vercel Blob with correct key', async () => {
      const email = TEST_EMAIL;
      const code = '123456';

      await storeCode(email, code);

      expect(put).toHaveBeenCalledWith(
        'auth-code/eddieom08@gmail.com',
        expect.any(String),
        {
          access: 'public',
          addRandomSuffix: false,
        }
      );
    });

    it('should store code with expiry timestamp', async () => {
      const email = TEST_EMAIL;
      const code = '123456';
      const beforeTime = Date.now();

      await storeCode(email, code);

      const putCall = (put as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(putCall[1]);

      expect(storedData.code).toBe(code);
      expect(storedData.expiresAt).toBeGreaterThan(beforeTime);
      expect(storedData.expiresAt).toBeLessThanOrEqual(beforeTime + 10 * 60 * 1000 + 100);
    });

    it('should normalize email to lowercase', async () => {
      const email = 'EDDIEOM08@GMAIL.COM';
      const code = '123456';

      await storeCode(email, code);

      expect(put).toHaveBeenCalledWith(
        'auth-code/eddieom08@gmail.com',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('verifyCode', () => {
    it('should return true for valid code', async () => {
      const email = TEST_EMAIL;
      const code = '123456';
      const expiresAt = Date.now() + 5 * 60 * 1000;

      (head as jest.Mock).mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test',
      });

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ code, expiresAt }),
      }) as jest.Mock;

      const result = await verifyCode(email, code);
      expect(result).toBe(true);
    });

    it('should return false for expired code', async () => {
      const email = TEST_EMAIL;
      const code = '123456';
      const expiresAt = Date.now() - 1000; // Expired

      (head as jest.Mock).mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test',
      });

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ code, expiresAt }),
      }) as jest.Mock;

      const result = await verifyCode(email, code);
      expect(result).toBe(false);
    });

    it('should return false for wrong code', async () => {
      const email = TEST_EMAIL;
      const storedCode = '123456';
      const providedCode = '654321';
      const expiresAt = Date.now() + 5 * 60 * 1000;

      (head as jest.Mock).mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test',
      });

      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ code: storedCode, expiresAt }),
      }) as jest.Mock;

      const result = await verifyCode(email, providedCode);
      expect(result).toBe(false);
    });

    it('should return false when blob does not exist', async () => {
      (head as jest.Mock).mockResolvedValue(null);

      const result = await verifyCode(TEST_EMAIL, '123456');
      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      (head as jest.Mock).mockRejectedValue(new Error('Blob error'));

      const result = await verifyCode(TEST_EMAIL, '123456');
      expect(result).toBe(false);
    });

    it('should normalize email to lowercase', async () => {
      const email = 'EDDIEOM08@GMAIL.COM';
      const code = '123456';

      (head as jest.Mock).mockResolvedValue(null);

      await verifyCode(email, code);

      expect(head).toHaveBeenCalledWith('auth-code/eddieom08@gmail.com');
    });
  });

  describe('createSessionToken', () => {
    it('should create valid JWT token', async () => {
      const email = TEST_EMAIL;
      const token = await createSessionToken(email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should normalize email in token', async () => {
      const email = 'EDDIEOM08@GMAIL.COM';
      const token = await createSessionToken(email);

      const verified = await verifySessionToken(token);
      expect(verified?.email).toBe('eddieom08@gmail.com');
    });
  });

  describe('verifySessionToken', () => {
    it('should verify valid token', async () => {
      const email = TEST_EMAIL;
      const token = await createSessionToken(email);

      const result = await verifySessionToken(token);

      expect(result).not.toBeNull();
      expect(result?.email).toBe(email);
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
