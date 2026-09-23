/** Focused in-process adapter; carries audio handles, never microphone samples. */
const listeners=new Set();
let snapshot={state:'idle'};
export function publishAvatarEvent(event) {
  if(event.type==='state') snapshot={...snapshot,state:event.state};
  if(event.type==='audioContext') snapshot={...snapshot,context:event.context,gain:event.gain};
  if(event.type==='disconnect') snapshot={state:'idle'};
  for(const fn of [...listeners]) {try{fn(event);}catch(error){console.error('[SIYA avatar adapter]',error);}}
}
export function subscribeAvatarEvents(fn) {
  listeners.add(fn);
  fn({type:'state',state:snapshot.state});
  if(snapshot.context) fn({type:'audioContext',context:snapshot.context,gain:snapshot.gain});
  return ()=>listeners.delete(fn);
}
