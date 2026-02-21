import { POST } from '@/app/api/auth/send-code/route';
import * as gateLib from '@/lib/auth/gate';
import { put } from '@vercel/blob';
import { TEST_EMAIL, INVALID_EMAIL } from '../../setup';

// Mock dependencies
jest.mock('@vercel/blob');
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

jest.mock('@/lib/auth/gate', () => {
  const original = jest.requireActual('@/lib/auth/gate');
  return {
    ...original,
    storeCode: jest.fn(),
  };
});

describe('POST /api/auth/send-code', () => {
  let mockStoreCode: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreCode = gateLib.storeCode as jest.Mock;
    mockStoreCode.mockResolvedValue(undefined);

    // Reset environment
    delete process.env.RESEND_API_KEY;
  });

  describe('Input Validation', () => {
    it('should reject request without email', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid email required');
    });

    it('should reject request with invalid email format', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid email required');
    });

    it('should reject email without @', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalidemail.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid email required');
    });

    it('should reject email without domain', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid email required');
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: 'not-json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid email required');
    });
  });

  describe('Email Authorization', () => {
    it('should accept allowed email', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('should return ok for disallowed email without revealing', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: INVALID_EMAIL }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should return ok to not reveal email existence
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);

      // But should not store code
      expect(mockStoreCode).not.toHaveBeenCalled();
    });

    it('should handle case insensitive email matching', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: 'EDDIEOM08@GMAIL.COM' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockStoreCode).toHaveBeenCalled();
    });

    it('should trim whitespace from email', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: '  eddieom08@gmail.com  ' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockStoreCode).toHaveBeenCalledWith('eddieom08@gmail.com', expect.any(String));
    });
  });

  describe('Code Generation and Storage', () => {
    it('should generate 6-digit code', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await POST(request);

      expect(mockStoreCode).toHaveBeenCalledWith(
        TEST_EMAIL,
        expect.stringMatching(/^\d{6}$/)
      );
    });

    it('should store code for allowed email', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await POST(request);

      expect(mockStoreCode).toHaveBeenCalledTimes(1);
      expect(mockStoreCode).toHaveBeenCalledWith(TEST_EMAIL, expect.any(String));
    });

    it('should not store code for disallowed email', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: INVALID_EMAIL }),
      });

      await POST(request);

      expect(mockStoreCode).not.toHaveBeenCalled();
    });
  });

  describe('Development Mode (No Resend)', () => {
    beforeEach(() => {
      delete process.env.RESEND_API_KEY;
      // Mock console.log to verify logging
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log code to console when RESEND_API_KEY not set', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await POST(request);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[GATE\] Code for .+: \d{6}/)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStoreCode.mockRejectedValue(new Error('Storage error'));

      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await expect(POST(request)).rejects.toThrow('Storage error');
    });
  });

  describe('Response Format', () => {
    it('should return consistent response for all emails', async () => {
      const allowedRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      const disallowedRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: INVALID_EMAIL }),
      });

      const allowedResponse = await POST(allowedRequest);
      const disallowedResponse = await POST(disallowedRequest);

      const allowedData = await allowedResponse.json();
      const disallowedData = await disallowedResponse.json();

      // Both should return same format
      expect(allowedResponse.status).toBe(disallowedResponse.status);
      expect(allowedData).toEqual(disallowedData);
    });
  });
});
