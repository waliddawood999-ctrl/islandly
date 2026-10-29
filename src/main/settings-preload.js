const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  perf: () => ipcRenderer.invoke('perf:get'),
  call: channel => channel === 'perf:get' ? ipcRenderer.invoke(channel) : Promise.reject(Error('blocked')),
  send: (channel, on) => { if (channel === 'perf:watch' && typeof on === 'boolean') ipcRenderer.send(channel, on); },
  on: (channel, cb) => { if (['material:changed', 'perf:update', 'eco:changed', 'settings:update'].includes(channel)) { const listener = (_e, value) => cb(value); ipcRenderer.on(channel, listener); return () => ipcRenderer.removeListener(channel, listener); } },
  prayer: () => ipcRenderer.invoke('prayer:get'),
  hijri: () => ipcRenderer.invoke('hijri:get'),
  material: () => ipcRenderer.invoke('material:get'),
  watchPerf: (on) => { if (typeof on === 'boolean') ipcRenderer.send('perf:watch', on); },
  get: () => ipcRenderer.sendSync('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  quit: () => ipcRenderer.send('app:quit'),
  cities: () => ipcRenderer.sendSync('settings:cities'),
  setSecret: (name, value) => ipcRenderer.invoke('settings:secret', name, value),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
});
