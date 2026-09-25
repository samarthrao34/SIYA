import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechTimeline,amplitudeFrames} from '../runtime/speechTimeline.js';
test('buffered audio remains silent until playback, including streaming gaps',()=>{
  const t=new SpeechTimeline();t.begin('a');t.addWindow(10,11,'a');t.addWindow(12,13,'a');
  t.enqueue([{time:10,duration:2,weights:{aa:0.6}}],'a');
  assert.deepEqual(t.sample(9.9),{});assert.equal(t.sample(10.2).aa,0.6);
  assert.deepEqual(t.sample(11.5),{});
});
test('cancelled utterances and delayed chunks cannot restart speech',()=>{
  const t=new SpeechTimeline();t.begin('a');t.stop('a');
  assert.equal(t.begin('a'),false);assert.equal(t.enqueue([{time:1,duration:1,weights:{aa:1}}],'a'),false);
  assert.equal(t.begin('b'),true);t.stop('a');assert.equal(t.id,'b');
});
test('rapid responses retire superseded utterances',()=>{
  const t=new SpeechTimeline();t.begin('a');t.begin('b');assert.equal(t.begin('a'),false);
});
test('mute, suspend, alignment priority, and normalization',()=>{
  const t=new SpeechTimeline();t.begin('a');t.addWindow(1,3,'a');
  t.enqueue(amplitudeFrames(new Float32Array(24000).fill(.1),24000,1),'a');
  t.enqueue([{time:1,duration:1,weights:{PP:2,aa:1,invalid:4}}],'a');
  assert.deepEqual(t.sample(1.01),{PP:.5,aa:.5});
  assert.deepEqual(t.sample(1.01,{muted:true}),{});assert.deepEqual(t.sample(1.01,{playing:false}),{});
});
test('dispose rejects future scheduling and empties state',()=>{
  const t=new SpeechTimeline();t.begin('a');t.dispose();assert.equal(t.begin('b'),false);
  assert.deepEqual(t.sample(1),{});assert.equal(t.frames.length,0);
});
