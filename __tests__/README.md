# Email Authentication Flow Tests

Comprehensive test suite for the email-based authentication system using Vercel Blob storage.

## Test Structure

```
__tests__/
├── setup.ts                          # Test configuration and utilities
├── lib/
│   └── auth/
│       └── gate.test.ts              # Unit tests for auth library functions
├── api/
│   └── auth/
│       ├── send-code.test.ts         # API route tests for code generation
│       └── verify.test.ts            # API route tests for code verification
└── integration/
    └── auth-flow.test.ts             # End-to-end integration tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- gate.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should verify valid code"
```

## Test Coverage

### Unit Tests (`lib/auth/gate.test.ts`)
- ✓ Email validation and allowed list checking
- ✓ 6-digit code generation
- ✓ Code storage in Vercel Blob
- ✓ Code verification with expiry handling
- ✓ JWT session token creation and verification
- ✓ Case-insensitive email handling
- ✓ Whitespace trimming

### API Route Tests

#### Send Code (`api/auth/send-code.test.ts`)
- ✓ Input validation (email format, required fields)
- ✓ Email authorization checking
- ✓ Code generation and storage
- ✓ Development mode (console logging)
- ✓ Production mode (email sending via Resend)
- ✓ Security: consistent responses for all emails
- ✓ Error handling

#### Verify Code (`api/auth/verify.test.ts`)
- ✓ Input validation (email and code required)
- ✓ Email authorization pre-check
- ✓ Code verification (valid, invalid, expired)
- ✓ Session cookie creation with correct attributes
- ✓ JWT token generation and validation
- ✓ Security: no cookie on failed verification
- ✓ Error handling

### Integration Tests (`integration/auth-flow.test.ts`)
- ✓ Complete authentication flow (send → verify → session)
- ✓ Invalid code rejection
- ✓ Expired code rejection
- ✓ Multiple code requests (overwrites previous)
- ✓ Security: email existence disclosure prevention
- ✓ Brute force attempt handling
- ✓ Case-insensitive email matching
- ✓ Vercel Blob storage persistence
- ✓ Long-lived session token creation

## Test Environment

The tests use mocked dependencies to avoid external service calls:

- **Vercel Blob**: Mocked with in-memory storage
- **Resend API**: Mocked email sending
- **File System**: Mocked for allowed-emails.json reading

Environment variables for testing:
```
GATE_SECRET=test-secret-key-for-testing-only
NODE_ENV=test
RESEND_API_KEY='' (disabled for tests)
```

## Key Test Scenarios

### Happy Path
1. User requests code with allowed email
2. Code is generated and stored in Vercel Blob
3. User submits email + code for verification
4. Code is validated (correct and not expired)
5. Session token is created and set as HTTP-only cookie
6. Token contains user's email and is valid for 7 days

### Security Scenarios
1. **Email Privacy**: Disallowed emails receive same "ok" response
2. **Code Security**: 6-digit random codes with 10-minute expiry
3. **Token Security**: HTTP-only, SameSite=Lax cookies
4. **Brute Force**: No rate limiting in code, but codes expire quickly
5. **Case Insensitivity**: Emails normalized to lowercase

### Error Scenarios
1. Invalid email format → 400 error
2. Missing email or code → 400 error
3. Disallowed email → Generic error without revealing existence
4. Wrong code → 401 error
5. Expired code → 401 error
6. Storage failures → Propagated errors

## Migration from In-Memory to Vercel Blob

These tests verify the migration from Map-based in-memory storage to Vercel Blob:

- **Before**: Codes stored in process memory (lost on serverless restarts)
- **After**: Codes stored in Vercel Blob (persistent across invocations)

The tests mock Vercel Blob with an in-memory Map to simulate the storage behavior without requiring actual blob storage access.

## Continuous Integration

Add to CI/CD pipeline:
```yaml
- name: Run tests
  run: npm test

- name: Upload coverage
  run: npm run test:coverage
```

## Test Maintenance

When updating auth logic:
1. Update corresponding unit tests first
2. Ensure integration tests still pass
3. Add new test cases for new features
4. Maintain >80% code coverage
5. Run full test suite before committing

## Debugging Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run specific test file with debugging
node --inspect-brk node_modules/.bin/jest __tests__/lib/auth/gate.test.ts

# View detailed error messages
npm test -- --no-coverage
```

## Common Issues

### Issue: Tests fail with Vercel Blob errors
**Solution**: Ensure @vercel/blob is properly mocked in test files

### Issue: JWT verification fails
**Solution**: Check that GATE_SECRET is set in test environment

### Issue: Cookie parsing fails
**Solution**: Verify cookie string format matches expected pattern

## Future Enhancements

Potential test additions:
- [ ] Rate limiting tests
- [ ] Concurrent request handling
- [ ] Performance benchmarks
- [ ] Load testing for code generation
- [ ] Session token expiry edge cases
- [ ] Database cleanup tests
