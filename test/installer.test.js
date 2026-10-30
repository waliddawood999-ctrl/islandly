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
 assert(cmd.includes('type "%~dp0shortcut.dat" > "%MENU%"'));
 console.log('Installer static/shortcut identity contract PASS');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
