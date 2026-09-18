import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db=new DatabaseSync(path.join(root,'data','calendar.sqlite'));
try{
 const children=db.prepare('SELECT id,file FROM child_registry ORDER BY id').all().map(({id,file})=>({id:String(id),name:file.replace(/\.png$/,''),image:`/portraits/${id}.png`,file}));
 const visits=db.prepare('SELECT date,child FROM visits ORDER BY date,child').all();
 if(!children.length)throw Error('ยังไม่มีรายชื่อหลานในฐานข้อมูล');
 if(visits.some(visit=>!children.some(child=>child.id===visit.child)))throw Error('มีบันทึกที่ไม่พบรหัสหลาน');
 writeFileSync(path.join(root,'netlify','seed.mjs'),`// Generated from local SQLite by npm run export:netlify\nexport const seed=${JSON.stringify({children,visits},null,2)};\n`);
 console.log(`Exported ${children.length} children and ${visits.length} visits`);
}finally{db.close();}
