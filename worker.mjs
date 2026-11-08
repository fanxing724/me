const BACKEND='https://admin.724520.xyz';
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 let response;
 try{
  if(['/manage','/login','/logout'].includes(path)){
   response=['GET','HEAD'].includes(request.method)?new Response(null,{status:302,headers:{Location:BACKEND+'/manage'}}):new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  }else if(path==='/cdn-check'){
   const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
   if(request.headers.get('Origin')==='https://cdn.724520.xyz')headers['Access-Control-Allow-Origin']='https://cdn.724520.xyz';
   response=['GET','HEAD'].includes(request.method)?new Response(JSON.stringify({ok:true,service:'homepage-cdn',line:'cloudflare',version:'20261108-custom1'}),{headers}):new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  }else if(['/api/data','/api/settings','/api/music','/api/pageviews'].includes(path)){
   const count=path==='/api/pageviews';
   if(!['GET','HEAD',...(count?['POST']:[])].includes(request.method))response=new Response(null,{status:405,headers:{Allow:count?'GET, HEAD, POST':'GET, HEAD'}});
   else if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))response=Response.json({error:'Forbidden'},{status:403});
   else{
    const headers=new Headers({Accept:'application/json'});
    if(request.method==='POST')headers.set('Origin',url.origin);
    response=await env.HOME_BACKEND.fetch(new Request(BACKEND+path,{method:request.method==='HEAD'?'GET':request.method,headers}));
   }
  }else if(path==='/api/visitor-ip')response=['GET','HEAD'].includes(request.method)?await visitorIP(request):new Response(null,{status:405});
  else if(path.startsWith('/api/')||/^\/static\/admin(?:[.-])/.test(path))response=new Response('Not found',{status:404});
  else response=await env.ASSETS.fetch(request);
 }catch{response=Response.json({error:'Service unavailable'},{status:503});}
 const headers=new Headers(response.headers);headers.delete('Set-Cookie');
 for(const key of [...headers.keys()])if(key.toLowerCase().startsWith('access-control-'))headers.delete(key);
 if(path==='/cdn-check'&&request.headers.get('Origin')==='https://cdn.724520.xyz')headers.set('Access-Control-Allow-Origin','https://cdn.724520.xyz');
 headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(path.startsWith('/api/')||['/manage','/login','/logout','/cdn-check'].includes(path))headers.set('Cache-Control','no-store');
 else if(response.ok&&(path.startsWith('/assets/')||path.startsWith('/static/')))headers.set('Cache-Control','public, max-age=86400');
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}};
async function visitorIP(request){const path='/api/visitor-ip';
  if (path === '/api/visitor-ip' && ['GET','HEAD'].includes(request.method)) {
    try {
      // 获取访客真实IP地址
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      request.headers.get('X-Real-IP') || 
                      '未知IP';

      // 获取国家信息（Cloudflare提供）
      const country = request.cf?.country || '未知';
      const city = request.cf?.city || '未知';
      const region = request.cf?.region || '未知';

      // 处理IPv6地址显示
      let displayIP = clientIP;
      if (clientIP.includes(':') && clientIP.length > 20) {
        displayIP = clientIP.substring(0, 26) + '...';
      }

      // 构建位置信息
      let countryName = country;
      try {
        if (/^[A-Z]{2}$/.test(country)) countryName = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(country);
      } catch {}
      const seenLocations = new Set();
      const locationParts = [countryName, region, city]
        .map(part => typeof part === 'string' ? part.trim() : '')
        .filter(part => {
          if (!part || part === '未知' || seenLocations.has(part.toLowerCase())) return false;
          seenLocations.add(part.toLowerCase());
          return true;
        });
      const location = locationParts.length > 0 ? locationParts.join(' · ') : '暂无法识别';
      const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

      const response = {
        ip: displayIP,
        fullIP: clientIP,
        country: country,
        region: region,
        city: city,
        location: location,
        displayText: `${escapeHTML(displayIP)}<br>大致位置：${escapeHTML(location)}`
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to get IP information',
        ip: '无法获取IP地址',
        displayText: '无法获取IP地址'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }


}
export class PageViewCounter {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS pageviews (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO pageviews (id, total) VALUES (1, 0)');
  }
  async fetch(request) {
    if (request.method === 'POST') {
      const row = this.sql.exec('UPDATE pageviews SET total = total + 1 WHERE id = 1 RETURNING total').one();
      return Response.json(row);
    }
    return Response.json(this.sql.exec('SELECT total FROM pageviews WHERE id = 1').one());
  }
}
