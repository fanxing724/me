import {json, readOnly} from '../_lib/common.js';
export function onRequest({request}) {
  const rejected=readOnly(request); if(rejected) return rejected;
  const eo=request.eo || {}; const geo=eo.geo || {};
  const raw=typeof eo.clientIp === 'string' ? eo.clientIp : '';
  const ip=/^[0-9a-fA-F:.]{3,64}$/.test(raw) ? raw : '';
  const location=[geo.countryName,geo.regionName,geo.cityName].filter(v=>typeof v==='string'&&v.trim()).join(' · ');
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return json(request,{ip:ip||'暂不可用',location,displayText:esc(ip||'暂不可用')+(location?'<br>大致位置：'+esc(location):'')});
}
export default onRequest;
