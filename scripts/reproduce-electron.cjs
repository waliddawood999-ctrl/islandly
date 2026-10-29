// Frozen 0.4.0 identity reproduction, independent of current app code/version.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const {verifyElectron}=require('./windows-identity');
(async()=>{
 const root=path.resolve(__dirname,'..'),lock=require('../packaging/windows-identity.json');
 const tooling=createRequire(path.join(root,'packaging/tooling/package.json'));
 const mod=await import(pathToFileURL(tooling.resolve('@electron/packager')).href);
 const packageApp=mod.packager||mod.default;
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-frozen-040-'));
 const output=path.join(root,'out','reference-electron');
 try{
  const stub=path.join(scratch,'app');fs.mkdirSync(stub);
  fs.writeFileSync(path.join(stub,'package.json'),JSON.stringify({name:'islandly',version:'0.4.0',description:'A Dynamic Island for Windows: music, timers, battery and more in one floating pill.',main:'index.js'}));
  fs.writeFileSync(path.join(stub,'index.js'),'// Build identity fixture, replaced by real resources/app.\n');
  const result=await packageApp({dir:stub,name:'Islandly',appVersion:'0.4.0',platform:'win32',arch:'x64',electronVersion:'45.1.0',out:output,overwrite:true,asar:false,prune:false,win32metadata:{CompanyName:'GitHub, Inc.'}});
  if(result.length!==1)throw Error('Expected exactly one frozen Windows runtime');
  const exe=path.join(result[0],'Islandly.exe');
  const hash=verifyElectron(exe,lock.electron);
  console.log(`FROZEN ELECTRON EXACT MATCH: ${hash}`);
  fs.writeFileSync(path.join(output,'reference-directory.txt'),result[0]);
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
