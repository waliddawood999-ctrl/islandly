const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {digest,verifyElectron,inventory,fullHash}=require('../scripts/windows-identity');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-identity-'));
try{
 const file=path.join(root,'Islandly.exe');fs.writeFileSync(file,'reference bytes');const pin={sha256:digest(file),size:fs.statSync(file).size};
 assert.equal(verifyElectron(file,pin),pin.sha256);
 for(const sha256 of [null,'758e','z'.repeat(64),''])assert.throws(()=>verifyElectron(file,{...pin,sha256}),/full SHA256/);
 assert.equal(fullHash(pin.sha256.toUpperCase(),'reference'),pin.sha256);
 fs.writeFileSync(file,'different bytes');assert.throws(()=>verifyElectron(file,pin),/identity changed|size differs/);
 fs.mkdirSync(path.join(root,'panels'));fs.copyFileSync(file,path.join(root,'panels','Islandly.exe'));fs.writeFileSync(path.join(root,'helper.EXE'),'helper');fs.writeFileSync(path.join(root,'ignore.dll'),'DLL');
 assert.deepEqual(inventory(root).map(x=>x.path).sort(),['Islandly.exe','helper.EXE','panels/Islandly.exe'].sort());
 assert.throws(()=>verifyElectron(path.join(root,'helper.EXE'),pin),/filename/);
 console.log('Executable identity: full pin required, content/size/name mismatches fail, recursive EXE inventory includes same-named host/panels and helpers');
}finally{fs.rmSync(root,{recursive:true,force:true});}
