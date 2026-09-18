const $=s=>document.querySelector(s),escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,month,selected=null,selectedDate;const modal=$('#modal');
const isAdminPath=()=>location.pathname.replace(/\/$/,'')==='/admin';
const child=id=>state.children.find(c=>c.id===id),included=id=>selected===null||selected.has(id),shortName=c=>c.name.match(/\((.*)\)/)?.[1]||c.name;
const avatarSizeClass=count=>count>=6?'many':count>=4?'medium':'few';
const photo=(id,extra='')=>`<img class="avatar ${extra}" src="${child(id).image}" alt="${escapeHtml(shortName(child(id)))}" title="${escapeHtml(child(id).name)}">`;
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
function open(html){$('#modalContent').innerHTML=html;if(!modal.open)modal.showModal();$('.close')?.addEventListener('click',()=>modal.close());}
const head=title=>`<div class="modal-head"><h2>${title}</h2><button class="round close" aria-label="ปิด">×</button></div>`;
function choices(ids){return `<div class="child-list">${state.children.map(c=>{const names=c.name.match(/^(.*?)\s*\((.*)\)$/);return `<label class="child-option"><input type="checkbox" value="${c.id}" ${ids.has(c.id)?'checked':''}>${photo(c.id)}<span class="child-name"><span class="name-en">${escapeHtml(names?names[1]:c.name)}</span>${names?`<span class="name-th">${escapeHtml(names[2])}</span>`:''}</span></label>`;}).join('')}</div>`;}
function checked(){return [...modal.querySelectorAll('.child-option input:checked')].map(el=>el.value);}
function showFilter(){const ids=selected===null?new Set(state.children.map(c=>c.id)):new Set(selected);open(head('วันนี้อยากส่องหลานคนไหน ♡')+`<input class="child-search" id="childSearch" type="search" placeholder="🔍 ค้นหาชื่อหลาน..." aria-label="ค้นหาชื่อหลาน" autocomplete="off"><div class="filter-actions"><button class="pill" id="all">เลือกหลานทุกคน</button><button class="pill" id="none">เอาออกหมดก่อน</button></div>${choices(ids)}<div class="actions"><button class="primary" id="apply">ดูหลานที่เลือกกัน ♡</button></div>`);$('#all').onclick=()=>modal.querySelectorAll('.child-option input').forEach(i=>i.checked=true);$('#none').onclick=()=>modal.querySelectorAll('.child-option input').forEach(i=>i.checked=false);$('#childSearch').oninput=e=>{const query=e.target.value.trim().toLocaleLowerCase('th');modal.querySelectorAll('.child-option').forEach(option=>{option.hidden=!option.textContent.toLocaleLowerCase('th').includes(query);});};$('#apply').onclick=()=>{const ids=checked();selected=ids.length===state.children.length?null:new Set(ids);render();modal.close();};}
function render(){
 $('#status').textContent='';$('#filter').textContent=`เลือกหลานจ๋า · ${selected===null?'ทุกคน':selected.size+' คน'} ▼`;
 const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate(),offset=(new Date(y,m-1,1).getDay()+6)%7;
 const months=[];for(let yy=2026,mm=8;`${yy}-${String(mm).padStart(2,'0')}`<=state.today.slice(0,7);){const v=`${yy}-${String(mm).padStart(2,'0')}`;months.push(v);if(++mm===13){mm=1;yy++;}}
 const visits=state.visits.filter(v=>v.date.startsWith(month)&&included(v.child));
 const forecastEnd=addDays(state.today,14),forecasts=state.forecasts.filter(f=>included(f.child));
 const lastDate=month===state.today.slice(0,7)&&forecastEnd.slice(0,7)!==month?forecastEnd:month+'-'+String(days).padStart(2,'0');
 const count=Math.round((Date.parse(lastDate)-Date.parse(month+'-01'))/86400000)+1;
 const cells=Array.from({length:offset},()=>'<div></div>');
 for(let d=1;d<=count;d++){
  const date=addDays(month+'-01',d-1),future=date>state.today;
  const ids=future?forecasts.filter(f=>f.dates.includes(date)).map(f=>f.child):visits.filter(v=>v.date===date).map(v=>v.child);
  const label=date.slice(0,7)!==month?thaiDate(date,{day:'numeric',month:'short'}):String(Number(date.slice(-2)));
  const size=avatarSizeClass(ids.length);
  cells.push(`<button class="day ${ids.length?'':'empty'} ${future&&ids.length?'forecast-day':''} ${date===state.today?'today':''} ${date===selectedDate?'selected':''}" data-date="${date}" aria-label="${thaiDate(date)} ${future?'น่าจะแวะมา':'แวะมาแล้ว'} ${ids.length} คน" ${date>forecastEnd?'disabled':''}><span class="number ${date.slice(0,7)!==month?'spill-number':''}">${label}</span><span class="avatars ${size}">${ids.map(id=>photo(id,future?'predicted':'')).join('')}${ids.length===0?'<span class="blank-dot"></span>':''}</span></button>`);
 }
 $('#content').innerHTML=`<div class="app-layout"><section class="calendar"><div class="monthbar"><button class="round" id="prev" aria-label="เดือนก่อน" ${month===months[0]?'disabled':''}>‹</button><select id="month" aria-label="เลือกเดือน">${months.map(v=>`<option value="${v}" ${v===month?'selected':''}>${thaiDate(v+'-01',{month:'long',year:'numeric'})}</option>`).join('')}</select><button class="round" id="next" aria-label="เดือนถัดไป" ${month===months.at(-1)?'disabled':''}>›</button><button class="today-btn" id="today">วันนี้</button></div><div class="weekdays">${['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(s=>`<span>${s}</span>`).join('')}</div><div class="grid">${cells.join('')}</div><div class="calendar-note"><div class="summary"><span>👥 <strong>${new Set(visits.map(v=>v.child)).size}</strong> <small>คน</small></span><span class="divider"></span><span><strong>${new Set(visits.map(v=>v.date)).size}</strong> <small>วันที่มา</small></span></div><span class="note-love">ทุกวันที่หลานแวะมา ก็เป็นอีกวันที่น่ารักเสมอ ♡</span></div></section>${detailCard(selectedDate)}</div>`;
 $('#month').onchange=e=>{month=e.target.value;render();};$('#prev').onclick=()=>{month=months[months.indexOf(month)-1];render();};$('#next').onclick=()=>{month=months[months.indexOf(month)+1];render();};$('#today').onclick=()=>{month=state.today.slice(0,7);selectedDate=state.today;render();};document.querySelectorAll('[data-date]').forEach(el=>el.onclick=()=>selectDay(el.dataset.date));
}
function selectDay(date){selectedDate=date;if(date.slice(0,7)<month||date.slice(0,7)>month)month=date.slice(0,7);render();}
function people(ids,predicted=false){return `<div class="people-row">${ids.map(id=>`<div class="mini-person">${photo(id,predicted?'predicted':'')}<span>${escapeHtml(shortName(child(id)))}</span></div>`).join('')}</div>`;}
function detailCard(date){
 const future=date>state.today,entries=future?state.forecasts.filter(f=>included(f.child)&&f.dates.includes(date)):[],ids=future?entries.map(f=>f.child):state.visits.filter(v=>v.date===date&&included(v.child)).map(v=>v.child);
 const chip=future?(ids.length?`<div class="chip forecast">✨ น่าจะแวะมา<small>วันนี้น่าจะมีหลานแวะมา ${ids.length} คน</small></div>`:`<div class="chip forecast">💤 วันนี้ยังเงียบ ๆ อยู่งับ<small>กำลังจับทางหลานอยู่คับ ♡</small></div>`):`<div class="chip">ข้อมูลจริง</div>`;
 const reasonRows=entries.map(f=>({child:f.child,reason:softenReason(f.dateReasons?.[date]||f.reason)}));
 return `<aside class="detail-card" id="detail"><div class="detail-head"><div><p class="detail-date">${thaiDate(date,{day:'numeric',month:'short',year:'numeric'})}</p><p class="weekday">${thaiWeekday(date)}</p></div>${chip}</div><section class="detail-section"><h2>${future?'วันนี้ใครน่าจะแวะมาบ้าง':'วันนี้มีใครแวะมาบ้าง'}</h2>${ids.length?people(ids,future):emptyMessage(future)}</section>${future?`<section class="detail-section"><h2>ทำไมแต่ละคนน่าจะแวะมา</h2>${reasonRows.length?`<div class="reason-list">${reasonRows.map(row=>`<div class="reason-item">${photo(row.child,'reason-avatar predicted')}<div><strong>${escapeHtml(shortName(child(row.child)))}</strong><p>${escapeHtml(row.reason)}</p></div></div>`).join('')}</div>`:'<div class="detail-empty">ข้อมูลวันนี้ยังไม่พอให้บอกได้ชัด</div>'}</section><div class="forecast-note">อาจมีหลานคนอื่น ๆ แอบแวะมาเพิ่มเติมได้ มารอดูกันนะ ♡</div>`:''}${!future&&state.authenticated?'<div class="actions"><button class="primary" id="edit">แก้ไขหลานที่แวะมาวันนี้</button></div>':''}</aside>`;
}
function editDay(date,ids){open(head('บันทึกวันที่หลานแวะมา')+`<p>${thaiDate(date)}</p><p class="muted">เลือกหลานได้หลายคน · เอาเครื่องหมายออกถ้าวันนี้ไม่ได้แวะมา</p>${choices(new Set(ids))}<p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" id="save">บันทึก</button></div>`);$('#save').onclick=async()=>{const button=$('#save');button.disabled=true;try{await api('/api/day','PUT',{date,ids:checked()});await load();modal.close();}catch(e){$('#formError').textContent=e.message;}finally{button.disabled=false;}};}
function admin(){if(state.authenticated){open(head('แอดมิน')+'<p>เลือกวันที่ในปฏิทินเพื่อบันทึกว่าหลานคนไหนแวะมาบ้าง</p><div class="actions"><button class="pill" id="logout">ออกจากระบบ</button><button class="primary" id="back">ไปที่ปฏิทิน</button></div>');$('#back').onclick=()=>{render();modal.close();};$('#logout').onclick=async()=>{try{await api('/api/logout','POST',{});await load();modal.close();if(isAdminPath())admin();}catch(e){$('#status').textContent=e.message;modal.close();}};return;}
 open(head('เข้าสู่ระบบแอดมิน')+`<form id="login"><label class="field">ชื่อผู้ใช้<input name="username" autocomplete="username" required></label><label class="field">รหัสผ่าน<input name="password" type="password" autocomplete="current-password" required></label><p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" type="submit">เข้าสู่ระบบ</button></div></form>`);$('#login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;try{await api('/api/login','POST',Object.fromEntries(new FormData(form)));await load();modal.close();if(isAdminPath())admin();}catch(e){$('#formError').textContent=e.message;}finally{button.disabled=false;}};}
$('#filter').onclick=()=>state&&showFilter();
document.addEventListener('click',e=>{if(e.target?.id==='edit'&&state&&selectedDate)editDay(selectedDate,state.visits.filter(v=>v.date===selectedDate).map(v=>v.child));});
load(true).catch(e=>{$('#status').textContent=e.message+' · รีเฟรชเพื่อลองใหม่';});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'filter_children',description:'เลือกหลานที่อยากดูในปฏิทิน ส่ง null เพื่อดูทั้งหมด',inputSchema:{type:'object',properties:{ids:{anyOf:[{type:'null'},{type:'array',items:{type:'string'}}]}},required:['ids'],additionalProperties:false},execute:async({ids})=>{if(!state)throw Error('ยังโหลดไม่เสร็จ');if(ids!==null&&(!Array.isArray(ids)||ids.some(id=>!child(id))))throw Error('รายชื่อไม่ถูกต้อง');selected=ids===null?null:new Set(ids);render();return {selected:ids};}})).catch(()=>{});}catch{}}

