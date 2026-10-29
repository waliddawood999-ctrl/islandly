const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Discover pure Node suites so later task integrations cannot silently lose registered tests.
for(const file of fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.js')).sort()){
 let temporary,status;const env={...process.env};
 try{
  if(process.platform==='win32'&&file==='palette.test.js'){
   temporary=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-test-profile-'));env.APPDATA=path.join(temporary,'user');env.ProgramData=path.join(temporary,'system');
  }
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',env,windowsHide:true});
  if(result.error)throw result.error;status=result.status===null?1:result.status;
 }finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
 if(status!==0){process.exitCode=status;break;}
}
