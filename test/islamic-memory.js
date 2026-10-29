// Windows Electron main-process incremental working sets, including cold Intl initialization.
const {app}=require('electron');
const fs=require('node:fs');
// The old prayer module already loads these and computes today's/tomorrow's times.
const adhan=require('adhan');require('../src/main/cities');
for(let n=0;n<2;n++)new adhan.PrayerTimes(new adhan.Coordinates(24.7136,46.6753),new Date(2026,0,1+n,12),adhan.CalculationMethod.UmmAlQura());
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function sample(){const rows=[];for(let n=0;n<30;n++){await wait(1000);rows.push(app.getAppMetrics().find(p=>p.pid===process.pid).memory.workingSetSize/1024);}return{averageMB:rows.reduce((a,b)=>a+b,0)/rows.length,samples:rows};}
app.whenReady().then(async()=>{
 await wait(15000);const before=await sample();
 const {PrayerService}=require('../src/main/services/prayer'),hijri=require('../src/main/services/hijri'),{QuranService}=require('../src/main/services/quran');
 let requests=0,events=0;const defaults=require('../src/main/services/prayer-defaults');
 const service=new PrayerService({getSettings:()=>({...defaults,city:'riyadh'}),onState:()=>events++,media:{isPlaying:()=>false}});
 const quran=new QuranService({directory:()=>app.getPath('userData'),fetchList:async()=>{requests++;throw Error('unexpected network');}});
 service.start();hijri.get();service.get();
 await wait(15000);const after=await sample();service.stop();
 const result={platform:process.platform,electron:process.versions.electron,before,after,deltaMB:after.averageMB-before.averageMB,requests,events,method:'Electron Browser process workingSetSize KB / 1024; 15s warmup and 30 one-second samples before and after cold T10 service initialization; no GC/working-set trim'};
 fs.writeFileSync('islamic-memory.json',JSON.stringify(result,null,2));console.log('T10 MEMORY '+JSON.stringify({...result,before:{averageMB:before.averageMB},after:{averageMB:after.averageMB}}));
 if(requests!==0||result.deltaMB>=3)throw Error('T10 incremental RAM/network budget failed');
 app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
