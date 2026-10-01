import crypto from 'crypto';

const CASHFREE_ENV = (process.env.CASHFREE_ENVIRONMENT || 'TEST').toUpperCase();
const CASHFREE_BASE_URL = CASHFREE_ENV === 'PRODUCTION'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';
const API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';

export function getCashfreeConfig() {
  const appId = (process.env.CASHFREE_APP_ID || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const isProduction = CASHFREE_ENV === 'PRODUCTION';

  const isConfigured = Boolean(
    appId &&
    secretKey &&
    !appId.includes('placeholder') &&
    !secretKey.includes('placeholder') &&
    !appId.includes('your_cashfree')
  );

  return {
    appId,
    secretKey,
    environment: isProduction ? 'production' : 'sandbox',
    baseUrl: CASHFREE_BASE_URL,
    apiVersion: API_VERSION,
    isConfigured
  };
}

/**
 * Create a Cashfree Payment Order
 */
export async function createOrder({ orderId, amountRupees, customer, returnUrl, orderNote }) {
  const config = getCashfreeConfig();
  const finalOrderId = orderId || ('order_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'));

  if (!config.isConfigured) {
    throw new Error('Cashfree gateway is not configured on the server. Please add CASHFREE_APP_ID and CASHFREE_SECRET_KEY in server environment variables.');
  }

  const cleanPhone = (customer.phone || '')
    .toString()
    .replace(/[^0-9]/g, '')
    .slice(-10);

  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('A valid 10-digit customer mobile number is required to create a Cashfree order');
  }

  const payload = {
    order_id: finalOrderId,
    order_amount: parseFloat(Number(amountRupees).toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id: String(customer.id || 'cust_' + crypto.randomBytes(4).toString('hex')),
      customer_name: customer.name || 'NexxSkill Student',
      customer_email: customer.email || 'student@nexxskill.com',
      customer_phone: cleanPhone
    },
    order_meta: {
      return_url: returnUrl || 'https://nexxskill.com/student/dashboard'
    },
    order_note: orderNote || 'NexxSkill Academy Course Enrollment'
  };

  const response = await fetch(`${config.baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.message || data.error || 'Failed to create Cashfree order';
    throw new Error(errMsg);
  }

  return {
    orderId: data.order_id,
    cfOrderId: data.cf_order_id,
    paymentSessionId: data.payment_session_id,
    orderAmount: data.order_amount,
    orderCurrency: data.order_currency,
    environment: config.environment,
    appId: config.appId
  };
}

/**
 * Retrieve Order Details from Cashfree (Strict verification)
 */
export async function getOrder(orderId) {
  const config = getCashfreeConfig();

  if (!config.isConfigured) {
    throw new Error('Cashfree gateway is not configured on the server. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.');
  }

  const response = await fetch(`${config.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'x-client-id': config.appId,
      'x-client-secret': config.secretKey,
      'x-api-version': config.apiVersion,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Cashfree API returned ${response.status}`);
  }

  return await response.json();
}

/**
 * Retrieve Order Payments from Cashfree
 */
export async function getOrderPayments(orderId) {
  const config = getCashfreeConfig();

  if (!config.isConfigured) {
    return [];
  }

  try {
    const response = await fetch(`${config.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (err) {
    console.error('[Cashfree] getOrderPayments error:', err.message);
    return [];
  }
}

/**
 * Verify Cashfree Webhook Signature
 */
export function verifyWebhookSignature(rawBody, signature, timestamp) {
  const config = getCashfreeConfig();
  if (!config.isConfigured || !config.secretKey) {
    return false;
  }

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const dataToSign = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.secretKey)
      .update(dataToSign)
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch (err) {
    console.error('[Cashfree] verifyWebhookSignature error:', err.message);
    return false;
  }
}
