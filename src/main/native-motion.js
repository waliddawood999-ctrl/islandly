// Coordinates stay in Electron DIP until the native physical-pixel handoff.
function alignPanel({ window, card, display, anchor, zoom }) {
  if (![window.x,window.y,card.x,card.y,card.width,card.height,display.x,display.width,anchor.x,anchor.y,zoom].every(Number.isFinite) || card.width<=0 || card.height<=0 || zoom<=0) throw new TypeError('Invalid native panel geometry');
  // Electron's int32 converter rejects JavaScript -0 (Math.round(-0.4)).
  const integer=value=>Math.round(value)||0;
  const w=card.width*zoom,h=card.height*zoom,margin=12*zoom;
  const left=Math.max(display.x+margin,Math.min(display.x+display.width-margin-w,anchor.x-w/2));
  return {x:integer(window.x+left-(window.x+card.x*zoom)),y:integer(anchor.y-card.y*zoom),width:w,height:h};
}
function parseAnchor(value) {
  try {const a=JSON.parse(value);return Number.isFinite(a.center)&&Number.isFinite(a.top)?a:null;}catch{return null;}
}
module.exports={alignPanel,parseAnchor};
