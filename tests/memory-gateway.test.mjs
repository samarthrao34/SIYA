import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGatewayHandler } from '../services/memory_gateway/gateway.mjs';

const SERVER_TOKEN = 'server-side-test-token';

async function withGateway(options, run) {
  const upstreamCalls = [];
  const fetchImpl = async (url, init) => {
    upstreamCalls.push({ url: String(url), method: init.method, auth: init.headers.Authorization, body: init.body?.toString() });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const handler = createGatewayHandler({
    readToken: () => SERVER_TOKEN,
    upstreamUrl: 'http://127.0.0.1:1',
    allowedDevices: ['siya-phone'],
    fetchImpl,
    log: () => {},
    ...options,
  });
  const server = http.createServer((req, res) => void handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base, upstreamCalls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('allowed tailnet device is forwarded with the server-held token only', async () => {
  await withGateway({ whois: async () => ({ device: 'siya-phone', login: 'me@example.com' }) }, async (base, calls) => {
    const res = await fetch(`${base}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer client-supplied' },
      body: JSON.stringify({ query: 'hello' }),
    });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].auth, `Bearer ${SERVER_TOKEN}`, 'client Authorization must be replaced');
    assert.match(calls[0].url, /\/query$/);
    assert.equal(calls[0].body, JSON.stringify({ query: 'hello' }));
  });
});

test('unidentified callers and other devices are refused before reaching the server', async () => {
  await withGateway({ whois: async () => null }, async (base, calls) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls.length, 0);
  });
  await withGateway({ whois: async () => ({ device: 'someone-elses-laptop', login: 'x' }) }, async (base, calls) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls.length, 0);
  });
});

test('only the mobile client routes are exposed', async () => {
  await withGateway({ whois: async () => ({ device: 'siya-phone', login: 'x' }) }, async (base, calls) => {
    assert.equal((await fetch(`${base}/admin`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/query`, { method: 'GET' })).status, 404);
    assert.equal((await fetch(`${base}/raw?path=a.md`)).status, 200);
    assert.equal(calls.length, 1);
  });
});

test('an empty allowlist refuses to start', () => {
  assert.throws(
    () => createGatewayHandler({ readToken: () => 't', upstreamUrl: 'http://127.0.0.1:1', allowedDevices: [' ', ''] }),
    /ALLOWED_DEVICES is empty/,
  );
});

test('oversized bodies are refused', async () => {
  await withGateway({ whois: async () => ({ device: 'siya-phone', login: 'x' }) }, async (base, calls) => {
    const res = await fetch(`${base}/ingest`, { method: 'POST', body: 'x'.repeat(1_100_000), signal: AbortSignal.timeout(5_000) })
      .catch((error) => (error?.name === 'TimeoutError' ? 'hung' : null));
    assert.notEqual(res, 'hung', 'the gateway must not leave an oversized upload hanging');
    assert.ok(!res || res.status === 413);
    assert.equal(calls.length, 0);
  });
});
