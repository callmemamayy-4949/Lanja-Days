import {cpSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seed} from '../netlify/seed.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist=path.resolve(root,'dist');
if(!dist.startsWith(root+path.sep))throw Error('Invalid build path');
rmSync(dist,{recursive:true,force:true});
cpSync(path.join(root,'public'),dist,{recursive:true});
mkdirSync(path.join(dist,'portraits'),{recursive:true});
for(const child of seed.children)cpSync(path.join(root,'รูป+ชื่อหลาน',child.file),path.join(dist,'portraits',`${child.id}.png`));
mkdirSync(path.join(dist,'admin'),{recursive:true});
cpSync(path.join(root,'public','index.html'),path.join(dist,'admin','index.html'));
console.log(`Built ${seed.children.length} portraits in ${dist}`);
