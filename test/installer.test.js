const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-installer-'));
try {
 const cmd=fs.readFileSync('packaging/per-user/Install.cmd','utf8');
 assert(!/ExecutionPolicy|Add-Type|New-Object|Unblock-File|powershell|mshta|wscript|cscript|taskkill/i.test(cmd));
 assert(cmd.includes('758e43cf25850408fa42d7de76565561ae329b353b8facc508ece9875bcd1592'));
 assert(cmd.includes('DisableDelayedExpansion'));
 assert(cmd.includes('previous-registration.reg'));
 // Extract the pure shortcut constructor without running the packaging entrypoint.
 const script=fs.readFileSync('scripts/package-installer.cjs','utf8');
 const f=script.slice(script.indexOf('function shortcut()'),script.indexOf("fs.writeFileSync(path.join(target,'Islandly.lnk')"));
 const link=Function('Buffer',`${f};return shortcut();`)(Buffer);
 assert.equal(link.readUInt32LE(0),76);assert.equal(link.readUInt32LE(20),0x02000280);
 assert.equal(link.readUInt32LE(76),788);assert.equal(link.readUInt32LE(80),0xa0000001);
 assert.equal(link.subarray(344,864).toString('utf16le').split('\0')[0],'%LOCALAPPDATA%\\Islandly\\Islandly.exe');
 assert.equal(link.readUInt32LE(864),0);
 console.log('Installer static/shortcut identity contract PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
