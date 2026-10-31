const path = require('node:path');
function nativeHostPath({packaged,executable,baseRoot}) {
  if(!packaged)return path.join(baseRoot,'native','bin','Islandly.exe');
  const directory=path.dirname(executable);
  const preservedPanels=path.basename(executable).toLowerCase()==='islandly.exe'&&path.basename(directory).toLowerCase()==='panels';
  return path.join(preservedPanels?path.dirname(directory):directory,'Islandly.exe');
}
module.exports={nativeHostPath};
