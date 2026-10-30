// Coordinates stay in Electron DIP until the native physical-pixel handoff.
function alignPanel({ window, card, display, anchor, zoom }) {
  const w=card.width*zoom,h=card.height*zoom,margin=12*zoom;
  const left=Math.max(display.x+margin,Math.min(display.x+display.width-margin-w,anchor.x-w/2));
  return {x:Math.round(window.x+left-(window.x+card.x*zoom)),y:Math.round(anchor.y-card.y*zoom),width:w,height:h};
}
function parseAnchor(value) {
  try {const a=JSON.parse(value);return Number.isFinite(a.center)&&Number.isFinite(a.top)?a:null;}catch{return null;}
}
module.exports={alignPanel,parseAnchor};
