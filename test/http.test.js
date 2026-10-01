import test from 'node:test';
import assert from 'node:assert';
import app from '../src/index.js';

test('HTTP Route: GET /health returns 200 with API status', async () => {
  // Use http request against the app
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.version && data.version.includes('1.0.'));
    assert.ok(data.message.includes('Node.js'));
  } finally {
    server.close();
  }
});

test('HTTP Route: GET /v1/health returns 200 with /v1 prefix', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/v1/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
  } finally {
    server.close();
  }
});

test('HTTP Route: POST /auth/google requires email', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_INPUT');
  } finally {
    server.close();
  }
});

