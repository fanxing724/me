export const SOURCE = 'https://admin.724520.xyz';
export function json(request,body,status=200,extra={}){
 return new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
export function readOnly(request){return ['GET','HEAD'].includes(request.method)?null:json(request,{error:'Method not allowed'},405,{Allow:'GET, HEAD'});}
function failure(code,status){const error=new Error('Public backend unavailable');error.code=code;if(status)error.status=status;return error;}
// Use common Web APIs and native EO timeouts; do not depend on AbortSignal.timeout.
export async function upstreamJSON(path,{method='GET',origin,timeout=6000}={}){
 if(!['/api/data','/api/settings','/api/music','/api/pageviews'].includes(path))throw failure('UPSTREAM_PATH');
 const headers={Accept:'application/json'};if(origin)headers.Origin=origin;
 const controller=typeof AbortController==='function'?new AbortController():null;
 let timer;
 try{
  const task=(async()=>{
   const response=await fetch(SOURCE+path,{method,headers,redirect:'manual',...(controller?{signal:controller.signal}:{}),eo:{timeoutSetting:{connectTimeout:timeout,readTimeout:timeout,writeTimeout:timeout}}});
   if(!response.ok)throw failure('UPSTREAM_HTTP',response.status);
   try{return await response.json();}catch{throw failure('UPSTREAM_JSON');}
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(failure('UPSTREAM_TIMEOUT'));controller?.abort();},timeout);});
  return await Promise.race([task,deadline]);
 }catch(error){
  const code=typeof error?.code==='string'&&error.code.startsWith('UPSTREAM_')?error.code:'UPSTREAM_FETCH';
  console.warn('Homepage public backend request failed',{code,stage:method==='POST'?'count':'read',...(Number.isInteger(error?.status)?{status:error.status}:{})});
  throw failure(code,error?.status);
 }finally{clearTimeout(timer);}
}
export function errorCode(error){return typeof error?.code==='string'&&error.code.startsWith('UPSTREAM_')?error.code:'UPSTREAM_FETCH';}
