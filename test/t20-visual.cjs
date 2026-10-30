// Real renderer matrix and geometry audit. Browser materials are fixtures, not a Windows DWM claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {fixture}=require('./t20-fixture');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.T21_VISUAL_OUT||path.join(root,'out/t21/renderer'));
const panels=['clock','music','timer','battery','today','clipboard','shelf','calendar','system','notes','usage','github'];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(process.platform==='linux'?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const audit=[],origin=`http://127.0.0.1:${server.address().port}`;let nativeFixtures=0,designFixtures=0;
 try{for(const lang of ['ar','en'])for(const theme of ['dark','light'])for(const material of ['acrylic','glass'])for(const mode of ['overlay','appbar'])for(const dpi of [1,1.25,1.5]){
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpi,colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-10-30T10:42:00Z'));
  await page.addInitScript(fixture,{lang,mode,material,complete:true});await page.goto(origin+'/src/renderer/index.html');
  await page.evaluate(({lang,mode,theme})=>{
   window.__seedPanels();const strip=mode==='appbar'?44:0;
   const background=document.createElement('main');background.id='qa-page';background.dir=lang==='ar'?'rtl':'ltr';background.style.cssText=`position:fixed;inset:${strip}px 0 0;padding:64px;background:${theme==='light'?'#e9edf4':'#142033'};color:${theme==='light'?'#36435a':'#adc0da'};font:18px sans-serif;pointer-events:none`;
   const title=document.createElement('h1');title.textContent=lang==='ar'?'صفحة التطبيق خلف الجزيرة':'Application page behind the island';background.append(title);
   for(let i=0;i<5;i++){const row=document.createElement('p');row.style.cssText='margin-top:44px;border-top:1px solid #8995a544;padding-top:20px';row.textContent=lang==='ar'?'محتوى الصفحة يبقى تحت الشريط المحجوز في وضع AppBar.':'Page content starts below the reserved strip in AppBar mode.';background.append(row);}document.body.prepend(background);
   if(strip){const bar=document.createElement('aside');bar.id='qa-appbar-strip';bar.textContent=lang==='ar'?'مساحة محجوزة · AppBar':'Reserved space · AppBar';bar.style.cssText=`position:fixed;inset:0 0 auto;height:44px;background:${theme==='light'?'#c8d1df':'#29374d'};color:${theme==='light'?'#36435a':'#b8c6db'};font:12px sans-serif;padding:12px;pointer-events:none`;document.body.insertBefore(bar,background.nextSibling);}
   Island.el.style.zIndex=2;document.getElementById('below').style.zIndex=2;
   Island.configure({workArea:{width:1280,height:800-strip}});
  },{lang,mode,theme});
  const prefix=`${lang}-${theme}-${material}-${mode}-${dpi*100}`;
  const geometry=async(panel,scene='normal')=>page.evaluate(({panel,scene})=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
   const intersect=(a,b)=>({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});
   const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
   const visible=e=>{let r=rect(e);for(let p=e;p&&p!==Island.el;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return null;if(p!==e&&(s.overflowX!=='visible'||s.overflowY!=='visible'))r=intersect(r,rect(p));}return r.right>r.x+.5&&r.bottom>r.y+.5?r:null;};
   const card=rect(Island.el),view=Island.el.querySelector('#content > .view'),footer=Island.el.querySelector('.dots'),dots=[...footer.querySelectorAll('.dot')],gear=footer.querySelector('.dots-gear'),collisions=[];
   if(/NaN|undefined|ليس.*رقم/.test(view.innerText))throw Error('Invalid fixture data: '+panel+' '+view.innerText);
   const v=rect(view),f=rect(footer),g=rect(gear),items=[...view.querySelectorAll('button,input,textarea,.ck-time,.ck-sec,.ck-date,.ck-app-name,.nt-text,.cl-text,.cal-title,.p-title,.sh-name,.m-title,.m-artist')].map(e=>({e,r:visible(e)})).filter(x=>x.r);
   if(overlap(v,f))collisions.push('view/footer');
   for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;if(a.e.closest('.ring-wrap')&&a.e.closest('.ring-wrap')===b.e.closest('.ring-wrap'))continue;if(overlap(a.r,b.r))collisions.push(`${a.e.className}/${b.e.className}`);}
   const dotRects=dots.map(rect),group={x:Math.min(...dotRects.map(r=>r.x)),right:Math.max(...dotRects.map(r=>r.right))};const gearGap=g.right<=group.x?group.x-g.right:g.x-group.right;
   if(gearGap<8)collisions.push('gear/dots gap '+gearGap);
   const labels=[...view.querySelectorAll('.ck-app-name')];if(labels.some(e=>parseFloat(getComputedStyle(e).fontSize)<12))collisions.push('tile labels below12px');
   let clockAlignment=null,emptyGap=null;if(panel==='clock'){
    const c=rect(view.querySelector('.ck-clock'));clockAlignment={side:document.documentElement.dir==='rtl'?'right':'left',x:c.x,right:c.right,viewX:v.x,viewRight:v.right,digitsDirection:getComputedStyle(view.querySelector('.ck-clock')).direction};
    if(Math.abs(clockAlignment.side==='right'?c.right-v.right:c.x-v.x)>1)collisions.push('clock not at inline-start');
    const tiles=[...view.querySelectorAll('.ck-app')].map(rect);emptyGap=f.y-Math.max(...tiles.map(r=>r.bottom));if(emptyGap>32)collisions.push('empty clock gap '+emptyGap);
   }
   const scrolls=[view,...view.querySelectorAll('*')].filter(e=>e.clientHeight>0&&e.scrollHeight>e.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).map(e=>({class:e.className,client:e.clientHeight,scroll:e.scrollHeight}));
   const strip=document.getElementById('qa-appbar-strip');return {panel,scene,card,view:v,footer:f,gear:g,gearGap,dotCount:dots.length,clockAlignment,emptyGap,scrolls,collisions,dir:document.documentElement.dir,material:document.documentElement.classList.contains('acrylic')?'acrylic':'glass',pageTop:rect(document.getElementById('qa-page')).y,strip:strip?rect(strip):null};
  },{panel,scene});
  for(const panel of panels){
   await page.evaluate(id=>Island.open(id),panel);await page.evaluate(()=>Island.whenPainted());await page.waitForTimeout(120);
   const row={lang,theme,material,mode,dpi,errors:[...errors],...await geometry(panel)};audit.push(row);
   await page.screenshot({path:path.join(out,`${prefix}-${panel}.png`)});
   if(row.collisions.length||errors.length||row.card.w>560.5||row.card.h>560.5||row.card.bottom>800||row.card.x<11)throw Error(JSON.stringify(row));
  }
  // A long notes list must scroll and materially differ from the short fixture.
  const short=audit.at(-3)?.panel==='notes'?audit.at(-3).card.h:audit.find(r=>r.lang===lang&&r.theme===theme&&r.material===material&&r.mode===mode&&r.dpi===dpi&&r.panel==='notes').card.h;
  await page.evaluate(()=>{const notes=Island.feature('notes');notes.todos=Array.from({length:50},(_,i)=>({id:i,text:(document.documentElement.dir==='rtl'?'مهمة طويلة للمراجعة ':'A long review item ')+i,done:false}));notes.paint();Island.open('notes');});await page.evaluate(()=>Island.whenPainted());await page.waitForTimeout(100);
  const long={lang,theme,material,mode,dpi,errors:[...errors],shortHeight:short,...await geometry('notes','long')};audit.push(long);await page.screenshot({path:path.join(out,`${prefix}-notes-long.png`)});if(!long.scrolls.length||long.card.h<=short||long.collisions.length)throw Error('Long content audit '+JSON.stringify(long));
  // Composite actual production Direct2D readbacks into page context when native CI generated them.
  const nativeDir=`out/t21/screenshots/${lang}-${theme}-${mode}-${material}-flush-${dpi}`;
  const nativeAvailable=fs.existsSync(path.join(root,nativeDir,'rest.png'));
  const scenes=['rest','open-0ms','open-30ms','open-60ms','open-100ms','open-150ms','open-260ms','close-0ms','close-30ms','close-60ms','close-100ms','close-150ms','close-260ms'];
  if(nativeAvailable){await page.evaluate(()=>{Island.el.style.visibility='hidden';document.getElementById('below').style.visibility='hidden';});
   for(const scene of scenes){await page.evaluate(async({url})=>{let holder=document.getElementById('qa-native');if(!holder){holder=document.createElement('img');holder.id='qa-native';holder.style.cssText='position:fixed;width:600px;height:700px;left:calc(50% - 300px);top:0;pointer-events:none';document.body.append(holder);}holder.src=url;await holder.decode();},{url:origin+'/'+nativeDir+'/'+scene+'.png'});await page.screenshot({path:path.join(out,`${prefix}-native-${scene}.png`)});nativeFixtures++;}
  }else{designFixtures++;}
  await context.close();
 }
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify({matrix:'all12 panels x ar/en x light/dark x acrylic/glass x overlay/AppBar x100/125/150%',nativeFrames:nativeFixtures,nativeUnavailableContexts:designFixtures,rows:audit},null,2));
 console.log(`T21 renderer audit PASS: ${audit.length} panel scenes; ${nativeFixtures} actual Direct2D collapsed/open/close context frames; native-unavailable contexts=${designFixtures}; no collisions, >=8px gear gap, >=12px tile labels, adaptive height/scroll, inline-start RTL time`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
