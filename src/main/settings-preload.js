const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  get: () => ipcRenderer.sendSync('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  quit: () => ipcRenderer.send('app:quit'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
});
