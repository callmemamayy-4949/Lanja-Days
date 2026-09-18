import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {registerChildren} from '../child-registry.mjs';

test('adding a portrait before existing filenames does not reassign visit IDs',()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'laan-children-'));
 const db=new DatabaseSync(path.join(folder,'test.sqlite'));
 try{
  const original=registerChildren(db,['B.png','D.png']);
  assert.deepEqual(original.map(c=>c.id),['1','2']);
  db.exec('CREATE TABLE visits(date TEXT,child TEXT)');
  db.prepare('INSERT INTO visits VALUES(?,?)').run('2026-09-01','1');
  const updated=registerChildren(db,['A.png','B.png','D.png']);
  assert.deepEqual(updated.map(c=>[c.name,c.id]),[['A','3'],['B','1'],['D','2']]);
  assert.equal(db.prepare('SELECT child FROM visits').get().child,'1');
 }finally{db.close();}
});
