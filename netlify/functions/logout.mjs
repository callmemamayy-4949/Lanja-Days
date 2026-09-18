import {getService} from './shared.mjs';
import {respond} from '../service.mjs';
export default request=>respond(getService().logout,request);
export const config={path:'/api/logout'};
