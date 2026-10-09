import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PrivacyControls,
  createGatedAgentCaller,
  redactActivity,
  buildPrivacyStatus,
  isLoopbackUrl,
  SCREEN_CONTENT_TOOLS,
  ACTIVITY_TOOLS,
} from '../server/privacyControls.ts';

function fakeAgent(result = { ok: true, result: { image_base64: 'AAAA', width: 10, height: 10 } }) {
  const calls = [];
  let release = null;
  const raw = async (tool, args) => {
    calls.push(tool);
    if (release === 'hold') await new Promise((resolve) => { release = resolve; });
    return structuredClone(result);
  };
  return { raw, calls, hold: () => { release = 'hold'; }, release: () => release && release() };
}

test('screen tools are refused by default and the agent is never called', async () => {
  const controls = new PrivacyControls(() => false);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  for (const tool of SCREEN_CONTENT_TOOLS) {
    const res = await call(tool, {}, undefined, { connectionId: 'conn-a' });
    assert.equal(res.ok, false, tool);
    assert.equal(res.blocked, 'screen', tool);
  }
  assert.deepEqual(agent.calls, []);
  assert.equal(controls.isScreenAccessActive(), false);
});

test('Share screen on allows screen tools for that session only', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  assert.equal(controls.isScreenShareActive('conn-a'), true);
  assert.equal(controls.isScreenShareActive('conn-b'), false);
  const res = await call('viewScreen', {}, undefined, { connectionId: 'conn-a' });
  assert.equal(res.ok, true);
  assert.deepEqual(agent.calls, ['viewScreen']);
});

test('turning Share screen off refuses the next capture', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  assert.equal((await call('takeScreenshot', {}, undefined, { connectionId: 'conn-a' })).ok, true);
  controls.setScreenShare('conn-a', false);
  const res = await call('takeScreenshot', {}, undefined, { connectionId: 'conn-a' });
  assert.equal(res.blocked, 'screen');
  assert.deepEqual(agent.calls, ['takeScreenshot']);
});

test('a capture in flight when sharing stops is discarded, not returned', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  agent.hold();
  const pending = call('viewScreen', {}, undefined, { connectionId: 'conn-a' });
  await new Promise((resolve) => setImmediate(resolve));
  controls.setScreenShare('conn-a', false);
  agent.release();
  const res = await pending;
  assert.equal(res.ok, false);
  assert.equal(res.blocked, 'screen');
  assert.equal(res.result, undefined, 'no image may be returned');
});

test('a capture in flight across stop-and-restart is still discarded', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  agent.hold();
  const pending = call('viewScreen', {}, undefined, { connectionId: 'conn-a' });
  await new Promise((resolve) => setImmediate(resolve));
  controls.setScreenShare('conn-a', false);
  controls.setScreenShare('conn-a', true);
  agent.release();
  assert.equal((await pending).blocked, 'screen');
});

test('sharing in one session does not authorise captures for another', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  const res = await call('viewScreen', {}, undefined, { connectionId: 'conn-b' });
  assert.equal(res.blocked, 'screen');
  assert.deepEqual(agent.calls, []);
});

test('screen tools without a session are always refused', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  assert.equal((await call('takeScreenshot', {})).blocked, 'screen');
  assert.deepEqual(agent.calls, []);
});

test('another session stopping does not cancel this session\'s capture', async () => {
  const controls = new PrivacyControls(() => true);
  const agent = fakeAgent();
  const call = createGatedAgentCaller(agent.raw, controls);
  controls.setScreenShare('conn-a', true);
  controls.setScreenShare('conn-b', true);
  agent.hold();
  const pending = call('viewScreen', {}, undefined, { connectionId: 'conn-a' });
  await new Promise((resolve) => setImmediate(resolve));
  controls.setScreenShare('conn-b', false);
  agent.release();
  assert.equal((await pending).ok, true);
});

test('a session that closes stops counting as sharing', async () => {
  const controls = new PrivacyControls(() => true);
  const call = createGatedAgentCaller(fakeAgent().raw, controls);
  controls.setScreenShare('conn-a', true);
  controls.endConnection('conn-a');
  assert.equal(controls.isScreenAccessActive(), false);
  assert.equal((await call('readScreen', {}, undefined, { connectionId: 'conn-a' })).blocked, 'screen');
});

test('activity tools are refused while activity awareness is off', async () => {
  let aware = false;
  const controls = new PrivacyControls(() => aware);
  const agent = fakeAgent({ ok: true, result: { windows: [] } });
  const call = createGatedAgentCaller(agent.raw, controls);
  for (const tool of ACTIVITY_TOOLS) assert.equal((await call(tool, {})).blocked, 'activity', tool);
  assert.deepEqual(agent.calls, []);
  aware = true;
  assert.equal((await call('getActiveWindow', {})).ok, true);
  assert.deepEqual(agent.calls, ['getActiveWindow']);
});

