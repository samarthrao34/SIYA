import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveSession} from '../src/api/liveSession.ts';
import {subscribeAvatarEvents} from '../runtime/avatarEvents.js';
globalThis.window={atob:globalThis.atob,btoa:globalThis.btoa};
function fixture(){
 const events=[],sources=[];const unsub=subscribeAvatarEvents(e=>events.push(e));
 const live=new LiveSession({onStateChange(){},onError(){}});
 live.outputGainNode={gain:{setTargetAtTime(){}}};
 live.outputAudioCtx={currentTime:10,createBuffer(ch,n,rate){return {duration:n/rate,getChannelData:()=>new Float32Array(n)};},createBufferSource(){const s={connect(){},disconnect(){},start(time){this.startTime=time;},stop(){this.stopped=true;}};sources.push(s);return s;}};
 return {live,events,sources,unsub,pcm:Buffer.alloc(4800).toString('base64')};
}
test('actual voice adapter schedules avatar from audio clock and cancels old playback',()=>{
 const {live,events,sources,unsub,pcm}=fixture();
 live.beginAvatarSpeech('a');live.playAudioPCMChunk(pcm,'a');
 assert.equal(sources[0].startTime,10.15);
 assert.equal(events.find(e=>e.type==='audioWindow').start,10.15);
 live.handleInterruption('a');assert.equal(sources[0].stopped,true);
 assert.equal(live.beginAvatarSpeech('a'),false);live.playAudioPCMChunk(pcm,'a');assert.equal(sources.length,1);
 live.beginAvatarSpeech('b');live.playAudioPCMChunk(pcm,'b');
 sources[0].onended();assert.equal(live.getState(),'speaking');
 live.handleInterruption('a');assert.equal(live.avatarUtteranceId,'b');assert.equal(sources[1].stopped,undefined);
 sources[1].onended();assert.equal(live.getState(),'listening');unsub();
});
test('playback failure cancels the utterance and publishes error',()=>{
 const {live,events,unsub,pcm}=fixture();live.beginAvatarSpeech('failed');
 live.outputAudioCtx.createBuffer=()=>{throw Error('simulated playback failure');};
 live.playAudioPCMChunk(pcm,'failed');assert.equal(live.avatarUtteranceId,null);
 assert.ok(events.some(e=>e.type==='playbackError'));assert.equal(live.beginAvatarSpeech('failed'),false);unsub();
});
