const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {app,BrowserWindow}=require('electron');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-islamic-ipc-'));app.setPath('userData',dir);
fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({weather:false,updates:false,clipboard:false,timeTracking:false,micCamIndicator:false,prayerAutoPause:false,breakEvery:0}));
require('../src/main/main');const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 await wait(1500);const island=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/'));
 assert(island);const state=await island.webContents.executeJavaScript("islandAPI.call('prayer:get')");assert(['idle','pre','adhan','iqama'].includes(state.phase));assert(state.next&&state.next.name!=='sunrise');
 const h=await island.webContents.executeJavaScript("islandAPI.call('hijri:get')");assert(h.month>=1&&h.month<=12);assert(h.monthNameAr&&h.monthNameEn);
 const result=await island.webContents.executeJavaScript("islandAPI.call('media:resume')");assert.equal(result.ok,false);
 const foreign=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'../src/main/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 await foreign.loadURL('data:text/html,<title>foreign</title>');
 for(const channel of ['prayer:get','hijri:get','quran:reciters','media:resume']){
 const rejected=await foreign.webContents.executeJavaScript(`islandAPI.call(${JSON.stringify(channel)}).then(()=>false,e=>e.message.includes('Unauthorized'))`);assert(rejected,channel);
 }
 foreign.destroy();console.log('Real Electron Islamic IPC: valid state/calendar, guarded resume and foreign-window rejection pass');app.quit();
}).catch(e=>{console.error(e);app.exit(1);});
