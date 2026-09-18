import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data=path.resolve(process.env.LAAN_DATA_DIR||path.join(root,'data'));
const backupDir=path.join(data,'backups');
mkdirSync(backupDir,{recursive:true});
const target=path.join(backupDir,`calendar-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const source=new DatabaseSync(path.join(data,'calendar.sqlite'));
try{source.exec(`VACUUM INTO '${target.replaceAll("'","''")}'`);}finally{source.close();}
const copy=new DatabaseSync(target);
try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('ไฟล์สำรองตรวจสอบไม่ผ่าน');}
finally{copy.close();}
console.log(target);
