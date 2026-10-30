// Packaging only: not shipped as a runtime or installer dependency.
const fs = require('node:fs');
const path = require('node:path');
const { verifyElectron, digest } = require('./windows-identity');
const lock = require('../packaging/windows-identity.json');
const target = process.argv[2] || 'out/Islandly-install';
const source = process.argv[3] || 'out/Islandly-native-win64';
verifyElectron(path.join(source, lock.electron.path), lock.electron);
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
// MS-SHLLINK EnvironmentVariableDataBlock: resolve the user's LOCALAPPDATA at launch,
// never bake the CI account's profile into a shortcut. No script or command target.
function shortcut() {
 const h = Buffer.alloc(76);
 h.writeUInt32LE(76,0); Buffer.from('0114020000000000c000000000000046','hex').copy(h,4);
 h.writeUInt32LE(0x02000280,20); // IsUnicode | HasExpString | PreferEnvironmentPath
 h.writeUInt32LE(1,60); // SW_SHOWNORMAL
 const b = Buffer.alloc(788); b.writeUInt32LE(788); b.writeUInt32LE(0xa0000001,4);
 const p = '%LOCALAPPDATA%\\Islandly\\Islandly.exe';
 b.write(p,8,260,'ascii'); b.write(p,268,520,'utf16le');
 return Buffer.concat([h,b,Buffer.alloc(4)]);
}
fs.writeFileSync(path.join(target,'Islandly.lnk'),shortcut());
const cmd=fs.readFileSync('packaging/per-user/Install.cmd','utf8').replace(/\r?\n/g,'\r\n');
fs.writeFileSync(path.join(target,'Install.cmd'),cmd);
fs.copyFileSync('docs/INSTALL.md',path.join(target,'INSTALL.txt'));
const report={sourceCommit:process.env.GITHUB_SHA||null,binaries,noNewExecutableOrDll:true,electronMatchesKnownGood:true,hostSha256:digest(path.join(source,'Islandly.exe')),acceptedHostSha256:lock.host.laptopAcceptedSha256};
report.hostMatchesLaptopAccepted=report.hostSha256===report.acceptedHostSha256;
fs.writeFileSync(path.join(target,'IDENTITY.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
module.exports={shortcut};
