const path=require('node:path');
try {
 const report=require('./ci/locales').check(path.join(__dirname,'..'),process.env.ISLANDLY_LOCALES_DIR);
 console.log(`Locale parity PASS: ${report.keyCount} keys, ${report.files.ar} ↔ ${report.files.en}`);
} catch(e) {console.error(e.message);process.exitCode=1;}
