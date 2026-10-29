// Chromium screenshot/geometry audit; does not emulate Windows acrylic or SAC.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {fixture}=require('./t20-fixture');
const root=path.resolve(__dirname,'..'), out=path.join(root,'dev/t20');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const baseline=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-t20-before-'));
 const archive=execFileSync('git',['archive','8b32e1948b8b4529d0b71e0ca67a76a9cb28ff3c','src/renderer','assets/fonts'],{cwd:root,maxBuffer:50*1024*1024});
 execFileSync('tar',['-x','-C',baseline],{input:archive});
 const server=require('node:http').createServer((req,res)=>{
  const parts=new URL(req.url,'http://localhost').pathname.split('/').filter(Boolean); const version=parts.shift();
  const base=version==='before'?baseline:root, file=path.resolve(base,...parts);
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const audit=[];
 try {for(const version of ['before','after']) for(const lang of ['ar','en']) for(const mode of ['overlay','appbar']) for(const dpi of [1,1.25,1.5]) {
  const ctx=await browser.newContext({viewport:{width:760,height:740},deviceScaleFactor:dpi});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(fixture,{lang,mode});
  await page.goto(`http://127.0.0.1:${server.address().port}/${version}/src/renderer/index.html`);
  await page.evaluate(()=>{document.body.style.background='#142033'; Island.open('clock');});
  await page.waitForTimeout(700);
  const geometry=await page.evaluate(()=>{
   const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
   const card=r(Island.el), dots=r(document.querySelector('.dots')), tiles=[...document.querySelectorAll('.ck-app')].map(r), head=r(document.querySelector('.ck-head'));
   const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
   const collisions=[];if(tiles.some(t=>overlap(t,dots)))collisions.push('dots/tiles');
   for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++)if(overlap(tiles[i],tiles[j]))collisions.push('tile/tile');
   if(tiles.some(t=>overlap(t,head)))collisions.push('clock/tiles');
   const a=r(document.querySelector('.ck-clock')),b=r(document.querySelector('.ck-dates'));if(overlap(a,b))collisions.push('clock/date');
   return {card,dots,tiles,head,collisions,dir:document.documentElement.dir};
  });
  await page.screenshot({path:path.join(out,`${version}-${lang}-${mode}-${dpi*100}.png`)});
  audit.push({version,lang,mode,dpi,errors,...geometry});
  if(version==='after'&&(geometry.collisions.length||errors.length))throw Error(JSON.stringify(audit.at(-1)));
  if(process.env.T20_PROFILE && version==='after' && lang==='ar' && mode==='overlay' && dpi===1) {
   const script=fs.readFileSync(path.join(__dirname,'t20-electron.js'),'utf8').match(/const timing=await run\(`([\s\S]*?)`\);/)[1];
   const timing=await page.evaluate(script);console.log('LOCAL FRAME PROFILE '+JSON.stringify({...timing,frames:undefined}));
  }
  if(version==='after' && dpi===1) {
   await page.evaluate(() => { Island.open('timer'); Island.feature('timer').setMode('quick'); });
   await page.waitForTimeout(400);
   await page.locator('.timer-expanded .step:last-child').click();
   if(!await page.evaluate(()=>Island.feature('timer').total===660))throw Error('Timer custom step inaccessible');
   const adaptive=await page.evaluate(async()=>{
    window.__emit('media:update',{type:'media',active:true,title:'A wide media title',artist:'Fixture',playing:false,position:10,duration:180,sentAt:Date.now(),trackChanged:false});
    Island.open('music'); await Island.whenPainted();
    const wide=Island.debug().shape.w;
    Island.open('clock');await Island.whenPainted();const narrow=Island.debug().shape.w;
    Island.configure({workArea:{width:320,height:400}});await Island.whenPainted();const small=Island.debug().shape;
    return {wide,narrow,small};
   });
   if(adaptive.wide<=adaptive.narrow || adaptive.narrow!==360 || adaptive.small.w>284 || adaptive.small.h>374)throw Error('Adaptive bounds failure: '+JSON.stringify(adaptive));
   audit.at(-1).adaptive=adaptive;
  }
  await ctx.close();
 }
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(audit,null,2));
 console.log('T20 visual audit: 24 before/after screenshots, RTL/LTR x overlay/AppBar x 100/125/150%');
 } finally {await browser.close();server.close();fs.rmSync(baseline,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
