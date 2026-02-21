// Test setup file
// Mock environment variables
process.env.GATE_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = ''; // Disable email sending in tests

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
export const TEST_EMAIL = 'eddieom08@gmail.com';
export const INVALID_EMAIL = 'notallowed@example.com';
