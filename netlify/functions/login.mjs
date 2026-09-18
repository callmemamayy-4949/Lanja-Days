import {getService} from './shared.mjs';
import {respond} from '../service.mjs';
export default request=>respond(getService().login,request);
export const config={path:'/api/login'};
