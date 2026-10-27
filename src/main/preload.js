const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islandAPI', {
  setInteractive: (interactive) => ipcRenderer.send('island:interactive', !!interactive),
  mediaControl: (action) => ipcRenderer.send('media:control', action),
  onMedia: (cb) => ipcRenderer.on('media:update', (_e, payload) => cb(payload)),
  onShortcut: (cb) => ipcRenderer.on('shortcut', (_e, cmd) => cb(cmd)),
});
