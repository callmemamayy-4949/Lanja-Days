const $=s=>document.querySelector(s),escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,month,selected=null,selectedDate,historyLimit=10,expandedHistoryDate=null;const modal=$('#modal');
const isAdminPath=()=>location.pathname.replace(/\/$/,'')==='/admin';
const child=id=>state.children.find(c=>c.id===id),included=id=>selected===null||selected.has(id),shortName=c=>c.name.match(/\((.*)\)/)?.[1]||c.name;
const avatarSizeClass=count=>count>=6?'many':count>=4?'medium':'few';
const photo=(id,extra='')=>`<img class="avatar ${extra}" src="${child(id).image}" alt="${escapeHtml(shortName(child(id)))}" title="${escapeHtml(child(id).name)}">`;
const displayName=id=>child(id).name.replace(/\s*\(.*\)$/,'');
const birthdayNotes=date=>state.children.filter(c=>c.birthday&&c.birthday.month===Number(date.slice(5,7))&&c.birthday.day===Number(date.slice(8,10))&&included(c.id));
const thaiDate=(d,options={day:'numeric',month:'long',year:'numeric'})=>new Intl.DateTimeFormat('th-TH-u-ca-gregory',options).format(new Date(d+'T12:00:00'));
const thaiWeekday=d=>new Intl.DateTimeFormat('th-TH-u-ca-gregory',{weekday:'long'}).format(new Date(d+'T12:00:00'));
const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const primaryReason=text=>{
 const parts=text.split(' · ').filter(Boolean);
 return parts.find(part=>part.startsWith('มาประมาณทุก '))
  ||parts.find(part=>part.startsWith('เดาจากระยะห่างกลาง ๆ ประมาณ '))
  ||parts.find(part=>part.startsWith('เคยมาห่างกัน '))
  ||parts.find(part=>part.startsWith('มาทุก'))
  ||parts.find(part=>part.startsWith('มักมาวัน'))
  ||parts.find(part=>part.startsWith('มาเป็นรอบสลับ '))
  ||parts.find(part=>!part.startsWith('ข้อมูลยังน้อย'))
  ||parts[0]
  ||'';
};
const softenReason=text=>{
 const part=primaryReason(text);
 if(part.startsWith('มาประมาณทุก '))return 'ช่วงหลังหลานมักแวะมาห่างกันประมาณ '+part.replace('มาประมาณทุก ','')+'คับ';
 if(part.startsWith('มาทุกวัน'))return 'ช่วงหลังหลานแวะมาทุกวัน'+part.slice('มาทุกวัน'.length)+'คับ';
 if(part.startsWith('มักแวะมาวัน'))return 'ช่วงหลังหลานมักแวะมาวัน'+part.slice('มักแวะมาวัน'.length)+'คับ';
 if(part.startsWith('มักมาวัน'))return 'ช่วงหลังหลานมักแวะมาวัน'+part.slice('มักมาวัน'.length)+'คับ';
 if(part.startsWith('มาเป็นรอบสลับ '))return 'ช่วงหลังหลานมาเป็นรอบสลับ '+part.slice('มาเป็นรอบสลับ '.length)+'คับ';
 if(part.startsWith('ดูจากระยะห่างราว '))return 'คำนวณจากระยะห่างราว '+part.slice('ดูจากระยะห่างราว '.length)+'คับ';
 if(part.startsWith('เดาจากระยะห่างกลาง ๆ ประมาณ '))return 'ช่วงหลังหลานมักแวะมาห่างกันประมาณ '+part.replace('เดาจากระยะห่างกลาง ๆ ประมาณ ','')+'คับ';
 if(part.startsWith('ข้อมูลยังน้อย'))return 'มีเรื่องของหลานให้จำอยู่นิดเดียวววว';
 if(part.startsWith('เคยมาห่างกัน '))return 'สองครั้งที่ผ่านมา หลานแวะมาห่างกัน '+part.replace('เคยมาห่างกัน ','')+'คับป๋ม';
 if(part==='รูปแบบค่อนข้างสม่ำเสมอ')return 'ช่วงนี้เริ่มจับจังหวะหลานได้ค่อนข้างชัดแล้วค่ะ';
 if(part==='รูปแบบพอประมาณ')return 'เริ่มพอจับทางหลานได้บ้างแล้วคับ';
 if(part==='พยากรณ์แบบข้อมูลยังน้อย')return 'ตอนนี้ยังจับทางหลานไม่ค่อยได้งับ';
 if(part==='ระยะห่างยังแกว่งมาก')return 'ช่วงนี้หลานมาไม่ค่อยเป็นจังหวะเท่าไหร่งับ';
 if(part==='รอข้อมูลเพิ่ม')return 'ขอเก็บข้อมูลอีกนิดน้า';
 if(part==='ต้องมีอย่างน้อย 2 วันที่มา')return 'ขอให้หลานแวะมาอีกสักครั้ง แล้วค่อยช่วยพยากรณ์นะคับป๋ม';
 return part;
};
const emptyMessage=future=>future?'<div class="detail-empty"><strong>วันนี้ยังจับทางหลานไม่ค่อยถูกเลยงับ</strong><small>ไว้รอดูกันว่าใครจะแอบแวะมาหานะ ♡</small></div>':'<div class="detail-empty"><strong>วันนี้ยังไม่มีหลานแวะมาเลย</strong><small>สงสัยวันนี้บางคนไปโรงเรียน บางคนก็ยังหลับปุ๋ยอยู่ ♡</small></div>';

