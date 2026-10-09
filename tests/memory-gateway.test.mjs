import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGatewayHandler, parseAllowedNodes } from '../services/memory_gateway/gateway.mjs';

const PHONE = 'nPhone123456CNTRL';
const phone = { nodeId: PHONE, device: 'siya-phone', login: 'me@example.com' };

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
    allowedNodes: `${PHONE}=siya-phone`,
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
  await withGateway({ whois: async () => phone }, async (base, calls) => {
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
  await withGateway({ whois: async () => ({ nodeId: 'nOther12345CNTRL', device: 'someone-elses-laptop', login: 'x' }) }, async (base, calls) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls.length, 0);
  });
});

test('only the mobile client routes are exposed', async () => {
  await withGateway({ whois: async () => phone }, async (base, calls) => {
    assert.equal((await fetch(`${base}/admin`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/query`, { method: 'GET' })).status, 404);
    assert.equal((await fetch(`${base}/raw?path=a.md`)).status, 200);
    assert.equal(calls.length, 1);
  });
});

test('an empty allowlist refuses to start; "none" explicitly denies everyone', async () => {
  assert.throws(() => parseAllowedNodes(''), /ALLOWED_NODE_IDS is empty/);
  assert.equal(parseAllowedNodes('none').size, 0);
  await withGateway({ whois: async () => phone, allowedNodes: 'none' }, async (base, calls) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls.length, 0);
  });
});

test('device names are not accepted as allowlist entries', () => {
  assert.throws(() => parseAllowedNodes('siya-phone'), /Not a Tailscale stable node ID/);
  assert.throws(() => parseAllowedNodes(`${PHONE}=ok,samarths-f15`), /Not a Tailscale stable node ID/);
  assert.deepEqual([...parseAllowedNodes(`${PHONE}=siya-phone`)], [[PHONE, 'siya-phone']]);
});

test('a different device using an approved device name is refused', async () => {
  const impostor = { nodeId: 'nImpostor99CNTRL', device: 'siya-phone', login: 'me@example.com' };
  await withGateway({ whois: async () => impostor }, async (base, calls) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls.length, 0);
  });
});

test('oversized bodies are refused', async () => {
  await withGateway({ whois: async () => phone }, async (base, calls) => {
    const res = await fetch(`${base}/ingest`, { method: 'POST', body: 'x'.repeat(1_100_000), signal: AbortSignal.timeout(5_000) })
      .catch((error) => (error?.name === 'TimeoutError' ? 'hung' : null));
    assert.notEqual(res, 'hung', 'the gateway must not leave an oversized upload hanging');
    assert.ok(!res || res.status === 413);
    assert.equal(calls.length, 0);
  });
});

test('a failed identity lookup is not cached', async () => {
  let attempts = 0;
  const whois = async () => (++attempts === 1 ? null : phone);
  await withGateway({ whois }, async (base) => {
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/query`, { method: 'POST', body: '{}' })).status, 200);
  });
});