test('window titles and app names are removed from tool results without activity awareness', async () => {
  const controls = new PrivacyControls(() => false);
  const agent = fakeAgent({
    ok: true,
    result: {
      result: "Minimized 'Bank statement.pdf - Okular'.",
      title: 'Bank statement.pdf - Okular',
      application: 'okular',
      ok: true,
    },
  });
  const call = createGatedAgentCaller(agent.raw, controls);
  const res = await call('minimizeWindow', { title: 'okular' });
  assert.equal(res.ok, true);
  assert.equal(res.result.title, undefined);
  assert.equal(res.result.application, undefined);
  assert.doesNotMatch(JSON.stringify(res.result), /Bank statement|okular/i);
});

test('titles that appear only in result text are removed without activity awareness', async () => {
  const controls = new PrivacyControls(() => false);
  for (const [tool, text] of [
    ['minimizeWindow', 'Minimized window: Payslip March.pdf (moved to special workspace).'],
    ['switchApplication', 'Switched to: Private chat - Signal.'],
    ['closeWindow', 'Closed window: Diary.txt - Editor.'],
  ]) {
    const call = createGatedAgentCaller(fakeAgent({ ok: true, result: { result: text } }).raw, controls);
    const res = await call(tool, {});
    assert.equal(res.ok, true, tool);
    assert.doesNotMatch(JSON.stringify(res.result), /Payslip|Signal|Diary/, tool);
  }
});

test('results pass through unchanged with activity awareness on', async () => {
  const controls = new PrivacyControls(() => true);
  const payload = { ok: true, result: { result: 'Switched to Firefox', title: 'Firefox' } };
  const call = createGatedAgentCaller(fakeAgent(payload).raw, controls);
  assert.deepEqual(await call('switchApplication', {}), payload);
});

test('redactActivity leaves unrelated results alone', () => {
  assert.deepEqual(redactActivity({ cpu: 12, result: 'CPU 12%' }), { cpu: 12, result: 'CPU 12%' });
  assert.equal(redactActivity('plain'), 'plain');
});

test('privacy status defaults: Gemini mode, nothing shared, activity off', () => {
  const status = buildPrivacyStatus({
    encrypted: true, brain: 'gemini', textEmotionConfigured: false,
    activityAwarenessAllowed: true, activityAwarenessActive: false, screenShareActive: false,
    env: {}, geminiKeySaved: true,
  });
  assert.equal(status.brain, 'gemini');
  assert.equal(status.screenShareActive, false);
  assert.equal(status.activityAwareness, false);
  assert.equal(status.textEmotion, false);
  assert.deepEqual(status.externalInLocalMode, []);
});

test('privacy status never calls local mode local when data leaves the machine', () => {
  const base = {
    encrypted: false, brain: 'local', textEmotionConfigured: true,
    activityAwarenessAllowed: true, activityAwarenessActive: false, screenShareActive: false,
  };
  const edge = buildPrivacyStatus({ ...base, env: {}, geminiKeySaved: true });
  assert.equal(edge.textEmotion, false, 'TypeSafe is never used in local mode');
  assert.deepEqual(edge.externalInLocalMode, ['edge-tts', 'gemini-planning']);
  const remote = buildPrivacyStatus({
    ...base,
    env: { SIYA_TTS_ENGINE: 'kokoro', SIYA_LOCAL_LLM_URL: 'http://100.64.1.2:9379/v1' },
    geminiKeySaved: false,
  });
  assert.equal(remote.localModelOnDevice, false);
  assert.deepEqual(remote.externalInLocalMode, ['model-server']);
  const offline = buildPrivacyStatus({ ...base, env: { SIYA_TTS_ENGINE: 'kokoro' }, geminiKeySaved: false });
  assert.deepEqual(offline.externalInLocalMode, []);
});

test('loopback detection', () => {
  assert.equal(isLoopbackUrl(undefined), true);
  assert.equal(isLoopbackUrl('http://127.0.0.1:9379/v1'), true);
  assert.equal(isLoopbackUrl('http://localhost:8795'), true);
  assert.equal(isLoopbackUrl('http://[::1]:8795'), true);
  assert.equal(isLoopbackUrl('http://192.168.1.5:9379'), false);
  assert.equal(isLoopbackUrl('not a url'), false);
});

test('mobile build refuses to embed credential-like VITE_ variables', async () => {
  const { default: config } = await import('../vite.mobile.config.ts');
  process.env.VITE_TEST_ONLY_TOKEN = 'not-a-real-token';
  try {
    assert.throws(() => config({ mode: 'test-privacy', command: 'build' }), /Refusing to build:.*VITE_TEST_ONLY_TOKEN/);
  } finally {
    delete process.env.VITE_TEST_ONLY_TOKEN;
  }
});
