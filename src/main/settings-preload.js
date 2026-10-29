const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  prayer: () => ipcRenderer.invoke('prayer:get'),
  hijri: () => ipcRenderer.invoke('hijri:get'),
  get: () => ipcRenderer.sendSync('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  quit: () => ipcRenderer.send('app:quit'),
  cities: () => ipcRenderer.sendSync('settings:cities'),
  setSecret: (name, value) => ipcRenderer.invoke('settings:secret', name, value),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
});
