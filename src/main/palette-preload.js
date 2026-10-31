const { contextBridge, ipcRenderer } = require('electron');

const CALL = new Set(['palette:query', 'palette:run']);
const SEND = new Set(['palette:hide', 'palette:height', 'palette:ask', 'palette:copy']);
const ON = new Set(['palette:shown', 'palette:ai-text', 'palette:ai-done', 'settings:update', 'eco:changed']);

contextBridge.exposeInMainWorld('paletteAPI', {
  settings: ipcRenderer.sendSync('settings:get'),
  call: (channel, ...args) => (CALL.has(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.reject(new Error('blocked: ' + channel))),
  send: (channel, ...args) => {
    if (SEND.has(channel)) ipcRenderer.send(channel, ...args);
  },
  on: (channel, cb) => {
    if (ON.has(channel) && typeof cb === 'function') {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  },
});
