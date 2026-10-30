// Packaging only: not shipped as a runtime or installer dependency.
const fs = require('node:fs');
const path = require('node:path');
const { verifyElectron, digest } = require('./windows-identity');
const lock = require('../packaging/windows-identity.json');
const nativePin = require('../packaging/per-user/identity.json');
const target = process.argv[2] || 'out/Islandly-install';
const source = process.argv[3] || 'out/Islandly-native-win64';
verifyElectron(path.join(source, lock.electron.path), lock.electron);
for(const [file,hash] of [['Islandly.exe',nativePin.hostSha256],['Islandly.Motion.dll',nativePin.motionSha256]]) {
 if(digest(path.join(source,file))!==hash)throw Error('Frozen T21 binary identity changed: '+file+'; do not silently ship a new SAC identity');
}
if (fs.existsSync(target)) throw Error('Installer output must be a fresh directory');
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, path.join(target, 'payload'), { recursive: true });
const binaries = [];
function walk(dir) {
 for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  const f = path.join(dir,e.name);
  if (e.isDirectory()) walk(f);
  else if (/\.(exe|dll|node)$/i.test(e.name)) binaries.push({path:path.relative(source,f).split(path.sep).join('\\'),sha256:digest(f)});
 }
}
walk(source);
fs.writeFileSync(path.join(target,'payload','BINARY-SHA256.txt'),binaries.map(e=>`${e.sha256} ${e.path}`).join('\r\n')+'\r\n');
// Build-time Windows Shell serialization, never COM/PowerShell on the user's machine.
// Keep the environment data block and prefer it over build-account ID/link information.
const {spawnSync}=require('node:child_process');
const shortcutPath=path.resolve(target,'shortcut.hex');
const script="$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:T22_LINK);$s.TargetPath='%LOCALAPPDATA%\\Islandly\\Islandly.exe';$s.Save()";
const temporary=shortcutPath+'.lnk';
const made=spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,T22_LINK:temporary},encoding:'utf8'});
if(made.status!==0)throw Error('Windows shortcut serialization failed: '+made.stderr);
const link=fs.readFileSync(temporary);
const flags=link.readUInt32LE(20);
if(!(flags & 0x200))throw Error('Shortcut lost its environment variable block');
// A target ID list can take precedence over environment paths; remove it.
let result=link;
if(flags & 1){const length=link.readUInt16LE(76)+2;result=Buffer.concat([link.subarray(0,76),link.subarray(76+length)]);}
result.writeUInt32LE((flags & ~1)|0x02000000,20);
fs.writeFileSync(shortcutPath,result.toString('hex').match(/.{1,64}/g).join('\r\n')+'\r\n');fs.unlinkSync(temporary);
// Use typed registry data for the optional quoted startup command. The user's
// path is expanded by Windows, never interpolated as CMD command syntax.
const startupBytes=Buffer.from('"%LOCALAPPDATA%\\Islandly\\Islandly.exe"\0','utf16le');
const startupReg='\ufeffWindows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]\r\n"Islandly"=hex(2):'+startupBytes.toString('hex').match(/../g).join(',')+'\r\n';
fs.writeFileSync(path.join(target,'startup.reg'),startupReg,'utf16le');
fs.copyFileSync(path.join(target,'startup.reg'),path.join(target,'payload','startup.reg'));
const cmd=fs.readFileSync('packaging/per-user/Install.cmd','utf8').replace(/\r?\n/g,'\r\n');
fs.writeFileSync(path.join(target,'Install.cmd'),cmd);
fs.copyFileSync('docs/INSTALL.md',path.join(target,'INSTALL.txt'));
const report={sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),binaries,nativeSourceCommit:nativePin.nativeSourceCommit,noNewExecutableOrDll:true,electronMatchesKnownGood:true,hostSha256:digest(path.join(source,'Islandly.exe')),acceptedHostSha256:lock.host.laptopAcceptedSha256};
report.hostMatchesLaptopAccepted=report.hostSha256===report.acceptedHostSha256;
fs.writeFileSync(path.join(target,'IDENTITY.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
