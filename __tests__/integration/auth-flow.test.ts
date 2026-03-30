/**
 * Integration tests for the complete email authentication flow
 * Tests the full user journey from code generation to session creation
 *
 * The auth system uses JWT tokens + in-memory cache for code storage.
 * send-code: generates code, stores in cache, sets da_verify_token cookie
 * verify: checks cache first, then falls back to JWT verify token
 */

import { POST as sendCodePOST } from '@/app/api/auth/send-code/route';
import { POST as verifyPOST } from '@/app/api/auth/verify/route';
import * as gateLib from '@/lib/auth/gate';
import { GATE_COOKIE_NAME } from '@/lib/auth/gate';
import { TEST_EMAIL } from '../setup';

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  })),
}));

describe('Email Authentication Flow Integration Tests', () => {
  // Track console.log to capture generated codes
  let consoleSpy: jest.SpyInstance;
  let capturedCode: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCode = null;

    // Capture the code from console.log output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      const msg = args.join(' ');
      const match = msg.match(/Code for .+: (\d{6})/);
      if (match) capturedCode = match[1];
    });

    // Disable email sending in tests
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
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
      expect(capturedCode).toMatch(/^\d{6}$/);

      // Step 2: Extract verify token from send-code response cookies
      const sendCookies = sendResponse.headers.get('set-cookie') || '';
      expect(sendCookies).toContain('da_verify_token');

      // Step 3: Verify the code (using in-memory cache, no cookie needed)
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL, code: capturedCode }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(200);

      const verifyData = await verifyResponse.json();
      expect(verifyData.ok).toBe(true);

      // Step 4: Verify session cookie was created
      const cookies = verifyResponse.headers.get('set-cookie');
      expect(cookies).toBeTruthy();
      expect(cookies).toContain(GATE_COOKIE_NAME);

      // Step 5: Validate session token
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

    it('should handle multiple code requests (latest code wins)', async () => {
      // Request first code
      const request1 = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(request1);
      const firstCode = capturedCode;

      // Request second code (overwrites first in cache)
      const request2 = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(request2);
      const secondCode = capturedCode;

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

      // But no code should have been logged (code is only stored for allowed emails)
      // The capturedCode should be null since no console.log fires for disallowed emails
      // Actually, send-code returns ok:true but doesn't store or log code

      // Attempt verification should fail
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: unauthorizedEmail, code: '123456' }),
      });

      const verifyResponse = await verifyPOST(verifyRequest);
      expect(verifyResponse.status).toBe(401);
    });

    it('should handle brute force attempts - valid code still works after wrong guesses', async () => {
      // Request valid code
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);
      const validCode = capturedCode;

      // Try multiple wrong codes
      const wrongCodes = ['000000', '111111', '222222'];

      for (const code of wrongCodes) {
        const verifyRequest = new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ email: TEST_EMAIL, code }),
        });

        const response = await verifyPOST(verifyRequest);
        expect(response.status).toBe(401);
      }

      // Valid code should still work (cache stores code, wrong attempts don't consume it)
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
      const code = capturedCode;

      // Verify with uppercase email
      const verifyRequest = new Request('http://localhost/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL.toUpperCase(), code }),
      });

      const response = await verifyPOST(verifyRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('Token Lifecycle', () => {
    it('should create long-lived session token with 7-day expiry', async () => {
      // Complete auth flow
      const sendRequest = new Request('http://localhost/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: TEST_EMAIL }),
      });

      await sendCodePOST(sendRequest);
      const code = capturedCode;

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
