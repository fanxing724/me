import snapshot from '../_lib/snapshot.js';
import {json,readOnly,upstreamJSON,errorCode} from '../_lib/common.js';
export async function onRequest({request}){
 const rejected=readOnly(request);if(rejected)return rejected;
 try{const body=await upstreamJSON('/api/data');if(!Array.isArray(body?.data?.sitesData))throw Error('schema');return json(request,body,200,{'X-Homepage-Data':'live'});}
 catch(error){return json(request,snapshot,200,{'X-Homepage-Data':'snapshot','X-Homepage-Upstream':errorCode(error)});}
}
export default onRequest;
