const hijri = require('./hijri');
function register({ ipcMain, isIsland, isSettings, settings, prayer, quran }) {
  const permit = (e, settingsAllowed = false) => { if (!isIsland(e) && !(settingsAllowed && isSettings(e))) throw Error('Unauthorized IPC sender'); };
  ipcMain.handle('prayer:get', e => { permit(e, true); return prayer().get(); });
  ipcMain.handle('hijri:get', e => { permit(e, true); return hijri.get(new Date(), settings.get().hijriOccasions !== false); });
  ipcMain.handle('media:resume', e => { permit(e); return prayer().resume(); });
  ipcMain.handle('quran:reciters', e => { permit(e); return quran.reciters(); });
  ipcMain.handle('quran:url', (e, ...args) => { permit(e); return quran.url(...args); });
}
module.exports = { register };
