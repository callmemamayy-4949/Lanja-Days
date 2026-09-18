import {getStore} from '@netlify/blobs';
import {seed} from '../seed.mjs';
import {createService} from '../service.mjs';

let service;
export function getService(){
 return service??=createService({
  seed,
  visitsStore:getStore({name:'laan-visits',consistency:'strong'}),
  sessionsStore:getStore({name:'laan-sessions',consistency:'strong'}),
  attemptsStore:getStore({name:'laan-login-attempts',consistency:'strong'}),
  adminUsername:process.env.ADMIN_USERNAME,
  adminPassword:process.env.ADMIN_PASSWORD,
 });
}
