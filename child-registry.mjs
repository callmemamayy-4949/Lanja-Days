export function registerChildren(db,files){
 db.exec('CREATE TABLE IF NOT EXISTS child_registry(id INTEGER PRIMARY KEY, file TEXT NOT NULL UNIQUE)');
 const known=new Map(db.prepare('SELECT id,file FROM child_registry').all().map(row=>[row.file,row.id]));
 let nextId=Math.max(0,...known.values())+1;
 const additions=files.filter(file=>!known.has(file));
 if(additions.length){
  db.exec('BEGIN');
  try{const insert=db.prepare('INSERT INTO child_registry(id,file) VALUES(?,?)');for(const file of additions){known.set(file,nextId);insert.run(nextId++,file);}db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
 }
 return files.map(file=>({id:String(known.get(file)),name:file.replace(/\.png$/,''),image:'/portraits/'+known.get(file)+'.png',file}));
}
