import http from 'node:http';
import {readFileSync,readdirSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {predict} from './forecast.mjs';
import {captureForecasts,forecastHistory} from './forecast-history.mjs';
import {withBirthdays} from './birthdays.mjs';
import {registerChildren} from './child-registry.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
if(existsSync(path.join(root,'.env')))loadEnvFile(path.join(root,'.env'));
const adminUsername=process.env.ADMIN_USERNAME,adminPassword=process.env.ADMIN_PASSWORD;
if(!adminUsername||!adminPassword||adminPassword.length>=256)throw new Error('ตั้งค่า ADMIN_USERNAME และ ADMIN_PASSWORD ใน .env ก่อนเปิดเว็บ');
const adminSalt=randomBytes(16).toString('hex'),adminHash=scryptSync(adminPassword,adminSalt,64);
const data=path.resolve(process.env.LAAN_DATA_DIR||path.join(root,'data'));mkdirSync(data,{recursive:true});
const db=new DatabaseSync(path.join(data,'calendar.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS visits(date TEXT NOT NULL, child TEXT NOT NULL, PRIMARY KEY(date,child)); CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY,salt TEXT NOT NULL,hash TEXT NOT NULL);');
if(existsSync(path.join(data,'admin-access.txt')))unlinkSync(path.join(data,'admin-access.txt'));
const children=registerChildren(db,readdirSync(path.join(root,'รูป+ชื่อหลาน')).filter(n=>n.endsWith('.png')).sort());
db.exec('CREATE TABLE IF NOT EXISTS forecast_history(date TEXT PRIMARY KEY, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS confirmed_days(date TEXT PRIMARY KEY);');
const sessions=new Map(),attempts=new Map();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const port=Number(process.env.PORT||3000);
const lanIp=process.env.LAAN_LAN_IP;
const bindHost=process.env.LAAN_BIND_HOST||'127.0.0.1';
const publicOrigin=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN):null;
if(publicOrigin&&(publicOrigin.protocol!=='https:'||publicOrigin.pathname!=='/'||publicOrigin.search||publicOrigin.hash))throw new Error('PUBLIC_ORIGIN ต้องเป็น https://ชื่อโดเมน โดยไม่มี path');
const localHosts=[`localhost:${port}`,`127.0.0.1:${port}`,...(lanIp?[`${lanIp}:${port}`]:[])];
const allowedHosts=new Set([...localHosts,...(publicOrigin?[publicOrigin.host]:[])]);
const allowedOrigins=new Set(localHosts.map(host=>`http://${host}`));
if(publicOrigin)allowedOrigins.add(publicOrigin.origin);
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'");
 if(!allowedHosts.has(req.headers.host))return json(res,403,{error:'Host ไม่ถูกต้อง'});
 const url=new URL(req.url,'http://localhost');const token=req.headers.cookie?.match(/(?:^|; )laan_session=([^;]+)/)?.[1];const session=sessions.get(token);const authenticated=!!session&&session>Date.now();
 let body={};if(['POST','PUT','DELETE'].includes(req.method)){if(!allowedOrigins.has(req.headers.origin))return json(res,403,{error:'คำขอไม่ถูกต้อง'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return json(res,413,{error:'ข้อมูลใหญ่เกินไป'});}try{body=JSON.parse(raw||'{}');}catch{return json(res,400,{error:'ข้อมูลไม่ถูกต้อง'});}}
 if(url.pathname==='/api/state'&&req.method==='GET'){const visits=db.prepare('SELECT date,child FROM visits ORDER BY date').all();const currentDay=today();const history=Object.fromEntries(db.prepare('SELECT date,snapshot FROM forecast_history').all().map(r=>[r.date,JSON.parse(r.snapshot)]));const captured=captureForecasts(children,visits,currentDay,history);for(const [date,snapshot] of Object.entries(captured))if(!history[date])db.prepare('INSERT OR IGNORE INTO forecast_history VALUES(?,?)').run(date,JSON.stringify(snapshot));return json(res,200,{today:currentDay,authenticated,...(authenticated?{forecastHistory:forecastHistory(visits,db.prepare('SELECT date FROM confirmed_days').all().map(r=>r.date),captured,currentDay)}:{}),children:withBirthdays(children.map(({file,...c})=>c)),visits,forecasts:children.map(c=>({child:c.id,...predict(visits.filter(v=>v.child===c.id).map(v=>v.date),today())}))});}
 if(url.pathname==='/api/login'&&req.method==='POST'){const key=req.socket.remoteAddress,record=attempts.get(key);if(record&&record.until>Date.now()&&record.count>=8)return json(res,429,{error:'ลองใหม่ใน 15 นาที'});const attempt=record&&record.until>Date.now()?record:{count:0,until:Date.now()+900000};attempt.count++;attempts.set(key,attempt);const valid=body.username===adminUsername&&typeof body.password==='string'&&body.password.length<256&&timingSafeEqual(adminHash,scryptSync(body.password,adminSalt,64));if(!valid)return json(res,401,{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'});attempts.delete(key);const newToken=randomBytes(32).toString('hex');sessions.set(newToken,Date.now()+28800000);res.setHeader('Set-Cookie',`laan_session=${newToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${publicOrigin?'; Secure':''}`);return json(res,200,{ok:true});}
 if(url.pathname==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',`laan_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${publicOrigin?'; Secure':''}`);return json(res,200,{ok:true});}
 if(url.pathname==='/api/day'&&req.method==='PUT'){if(!authenticated)return json(res,401,{error:'กรุณาเข้าสู่ระบบแอดมิน'});const {date,ids}=body;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'2026-08-01'||date>today()||!Array.isArray(ids)||ids.length>children.length||ids.some(id=>!children.some(c=>c.id===id)))return json(res,400,{error:'วันที่หรือรายชื่อไม่ถูกต้อง บันทึกได้ถึงวันนี้เท่านั้น'});db.exec('BEGIN');try{db.prepare('DELETE FROM visits WHERE date=?').run(date);for(const id of new Set(ids))db.prepare('INSERT INTO visits VALUES(?,?)').run(date,id);db.prepare('INSERT OR IGNORE INTO confirmed_days VALUES(?)').run(date);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
 if(req.method!=='GET')return json(res,405,{error:'ไม่รองรับคำขอนี้'});
 const portrait=children.find(c=>c.image===url.pathname);const font=url.pathname.match(/^\/fonts\/(noto-sans-thai-[1-6]\.ttf)$/);if(font){res.writeHead(200,{'Content-Type':'font/ttf','Cache-Control':'public, max-age=31536000, immutable'});return res.end(readFileSync(path.join(root,'public','fonts',font[1])));}const assets={'/':['index.html','text/html'],'/admin':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml'],'/hero.png':['hero.png','image/png'],'/brand-icon.png':['brand-icon.png','image/png'],'/noto.css':['noto.css','text/css']};
 if(portrait){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'});return res.end(readFileSync(path.join(root,'รูป+ชื่อหลาน',portrait.file)));}
 const asset=assets[url.pathname];if(!asset)return json(res,404,{error:'ไม่พบหน้านี้'});res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(path.join(root,'public',asset[0])));
 }catch(error){console.error(error.message);json(res,500,{error:'บันทึกหรือโหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'});}});
server.listen(port,bindHost,()=>console.log(`Listening: ${bindHost}:${port}`));
if(lanIp&&bindHost==='127.0.0.1')http.createServer(server.listeners('request')[0]).listen(port,lanIp,()=>console.log(`LAN: http://${lanIp}:${port}`));
