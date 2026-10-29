// Deterministic local renderer fixture. No network requests or OS data.
function fixture({ lang='ar', mode='overlay' }={}) {
  const handlers = {};
  window.__emit = (name, value) => (handlers[name] || []).forEach(cb => cb(value));
  window.islandAPI = {
    settings: { lang, uiLang: lang, digits: 'latn', autoHide: 'never', islandMode: mode, motion: 'full', material: 'glass' },
    call: async ch => {
      if(ch === 'shortcuts:list') return ['Edge','File Explorer','Spotify','VS Code'].map(name=>({name}));
      if(ch === 'island:work-area') return {width:Math.min(1280,window.innerWidth),height:Math.min(760,window.innerHeight)};
      if(ch === 'media:caps') return { ok:true, next:true, prev:true, seek:true,toggle:true };
      if(ch === 'material:get') return {material:'glass',supported:false};
      return null;
    },
    on: (ch,cb) => { (handlers[ch] ||= []).push(cb); }, send() {}, pathsForFiles:()=>[],
  };
  const battery = Object.assign(new EventTarget(), {level:.82,charging:true});
  navigator.getBattery = async () => battery;
}
module.exports = {fixture};
