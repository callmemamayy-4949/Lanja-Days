import test from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../netlify/service.mjs';
import {seed} from '../netlify/seed.mjs';

class Store{
 items=new Map();version=0;
 async get(key){return this.items.get(key)?.data??null;}
 async getWithMetadata(key){return this.items.get(key)??null;}
 async setJSON(key,data,options={}){const old=this.items.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};const etag=String(++this.version);this.items.set(key,{data,etag});return {modified:true,etag};}
 async delete(key){this.items.delete(key);}
}

test('public calendar remains readable before admin credentials are configured',async()=>{
 const api=createService({seed,visitsStore:new Store(),sessionsStore:new Store(),attemptsStore:new Store()});
 const state=await(await api.state(new Request('https://lanja.example/api/state'))).json();
 assert.equal(state.visits.length,seed.visits.length);
 assert.equal(state.children.length,seed.children.length);
 assert.deepEqual(state.children.find(child=>child.id==='24').birthday,{month:3,day:6});
 assert.equal(state.forecastHistory,undefined);
 assert.equal((await api.login(new Request('https://lanja.example/api/login',{method:'POST'}))).status,503);
});

test('Netlify API preserves seed visits and protects edits with an HTTPS admin session',async()=>{
 const visitsStore=new Store(),sessionsStore=new Store(),attemptsStore=new Store();
 const api=createService({seed,visitsStore,sessionsStore,attemptsStore,adminUsername:'test-admin',adminPassword:'test-secret-123!'});
 const url='https://lanja.example';
 const request=(route,method='GET',body,cookie,origin=url)=>new Request(url+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 let response=await api.state(request('/api/state'));let state=await response.json();
 assert.equal(state.visits.length,seed.visits.length);assert.equal(state.children.length,seed.children.length);assert.equal(state.authenticated,false);assert.equal(state.forecastHistory,undefined);
 assert.equal((await api.day(request('/api/day','PUT',{date:'2026-09-01',ids:['1']}))).status,401);
 assert.equal((await api.login(request('/api/login','POST',{username:'test-admin',password:'wrong'}))).status,401);
 response=await api.login(request('/api/login','POST',{username:'test-admin',password:'test-secret-123!'}));
 assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal((await api.day(request('/api/day','PUT',{date:'2026-09-01',ids:['1','2']},cookie,'https://other.example'))).status,403);
 assert.equal((await api.day(request('/api/day','PUT',{date:'2026-09-01',ids:['1','2']},cookie))).status,200);
 state=await(await api.state(request('/api/state','GET',undefined,cookie))).json();
 assert.equal(state.authenticated,true);assert.deepEqual(state.visits.filter(v=>v.date==='2026-09-01').map(v=>v.child),['1','2']);
 assert.ok(Array.isArray(state.forecastHistory));
 const savedHistory=await visitsStore.get('forecast-history');
 assert.equal((await api.day(request('/api/day','PUT',{date:'2026-09-01',ids:[]},cookie))).status,200);
 const restarted=createService({seed,visitsStore,sessionsStore,attemptsStore,adminUsername:'test-admin',adminPassword:'test-secret-123!'});
 state=await(await restarted.state(request('/api/state','GET',undefined,cookie))).json();
 const emptyDay=state.forecastHistory.find(r=>r.date==='2026-09-01');
 assert.equal(emptyDay.confirmed,true);assert.deepEqual(emptyDay.actual,[]);
 assert.deepEqual(await visitsStore.get('forecast-history'),savedHistory);
 assert.equal((await api.logout(request('/api/logout','POST',undefined,cookie))).status,200);
 assert.equal((await api.day(request('/api/day','PUT',{date:'2026-09-01',ids:[]},cookie))).status,401);
});
