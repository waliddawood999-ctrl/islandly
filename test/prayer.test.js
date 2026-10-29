const assert = require('node:assert/strict');
const prayer = require('../src/main/services/prayer');
const hijri = require('../src/main/services/hijri');
const defaults = require('../src/main/services/prayer-defaults');
const M = 60000;
const settings = { ...defaults, city: 'riyadh', ramadanMode: 'off' };
const date = new Date('2026-01-01T12:00:00+03:00');
const hhmm = time => new Date(time + 3*60*M).toISOString().slice(11,16);
assert.deepEqual(prayer.timesFor(settings,date).map(p => [p.name, hhmm(p.time)]), [
  ['fajr','05:14'],['sunrise','06:38'],['dhuhr','11:57'],['asr','14:56'],['maghrib','17:16'],['isha','18:46'],
]);
const normal = prayer.timesFor(settings,date), forced = prayer.timesFor({ ...settings, ramadanMode:'on' },date);
for (let i=0;i<normal.length;i++) assert.equal(forced[i].time-normal[i].time,normal[i].name==='isha'?30*M:0);
assert(prayer.ramadan({ramadanMode:'auto'},new Date('2025-03-01T12:00:00+03:00')));
assert(!prayer.ramadan({ramadanMode:'auto'},new Date('2025-03-30T12:00:00+03:00')));
const egypt = { ...settings, prayerMethod:'Egyptian' };
assert.deepEqual(prayer.timesFor(egypt,date),prayer.timesFor({...egypt,ramadanMode:'on'},date));
const at=+new Date('2026-01-01T06:00:00+03:00');
const fakeTimes = (_,d) => ['fajr','dhuhr','asr','maghrib','isha'].map((name,i)=>({name,time:hijri.midnight(d)+[6,12,15,18,20][i]*60*M}));
class Clock {
  constructor(time) { this.time=time; this.pending=new Map();this.id=0; }
  set = (fn,delay) => { assert(delay>0); const id=++this.id;this.pending.set(id,{at:this.time+delay,fn});return id; };
  clear = id => this.pending.delete(id);
  advance(time) { while(true) {const next=[...this.pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>time)break;this.pending.delete(next[0]);this.time=next[1].at;next[1].fn();assert(this.pending.size<=1);}this.time=time; }
}
const flush = async()=>{await Promise.resolve();await Promise.resolve();};
(async()=>{
  const clock=new Clock(at-11*M), events=[];
  let playing=true, pauses=0, resumes=0;
  const media={isPlaying:()=>playing,pauseForAdhan:async()=>{pauses++;playing=false;return{ok:true};},resumeAfterAdhan:async()=>{resumes++;playing=true;return{ok:true};}};
  const service=new prayer.PrayerService({getSettings:()=>settings,onState:x=>events.push(x),media,now:()=>clock.time,setTimer:clock.set,clearTimer:clock.clear,getTimes:fakeTimes});
  service.start();assert.equal(service.get().phase,'idle');assert.equal(clock.pending.size,1);
  clock.advance(at-10*M);assert.equal(service.get().phase,'pre');assert.equal(service.get().phaseEndsAt,at);
  clock.advance(at);await flush();assert.equal(service.get().phase,'adhan');assert.equal(service.get().current.name,'fajr');assert.notEqual(service.get().next.name,'sunrise');assert.equal(pauses,1);assert(service.get().pausedByAdhan);
  service.update();await flush();assert.equal(pauses,1,'duplicate boundary/update must not pause twice');
  clock.advance(at+2*M);assert.equal(service.get().phase,'iqama');assert.equal(service.get().phaseEndsAt,at+25*M);
  clock.advance(at+25*M);assert.equal(service.get().phase,'idle');assert(!service.get().pausedByAdhan);assert.equal(resumes,0,'never auto-resume');
  assert.equal((await service.resume()).ok,false);
  service.stop();assert.equal(clock.pending.size,0);
  assert(events.some(e=>e.phase==='adhan'&&e.pausedByAdhan));
  // Mid-adhan startup and explicit resume; no toggle or unsolicited play on missing media.
  clock.time=at+M;playing=true;
  const other=new prayer.PrayerService({getSettings:()=>settings,onState:()=>{},media,now:()=>clock.time,setTimer:clock.set,clearTimer:clock.clear,getTimes:fakeTimes});
  other.start();await flush();assert(other.get().pausedByAdhan);assert.equal((await other.resume()).ok,true);assert.equal(resumes,1);assert(!other.get().pausedByAdhan);other.stop();
  playing=false;const previous=pauses;other.pauseFor=null;other.start();await flush();assert.equal(pauses,previous,'no pause when nothing is playing');
  playing=true;other.mediaChanged({type:'media',active:true,playing:true});await flush();assert.equal(pauses,previous+1,'first playing metadata during adhan is caught after cold startup');
  other.mediaChanged({type:'media',active:true,playing:true});await flush();assert.equal(pauses,previous+1,'metadata updates never repeat the same adhan pause');
  clock.time=at+26*M;assert(!other.get().pausedByAdhan);assert.equal((await other.resume()).ok,false,'a delayed timer cannot resume after iqama has ended');other.stop();
  playing=true;
  const disabled=new prayer.PrayerService({getSettings:()=>({...settings,prayerAutoPause:false}),onState:()=>{},media,now:()=>at,setTimer:clock.set,clearTimer:clock.clear,getTimes:fakeTimes});
  disabled.start();await flush();assert.equal(pauses,previous+1);disabled.stop();
  assert.equal(prayer.windowFor({...settings,prayerIqamaMinutes:{fajr:2}},at+2*M,fakeTimes).state.phase,'idle');
  const ramadan=prayer.windowFor({...settings,ramadanMode:'on'},at-11*M,fakeTimes).state;
  assert.equal(ramadan.imsak,at-10*M);assert.equal(ramadan.iftar,hijri.midnight(new Date(at))+18*60*M);
  // A completed command after stop/config invalidation cannot resurrect paused state.
  let resolvePause;const late=new prayer.PrayerService({getSettings:()=>settings,onState:()=>{},media:{isPlaying:()=>true,pauseForAdhan:()=>new Promise(r=>{resolvePause=r;})},now:()=>at,setTimer:clock.set,clearTimer:clock.clear,getTimes:fakeTimes});
  late.start();late.stop();resolvePause({ok:true});await flush();assert(!late.pausedByAdhan);
  // Host TZ cannot change the selected Riyadh civil date or the calculated epochs.
  const {execFileSync}=require('node:child_process');
  const script=`console.log(JSON.stringify(require('./src/main/services/prayer').schedule(${JSON.stringify(settings)},new Date('2026-01-01T22:30:00Z'))))`;
  const a=execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:'America/Los_Angeles'}}).toString();
  const b=execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:'Asia/Tokyo'}}).toString();assert.equal(a,b);
  console.log('prayer: Riyadh reference, Ramadan +30, host TZ, event phases, one timer, safe pause/resume and late-stop tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
