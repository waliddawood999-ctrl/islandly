const fs = require('node:fs'), path = require('node:path');
const { app } = require('electron');
process.on('exit', code => {
  if (!code) return;
  try {
    const file=path.join(app.getPath('userData'),'error.log');
    if(fs.existsSync(file)) process.stderr.write(fs.readFileSync(file,'utf8').slice(-12000));
  } catch (_) {}
});
