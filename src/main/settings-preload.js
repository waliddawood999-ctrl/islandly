const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  material: () => ipcRenderer.invoke('material:get'),
  on: (channel, cb) => {
    if (['material:changed', 'settings:update'].includes(channel)) ipcRenderer.on(channel, (_e, payload) => cb(payload));
  },
  get: () => ipcRenderer.sendSync('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  quit: () => ipcRenderer.send('app:quit'),
  cities: () => ipcRenderer.sendSync('settings:cities'),
  setSecret: (name, value) => ipcRenderer.invoke('settings:secret', name, value),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
});
