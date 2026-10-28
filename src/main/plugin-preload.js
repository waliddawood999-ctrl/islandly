const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("islandPlugin", {
  publish: (card) => ipcRenderer.send("plugin:publish", card),
});
