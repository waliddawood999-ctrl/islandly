// Reproducible compact cache of Intl's exact Umm al-Qura month starts. No network.
const fs=require('node:fs'),path=require('node:path');
const startYear=1400,endYear=1500,DAY=86400000;
const formatter=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'});
const starts=[];
for(let time=Date.UTC(1979,0,1,12);time<Date.UTC(2079,0,1,12);time+=DAY){
 const parts=Object.fromEntries(formatter.formatToParts(new Date(time)).map(p=>[p.type,p.value]));
 const year=+parts.year,month=+parts.month;
 if(+parts.day===1&&year>=startYear&&(year<=endYear||year===endYear+1&&month===1))starts[(year-startYear)*12+month-1]=Math.floor(time/DAY);
}
if(starts.length!==(endYear-startYear+1)*12+1||Array.from(starts).some((x,i)=>!Number.isInteger(x)||i&&(x-starts[i-1]<29||x-starts[i-1]>30)))throw Error('incomplete Intl month table');
const result={calendar:'islamic-umalqura',timeZone:'Asia/Riyadh',source:'Intl.DateTimeFormat(en-u-ca-islamic-umalqura)',icu:process.versions.icu,startYear,endYear,starts};
fs.writeFileSync(path.join(__dirname,'../src/main/services/hijri-months.json'),JSON.stringify(result)+'\n');
console.log(`Generated ${starts.length-1} exact Intl month intervals`);
