const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {compare,check}=require('./ci/locales');
const {validate,baseline}=require('./ci/performance');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-ci-contracts-'));
try {
 assert.throws(()=>check(root),/T11 prerequisite missing/);
 const dir=path.join(root,'locales');fs.mkdirSync(dir);
 fs.writeFileSync(path.join(dir,'ar.json'),JSON.stringify({title:'عنوان',panel:{open:'افتح'},items:['واحد','اثنان']}));
 assert.throws(()=>check(root),/Missing locale catalogue/);
 fs.writeFileSync(path.join(dir,'en.json'),JSON.stringify({title:'Title',panel:{open:'Open'},items:['one','two']}));
 assert.equal(check(root).keyCount,6);
 const missing=compare({onlyAr:'أ',deep:{x:'س'}},{onlyEn:'B',deep:{y:'Y'}});
 assert.deepEqual(missing.missingInArabic,['/deep/y','/onlyEn']);assert.deepEqual(missing.missingInEnglish,['/deep/x','/onlyAr']);
 assert.deepEqual(compare({'a.b':'a'},{a:{b:'b'}}).missingInEnglish,['/a.b']);
 assert.equal(compare({a:'s'},{a:{b:'s'}}).mismatchedTypes[0].key,'/a');
 assert.throws(()=>compare([],{}),/JSON object/);
 fs.writeFileSync(path.join(dir,'en.json'),'{bad');assert.throws(()=>check(root),/Invalid locale JSON/);
 const sample=(mb=40,cpu=.2)=>({hostPid:42,phase:'idle',totalMB:mb,totalCPU:cpu,processes:[{pid:42,name:'Islandly',mb,cpu}]});
 const fixture=()=>({platform:'Windows',mode:'overlay',warmupSeconds:15,sampleCount:60,sampleIntervalSeconds:1,
  idle:{samples:Array.from({length:60},()=>sample())},afterClose:{samples:Array.from({length:60},()=>sample(32,.15))}});
 const report=fixture();assert.equal(validate(report,'overlay').idle.averageMB,40);
 assert.deepEqual(baseline.limits,{ramExclusiveMaxMB:180,cpuExclusiveMaxPercent:1});
 let bad=fixture();bad.idle.samples[0]=sample(180);assert.throws(()=>validate(bad,'overlay'),/RAM guard FAILED/,'one excessive RAM sample must fail even when its mean is low');
 bad=fixture();bad.afterClose.samples=Array.from({length:60},()=>sample(40,1));assert.throws(()=>validate(bad,'overlay'),/CPU guard FAILED/);
 bad=fixture();bad.idle.samples[0]=sample(40,3);assert(validate(bad,'overlay'),'T9 CPU cap is a 60-sample mean, not an instantaneous spike cap');
 bad=fixture();bad.idle.samples.pop();assert.throws(()=>validate(bad,'overlay'),/expected 60/);
 bad=fixture();bad.idle.samples[0].processes.push({pid:99,name:'electron',mb:10,cpu:0});assert.throws(()=>validate(bad,'overlay'),/Electron\/helper/);
 bad=fixture();bad.idle.samples[0].processes[0].name='electron';assert.throws(()=>validate(bad,'overlay'),/unexpected idle process/);
 bad=fixture();bad.idle.samples[0].totalMB=1;assert.throws(()=>validate(bad,'overlay'),/totals omit/);
 bad=fixture();bad.afterClose.samples[0].totalCPU=NaN;assert.throws(()=>validate(bad,'overlay'),/Invalid or missing/);
 bad=fixture();bad.idle.samples[0]=sample(0);assert.throws(()=>validate(bad,'overlay'),/zero native working set/);
 bad=fixture();bad.warmupSeconds=0;assert.throws(()=>validate(bad,'overlay'),/warmup/);
 bad=fixture();bad.platform='linux';assert.throws(()=>validate(bad,'overlay'),/platform\/mode/);
 console.log('CI guards: bidirectional/deep locale keys, missing/invalid catalogues, raw-sample RAM/CPU boundaries, no Electron/omitted processes, and malformed/short reports pass');
} finally {fs.rmSync(root,{recursive:true,force:true});}
