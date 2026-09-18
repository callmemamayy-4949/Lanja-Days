const dayMs=86400000;
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*dayMs).toISOString().slice(0,10);
export const weekday=date=>new Date(date+'T00:00:00Z').getUTCDay();
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const horizon=(today,rule)=>Array.from({length:14},(_,i)=>addDays(today,i+1)).filter(rule);
const weekdayNames=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
export function predict(dates,today){
 const history=[...new Set(dates)].filter(d=>d<=today).sort();
 if(history.length<2)return {reason:'ข้อมูลยังไม่พอ · ต้องมีอย่างน้อย 2 วันที่มา',dates:[]};
 const recent=history.slice(-12),gaps=recent.slice(1).map((d,i)=>(Date.parse(d)-Date.parse(recent[i]))/dayMs);
 const freq=new Map();gaps.forEach(g=>freq.set(g,(freq.get(g)||0)+1));
 const [interval,count]=[...freq].sort((a,b)=>b[1]-a[1])[0];
 let rule,reason,quality,dateReasons;
 if(recent.length>=3&&count/gaps.length>=.8&&interval<=28){rule=d=>(Date.parse(d)-Date.parse(recent.at(-1)))/dayMs%interval===0;reason=interval===7?'มาทุกวัน'+weekdayNames[weekday(recent.at(-1))]:`มาประมาณทุก ${interval} วัน`;quality=count/gaps.length;}
 else if(gaps.length>=5&&gaps.every((g,i)=>g===gaps[i%2])&&gaps[0]!==gaps[1]){
  let cursor=recent.at(-1),i=gaps.length;const candidates=new Set();while(cursor<addDays(today,14)){cursor=addDays(cursor,gaps[i++%2]);candidates.add(cursor);}rule=d=>candidates.has(d);reason=`มาเป็นรอบสลับ ${gaps[0]} และ ${gaps[1]} วัน`;quality=.85;
 }else{
  const spanDays=(Date.parse(today)-Date.parse(recent[0]))/dayMs;
  const weekdayCounts=Array.from({length:7},(_,w)=>recent.filter(d=>weekday(d)===w).length);
  const regularDays=weekdayCounts.map((visits,w)=>({w,visits,opportunities:Math.floor((spanDays-(w-weekday(recent[0])+7)%7)/7)+1})).filter(({visits,opportunities})=>visits>=3&&opportunities>=3&&visits/opportunities>=.6);
  if(spanDays>=20&&regularDays.length&&regularDays.reduce((n,d)=>n+d.visits,0)/recent.length>=.6){const days=regularDays.map(d=>d.w);rule=d=>days.includes(weekday(d));reason='มักแวะมาวัน'+days.map(w=>weekdayNames[w]).join(' / ');quality=Math.min(.85,regularDays.reduce((n,d)=>n+d.visits/d.opportunities,0)/regularDays.length);}
 }
 if(!rule){
  const looseInterval=Math.max(2,Math.round(median(gaps)));
  if(looseInterval>28)return {reason:'ระยะห่างยังแกว่งมาก · รอข้อมูลเพิ่ม',dates:[]};
  const weekdayCounts=Array.from({length:7},(_,w)=>recent.filter(d=>weekday(d)===w).length);
  const candidates=new Set();const end=addDays(today,14),last=recent.at(-1);
  for(let n=1;n<=Math.ceil((14+(Date.parse(today)-Date.parse(last))/dayMs)/looseInterval)+1;n++){
   const anchor=addDays(last,n*looseInterval);
   const nearby=[-1,0,1].map(offset=>{const date=addDays(anchor,offset);const gapFit=offset===0?1:.5;const visitsOnWeekday=weekdayCounts[weekday(date)];const weekdayFit=visitsOnWeekday>=2?visitsOnWeekday/recent.length:0;return {date,score:.45*gapFit+.55*weekdayFit};}).filter(({date})=>date>today&&date<=end);
   if(nearby.length)candidates.add(nearby.sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date))[0].date);
  }
  rule=d=>candidates.has(d);
  reason=recent.length===2?`ข้อมูลยังน้อย · เคยมาห่างกัน ${looseInterval} วัน`:`เดาจากระยะห่างกลาง ๆ ประมาณ ${looseInterval} วัน`;
  dateReasons=Object.fromEntries([...candidates].map(date=>[date,recent.length>2&&weekdayCounts[weekday(date)]>=2?`ดูจากระยะห่างราว ${looseInterval} วันและการแวะมาวัน${weekdayNames[weekday(date)]}บ่อย`:reason]));
  quality=.45;
 }
 const age=(Date.parse(today)-Date.parse(recent.at(-1)))/dayMs;
 if(age>Math.max(21,interval*2))return {reason:'ประวัติล่าสุดห่างเกินไป · รอข้อมูลเพิ่ม',dates:[]};
 return {reason,confidence:quality>=.9?'รูปแบบค่อนข้างสม่ำเสมอ':quality>=.7?'รูปแบบพอประมาณ':'พยากรณ์แบบข้อมูลยังน้อย',dates:horizon(today,rule),...(dateReasons?{dateReasons}:{})};
}
