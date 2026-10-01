import test from 'node:test';
import assert from 'node:assert';
import { generateTokens, decodeToken } from '../src/services/jwtService.js';
import * as CashfreeService from '../src/services/cashfreeService.js';

test('JWT Service: should generate and decode valid tokens', () => {
  const mockUser = {
    id: 1,
    name: 'Test Student',
    email: 'test@example.com',
    role: 'student'
  };

  const tokens = generateTokens(mockUser);
  assert.ok(tokens.access_token, 'Access token should exist');
  assert.ok(tokens.refresh_token, 'Refresh token should exist');
  assert.strictEqual(tokens.expires_in, 7200);

  const decoded = decodeToken(tokens.access_token);
  assert.ok(decoded, 'Decoded payload should not be null');
  assert.strictEqual(decoded.sub, '1');
  assert.strictEqual(decoded.email, 'test@example.com');
  assert.strictEqual(decoded.role, 'student');
  assert.strictEqual(decoded.type, 'access');
});

test('Cashfree Service: throws error when unconfigured so no free bypass is allowed', async () => {
  try {
    await CashfreeService.createOrder({
      orderId: 'order_test_123',
      amountRupees: 4999,
      customer: { id: 1, name: 'Student', email: 'student@example.com' }
    });
    assert.fail('Should have thrown unconfigured error');
  } catch (err) {
    assert.ok(err.message.includes('Cashfree'), 'Should report Cashfree not configured');
  }
});

test('Mail Service: OTP email sender executes safely', async () => {
  const { sendOtpEmail } = await import('../src/services/mailService.js');
  const res = await sendOtpEmail('test@example.com', 'Test Learner', '123456');
  assert.strictEqual(typeof res, 'boolean');
});

test('Mail Service: Purchase confirmation email sender executes safely', async () => {
  const { sendPurchaseSuccessEmail } = await import('../src/services/mailService.js');
  const res = await sendPurchaseSuccessEmail({
    email: 'test@example.com',
    name: 'Test Student',
    courseTitle: 'Mainframe Full Course',
    courseDuration: '2 Months',
    amountRupees: '7999.00',
    orderId: 'order_test_123',
    paymentId: 'cf_pay_test_456'
  });
  assert.strictEqual(typeof res, 'boolean');
});

test('Mail Service: Welcome email sender executes safely', async () => {
  const { sendWelcomeEmail } = await import('../src/services/mailService.js');
  const res = await sendWelcomeEmail('test@example.com', 'Test Student');
  assert.strictEqual(typeof res, 'boolean');
});
