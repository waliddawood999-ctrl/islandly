const { contextBridge, ipcRenderer } = require("electron");
const allowed = new Set([
  "capture:list",
  "capture:mode",
  "capture:select",
  "capture:crop",
  "capture:chunk",
  "capture:finish",
]);
contextBridge.exposeInMainWorld("captureAPI", {
  call: (ch, ...args) =>
    allowed.has(ch)
      ? ipcRenderer.invoke(ch, ...args)
      : Promise.reject(new Error("Blocked")),
});
