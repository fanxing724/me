import {json,upstreamJSON,errorCode} from '../_lib/common.js';
export async function onRequest({request}){
 if(!['GET','HEAD','POST'].includes(request.method))return json(request,{error:'Method not allowed'},405,{Allow:'GET, HEAD, POST'});
 const url=new URL(request.url);
 if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))return json(request,{error:'Forbidden'},403);
 const write=request.method==='POST'&&url.origin==='https://eo.724520.xyz';
 try{
  const body=await upstreamJSON('/api/pageviews',{method:write?'POST':'GET',...(write?{origin:url.origin}:{}),timeout:6000});
  if(!Number.isSafeInteger(body.total)||body.total<0)return json(request,{error:'Counter unavailable',code:'UPSTREAM_SCHEMA'},503);
  return json(request,{total:body.total,mode:write?'counted':'read-only'});
 }catch(error){return json(request,{error:'Counter unavailable',code:errorCode(error),...(Number.isInteger(error?.status)?{upstreamStatus:error.status}:{})},503);}
}
export default onRequest;
