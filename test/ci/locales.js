const fs = require('node:fs');
const path = require('node:path');
const CANDIDATES = ['src/renderer/locales', 'src/locales', 'locales'];
function locate(root, directory) {
  const dirs = directory ? [path.resolve(root, directory)] : CANDIDATES.map(p => path.join(root, p));
  const present = dirs.filter(d => ['ar.json','en.json'].some(f => fs.existsSync(path.join(d,f))));
  if (present.length !== 1) throw Error(present.length ? `Ambiguous locale catalogues: ${present.join(', ')}. Set ISLANDLY_LOCALES_DIR to the application's catalogue directory.` : `T11 prerequisite missing: ar.json/en.json not found in ${dirs.join(', ')}. Add the real JSON catalogues; inline strings/fixtures are not accepted as a substitute.`);
  for (const name of ['ar.json','en.json']) if (!fs.existsSync(path.join(present[0],name))) throw Error(`Missing locale catalogue: ${path.join(present[0],name)}`);
  return { ar:path.join(present[0],'ar.json'), en:path.join(present[0],'en.json') };
}
const kind = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
function keys(value, prefix = '', out = new Map()) {
  if (!prefix && (kind(value) !== 'object')) throw Error('Locale root must be a JSON object');
  for (const [key, child] of Object.entries(value)) {
    const pointer = prefix + '/' + key.replace(/~/g,'~0').replace(/\//g,'~1');
    out.set(pointer,kind(child));
    if (child && typeof child === 'object') keys(child,pointer,out);
  }
  return out;
}
function compare(ar,en) {
  const a=keys(ar),b=keys(en);
  return { missingInArabic:[...b.keys()].filter(k=>!a.has(k)).sort(), missingInEnglish:[...a.keys()].filter(k=>!b.has(k)).sort(),
    mismatchedTypes:[...a].filter(([k,t])=>b.has(k)&&b.get(k)!==t).map(([key,type])=>({key,ar:type,en:b.get(key)})), keyCount:a.size };
}
function check(root,directory) {
  const files=locate(root,directory);
  const parse=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch(e){throw Error(`Invalid locale JSON ${file}: ${e.message}`);}};
  const report={...compare(parse(files.ar),parse(files.en)),files};
  const errors=[];
  if (!report.keyCount) errors.push('Empty locale catalogue: real application translations are required');
  if(report.missingInArabic.length) errors.push(`Missing in ar.json: ${report.missingInArabic.join(', ')}`);
  if(report.missingInEnglish.length) errors.push(`Missing in en.json: ${report.missingInEnglish.join(', ')}`);
  if(report.mismatchedTypes.length) errors.push(`Locale type mismatches: ${report.mismatchedTypes.map(x=>`${x.key} (${x.ar}/${x.en})`).join(', ')}`);
  if(errors.length)throw Error(errors.join('\n'));
  return report;
}
module.exports={locate,compare,check};
