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
 const stages=[];
 const record=label=>stages.push({label,mb:app.getAppMetrics().find(p=>p.pid===process.pid).memory.workingSetSize/1024,heapMB:process.memoryUsage().heapUsed/1048576});
 const mode=process.env.ISLANDLY_ISLAMIC_PROBE||'full';
 let service;
 let requests=0,events=0;
 if(mode==='intl-only') {
   global.__calendar=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'});
   global.__calendar.formatToParts(new Date());record('minimal required Intl calendar');
 } else {
 const {PrayerService}=require('../src/main/services/prayer'),hijri=require('../src/main/services/hijri'),{QuranService}=require('../src/main/services/quran');
 record('modules loaded');
 const defaults=require('../src/main/services/prayer-defaults');
 service=new PrayerService({getSettings:()=>({...defaults,city:'riyadh'}),onState:()=>events++,media:{isPlaying:()=>false}});
 const quran=new QuranService({directory:()=>app.getPath('userData'),fetchList:async()=>{requests++;throw Error('unexpected network');}});
 service.start();record('prayer service started');hijri.get();service.get();record('all services exercised');
 }
 await wait(15000);const after=await sample();service?.stop();
 const result={mode,stages,platform:process.platform,electron:process.versions.electron,before,after,deltaMB:after.averageMB-before.averageMB,requests,events,method:'Electron Browser process workingSetSize KB / 1024; 15s warmup and 30 one-second samples before and after cold T10 service initialization; no GC/working-set trim'};
 fs.writeFileSync(`islamic-memory-${mode}.json`,JSON.stringify(result,null,2));console.log('T10 MEMORY '+JSON.stringify({...result,before:{averageMB:before.averageMB},after:{averageMB:after.averageMB}}));
 if(mode==='full'&&(requests!==0||result.deltaMB>=3))throw Error('T10 incremental RAM/network budget failed');
 app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
