import {json,readOnly,upstreamJSON,errorCode} from '../_lib/common.js';
import snapshot from '../_lib/settings-snapshot.js';
export async function onRequest({request}){
 const rejected=readOnly(request);if(rejected)return rejected;
 try{const body=await upstreamJSON('/api/settings');if(!body?.settings?.modules)throw Error('schema');return json(request,body,200,{'X-Homepage-Settings':'live'});}
 catch(error){return json(request,snapshot,200,{'X-Homepage-Settings':'snapshot','X-Homepage-Upstream':errorCode(error)});}
}
export default onRequest;
