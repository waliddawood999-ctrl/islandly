const path = require('node:path');
function nativeHostPath({packaged,executable,baseRoot}) {
  if(!packaged)return path.join(baseRoot,'native','bin','Islandly.exe');
  const directory=path.dirname(executable);
  return path.join(path.basename(directory).toLowerCase()==='panels'?path.dirname(directory):directory,'Islandly.exe');
}
module.exports={nativeHostPath};
