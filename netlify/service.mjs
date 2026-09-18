import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {predict} from '../forecast.mjs';

const cookieName='laan_session';
const sessionLength=8*60*60*1000;
const attemptWindow=15*60*1000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const readCookie=request=>request.headers.get('cookie')?.match(/(?:^|; )laan_session=([^;]+)/)?.[1];
const cookie=(request,token,maxAge)=>`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
const parseBody=async request=>{const raw=await request.text();if(raw.length>20000)throw Object.assign(Error('ข้อมูลใหญ่เกินไป'),{status:413});try{return JSON.parse(raw||'{}');}catch{throw Object.assign(Error('ข้อมูลไม่ถูกต้อง'),{status:400});}};

export function createService({seed,visitsStore,sessionsStore,attemptsStore,adminUsername,adminPassword,now=Date.now}){
 const adminConfigured=!!adminUsername&&!!adminPassword&&adminPassword.length<256;
 const salt=adminConfigured?randomBytes(16).toString('hex'):null,passwordHash=adminConfigured?scryptSync(adminPassword,salt,64):null;
 const children=seed.children.map(({file,...child})=>child);
 const childIds=new Set(children.map(child=>child.id));
 const readVisits=async()=>{const entry=await visitsStore.getWithMetadata('visits',{type:'json'});return {visits:entry?.data??seed.visits,etag:entry?.etag};};
 const authenticated=async request=>{const token=readCookie(request);if(!token)return false;const session=await sessionsStore.get(hash(token),{type:'json'});return !!session&&session.expiresAt>now();};
 const state=async request=>{if(request.method!=='GET')return json({error:'ไม่รองรับคำขอนี้'},405);const {visits}=await readVisits();return json({today:today(),authenticated:await authenticated(request),children,visits,forecasts:children.map(child=>({child:child.id,...predict(visits.filter(visit=>visit.child===child.id).map(visit=>visit.date),today())}))});};
 const login=async request=>{if(request.method!=='POST')return json({error:'ไม่รองรับคำขอนี้'},405);if(!adminConfigured)return json({error:'ยังไม่ได้ตั้งค่าบัญชีแอดมิน'},503);if(!sameOrigin(request))return json({error:'คำขอไม่ถูกต้อง'},403);const body=await parseBody(request);const ip=request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const attemptKey=hash(ip);const prior=await attemptsStore.get(attemptKey,{type:'json'});const attempt=prior?.until>now()?prior:{count:0,until:now()+attemptWindow};if(attempt.count>=8)return json({error:'ลองใหม่ใน 15 นาที'},429);attempt.count++;await attemptsStore.setJSON(attemptKey,attempt);const valid=body.username===adminUsername&&typeof body.password==='string'&&body.password.length<256&&timingSafeEqual(passwordHash,scryptSync(body.password,salt,64));if(!valid)return json({error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'},401);await attemptsStore.delete(attemptKey);const token=randomBytes(32).toString('hex');await sessionsStore.setJSON(hash(token),{expiresAt:now()+sessionLength});return json({ok:true},200,{'Set-Cookie':cookie(request,token,28800)});};
 const logout=async request=>{if(request.method!=='POST')return json({error:'ไม่รองรับคำขอนี้'},405);if(!sameOrigin(request))return json({error:'คำขอไม่ถูกต้อง'},403);const token=readCookie(request);if(token)await sessionsStore.delete(hash(token));return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});};
 const day=async request=>{if(request.method!=='PUT')return json({error:'ไม่รองรับคำขอนี้'},405);if(!sameOrigin(request))return json({error:'คำขอไม่ถูกต้อง'},403);if(!await authenticated(request))return json({error:'กรุณาเข้าสู่ระบบแอดมิน'},401);const body=await parseBody(request);const {date,ids}=body;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'2026-08-01'||date>today()||!Array.isArray(ids)||ids.length>children.length||ids.some(id=>!childIds.has(id)))return json({error:'วันที่หรือรายชื่อไม่ถูกต้อง บันทึกได้ถึงวันนี้เท่านั้น'},400);const {visits,etag}=await readVisits();const next=visits.filter(visit=>visit.date!==date);for(const id of new Set(ids))next.push({date,child:id});next.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.child)-Number(b.child));const result=await visitsStore.setJSON('visits',next,etag?{onlyIfMatch:etag}:{onlyIfNew:true});if(!result.modified)return json({error:'มีการบันทึกพร้อมกัน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'},409);return json({ok:true});};
 return {state,login,logout,day};
}

export async function respond(handler,request){try{return await handler(request);}catch(error){console.error(error);return json({error:error.status?'ข้อมูลไม่ถูกต้อง':'บันทึกหรือโหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'},error.status||500);}}
