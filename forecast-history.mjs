import {addDays,predict,predictionWindow} from './forecast.mjs';

// Keep the first forecast saved for each target day, including an empty prediction.
export function captureForecasts(children,visits,today,history={}){
 const next={...history};
 const forecasts=children.map(c=>({child:c.id,...predict(visits.filter(v=>v.child===c.id).map(v=>v.date),today)}));
 for(let n=1;n<=predictionWindow;n++){
  const date=addDays(today,n);
  next[date]??={issuedOn:today,predicted:forecasts.filter(f=>f.dates.includes(date)).map(f=>f.child)};
 }
 return next;
}

export function forecastHistory(visits,confirmedDays,history,today){
 const confirmed=new Set([...confirmedDays,...visits.map(v=>v.date)]);
 const rows=[];
 for(let date='2026-08-01';date<=today;date=addDays(date,1)){
  const snapshot=history[date],actual=visits.filter(v=>v.date===date).map(v=>v.child);
  rows.push({date,issuedOn:snapshot?.issuedOn??null,predicted:snapshot?.predicted??null,actual,confirmed:confirmed.has(date)});
 }
 return rows.reverse();
}
