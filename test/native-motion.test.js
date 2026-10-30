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