async function api(url,method='GET',body){const response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Error(value.error||'โหลดไม่สำเร็จ');return value;}
async function load(openAdmin=false){state=await api('/api/state');month??=state.today.slice(0,7);selectedDate??=state.today;render();if(openAdmin&&isAdminPath())admin();}
function calendarMonths(){const end=addDays(state.today,28).slice(0,7),months=[];for(let yy=2026,mm=8;`${yy}-${String(mm).padStart(2,'0')}`<=end;){const v=`${yy}-${String(mm).padStart(2,'0')}`;months.push(v);if(++mm===13){mm=1;yy++;}}return months;}
function open(html){$('#modalContent').innerHTML=html;if(!modal.open)modal.showModal();$('.close')?.addEventListener('click',()=>modal.close());}
const head=title=>`<div class="modal-head"><h2>${title}</h2><button class="round close" aria-label="ปิด">×</button></div>`;
function choices(ids){return `<div class="child-list">${state.children.map(c=>{const names=c.name.match(/^(.*?)\s*\((.*)\)$/);return `<label class="child-option"><input type="checkbox" value="${c.id}" ${ids.has(c.id)?'checked':''}>${photo(c.id)}<span class="child-name"><span class="name-en">${escapeHtml(names?names[1]:c.name)}</span>${names?`<span class="name-th">${escapeHtml(names[2])}</span>`:''}</span></label>`;}).join('')}</div>`;}
function checked(){return [...modal.querySelectorAll('.child-option input:checked')].map(el=>el.value);}
function showFilter(){const ids=selected===null?new Set(state.children.map(c=>c.id)):new Set(selected);open(head('วันนี้อยากส่องหลานคนไหน ♡')+`<input class="child-search" id="childSearch" type="search" placeholder="🔍 ค้นหาชื่อหลาน..." aria-label="ค้นหาชื่อหลาน" autocomplete="off"><div class="filter-actions"><button class="pill" id="all">เลือกหลานทุกคน</button><button class="pill" id="none">เอาออกหมดก่อน</button></div>${choices(ids)}<div class="actions"><button class="primary" id="apply">ดูหลานที่เลือกกัน ♡</button></div>`);$('#all').onclick=()=>modal.querySelectorAll('.child-option input').forEach(i=>i.checked=true);$('#none').onclick=()=>modal.querySelectorAll('.child-option input').forEach(i=>i.checked=false);$('#childSearch').oninput=e=>{const query=e.target.value.trim().toLocaleLowerCase('th');modal.querySelectorAll('.child-option').forEach(option=>{option.hidden=!option.textContent.toLocaleLowerCase('th').includes(query);});};$('#apply').onclick=()=>{const ids=checked();selected=ids.length===state.children.length?null:new Set(ids);render();modal.close();};}
function render(){
 $('#status').textContent='';$('#filter').textContent=`เลือกหลานจ๋า · ${selected===null?'ทุกคน':selected.size+' คน'} ▼`;
 const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate(),offset=(new Date(y,m-1,1).getDay()+6)%7;
 const months=calendarMonths();
 const visits=state.visits.filter(v=>v.date.startsWith(month)&&included(v.child));
 const forecastEnd=addDays(state.today,28),forecasts=state.forecasts.filter(f=>included(f.child));
 const lastDate=month+'-'+String(days).padStart(2,'0');
 const count=Math.round((Date.parse(lastDate)-Date.parse(month+'-01'))/86400000)+1;
 const cells=Array.from({length:offset},()=>'<div></div>');
 for(let d=1;d<=count;d++){
  const date=addDays(month+'-01',d-1),future=date>state.today;
  const ids=future&&date<=forecastEnd?forecasts.filter(f=>f.dates.includes(date)).map(f=>f.child):future?[]:visits.filter(v=>v.date===date).map(v=>v.child);
  const label=date.slice(0,7)!==month?thaiDate(date,{day:'numeric',month:'short'}):String(Number(date.slice(-2)));
  const size=avatarSizeClass(ids.length),birthdays=birthdayNotes(date);
  cells.push(`<button class="day ${ids.length?'':'empty'} ${future&&ids.length?'forecast-day':''} ${birthdays.length?'birthday-day':''} ${date===state.today?'today':''} ${date===selectedDate?'selected':''}" data-date="${date}" aria-label="${thaiDate(date)} ${future&&date<=forecastEnd?'น่าจะแวะมา':future?'ยังไม่มีคำทาย':'แวะมาแล้ว'} ${ids.length} คน${birthdays.length?' มีวันเกิด '+birthdays.map(c=>displayName(c.id)).join(', '):''}"><span class="number ${date.slice(0,7)!==month?'spill-number':''}">${label}</span>${birthdays.length?`<span class="birthday-notes">${birthdays.slice(0,2).map(c=>`<small>${escapeHtml(displayName(c.id).toUpperCase())}'S BD</small>`).join('')}${birthdays.length>2?`<small>+${birthdays.length-2} BD</small>`:''}</span>`:''}<span class="avatars ${size}">${ids.map(id=>photo(id,future?'predicted':'')).join('')}${ids.length===0?'<span class="blank-dot"></span>':''}</span></button>`);
 }
 $('#content').innerHTML=`<div class="app-layout"><section class="calendar"><div class="monthbar"><button class="round" id="prev" aria-label="เดือนก่อน" ${month===months[0]?'disabled':''}>‹</button><select id="month" aria-label="เลือกเดือน">${months.map(v=>`<option value="${v}" ${v===month?'selected':''}>${thaiDate(v+'-01',{month:'long',year:'numeric'})}</option>`).join('')}</select><button class="round" id="next" aria-label="เดือนถัดไป" ${month===months.at(-1)?'disabled':''}>›</button><button class="today-btn" id="today">วันนี้</button></div><div class="weekdays">${['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(s=>`<span>${s}</span>`).join('')}</div><div class="grid">${cells.join('')}</div><div class="calendar-note"><div class="summary"><span>👥 <strong>${new Set(visits.map(v=>v.child)).size}</strong> <small>คน</small></span><span class="divider"></span><span><strong>${new Set(visits.map(v=>v.date)).size}</strong> <small>วันที่มา</small></span></div><span class="note-love">ทุกวันที่หลานแวะมา ก็เป็นอีกวันที่น่ารักเสมอ ♡</span></div></section>${detailCard(selectedDate)}</div>${historyCard()}`;
 $('#month').onchange=e=>{month=e.target.value;historyLimit=10;expandedHistoryDate=null;render();};$('#prev').onclick=()=>{month=months[months.indexOf(month)-1];historyLimit=10;expandedHistoryDate=null;render();};$('#next').onclick=()=>{month=months[months.indexOf(month)+1];historyLimit=10;expandedHistoryDate=null;render();};$('#today').onclick=()=>{month=state.today.slice(0,7);selectedDate=state.today;historyLimit=10;expandedHistoryDate=null;render();};document.querySelectorAll('[data-date]').forEach(el=>el.onclick=()=>selectDay(el.dataset.date));
 $('#historyMonth')?.addEventListener('change',e=>{month=e.target.value;historyLimit=10;expandedHistoryDate=null;render();});
 $('#historyChild')?.addEventListener('change',e=>{selected=e.target.value==='all'?null:new Set([e.target.value]);historyLimit=10;expandedHistoryDate=null;render();});
 $('#historyMore')?.addEventListener('click',()=>{historyLimit+=10;render();});
 document.querySelectorAll('[data-history-toggle]').forEach(el=>el.onclick=()=>{expandedHistoryDate=expandedHistoryDate===el.dataset.historyToggle?null:el.dataset.historyToggle;render();});
}
function historyCard(){
 if(!isAdminPath()||!state.authenticated)return '';
 const allRows=(state.forecastHistory||[]).filter(r=>r.date.startsWith(month)).map(r=>({...r,predicted:r.predicted===null?null:[...new Set(r.predicted)].filter(included),actual:[...new Set(r.actual)].filter(included)}));
 const compare=r=>{const predicted=r.predicted||[],actual=r.actual,hit=predicted.filter(id=>actual.includes(id)),over=predicted.filter(id=>!actual.includes(id)),missed=actual.filter(id=>!predicted.includes(id)),total=hit.length+over.length+missed.length;return {hit,over,missed,total,accuracy:total?Math.round(hit.length/total*100):null};};
 const evaluated=allRows.filter(r=>r.predicted!==null&&r.confirmed&&r.date<state.today).map(r=>({...r,stats:compare(r)}));
 const summary=evaluated.reduce((s,r)=>({days:s.days+1,hit:s.hit+r.stats.hit.length,over:s.over+r.stats.over.length,missed:s.missed+r.stats.missed.length,total:s.total+r.stats.total}),{days:0,hit:0,over:0,missed:0,total:0});
 const accuracy=summary.total?Math.round(summary.hit/summary.total*100)+'%':'—';
 const rows=allRows.slice(0,historyLimit);
 const more=historyLimit<allRows.length;
 const childValue=selected===null?'all':selected.size===1?[...selected][0]:'custom';
 const names=ids=>ids.length?'<div class="history-people">'+ids.map(id=>'<span>'+photo(id)+'<b>'+escapeHtml(shortName(child(id)))+'</b></span>').join('')+'</div>':'<span class="muted">ไม่มี</span>';
 const result=s=>'<div class="history-result"><span class="result-hit">✓ ทายถูก '+s.hit.length+'</span><span class="result-over">× ทายเกิน '+s.over.length+'</span><span class="result-missed">○ มาแต่ไม่ได้ทาย '+s.missed.length+'</span></div>';
 const detail=(r,s)=>expandedHistoryDate===r.date?'<tr class="history-detail"><td colspan="5"><div class="history-detail-box"><h3>รายละเอียด '+thaiDate(r.date,{day:'numeric',month:'short',year:'numeric'})+'</h3><div><strong>ทายถูก</strong>'+names(s.hit)+'</div><div><strong>ทายเกิน</strong>'+names(s.over)+'</div><div><strong>มาแต่ไม่ได้ทาย</strong>'+names(s.missed)+'</div></div></td></tr>':'';
 const personStats=state.children.filter(c=>included(c.id)).map(c=>{const totals=evaluated.reduce((s,r)=>{const p=r.predicted.includes(c.id),a=r.actual.includes(c.id);if(p&&a)s.hit++;else if(p&&!a)s.over++;else if(!p&&a)s.missed++;return s;},{hit:0,over:0,missed:0});const total=totals.hit+totals.over+totals.missed;return {...c,total,accuracy:total?Math.round(totals.hit/total*100):null};}).filter(c=>c.total>0).sort((a,b)=>b.accuracy-a.accuracy||a.name.localeCompare(b.name,'th'));
 return '<section class="history-card" aria-labelledby="historyTitle"><div class="history-head"><div><h2 id="historyTitle">สถิติการทายย้อนหลัง</h2><p class="muted">มาดูกันว่าที่ผ่านมา เราทายแม่นแค่ไหน ♡</p></div><div class="history-filters"><select id="historyMonth" aria-label="เลือกเดือนสถิติ">'+calendarMonths().map(v=>`<option value="${v}" ${v===month?'selected':''}>${v===state.today.slice(0,7)?'เดือนนี้':thaiDate(v+'-01',{month:'long',year:'numeric'})}</option>`).join('')+'</select><select id="historyChild" aria-label="เลือกหลานในสถิติ"><option value="all" '+(childValue==='all'?'selected':'')+'>หลานทั้งหมด</option>'+(childValue==='custom'?'<option value="custom" selected disabled>หลานที่เลือก</option>':'')+state.children.map(c=>`<option value="${c.id}" ${childValue===c.id?'selected':''}>${escapeHtml(shortName(c))}</option>`).join('')+'</select></div></div><div class="history-stats"><span>วันที่ทายทั้งหมด<strong>'+summary.days+' วัน</strong></span><span>ทายตรงทั้งหมด<strong>'+accuracy+'</strong></span><span>ทายถูก<strong>'+summary.hit+' ครั้ง</strong></span><span>ทายพลาด<strong>'+(summary.over+summary.missed)+' ครั้ง</strong></span></div><p class="muted">Accuracy ใช้สูตร ทายถูก ÷ (ทายถูก + ทายเกิน + มาแต่ไม่ได้ทาย) โดยนับระดับหลานแต่ละคน และใช้เฉพาะ snapshot ที่ระบบเคยเก็บไว้จริง</p><div class="history-scroll" tabindex="0" role="region" aria-label="ตารางสถิติการทายย้อนหลัง"><table class="history-table"><thead><tr><th scope="col">วันที่</th><th scope="col">ทายว่าจะมา</th><th scope="col">มาจริง</th><th scope="col">ผลการทาย</th><th scope="col">ความแม่นยำ</th></tr></thead><tbody>'+rows.map(r=>{const ready=r.predicted!==null&&r.confirmed&&r.date<state.today,s=compare(r),waiting=r.predicted===null?'ไม่มีข้อมูลคำทำนายย้อนหลัง':r.confirmed?'วันนี้ยังไม่นับในสถิติ':'ยังไม่บันทึกผลจริง';return '<tr class="history-row" data-history-toggle="'+r.date+'"><th scope="row"><button class="history-date" type="button">'+thaiDate(r.date,{day:'numeric',month:'short',year:'numeric'})+'</button><small>'+(r.issuedOn?'เก็บ '+thaiDate(r.issuedOn,{day:'numeric',month:'short'}):'ไม่มี snapshot')+'</small></th><td data-label="ทายว่าจะมา">'+(r.predicted===null?'<span class="muted">ไม่มีข้อมูลคำทำนายย้อนหลัง</span>':names(r.predicted))+'</td><td data-label="มาจริง">'+(r.confirmed?names(r.actual):'<span class="muted">ยังไม่บันทึกผลจริง</span>')+'</td><td data-label="ผลการทาย">'+(ready?result(s):'<span class="muted">'+waiting+'</span>')+'</td><td data-label="ความแม่นยำ">'+(ready&&s.accuracy!==null?s.accuracy+'%':'—')+'</td></tr>'+detail(r,s);}).join('')+'</tbody></table></div>'+(more?'<button class="history-more" id="historyMore" type="button">ดูย้อนหลังเพิ่มเติม</button>':'')+'<section class="person-accuracy"><h3>ใครที่เราทายแม่นที่สุด</h3><div class="person-accuracy-list">'+(personStats.length?personStats.map(c=>'<div class="person-accuracy-row">'+photo(c.id)+'<span>'+escapeHtml(shortName(c))+'</span><strong>'+c.accuracy+'%</strong></div>').join(''):'<p class="muted">ยังไม่มีข้อมูลพอให้คำนวณรายหลาน</p>')+'</div></section></section>';
}
function selectDay(date){selectedDate=date;if(date.slice(0,7)<month||date.slice(0,7)>month)month=date.slice(0,7);render();}
function people(ids,predicted=false){return `<div class="people-row">${ids.map(id=>`<div class="mini-person">${photo(id,predicted?'predicted':'')}<span>${escapeHtml(shortName(child(id)))}</span></div>`).join('')}</div>`;}
function detailCard(date){
 const future=date>state.today,withinForecast=date<=addDays(state.today,28),entries=future&&withinForecast?state.forecasts.filter(f=>included(f.child)&&f.dates.includes(date)):[],ids=future?entries.map(f=>f.child):state.visits.filter(v=>v.date===date&&included(v.child)).map(v=>v.child);
 const chip=future?(ids.length?`<div class="chip forecast">✨ น่าจะแวะมา<small>วันนี้น่าจะมีหลานแวะมา ${ids.length} คน</small></div>`:`<div class="chip forecast">💤 วันนี้ยังเงียบ ๆ อยู่งับ<small>กำลังจับทางหลานอยู่คับ ♡</small></div>`):`<div class="chip">ข้อมูลจริง</div>`;
 const reasonRows=entries.map(f=>({child:f.child,reason:softenReason(f.dateReasons?.[date]||f.reason)}));
 const birthdays=birthdayNotes(date);
 const birthdaySection=birthdays.length?`<section class="detail-section birthday-detail"><h2>วันเกิดวันนี้</h2><div class="birthday-list">${birthdays.map(c=>`<div class="birthday-person">${photo(c.id)}<div><strong>${escapeHtml(displayName(c.id))}'S BD</strong><small>${escapeHtml(shortName(c))}</small></div></div>`).join('')}</div></section>`:'';
 return `<aside class="detail-card" id="detail"><div class="detail-head"><div><p class="detail-date">${thaiDate(date,{day:'numeric',month:'short',year:'numeric'})}</p><p class="weekday">${thaiWeekday(date)}</p></div>${chip}</div>${birthdaySection}<section class="detail-section"><h2>${future?'วันนี้ใครน่าจะแวะมาบ้าง':'วันนี้มีใครแวะมาบ้าง'}</h2>${ids.length?people(ids,future):emptyMessage(future)}</section>${future?`<section class="detail-section"><h2>ทำไมแต่ละคนน่าจะแวะมา</h2>${reasonRows.length?`<div class="reason-list">${reasonRows.map(row=>`<div class="reason-item">${photo(row.child,'reason-avatar predicted')}<div><strong>${escapeHtml(shortName(child(row.child)))}</strong><p>${escapeHtml(row.reason)}</p></div></div>`).join('')}</div>`:'<div class="detail-empty">ข้อมูลวันนี้ยังไม่พอให้บอกได้ชัด</div>'}</section><div class="forecast-note">อาจมีหลานคนอื่น ๆ แอบแวะมาเพิ่มเติมได้ มารอดูกันนะ ♡</div>`:''}${!future&&state.authenticated?'<div class="actions"><button class="primary" id="edit">แก้ไขหลานที่แวะมาวันนี้</button></div>':''}</aside>`;
}
function editDay(date,ids){open(head('บันทึกวันที่หลานแวะมา')+`<p>${thaiDate(date)}</p><p class="muted">เลือกหลานได้หลายคน · เอาเครื่องหมายออกถ้าวันนี้ไม่ได้แวะมา</p>${choices(new Set(ids))}<p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" id="save">บันทึก</button></div>`);$('#save').onclick=async()=>{const button=$('#save');button.disabled=true;try{await api('/api/day','PUT',{date,ids:checked()});await load();modal.close();}catch(e){$('#formError').textContent=e.message;}finally{button.disabled=false;}};}
function admin(){if(state.authenticated){open(head('แอดมิน')+'<p>เลือกวันที่ในปฏิทินเพื่อบันทึกว่าหลานคนไหนแวะมาบ้าง</p><div class="actions"><button class="pill" id="logout">ออกจากระบบ</button><button class="primary" id="back">ไปที่ปฏิทิน</button></div>');$('#back').onclick=()=>{render();modal.close();};$('#logout').onclick=async()=>{try{await api('/api/logout','POST',{});await load();modal.close();if(isAdminPath())admin();}catch(e){$('#status').textContent=e.message;modal.close();}};return;}
 open(head('เข้าสู่ระบบแอดมิน')+`<form id="login"><label class="field">ชื่อผู้ใช้<input name="username" autocomplete="username" required></label><label class="field">รหัสผ่าน<input name="password" type="password" autocomplete="current-password" required></label><p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" type="submit">เข้าสู่ระบบ</button></div></form>`);$('#login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;try{await api('/api/login','POST',Object.fromEntries(new FormData(form)));await load();modal.close();if(isAdminPath())admin();}catch(e){$('#formError').textContent=e.message;}finally{button.disabled=false;}};}
$('#filter').onclick=()=>state&&showFilter();
document.addEventListener('click',e=>{if(e.target?.id==='edit'&&state&&selectedDate)editDay(selectedDate,state.visits.filter(v=>v.date===selectedDate).map(v=>v.child));});
load(true).catch(e=>{$('#status').textContent=e.message+' · รีเฟรชเพื่อลองใหม่';});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'filter_children',description:'เลือกหลานที่อยากดูในปฏิทิน ส่ง null เพื่อดูทั้งหมด',inputSchema:{type:'object',properties:{ids:{anyOf:[{type:'null'},{type:'array',items:{type:'string'}}]}},required:['ids'],additionalProperties:false},execute:async({ids})=>{if(!state)throw Error('ยังโหลดไม่เสร็จ');if(ids!==null&&(!Array.isArray(ids)||ids.some(id=>!child(id))))throw Error('รายชื่อไม่ถูกต้อง');selected=ids===null?null:new Set(ids);render();return {selected:ids};}})).catch(()=>{});}catch{}}

