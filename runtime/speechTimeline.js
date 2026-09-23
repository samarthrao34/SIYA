/** Audio-clock driven scheduling. No text-arrival timers and no phoneme claims. */
export const VISEMES = ['sil','PP','FF','TH','DD','kk','CH','SS','nn','RR','aa','E','I','O','U'];
const finite = (v, fallback=0) => Number.isFinite(v) ? v : fallback;
export class SpeechTimeline {
  constructor() { this.id=null; this.frames=[]; this.windows=[]; this.retired=new Set(); this.disposed=false; }
  begin(id) {
    if (this.disposed || !id || this.retired.has(id)) return false;
    if (id !== this.id) {
      if (this.id) this.retired.add(this.id);
      this.id=id; this.frames=[]; this.windows=[];
    }
    return true;
  }
  enqueue(frames,id) {
    if (this.disposed || id !== this.id || this.retired.has(id)) return false;
    for (const f of frames) {
      if (!Number.isFinite(f.time) || !(f.duration>0)) continue;
      const weights={}; let sum=0;
      for (const [key,val] of Object.entries(f.weights||{})) {
        if (!VISEMES.includes(key)) continue;
        weights[key]=Math.max(0,Math.min(1,finite(val))); sum+=weights[key];
      }
      if (sum>1) for (const key in weights) weights[key]/=sum;
      this.frames.push({time:f.time,duration:Math.min(2,f.duration),weights,source:f.source||'timestamped'});
    }
    this.frames.sort((a,b)=>a.time-b.time);
    return true;
  }
  addWindow(start,end,id) {
    if (id!==this.id || this.disposed || this.retired.has(id) || !Number.isFinite(start) || !(end>start)) return false;
    this.windows.push({start,end}); return true;
  }
  sample(clock,{muted=false,playing=true}={}) {
    if (this.disposed || !this.id || muted || !playing || !Number.isFinite(clock)) return {};
    this.frames=this.frames.filter(f=>f.time+f.duration>=clock-0.15);
    this.windows=this.windows.filter(w=>w.end>=clock-0.15);
    if (!this.windows.some(w=>clock>=w.start && clock<w.end)) return {};
    // Last timestamp wins for overlaps, so corrected alignment can replace fallback.
    const active=this.frames.filter(f=>clock>=f.time && clock<f.time+f.duration);
    const aligned=active.filter(f=>f.source!=='amplitude-fallback');
    const f=(aligned.length?aligned:active).at(-1);
    return f ? {...f.weights} : {};
  }
  stop(id=this.id) {
    if (id) this.retired.add(id);
    if (id===this.id) {this.id=null; this.frames=[];this.windows=[];}
  }
  reset() {this.stop();this.frames=[];this.windows=[];}
  dispose() {this.reset();this.disposed=true;this.retired.clear();}
}

/** 20ms RMS windows follow scheduled PCM time. This is amplitude animation. */
export function amplitudeFrames(pcm,rate,start) {
  const frames=[], step=Math.max(1,Math.round(rate*0.02));
  for(let i=0;i<pcm.length;i+=step) {
    let energy=0; const end=Math.min(pcm.length,i+step);
    for(let j=i;j<end;j++) energy+=pcm[j]*pcm[j];
    const rms=Math.sqrt(energy/Math.max(1,end-i));
    const amount=Math.max(0,Math.min(0.75,(rms-0.007)*5.5));
    frames.push({time:start+i/rate,duration:(end-i)/rate,weights:{aa:amount},source:'amplitude-fallback'});
  }
  return frames;
}
