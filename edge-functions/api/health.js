import {json,readOnly,upstreamJSON} from '../_lib/common.js';
export async function onRequest({request}){
 const rejected=readOnly(request);if(rejected)return rejected;
 let upstream=false;
 try{const value=await upstreamJSON('/api/pageviews');upstream=Number.isSafeInteger(value.total)&&value.total>=0;}catch{}
 return json(request,{upstream,abortController:typeof AbortController==='function',abortSignalTimeout:typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'},upstream?200:503);
}
export default onRequest;
