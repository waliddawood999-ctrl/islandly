// Deterministic local renderer fixture. No network requests or OS data.
function fixture({ lang='ar', mode='overlay', material='glass', complete=false }={}) {
  const handlers = {};
  window.__emit = (name, value) => (handlers[name] || []).forEach(cb => cb(value));
  window.islandAPI = {
    settings: { lang, uiLang: lang, digits: 'latn', autoHide: 'never', islandMode: mode, motion: 'full', material, floating:false, idleEyes:true },
    call: async ch => {
      if(ch === 'shortcuts:list') return ['Edge','File Explorer','Spotify','VS Code'].map(name=>({name}));
      if(ch === 'island:work-area') return {width:Math.min(1280,window.innerWidth),height:Math.min(760,window.innerHeight)};
      if(ch === 'media:caps') return { ok:true, next:true, prev:true, seek:true,toggle:true };
      if(ch === 'material:get') return {material,supported:material==='acrylic'};
      if(complete){
       const now=Date.now(),prayers=Array.from({length:6},(_,i)=>({name:['fajr','sunrise','dhuhr','asr','maghrib','isha'][i],time:now+(i+2)*3600000}));
       if(ch==='today:get')return {prayer:{today:prayers,tomorrow:prayers.map(p=>({...p,time:p.time+86400000})),location:lang==='ar'?'الرياض':'Riyadh'},weather:{temp:28,code:0,day:true,max:31,min:20}};
       if(ch==='notes:get')return {todos:Array.from({length:3},(_,i)=>({id:i+1,text:lang==='ar'?'مهمة واضحة للمراجعة '+(i+1):'Review item '+(i+1),done:i===0}))};
       if(ch==='clipboard:list')return Array.from({length:5},(_,i)=>({id:i+1,type:'text',text:lang==='ar'?'نص محفوظ في الحافظة '+(i+1):'Saved clipboard text '+(i+1),pinned:i===0}));
       if(ch==='shelf:list')return Array.from({length:4},(_,i)=>({id:i+1,name:(lang==='ar'?'ملف مشروع ':'Project file ')+(i+1)+'.txt',path:'C:\\Fixture\\item'+i+'.txt',ext:'.txt',size:2048,exists:true}));
       if(ch==='calendar:get')return {status:'ok',events:Array.from({length:4},(_,i)=>({id:i+1,title:lang==='ar'?'اجتماع الفريق '+(i+1):'Team meeting '+(i+1),start:now+(i+2)*3600000,end:now+(i+3)*3600000,location:lang==='ar'?'المكتب':'Office',url:'https://example.invalid/meeting'}))};
       if(ch==='usage:get')return {total:14400,apps:[{name:'Editor',seconds:7200},{name:'Browser',seconds:4800},{name:'Explorer',seconds:2400}]};
       if(ch==='github:get')return {status:'ok',fresh:[],items:[{id:'1',type:'PullRequest',title:lang==='ar'?'مراجعة التغيير المقترح':'Review proposed change',repo:'fixture/islandly',url:'https://example.invalid/review'}]};
      }
      return null;
    },
    on: (ch,cb) => { (handlers[ch] ||= []).push(cb); }, send() {}, pathsForFiles:()=>[],
  };
  const battery = Object.assign(new EventTarget(), {level:.82,charging:true,chargingTime:1200,dischargingTime:Infinity});
  navigator.getBattery = async () => battery;
  window.__seedPanels=()=>{
   if(!complete)return;
   window.__emit('media:update',{type:'media',active:true,title:lang==='ar'?'مقطع صوتي للاختبار':'A sample audio track',artist:lang==='ar'?'الفنان':'Sample artist',playing:false,position:42,duration:240,sentAt:Date.now(),trackChanged:false});
   window.__emit('system:sample',{cpu:12,memUsed:4*1024**3,memTotal:16*1024**3,uptime:9000});
  };

}
module.exports = {fixture};
