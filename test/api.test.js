import test from 'node:test';
import assert from 'node:assert';
import { generateTokens, decodeToken } from '../src/services/jwtService.js';
import * as RazorpayService from '../src/services/razorpayService.js';

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

test('Razorpay Service: should generate mock order in demo mode', async () => {
  const order = await RazorpayService.createOrder(10000, 'test_receipt_123');
  assert.ok(order.orderId, 'Order ID should exist');
  assert.strictEqual(order.amount, 10000);
  assert.strictEqual(order.currency, 'INR');
});

test('Razorpay Service: should verify mock signature safely', () => {
  const verified = RazorpayService.verifySignature('order_demo_123', 'pay_demo_456', 'any_sig');
  assert.strictEqual(verified, true);
});
