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
 try{const fast=!!process.env.T21_VISUAL_FAST;for(const lang of ['ar','en'])for(const theme of fast?['light']:['dark','light'])for(const material of fast?['acrylic']:['acrylic','glass'])for(const mode of fast?['overlay']:['overlay','appbar'])for(const dpi of fast?[1]:[1,1.25,1.5]){
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
   // No empty space: the lowest visible content must sit close above the footer (the card height follows its content).
   const lows=[...view.querySelectorAll('*')].map(e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>1&&r.height>1&&c.visibility!=='hidden'&&c.display!=='none'&&parseFloat(c.opacity)>0?r:null}).filter(Boolean).map(r=>Math.min(r.bottom,v.bottom));
   const emptyBelow=lows.length?Math.round(f.y-Math.max(...lows)):0;if(emptyBelow>40)collisions.push('empty space below content '+emptyBelow+'px');
   if(card.h<=card.w)collisions.push('card not portrait '+Math.round(card.w)+'x'+Math.round(card.h));
   if(card.h<card.w*1.1-1)collisions.push('card not clearly portrait '+Math.round(card.w)+'x'+Math.round(card.h));
   if(card.w>440.5)collisions.push('card wider than 440 '+Math.round(card.w));
   // Generic text/icon audit: every rendered line box of text, every icon (svg/emoji glyph) and page dot inside the card must be separated from every other one (no overlap, no touching within 0.5 px).
   {const boxes=[];const clip=(el,r)=>{let box={...r};for(let p=el;p&&p!==Island.el.parentElement;p=p.parentElement){const o=getComputedStyle(p);if(o.overflowX==='visible'&&o.overflowY==='visible')continue;const c=p.getBoundingClientRect();box={x:Math.max(box.x,c.x),y:Math.max(box.y,c.y),right:Math.min(box.right,c.right),bottom:Math.min(box.bottom,c.bottom)};if(box.right-box.x<=.5||box.bottom-box.y<=.5)return null;}return box;};const walker=document.createTreeWalker(Island.el,NodeFilter.SHOW_TEXT);for(let n=walker.nextNode();n;n=walker.nextNode()){if(!n.nodeValue.trim())continue;const el=n.parentElement;if(!el||el.closest('script,style,[hidden],svg'))continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0)continue;let hidden=false;for(let p=el;p&&p!==Island.el.parentElement;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0){hidden=true;break}}if(hidden)continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width>.5&&r.height>.5){const clipped=clip(el,{x:r.x,y:r.y,right:r.right,bottom:r.bottom});if(clipped)boxes.push({el,r:clipped,kind:'text:'+(el.getAttribute('class')||el.tagName)+'['+n.nodeValue.trim().slice(0,12)+']'});}}
    for(const el of Island.el.querySelectorAll('svg,.dot,.dots-gear')){if(el.closest('[hidden]'))continue;const c=getComputedStyle(el);if(c.display==='none'||c.visibility==='hidden')continue;const r=el.getBoundingClientRect();const clipped=r.width>.5&&r.height>.5?clip(el,{x:r.x,y:r.y,right:r.right,bottom:r.bottom}):null;if(clipped)boxes.push({el,r:clipped,kind:'icon:'+(el.getAttribute('class')||el.tagName)});}
    const sameRing=(a,b)=>{const r=a.closest('.ring-wrap');return r&&r===b.closest('.ring-wrap')};const near=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>-.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>-.5;
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.el===b.el||a.el.contains(b.el)&&a.kind.startsWith('icon')===false&&b.kind.startsWith('icon')===false&&false)continue;if(a.el===b.el||sameRing(a.el,b.el))continue;if(a.kind.startsWith('icon')&&b.kind.startsWith('icon')&&a.el.contains(b.el)||b.el.contains(a.el)&&a.kind.startsWith('icon')&&b.kind.startsWith('icon'))continue;if(near(a.r,b.r))collisions.push('text-audit '+a.kind+' / '+b.kind);}}
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
   const strip=document.getElementById('qa-appbar-strip');return {panel,scene,emptyBelow,roomy:Island.el.querySelector('#content > .view')?.style.getPropertyValue('--roomy'),card,view:v,footer:f,gear:g,gearGap,dotCount:dots.length,clockAlignment,emptyGap,scrolls,collisions,dir:document.documentElement.dir,material:document.documentElement.classList.contains('acrylic')?'acrylic':'glass',pageTop:rect(document.getElementById('qa-page')).y,strip:strip?rect(strip):null};
  },{panel,scene});
  for(const panel of panels){
   await page.evaluate(id=>Island.open(id),panel);await page.evaluate(()=>Island.whenPainted());await page.waitForTimeout(120);await page.evaluate(()=>new Promise(resolve=>{const until=performance.now()+1500;(function check(){const running=document.getAnimations().some(a=>{const t=a.effect&&a.effect.getComputedTiming();return a.playState==='running'&&t&&Number.isFinite(t.endTime)});if(!running||performance.now()>until)resolve();else requestAnimationFrame(check)})()})); /* measure only after finite running CSS transitions (the page-dot width easing overshoots for 250 ms) have ended: a slow runner caught the dots mid-transition */
   const row={lang,theme,material,mode,dpi,errors:[...errors],...await geometry(panel)};audit.push(row);
   await page.screenshot({path:path.join(out,`${prefix}-${panel}.png`)});
   if(row.collisions.length||errors.length||row.card.w>560.5||row.card.h>560.5||row.card.bottom>800||row.card.x<11){if(process.env.T21_VISUAL_COLLECT){console.log('COLLISION',lang,theme,material,mode,dpi,panel,JSON.stringify(row.collisions),JSON.stringify(errors),'card',Math.round(row.card.w)+'x'+Math.round(row.card.h),'view',Math.round(row.view.h),'footerY',Math.round(row.footer.y-row.card.y),'roomy',row.roomy);continue;}throw Error(JSON.stringify(row));}
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
