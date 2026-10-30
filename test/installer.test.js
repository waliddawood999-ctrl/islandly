const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-installer-'));
try {
 const cmd=fs.readFileSync('packaging/per-user/Install.cmd','utf8');
 assert(!/ExecutionPolicy|Add-Type|New-Object|Unblock-File|powershell|mshta|wscript|cscript|taskkill/i.test(cmd));
 assert(cmd.includes('758e43cf25850408fa42d7de76565561ae329b353b8facc508ece9875bcd1592'));
 assert(cmd.includes('DisableDelayedExpansion'));
 assert(cmd.includes('previous-registration.reg'));
 const script=fs.readFileSync('scripts/package-installer.cjs','utf8');
 assert(script.includes("if(!(flags & 0x200))"));
 assert(script.includes('0x02000000'));
 assert(script.includes('link.subarray(76+length)'));
 assert(cmd.includes('-decodehex "%~dp0shortcut.hex" "%MENU%" 4'));
 const pin=require('../packaging/per-user/identity.json');
 assert.equal(pin.nativeSourceCommit,'5d06d5e5f9c12cf056bf2f62b902faa2b605b116');
 assert.match(pin.hostSha256,/^[a-f0-9]{64}$/);assert.match(pin.motionSha256,/^[a-f0-9]{64}$/);
 console.log('Installer static/shortcut identity contract PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
