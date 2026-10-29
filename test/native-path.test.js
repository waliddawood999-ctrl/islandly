const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {nativeHostPath}=require('../src/main/native-path');
const root=path.join(os.tmpdir(),'Islandly test');
assert.equal(nativeHostPath({packaged:true,executable:path.join(root,'panels','Islandly.exe')}),path.join(root,'Islandly.exe'));
assert.equal(nativeHostPath({packaged:true,executable:path.join(root,'IslandlyPanels.exe')}),path.join(root,'Islandly.exe'));
assert.equal(nativeHostPath({packaged:false,executable:process.execPath,baseRoot:root}),path.join(root,'native','bin','Islandly.exe'));
console.log('Native entry path: preserved panels/Islandly.exe delegates to parent host without recursive Electron launch; legacy/development layouts retained');
