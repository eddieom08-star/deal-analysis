/**
 * Integration tests for the complete email authentication flow
 * Tests the full user journey from code generation to session creation
 */

import { POST as sendCodePOST } from '@/app/api/auth/send-code/route';
import { POST as verifyPOST } from '@/app/api/auth/verify/route';
import * as gateLib from '@/lib/auth/gate';
import { GATE_COOKIE_NAME } from '@/lib/auth/gate';
import { put, head } from '@vercel/blob';
import { TEST_EMAIL } from '../setup';

// Mock Vercel Blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  head: jest.fn(),
}));

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

describe('Email Authentication Flow Integration Tests', () => {
  // In-memory storage for simulating Vercel Blob
  const blobStorage = new Map<string, any>();

  beforeEach(() => {
    jest.clearAllMocks();
    blobStorage.clear();

    // Mock Vercel Blob put
    (put as jest.Mock).mockImplementation(async (key: string, data: string) => {
      blobStorage.set(key, data);
      return {
        url: `https://blob.vercel-storage.com/${key}`,
        downloadUrl: `https://blob.vercel-storage.com/${key}`,
        pathname: key,
      };
    });

    // Mock Vercel Blob head
    (head as jest.Mock).mockImplementation(async (key: string) => {
      if (!blobStorage.has(key)) {
        throw new Error('Not found');
      }
      return {
        url: `https://blob.vercel-storage.com/${key}`,
      };
    });

    // Mock fetch for reading blob data
    global.fetch = jest.fn().mockImplementation((url: string) => {
      // Extract the key from the URL - handle both formats
      const urlParts = url.split('/');
      let key = urlParts[urlParts.length - 1];

      // If key doesn't exist, try to match by searching for auth-code prefix
      if (!blobStorage.has(key)) {
        for (const [storageKey] of blobStorage) {
          if (url.includes(storageKey)) {
            key = storageKey;
            break;
          }
        }
      }

      if (key && blobStorage.has(key)) {
        return Promise.resolve({
          json: async () => JSON.parse(blobStorage.get(key)),
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as jest.Mock;

    // Disable email sending in tests
    delete process.env.RESEND_API_KEY;
  });

  describe('Complete Authentication Flow', () => {
    it('should successfully authenticate user through complete flow', async () => {
      // Step 1: Request verification code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      const sendResponse = await sendCodePOST(sendRequest);
      expect(sendResponse.status).toBe(200);

      const sendData = await sendResponse.json();
      expect(sendData.ok).toBe(true);

      // Verify code was stored
      const key = `auth-code/${TEST_EMAIL}`;
      expect(blobStorage.has(key)).toBe(true);

      // Extract the stored code
      const storedData = JSON.parse(blobStorage.get(key));
      const code = storedData.code;

      expect(code).toMatch(/^\d{6}$/);
      expect(storedData.expiresAt).toBeGreaterThan(Date.now());

      // Step 2: Verify the code
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(200);

      const verifyData = await verifyResponse.json();
      expect(verifyData.ok).toBe(true);

      // Step 3: Verify session cookie was created
      const cookies = verifyResponse.headers.get('set-cookie');
      expect(cookies).toBeTruthy();
      expect(cookies).toContain(GATE_COOKIE_NAME);

      // Step 4: Validate session token
      const tokenMatch = cookies?.match(/da_session=([^;]+)/);
      expect(tokenMatch).toBeTruthy();

      const token = tokenMatch![1];
      const session = await gateLib.verifySessionToken(token);

      expect(session).not.toBeNull();
      expect(session?.email).toBe(TEST_EMAIL);
    });

    it('should reject authentication with wrong code', async () => {
      // Step 1: Request verification code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);

      // Step 2: Try to verify with wrong code
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: '999999' }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(401);

      const verifyData = await verifyResponse.json();
      expect(verifyData.error).toBe('Invalid or expired code');

      // Verify no session cookie was created
      const cookies = verifyResponse.headers.get('set-cookie');
      expect(cookies).toBeNull();
    });

    it('should reject expired code', async () => {
      // Step 1: Request verification code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);

      // Extract and expire the code
      const key = `auth-code/${TEST_EMAIL}`;
      const storedData = JSON.parse(blobStorage.get(key));
      const code = storedData.code;

      // Manually expire the code
      storedData.expiresAt = Date.now() - 1000;
      blobStorage.set(key, JSON.stringify(storedData));

      // Step 2: Try to verify with expired code
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(401);

      const verifyData = await verifyResponse.json();
      expect(verifyData.error).toBe('Invalid or expired code');
    });

    it('should handle multiple code requests', async () => {
      // Request first code
      const request1 = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(request1);

      const key = `auth-code/${TEST_EMAIL}`;
      const firstCode = JSON.parse(blobStorage.get(key)).code;

      // Request second code (overwrites first)
      const request2 = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(request2);

      const secondCode = JSON.parse(blobStorage.get(key)).code;

      // Codes should be different
      expect(firstCode).not.toBe(secondCode);

      // First code should no longer work
      const verifyRequest1 = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: firstCode }),
      });

      const verifyResponse1 = await verifyPOST(verifyRequest1);
      expect(verifyResponse1.status).toBe(401);

      // Second code should work
      const verifyRequest2 = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: secondCode }),
      });

      const verifyResponse2 = await verifyPOST(verifyRequest2);
      expect(verifyResponse2.status).toBe(200);
    });
  });

  describe('Security Scenarios', () => {
    it('should not reveal email existence for unauthorized users', async () => {
      const unauthorizedEmail = 'unauthorized@example.com';

      // Request code for unauthorized email
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: unauthorizedEmail }),
      });

      const sendResponse = await sendCodePOST(sendRequest);

      // Should return success to not reveal email existence
      expect(sendResponse.status).toBe(200);

      const sendData = await sendResponse.json();
      expect(sendData.ok).toBe(true);

      // But no code should be stored
      const key = `auth-code/${unauthorizedEmail}`;
      expect(blobStorage.has(key)).toBe(false);

      // Attempt verification should fail
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: unauthorizedEmail, code: '123456' }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(401);
    });

    it('should handle brute force attempts', async () => {
      // Request valid code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);

      // Try multiple wrong codes
      const wrongCodes = ['000000', '111111', '222222', '333333', '444444'];

      for (const code of wrongCodes) {
        const verifyRequest = new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ email: TEST_EMAIL, code }),
        });

        const response = await verifyPOST(verifyRequest);
        expect(response.status).toBe(401);
      }

      // Valid code should still work after failed attempts
      const key = `auth-code/${TEST_EMAIL}`;
      const validCode = JSON.parse(blobStorage.get(key)).code;

      const validRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: validCode }),
      });

      const validResponse = await verifyPOST(validRequest);
      expect(validResponse.status).toBe(200);
    });

    it('should handle case-insensitive email matching', async () => {
      // Send code with lowercase email
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL.toLowerCase() }),
      });

      await sendCodePOST(sendRequest);

      const key = `auth-code/${TEST_EMAIL}`;
      const code = JSON.parse(blobStorage.get(key)).code;

      // Verify with uppercase email
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL.toUpperCase(), code }),
      });

      const response = await verifyPOST(verifyRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('Storage Persistence', () => {
    it('should persist code in Vercel Blob', async () => {
      const request = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(request);

      expect(put).toHaveBeenCalledWith(
        `auth-code/${TEST_EMAIL}`,
        expect.any(String),
        {
          access: 'public',
          addRandomSuffix: false,
        }
      );
    });

    it('should retrieve code from Vercel Blob during verification', async () => {
      // Store code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);

      const key = `auth-code/${TEST_EMAIL}`;
      const code = JSON.parse(blobStorage.get(key)).code;

      // Clear mocks to verify head is called
      jest.clearAllMocks();

      // Verify code
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code }),
      });

      await verifyPOST(verifyRequest);

      expect(head).toHaveBeenCalledWith(key);
    });
  });

  describe('Token Lifecycle', () => {
    it('should create long-lived session token', async () => {
      // Complete auth flow
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);

      const key = `auth-code/${TEST_EMAIL}`;
      const code = JSON.parse(blobStorage.get(key)).code;

      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code }),
      });

      const response = await verifyPOST(verifyRequest);

      // Extract and verify token
      const cookies = response.headers.get('set-cookie');
      const tokenMatch = cookies?.match(/da_session=([^;]+)/);
      const token = tokenMatch![1];

      // Token should be valid immediately
      const session = await gateLib.verifySessionToken(token);
      expect(session?.email).toBe(TEST_EMAIL);

      // Cookie should have 7-day max age
      expect(cookies).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
    });
  });
});
