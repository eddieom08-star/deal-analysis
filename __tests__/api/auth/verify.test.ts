import { POST } from '@/app/api/auth/verify/route';
import * as gateLib from '@/lib/auth/gate';
import { GATE_COOKIE_NAME } from '@/lib/auth/gate';
import { TEST_EMAIL, INVALID_EMAIL } from '../../setup';

// Mock dependencies
jest.mock('@/lib/auth/gate', () => {
  const original = jest.requireActual('@/lib/auth/gate');
  return {
    ...original,
    verifyCode: jest.fn(),
  };
});

describe('POST /api/auth/verify', () => {
  let mockVerifyCode: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyCode = gateLib.verifyCode as jest.Mock;
  });

  describe('Input Validation', () => {
    it('should reject request without email', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });

    it('should reject request without code', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });

    it('should reject request without both email and code', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: 'not-json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });

    it('should handle empty email', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: '', code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });

    it('should handle empty code', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and code required');
    });
  });

  describe('Email Authorization Check', () => {
    it('should reject disallowed email before code verification', async () => {
      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: INVALID_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid code');
      expect(mockVerifyCode).not.toHaveBeenCalled();
    });

    it('should accept allowed email', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockVerifyCode).toHaveBeenCalled();
    });

    it('should handle case insensitive email', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: 'EDDIEOM08@GMAIL.COM', code: '123456' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockVerifyCode).toHaveBeenCalledWith('eddieom08@gmail.com', '123456');
    });

    it('should trim whitespace from inputs', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: '  eddieom08@gmail.com  ', code: '  123456  ' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockVerifyCode).toHaveBeenCalledWith('eddieom08@gmail.com', '123456');
    });
  });

  describe('Code Verification', () => {
    it('should verify valid code', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockVerifyCode).toHaveBeenCalledWith(TEST_EMAIL, '123456');
    });

    it('should reject invalid code', async () => {
      mockVerifyCode.mockResolvedValue(false);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '999999' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired code');
    });

    it('should reject expired code', async () => {
      mockVerifyCode.mockResolvedValue(false);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired code');
    });
  });

  describe('Session Creation', () => {
    it('should create session cookie on successful verification', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      expect(cookies).toBeTruthy();
      expect(cookies).toContain(GATE_COOKIE_NAME);
    });

    it('should set httpOnly cookie', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      expect(cookies).toContain('HttpOnly');
    });

    it('should set SameSite=Lax', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      expect(cookies?.toLowerCase()).toContain('samesite=lax');
    });

    it('should set cookie path to root', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      expect(cookies).toContain('Path=/');
    });

    it('should set cookie max age to 7 days', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      const expectedMaxAge = 7 * 24 * 60 * 60; // 7 days in seconds
      expect(cookies).toContain(`Max-Age=${expectedMaxAge}`);
    });

    it('should not create session cookie on failed verification', async () => {
      mockVerifyCode.mockResolvedValue(false);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '999999' }),
      });

      const response = await POST(request);

      const cookies = response.headers.get('set-cookie');
      expect(cookies).toBeNull();
    });
  });

  describe('Session Token Validation', () => {
    it('should create valid JWT token', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const cookies = response.headers.get('set-cookie');

      // Extract token from cookie
      const tokenMatch = cookies?.match(/da_session=([^;]+)/);
      expect(tokenMatch).toBeTruthy();

      const token = tokenMatch![1];
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should create verifiable token', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const cookies = response.headers.get('set-cookie');

      const tokenMatch = cookies?.match(/da_session=([^;]+)/);
      const token = tokenMatch![1];

      // Verify token can be decoded
      const verified = await gateLib.verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.email).toBe(TEST_EMAIL);
    });
  });

  describe('Error Handling', () => {
    it('should handle verification errors', async () => {
      mockVerifyCode.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      await expect(POST(request)).rejects.toThrow('Database error');
    });
  });

  describe('Response Format', () => {
    it('should return JSON with ok:true on success', async () => {
      mockVerifyCode.mockResolvedValue(true);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toEqual({ ok: true });
    });

    it('should return JSON with error message on failure', async () => {
      mockVerifyCode.mockResolvedValue(false);

      const request = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });
});
