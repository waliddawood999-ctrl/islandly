const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fullHash(value,label){if(typeof value!=='string'||!/^[0-9a-f]{64}$/i.test(value))throw Error(`${label}: a full SHA256 is required; prefixes or missing pins cannot establish identity`);return value.toLowerCase();}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function verifyElectron(file,pin){
 const expected=fullHash(pin.sha256,'Known-good Electron');
 if(path.basename(file)!=='Islandly.exe')throw Error('Trusted Electron must keep the filename Islandly.exe');
 if(fs.statSync(file).size!==pin.size)throw Error('Trusted Electron size differs from the known-good binary');
 const actual=digest(file);if(actual!==expected)throw Error(`Electron executable identity changed: ${actual} != ${expected}`);return actual;
}
function inventory(root){
 const rows=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else if(item.isFile()&&/\.exe$/i.test(item.name))rows.push({path:path.relative(root,full).split(path.sep).join('/'),sha256:digest(full),size:fs.statSync(full).size});}}walk(root);return rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
if(require.main===module){try{
 const root=path.resolve(process.argv[2]||'out/Islandly-native-win64'),lock=require('../packaging/windows-identity.json');
 const electronHash=verifyElectron(path.join(root,lock.electron.path),lock.electron),hostHash=digest(path.join(root,lock.host.path));
 const report={electronMatchesKnownGood:true,electronHash,hostHash,hostChanged:hostHash!==lock.host.baselineSha256,sacLaptopRetestRequired:hostHash!==lock.host.laptopAcceptedSha256,executables:inventory(root)};
 fs.writeFileSync(path.join(root,'EXE-SHA256.txt'),report.executables.map(r=>`${r.sha256}  ${r.path}`).join('\n')+'\n');
 fs.writeFileSync(path.join(root,'EXECUTABLE-IDENTITY.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\nElectron exact reference match: YES (${electronHash})\n\nHost hash changed from recorded build: ${report.hostChanged}; SAC laptop retest required: ${report.sacLaptopRetestRequired}\n\n| EXE | SHA256 |\n|---|---|\n${report.executables.map(r=>`| ${r.path} | ${r.sha256} |`).join('\n')}\n`);
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={fullHash,digest,verifyElectron,inventory};
