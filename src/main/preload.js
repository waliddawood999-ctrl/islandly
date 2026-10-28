const { contextBridge, ipcRenderer, webUtils } = require('electron');

const CALL = new Set([
  'media:caps', 'clipboard:list', 'clipboard:copy', 'clipboard:pin', 'clipboard:remove', 'clipboard:clear',
  'shelf:list', 'shelf:add', 'shelf:remove', 'shelf:clear', 'shelf:open', 'shelf:reveal',
  'calendar:get', 'update:check', 'update:apply',
]);
const SEND = new Set(['island:envelope', 'log:error', 'media:control', 'open:external', 'settings:open', 'shelf:drag', 'menu:show']);
const ON = new Set([
  'media:update', 'clipboard:update', 'shelf:update', 'shelf:added', 'calendar:update', 'bluetooth:update',
  'update:ready', 'settings:update', 'shortcut', 'toast',
]);

contextBridge.exposeInMainWorld('islandAPI', {
  settings: ipcRenderer.sendSync('settings:get'),
  call: (channel, ...args) => (CALL.has(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.reject(new Error('blocked: ' + channel))),
  send: (channel, ...args) => {
    if (SEND.has(channel)) ipcRenderer.send(channel, ...args);
  },
  on: (channel, cb) => {
    if (ON.has(channel)) ipcRenderer.on(channel, (_e, payload) => cb(payload));
  },
  pathsForFiles: (files) => Array.from(files || []).map((f) => webUtils.getPathForFile(f)).filter(Boolean),
});
