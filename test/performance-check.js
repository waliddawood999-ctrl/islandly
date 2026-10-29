const fs=require('node:fs');
try {
 const [file,mode]=process.argv.slice(2);if(!file)throw Error('Usage: node test/performance-check.js report.json overlay|reserved-bar');
 const report=require('./ci/performance').validate(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),mode);
 const lines=[`## Native idle performance: ${mode}`,'','| Workload | RAM MB | Peak MB | CPU % | RAM change from T9 MB |','|---|---:|---:|---:|---:|'];
 for(const phase of ['idle','afterClose']){const r=report[phase];lines.push(`| ${phase} | ${r.averageMB.toFixed(2)} | ${r.peakMB.toFixed(2)} | ${r.averageCPU.toFixed(3)} | ${r.ramDeltaFromT9MB.toFixed(2)} |`);}
 lines.push('','Limits: all idle RAM samples <180 MB; mean idle CPU <1%. Baseline: accepted T9 native host, not the old Electron-only app.');
 const summary=lines.join('\n')+'\n';console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
} catch(e){console.error(e.message);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Native performance guard FAILED: ${e.message}\n`);process.exitCode=1;}
