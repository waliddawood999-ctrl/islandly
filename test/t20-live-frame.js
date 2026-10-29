require('./electron-diagnostics');
// Current actual main/preload/renderer + HWND acrylic IPC, not the comparison fixture.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {app,BrowserWindow}=require('electron');
const dpi=process.env.T20_DPI||'1';app.commandLine.appendSwitch('force-device-scale-factor',dpi);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'Islandly-T20-live-'));app.setPath('userData',profile);
fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({uiLang:'ar',lang:'ar',islandMode:'reserved-bar',scale:1,autoHide:'never',hideFullscreen:false,material:'acrylic',motion:'full',ecoMode:false,ecoAuto:false,weather:false,updates:false,clipboard:false,timeTracking:false,micCamIndicator:false,prayerAlerts:false,prayerAutoPause:false,breakEvery:0}));
process.env.ISLANDLY_TEST='1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('T20 live frame watchdog');app.exit(1)},60000);
require('../src/main/main');
app.whenReady().then(async()=>{
 for(let n=0;n<100&&!global.__islandly;n++)await wait(100);
 let win;
 for(let n=0;n<100;n++){win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/'));if(win&&!win.webContents.isLoadingMainFrame())break;await wait(100);}
 if(!win)throw Error('Live island window missing');
 const run=code=>win.webContents.executeJavaScript(code);
 const user32=require('koffi').load('user32.dll');
 const screenHeight=user32.func('int32 __stdcall GetSystemMetrics(int32 index)')(1);
 user32.func('bool __stdcall SetCursorPos(int32 x,int32 y)')(0,screenHeight-1);
 await run("window.__t20PinOnly=true; Island.setHover(false); void 0"); await wait(350);
 await run("Island.open('clock'); Island.whenPainted()");
 const benchmark=fs.readFileSync(path.join(__dirname,'t20-electron.js'),'utf8').match(/const timing=await run\(`([\s\S]*?)`\);/)[1];
 const timing=await run(benchmark);
 const out=path.join(__dirname,'../out/t20');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,`live-frames-${dpi}.json`),JSON.stringify({dpi:Number(dpi),context:'actual main/preload/renderer, Arabic AppBar, requested acrylic, current build, pin collapse/expand; hover measured in matched fixture and packaged OS-input regression',...timing},null,2));
 console.log('T20 LIVE FRAME RESULT '+JSON.stringify({...timing,frames:undefined}));
 if(timing.frameP95>25||timing.inputP95>=50||timing.inputSamples<10)throw Error('Live frame/input guard failed');
 clearTimeout(watchdog);global.__islandly.cleanup();app.quit();
}).catch(e=>{console.error(e);clearTimeout(watchdog);global.__islandly?.cleanup();app.exit(1)});
