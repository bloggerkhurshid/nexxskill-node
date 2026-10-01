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

test('Cashfree Service: should generate demo order when unconfigured', async () => {
  const order = await CashfreeService.createOrder({
    orderId: 'order_test_123',
    amountRupees: 4999,
    customer: { id: 1, name: 'Student', email: 'student@example.com' }
  });
  assert.ok(order.orderId, 'Order ID should exist');
  assert.ok(order.paymentSessionId, 'Payment session ID should exist');
  assert.strictEqual(order.orderAmount, 4999);
  assert.strictEqual(order.orderCurrency, 'INR');
});

test('Cashfree Service: should verify mock order and webhook safely', async () => {
  const order = await CashfreeService.getOrder('order_demo_123');
  assert.strictEqual(order.order_status, 'PAID');

  const verified = CashfreeService.verifyWebhookSignature('{}', 'any_sig', '1700000000');
  assert.strictEqual(verified, true);
});
