const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const mediaFile=path.join(__dirname,'../src/main/media.js'),realRequire=createRequire(mediaFile);
let keys=0, commands=[]; const commandHost={failed:false,request:async(_,args,command)=>{commands.push(command);return command==='pause'?{ok:true,app:'Player.App'}:{ok:true};}};const sandbox={require:id=>id==='./win32'?{mediaKey:()=>{keys++;return true;}}:id==='./ps'?{isWindows:false,host:commandHost}:realRequire(id),module:{exports:{}},Buffer,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(mediaFile,'utf8'),sandbox,{filename:mediaFile});
const {MediaBridge}=sandbox.module.exports;
const {register}=require('../src/main/services/islamic-ipc');
(async()=>{
 const bridge=new MediaBridge(()=>{},'');bridge.start();
 assert.equal((await bridge.pauseForAdhan()).ok,false);assert.equal(commands.length,0);assert.equal(keys,0);
 bridge.playback={active:true,playing:true,app:'Player.App'};assert.equal((await bridge.pauseForAdhan()).ok,true);assert.equal(commands[0],'pause');assert.equal(keys,0,'automatic pause must never fall back to a toggle key');
 assert.equal((await bridge.resumeAfterAdhan()).ok,true);assert.equal(commands[1],'play '+Buffer.from('Player.App').toString('base64'));assert.equal((await bridge.resumeAfterAdhan()).ok,false);
 const handlers=new Map();let downloads=0;
 register({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},isIsland:e=>e.role==='island'&&e.frame==='main',isSettings:e=>e.role==='settings'&&e.frame==='main',settings:{get:()=>({hijriOccasions:false})},prayer:()=>({get:()=>({phase:'idle'}),resume:async()=>({ok:false})}),quran:{reciters:async()=>{downloads++;return[];},url:()=>''}});
 for(const role of ['foreign','settings','island'])for(const frame of ['main','sub'])for(const [name,fn]of handlers){
  const allowed=frame==='main'&&(role==='island'||role==='settings'&&['prayer:get','hijri:get'].includes(name));
  if(allowed)await fn({role,frame});else assert.throws(()=>fn({role,frame}),/Unauthorized/);
 }
 assert.equal(downloads,1);assert.equal(handlers.get('hijri:get')({role:'settings',frame:'main'}).occasion,null);
 // Real settings validation must preserve defaults and partial per-prayer updates.
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-prayer-settings-'));
 const file=path.join(__dirname,'../src/main/settings.js'),req=createRequire(file),storeFile=path.join(__dirname,'../src/main/services/store.js');
 const defaults=require('../src/main/services/prayer-defaults');
 const ctx={require:id=>id==='electron'?{app:{getPath:()=>dir}}:id==='./services/store'?{ISLAMIC_DEFAULTS:defaults}:req(id),module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});const settings=ctx.module.exports;settings.init();
 settings.set({prayerIqamaMinutes:{fajr:18,isha:90,alien:3},prayerPreMinutes:-1,ramadanMode:'bad'});
 assert.equal(settings.get().prayerIqamaMinutes.fajr,18);assert.equal(settings.get().prayerIqamaMinutes.isha,20);assert.equal(settings.get().prayerPreMinutes,10);assert.equal(settings.get().ramadanMode,'auto');assert(!('alien'in settings.get().prayerIqamaMinutes));
 fs.rmSync(dir,{recursive:true,force:true});
 console.log('Islamic backend: explicit pause/session resume, no toggle, IPC sender/frame scope and settings validation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
