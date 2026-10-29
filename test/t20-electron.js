// Actual Electron/Windows compositor timing, local fixture, not hardware/SAC acceptance.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
app.on('window-all-closed',()=>{});
const dpi=process.env.T20_DPI||'1';app.commandLine.appendSwitch('force-device-scale-factor',dpi);
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/t20');fs.mkdirSync(out,{recursive:true});
const baseline=fs.mkdtempSync(path.join(os.tmpdir(),'T20-before-'));
execFileSync('tar',['-x','-C',baseline],{input:execFileSync('git',['archive','8b32e1948b8b4529d0b71e0ca67a76a9cb28ff3c','src/renderer','assets/fonts'],{cwd:root,maxBuffer:50*1024*1024})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];
app.whenReady().then(async()=>{
 for(const version of ['before','after']) for(const lang of ['ar','en']) for(const mode of ['overlay','appbar']){
  process.env.T20_LANG=lang;process.env.T20_MODE=mode;
  const area=require('electron').screen.getPrimaryDisplay().workArea;
  const win=new BrowserWindow({width:Math.min(760,area.width),height:Math.min(740,area.height),frame:false,show:true,webPreferences:{preload:path.join(__dirname,'t20-preload.js'),contextIsolation:false,nodeIntegration:false,sandbox:false,backgroundThrottling:false}});
  await win.loadFile(path.join(version==='before'?baseline:root,'src/renderer/index.html'));
  const run=code=>win.webContents.executeJavaScript(code);
  await run("document.body.style.background='#142033'; Island.open('clock'); void 0");await wait(600);
  const geometry=await run(`(() => {
   const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
   const dots=r(document.querySelector('.dots')), tiles=[...document.querySelectorAll('.ck-app')].map(r), head=r(document.querySelector('.ck-head'));
   const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
   return {dpr:devicePixelRatio,card:r(Island.el),viewport:{width:innerWidth,height:innerHeight},overlap:tiles.some(t=>overlaps(t,dots)||overlaps(t,head))||overlaps(r(document.querySelector('.ck-clock')),r(document.querySelector('.ck-dates')))};
  })()`);
  if(version==='after'&&(geometry.overlap||geometry.card.bottom>geometry.viewport.height||geometry.card.right>geometry.viewport.width))throw Error('Expanded overlap: '+JSON.stringify({lang,mode,dpi,geometry}));
  fs.writeFileSync(path.join(out,`${version}-${lang}-${mode}-${Number(dpi)*100}.png`),(await win.webContents.capturePage()).toPNG());
  const timing=await run(`(async()=>{
   const frames=[],inputs=[],inputDetails=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   for(let cycle=0;cycle<12;cycle++){
    if(cycle===6){Island.setHover(false);if(Island.isExpanded())Island.togglePin();await sleep(500);}
    const previous=Island.el.getBoundingClientRect();const oldOpacity=getComputedStyle(Island.el).opacity;const start=performance.now();let last=start,first=null;
    if(cycle<6) Island.togglePin(); else Island.setHover(cycle%2===0);
    const jsMs=performance.now()-start;let maxFrame=0;
    await new Promise(resolve=>{function frame(now){
     if(last!==start){frames.push(now-last);maxFrame=Math.max(maxFrame,now-last);}last=now;
     const rect=Island.el.getBoundingClientRect();if(first===null&&(Math.abs(rect.width-previous.width)>.1||Math.abs(rect.height-previous.height)>.1||getComputedStyle(Island.el).opacity!==oldOpacity))first=performance.now()-start;
     if(now-start<450)requestAnimationFrame(frame);else resolve();
    }requestAnimationFrame(frame)});
    inputDetails.push({cycle,jsMs,first,maxFrame});
    if(first!==null)inputs.push(first);await sleep(30);
   }
   const pct=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
   return {inputDetails,samples:frames.length,inputSamples:inputs.length,frameP50:pct(frames,.5),frameP95:pct(frames,.95),inputP50:pct(inputs,.5),inputP95:pct(inputs,.95),framesOver25ms:frames.filter(x=>x>25).length,frames};
  })()`);
  const row={version,lang,mode,dpi:Number(dpi),geometry,...timing};rows.push(row);console.log('T20 FRAME RESULT '+JSON.stringify({...row,frames:undefined}));
  win.destroy();
 }
 fs.writeFileSync(path.join(out,`frames-${dpi}.json`),JSON.stringify(rows,null,2));
 const bad=rows.filter(r=>r.version==='after'&&(r.frameP95>25||r.inputP95>=50||r.inputSamples<10));
 if(bad.length)throw Error('T20 frame/input guard failed: '+JSON.stringify(bad.map(({frames,...x})=>x)));
 fs.rmSync(baseline,{recursive:true,force:true});app.exit(0);
}).catch(e=>{fs.writeFileSync(path.join(out,`frames-${dpi}.json`),JSON.stringify(rows,null,2));console.error(e);app.exit(1)});
