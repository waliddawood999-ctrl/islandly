const assert = require('node:assert/strict');
const {get,midnight}=require('../src/main/services/hijri');
for(const [date,year,month,day,id] of [
 ['2025-03-01',1446,9,1,'ramadan'],['2025-03-30',1446,10,1,'eid-fitr'],
 ['2025-06-01',1446,12,5,'dhul-hijjah-ten'],['2025-06-05',1446,12,9,'arafah'],
 ['2025-06-06',1446,12,10,'eid-adha'],['2025-06-26',1447,1,1,'hijri-new-year'],
 ['2025-07-05',1447,1,10,'ashura'],['2025-02-22',1446,8,23,'founding-day'],
 ['2025-09-23',1447,4,1,'national-day'],
]) {
 const d=new Date(date+'T12:00:00+03:00'),h=get(d);
 assert.deepEqual([h.year,h.month,h.day,h.occasion?.id],[year,month,day,id],date);
 assert(h.monthNameAr && h.monthNameEn && h.occasion.ar && h.occasion.en);
 assert.equal(get(d,false).occasion,null);
}
assert.equal(get(new Date('2025-02-28T20:59:59Z')).month,8);
assert.equal(get(new Date('2025-02-28T21:00:00Z')).month,9,'Saudi midnight, not executor local day');
assert.equal(midnight(new Date('2025-02-28T22:00:00Z')),Date.parse('2025-02-28T21:00:00Z'));
console.log('hijri: known Umm al-Qura dates, fixed timezone, all occasions, precedence and disabled occasions passed');

// The compact cache is an exact materialization of Intl, not a substitute calendar algorithm.
const table=require('../src/main/services/hijri-months.json');
const intl=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'});
for(let i=0;i<table.starts.length-1;i++)for(const delta of [0,14,table.starts[i+1]-table.starts[i]-1]){
 const date=new Date((table.starts[i]+delta)*86400000+12*3600000);
 const fields=Object.fromEntries(intl.formatToParts(date).map(p=>[p.type,p.value]));const actual=get(date,false);
 assert.deepEqual([actual.year,actual.month,actual.day],[+fields.year,+fields.month,+fields.day]);
}
for(const date of [new Date('1970-01-01T12:00:00Z'),new Date('2080-01-01T12:00:00Z')]){
 const fields=Object.fromEntries(intl.formatToParts(date).map(p=>[p.type,p.value]));const actual=get(date,false);assert.deepEqual([actual.year,actual.month,actual.day],[+fields.year,+fields.month,+fields.day]);
}
console.log('Intl calendar cache: every cached month start/middle/end and out-of-range fallback agree with runtime Intl');
