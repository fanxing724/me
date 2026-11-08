import {json, readOnly} from './_lib/common.js';
export function onRequest({request}) {
  const rejected=readOnly(request); if(rejected) return rejected;
  const extra={'Vary':'Origin'};
  if(request.headers.get('Origin')==='https://cdn.724520.xyz') extra['Access-Control-Allow-Origin']='https://cdn.724520.xyz';
  return json(request,{ok:true,service:'homepage-cdn',line:'edgeone',version:'20261109-counter1'},200,extra);
}
export default onRequest;
