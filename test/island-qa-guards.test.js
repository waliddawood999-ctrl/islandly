// T24 guard: the island QA gates exist and none of their limits has been loosened.
const assert=require('node:assert');const fs=require('node:fs');const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const workflow=read('.github/workflows/island-qa.yml');
for(const job of ['desktop:','shape-and-layout:','memory:','packaging:'])assert(workflow.includes('\n  '+job),'island-qa.yml lost job '+job);
assert(/native-footprint\.ps1 -Mode \$\{\{ matrix\.mode \}\}/.test(workflow)&&workflow.includes('performance-check.js'),'memory job must run the footprint and the raw-sample guard');
assert(workflow.includes('windows-identity.js')&&workflow.includes('package-native.ps1')&&workflow.includes('archive-native.ps1'),'packaging job must package, archive and check the executable inventory');
assert(/memory:[\s\S]*require\('electron'\)[\s\S]*native-footprint\.ps1/.test(workflow),'memory job must provision the Electron binary before the panel is launched');
assert(workflow.includes('island-shape-qa.ps1'),'shape/matrix audit must stay wired');
// RAM limit is 180 MB everywhere it is asserted.
assert(/WorkingSet64\/1MB-ge 180/.test(read('test/island-requirements.ps1')),'island-requirements RAM guard changed');
assert(/\$peak-ge 180/.test(read('test/native-motion-perf.ps1')),'native-motion-perf RAM guard changed');
assert(/acceptanceUnder180/.test(read('test/native-footprint.ps1')),'native-footprint 180 MB acceptance changed');
assert(read('test/performance-check.js').includes('<180 MB'),'performance-check limit text changed');
// Expanded-state matrix: portrait, <=440 px tall, exterior alpha exactly 0, all themes/languages/materials/scales.
const shape=read('test/island-shape-qa.cs');
for(const needle of ['Expanded island is not portrait','wider than the 440 px maximum','new[]{1f,1.25f,1.5f}','exterior must be exact alpha0','expanded-matrix.png'])assert(shape.includes(needle),'island-shape-qa.cs lost: '+needle);
assert(!/Math\.Ceiling\(4[34]0\*scale\)\+/.test(shape),'matrix limits must have no tolerance');
console.log('T24 QA guards ok');
