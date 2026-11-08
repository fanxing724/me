// Original page: cmliu/Blog-CDN-Gateway (MIT). Layout and styles kept unchanged.
import upstream from './vendor/Blog-CDN-Gateway.mjs';
import {AVATAR} from './avatar.mjs';
import {DEFAULT_SETTINGS} from '../public/static/settings-schema.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#1b2337"/><path d="m20 7 3.5 9.5L33 20l-9.5 3.5L20 33l-3.5-9.5L7 20l9.5-3.5Z" fill="#b2ddc8"/></svg>');
export default {async fetch(request,env={}){
 const url=new URL(request.url),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(url.pathname==='/assets/cdn-background-v1.webp'){const response=await env.GATEWAY_ASSETS.fetch(request);const h=new Headers(response.headers);h.set('Cache-Control','public, max-age=31536000, immutable');return new Response(response.body,{status:response.status,headers:h});}
 if(url.pathname==='/favicon.ico')return new Response(request.method==='HEAD'?null:decodeURIComponent(icon.split(',')[1]),{headers:{...headers,'Content-Type':'image/svg+xml'}});
 if(url.pathname!=='/')return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});
 let config=DEFAULT_SETTINGS.cdn;
 try{if(env.HOME_BACKEND){const r=await env.HOME_BACKEND.fetch(new Request('https://admin.724520.xyz/api/settings',{signal:AbortSignal.timeout(1500)}));if(r.ok){const value=await r.json();if(value.settings?.cdn)config=value.settings.cdn;}}}catch{}
 const autoJump=config.autoJump&&url.searchParams.get('manual')!=='1';url.searchParams.delete('manual');
 const routes=[];if(config.edgeoneEnabled)routes.push('https://eo.724520.xyz#'+escape(config.edgeoneLabel));if(config.cloudflareEnabled)routes.push('https://cf.724520.xyz#'+escape(config.cloudflareLabel));
 const title=config.title===DEFAULT_SETTINGS.cdn.title?'选一条顺畅的路':config.title;
 const response=await upstream.fetch(new Request(url),{URLS:routes,NAME:escape(config.siteName),TITLE:escape(title),PNG:AVATAR,ICO:icon,IMG:['/assets/cdn-background-v1.webp'],ADS:'',JUMP_DELAY:999});
 let html=await response.text();
 html=html.replace('正在为您寻找最佳线路...',escape(config.description===DEFAULT_SETTINGS.cdn.description?'正在为你检测访问线路，请稍等一下。':config.description)).replace('实时测速','自动选线').replace('命中线路','线路就绪').replace('所有线路均未返回 200','暂时没有连通，请点击线路手动尝试。').replaceAll('检测失败','暂未连通');
 // Only adapt the existing script to our health probes, manual mode and path/hash retention.
 html=html.replace("const list = document.getElementById('urlList');",`const autoJump=${JSON.stringify(autoJump)};const checkTimeout=${JSON.stringify(config.timeout)};\nconst list = document.getElementById('urlList');`)
 .replace('fetch(url, {',"fetch(new URL('/cdn-check',url), {")
 .replace("method: 'HEAD'","method: 'GET'")
 .replace("redirect: 'follow'","redirect: 'error', credentials: 'omit'")
 .replace('controller.abort(), 3000','controller.abort(), checkTimeout')
 .replace('const latency = Date.now() - start;',"const marker=await response.json();\nconst latency = Date.now() - start;")
 .replace('ok: response.status === 200,',"ok: response.status === 200 && marker.ok===true && marker.service==='homepage-cdn' && marker.line===(new URL(url).hostname==='eo.724520.xyz'?'edgeone':'cloudflare'),")
 .replace('list.appendChild(li);',`li.tabIndex=0;li.setAttribute('role','link');li.style.cursor='pointer';const enter=()=>window.location.assign(testUrl+currentPath+currentParams+window.location.hash);li.addEventListener('click',enter);li.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();enter();}});\nlist.appendChild(li);`)
 .replace('subtitle.textContent = `即将跳转至: ${item.name}`;',"subtitle.textContent = autoJump ? `即将进入：${item.name}` : `已连接 ${item.name}，点击线路进入`;")
 .replace('setTimeout(() => {\n\t\t\t\t\t\twindow.location.href', 'if(autoJump) setTimeout(() => {\n\t\t\t\t\t\twindow.location.href')
 .replace('window.location.href = item.testUrl + currentPath + currentParams;', 'window.location.replace(item.testUrl + currentPath + currentParams + window.location.hash);')
 .replace('<ul class="url-list" id="urlList"></ul>','<ul class="url-list" id="urlList"></ul><noscript><p>请选择访问线路：'+routes.map((line,i)=>`<a href="${escape(line.split('#')[0]+url.pathname+url.search)}">${i+1}. ${line.split('#')[1]}</a>`).join(' · ')+'</p></noscript>');
 return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}};
