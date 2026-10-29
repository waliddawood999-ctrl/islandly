const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {QuranService,TTL,serverUrl}=require('../src/main/services/quran');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'islandly-quran-test-'));
const list=[{id:1,name:'قارئ',moshaf:[{id:7,name:'حفص',server:'https://server8.mp3quran.net/test/',surah_list:'1,2,114,0,115,no'}]}];
(async()=>{
 let calls=0,now=100000;
 const q=new QuranService({directory:()=>dir,now:()=>now,fetchList:async lang=>{calls++;return lang==='ar'?list:[{id:1,name:'Reader'}];}});
 assert.equal(calls,0);assert(!fs.existsSync(path.join(dir,'quran-reciters.json')));
 assert.throws(()=>q.url(1,7,1),/offline/);assert.equal(calls,0);
 const [a,b]=await Promise.all([q.reciters(),q.reciters()]);assert.deepEqual(a,b);assert.equal(calls,2);assert.equal(a[0].nameEn,'Reader');
 assert.deepEqual(a[0].moshaf[0].surahList,[1,2,114]);assert.equal(q.url(1,7,1),'https://server8.mp3quran.net/test/001.mp3');assert.equal(q.url(1,7,114),'https://server8.mp3quran.net/test/114.mp3');
 for(const args of [[1,7,3],[1,7,0],[1,7,115],['1',7,1],[9,7,1],[1,99,1],[1,7,1.2]]) assert.throws(()=>q.url(...args),/invalid/);
 await q.reciters();assert.equal(calls,2);now+=TTL-1;await q.reciters();assert.equal(calls,2);now++;await q.reciters();assert.equal(calls,4,'refresh at seven-day expiry, only on user request');
 const disk=new QuranService({directory:()=>dir,now:()=>now,fetchList:async()=>{throw Error('network must stay closed');}});assert.equal((await disk.reciters())[0].nameAr,'قارئ');
 now+=TTL;const offline=new QuranService({directory:()=>dir,now:()=>now,fetchList:async()=>{throw Error('offline');}});assert.equal((await offline.reciters()).length,1,'expired cache remains usable offline');assert.equal(offline.url(1,7,2),'https://server8.mp3quran.net/test/002.mp3');
 for(const url of ['http://server8.mp3quran.net/a/','https://mp3quran.net.evil.com/a/','https://mp3quran.net/a/','https://evil.com/','https://u:p@server.mp3quran.net/','https://server.mp3quran.net:444/a/','file:///tmp/a','javascript:alert(1)'])assert.equal(serverUrl(url),null,url);
 console.log('quran: lazy network, bilingual catalogue, 7-day/disk/offline cache, deduplication and URL validation passed');
})().finally(()=>fs.rmSync(dir,{recursive:true,force:true})).catch(e=>{console.error(e);process.exitCode=1;});
