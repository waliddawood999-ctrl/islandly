const assert=require('node:assert/strict');
const {alignPanel,parseAnchor}=require('../src/main/native-motion');
assert.equal(parseAnchor('broken'),null);assert.equal(parseAnchor('{"center":null,"top":0}'),null);
for(const x of [0,-1920,1920])for(const zoom of [.8,1,1.5,2])for(const pos of ['left','center','right']){
 const display={x,y:0,width:1920,height:1080};
 const anchor={x:pos==='left'?x+85:pos==='right'?x+1835:x+960,y:14*zoom};
 const card={x:100,y:8,width:360,height:440};const win={x:x+600,y:0};
 const r=alignPanel({window:win,card,display,anchor,zoom});
 assert.ok(r.x+card.x*zoom>=x+12*zoom-1);assert.ok(r.x+card.x*zoom+r.width<=x+1920-12*zoom+1);
 assert.ok(Math.abs(r.y+card.y*zoom-anchor.y)<=.5);assert.equal(r.width,360*zoom);
}
console.log('Native motion handoff: malformed anchors, physical left/right clamping, floating top and primary/secondary DPI alignment passed');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'native-motion-settings-'));
try{
 const file=path.join(profile,'settings.json');fs.writeFileSync(file,JSON.stringify({idleEyes:'yes',floating:1}));
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/main/settings.js'),'utf8'),{module,exports:module.exports,Buffer,require:n=>n==='electron'?{app:{getPath:()=>profile}}:n==='./services/store'?{ISLAMIC_DEFAULTS:{},ECO_DEFAULTS:{ecoMode:false,ecoAuto:false,motion:'full'},MATERIAL_DEFAULT:'acrylic'}:require(n)});
 const settings=module.exports;settings.init();assert.equal(settings.get().idleEyes,false);assert.equal(settings.get().floating,false);
 const updates=[];settings.onChange((next,prev)=>updates.push({next,prev}));settings.set({idleEyes:true,floating:true});
 assert.equal(settings.get().idleEyes,true);assert.equal(settings.get().floating,true);assert.equal(updates.length,1);assert.equal(updates[0].prev.idleEyes,false);assert.equal(JSON.parse(fs.readFileSync(file)).floating,true);
 settings.set({idleEyes:'false',floating:0});assert.equal(settings.get().idleEyes,true);assert.equal(settings.get().floating,true);
 console.log('Native motion settings: opt-in defaults, malformed persisted values, boolean-only writes, persistence and existing change publication passed');
}finally{fs.rmSync(profile,{recursive:true,force:true});}
