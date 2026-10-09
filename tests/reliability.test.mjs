import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveSession } from '../src/api/liveSession.ts';
import { readLiveAudio } from '../server/liveAudio.ts';
import { saveSettings, loadSettings, SETTINGS_STORAGE_KEY } from '../src/settings/settingsStore.ts';
import { restoreBounds } from '../electron/window-state.cjs';
import { setupUpdates } from '../electron/updates.cjs';

test('control packets and empty model turns do not crash audio handling', () => {
  for (const packet of [{}, {serverContent:{}}, {serverContent:{modelTurn:{}}}, {serverContent:{modelTurn:{parts:[]}}}]) {
    assert.equal(readLiveAudio(packet), undefined);
  }
  assert.equal(readLiveAudio({serverContent:{modelTurn:{parts:[{text:'hello'}, {inlineData:{mimeType:'audio/pcm',data:'pcm'}}]}}}), 'pcm');
});

test('settings writes are ordered, preserve other changes, and surface failed saves', async () => {
  const values = new Map();
  globalThis.window = {localStorage:{getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v)}};
  const originalFetch = globalThis.fetch;
  try {
    let release;
    const requests = [];
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(options.body));
      if (requests.length === 1) await new Promise(resolve => {release = resolve;});
      return {ok:true};
    };
    const first = saveSettings({voiceName:'Kore'});
    const second = saveSettings({micDeviceId:'usb-mic'});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(values.has(SETTINGS_STORAGE_KEY), false);
    release();
    await Promise.all([first, second]);
    assert.equal(loadSettings().voiceName, 'Kore');
    assert.equal(loadSettings().micDeviceId, 'usb-mic');
    globalThis.fetch = async () => ({ok:false,status:500,json:async()=>({error:'Disk full'})});
    await assert.rejects(saveSettings({voiceName:'Leda'}), /Disk full/);
    assert.equal(loadSettings().voiceName, 'Kore');
    globalThis.fetch = async () => ({ok:true});
    await saveSettings({animations:false});
    assert.equal(loadSettings().animations, false);
  } finally {globalThis.fetch = originalFetch;}
});

test('restart preserves text-only mode and does not activate a stopped session', () => {
  const live = new LiveSession({onStateChange(){},onError(){}});
  const modes = [];
  live.connect = (mode) => modes.push(mode);
  live.restart();
  assert.deepEqual(modes, []);
  live.isActivated = true;
  live.useMicrophone = false;
  live.restart();
  assert.deepEqual(modes, [false]);
});

test('network recovery backs off, preserves queued text, and can be cancelled', (t) => {
  t.mock.timers.enable({apis:['setTimeout']});
  const states = [], modes = [];
  const live = new LiveSession({onStateChange:s=>states.push(s),onError(){}});
  live.isActivated = true;
  live.useMicrophone = false;
  live.pendingTextMessages = ['unsent message'];
  live.connect = mode => {modes.push(mode);live.isActivated=true;};
  live.retryConnection();
  assert.equal(states.at(-1), 'connecting');
  assert.deepEqual(live.pendingTextMessages, ['unsent message']);
  t.mock.timers.tick(999);
  assert.equal(modes.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(modes, [false]);
  live.retryConnection();
  t.mock.timers.tick(1999);
  assert.equal(modes.length, 1);
  live.disconnect();
  t.mock.timers.tick(100000);
  assert.equal(modes.length, 1);
});

test('network recovery stops after five failed attempts', (t) => {
  t.mock.timers.enable({apis:['setTimeout']});
  const errors = [];
  const live = new LiveSession({onStateChange(){},onError:e=>errors.push(e)});
  live.connect = () => {live.isActivated=true;};
  live.isActivated=true;
  for (let i=0; i<6; i++) {live.retryConnection();t.mock.timers.tick(16000);}
  assert.equal(errors.length, 1);
  assert.equal(live.currentState, 'disconnected');
});

test('microphone capture uses the selected device; text mode never requests a mic', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWS = globalThis.WebSocket;
  const requests = [];
  class Socket {static OPEN=1;readyState=1;close(){};send(){}}
  class Audio {
    state='running';currentTime=0;
    createGain(){return {connect(){},gain:{}};}
    createAnalyser(){return {connect(){}};}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createScriptProcessor(){return {connect(){},disconnect(){}};}
    close(){return Promise.resolve();}
  }
  globalThis.window = {location:{protocol:'http:',host:'localhost'}, AudioContext:Audio,
    localStorage:{getItem:()=>JSON.stringify({micDeviceId:'usb-selected'})}};
  globalThis.WebSocket=Socket;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async c=>{
    requests.push(c);return {getTracks:()=>[{stop(){}}]};
  }}}});
  const errors=[];
  const live=new LiveSession({onStateChange(){},onError:e=>errors.push(e)});
  try {
    await live.connect(true);
    await live.ws.onopen();
    assert.deepEqual(requests[0].audio.deviceId, {exact:'usb-selected'});
    live.disconnect();
    await live.connect(false);
    await live.ws.onopen();
    assert.equal(requests.length,1);
    assert.deepEqual(errors,[]);
  } finally {
    live.disconnect();globalThis.WebSocket=originalWS;
    if(originalNavigator) Object.defineProperty(globalThis,'navigator',originalNavigator);
    else delete globalThis.navigator;
  }
});

test('saved windows on a removed monitor return to a visible default position', () => {
  const screens=[{workArea:{x:0,y:0,width:1920,height:1080}}];
  assert.deepEqual(restoreBounds({x:4000,y:0,width:1200,height:700},screens),{width:1200,height:700});
  assert.deepEqual(restoreBounds({x:100,y:100,width:1200,height:700},screens),{x:100,y:100,width:1200,height:700});
});

test('development updater reports its limitation without downloading anything', async () => {
  const messages=[];
  const controls=setupUpdates({app:{isPackaged:false},dialog:{showMessageBox:async(_w,m)=>{messages.push(m);}},Notification:{},getWindow:()=>null});
  await controls.check(true);
  assert.match(messages[0].detail,/development build/);
  controls.dispose();
});
