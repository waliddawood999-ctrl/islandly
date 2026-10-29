// Each suite runs in a fresh Node process. App-index fixtures must not include the host's Start Menu.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const suites=['ics','updater','palette','ai','prayer','hijri','quran','islamic-backend'];
for(const name of suites){
 let temporary;const env={...process.env};let status;
 try{
  if(process.platform==='win32'&&name==='palette'){
   temporary=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-test-profile-'));
   env.APPDATA=path.join(temporary,'user');env.ProgramData=path.join(temporary,'system');
  }
  const result=spawnSync(process.execPath,[path.join(__dirname,name+'.test.js')],{stdio:'inherit',env,windowsHide:true});
  if(result.error)throw result.error;status=result.status===null?1:result.status;
 }finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
 if(status!==0){process.exitCode=status;break;}
}
