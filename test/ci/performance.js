const baseline = require('./perf-baseline.json');
const finite = (n,label) => { if (typeof n!=='number'||!Number.isFinite(n)||n<0) throw Error(`Invalid or missing ${label}: ${String(n)}`); return n; };
function validate(report,mode) {
 if(!baseline.modes[mode])throw Error(`Unknown native mode: ${mode}`);
 if(report.platform!=='Windows'||report.mode!==mode)throw Error(`Wrong native measurement platform/mode: ${report.platform}/${report.mode}`);
 if(report.warmupSeconds<baseline.warmupSeconds||report.sampleCount!==baseline.sampleCount||report.sampleIntervalSeconds!==baseline.sampleIntervalSeconds)throw Error('Native probe must use >=15s warmup, exactly 60 one-second samples');
 const results={};
 for(const phase of ['idle','afterClose']){
  const rows=report[phase]?.samples;
  if(!Array.isArray(rows)||rows.length!==baseline.sampleCount)throw Error(`${phase}: expected 60 raw process snapshots, got ${rows?.length}`);
  let host;
  for(const [index,s]of rows.entries()){
   if(s.phase!=='idle'||!Number.isInteger(s.hostPid)||s.hostPid<=0)throw Error(`${phase}[${index}]: not native idle`);
   host??=s.hostPid;if(s.hostPid!==host)throw Error(`${phase}: native host restarted during measurement`);
   if(!Array.isArray(s.processes)||s.processes.length!==1||s.processes[0].pid!==host)throw Error(`${phase}[${index}]: native idle must own only its native host; Electron/helper or invalid ownership present`);
   const p=s.processes[0];if(!['islandly','islandlynative'].includes(String(p.name).toLowerCase()))throw Error(`${phase}[${index}]: unexpected idle process ${p.name}`);
   const mb=finite(p.mb,'process working set'),cpu=finite(p.cpu,'process CPU');
   if(mb===0)throw Error(`${phase}[${index}]: zero native working set is not a valid live-process measurement`);
   if(Math.abs(mb-finite(s.totalMB,'total working set'))>0.01||Math.abs(cpu-finite(s.totalCPU,'total CPU'))>0.01)throw Error(`${phase}[${index}]: totals omit or disagree with owned processes`);
  }
  const averageMB=rows.reduce((n,s)=>n+s.totalMB,0)/rows.length,averageCPU=rows.reduce((n,s)=>n+s.totalCPU,0)/rows.length,peakMB=Math.max(...rows.map(s=>s.totalMB));
  if(averageMB>=baseline.limits.ramExclusiveMaxMB||peakMB>=baseline.limits.ramExclusiveMaxMB)throw Error(`${phase}: native RAM guard FAILED (mean ${averageMB.toFixed(2)}, peak ${peakMB.toFixed(2)} MB; must stay below 180 MB)`);
  if(averageCPU>=baseline.limits.cpuExclusiveMaxPercent)throw Error(`${phase}: native CPU guard FAILED (${averageCPU.toFixed(3)}%; T9 requires mean idle CPU below 1%)`);
  results[phase]={averageMB,averageCPU,peakMB,ramDeltaFromT9MB:averageMB-(phase==='idle'?baseline.modes[mode].idleMB:baseline.modes[mode].returnedIdleMB),cpuDeltaFromT9:averageCPU-baseline.modes[mode].idleCPU};
 }
 return {mode,baseline:baseline.modes[mode],limits:baseline.limits,...results};
}
module.exports={validate,baseline};
