const root=document.documentElement;
try{root.dataset.theme=localStorage.getItem('fanxing-paper-theme-v2')==='dark'?'dark':'light'}catch{}
const theme=document.querySelector('#theme-toggle');
function updateThemeLabel(){theme.setAttribute('aria-label',root.dataset.theme==='dark'?'切换到浅色主题':'切换到深色主题')}
updateThemeLabel();theme.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('fanxing-paper-theme-v2',root.dataset.theme)}catch{}updateThemeLabel()});
document.querySelector('#year').textContent=new Date().getFullYear();
function text(selector,value){if(typeof value==='string')document.querySelector(selector).textContent=value}
function safeUrl(value){if(typeof value!=='string'||!value.trim())return null;try{const url=new URL(value,location.origin);return ['https:','http:'].includes(url.protocol)?url:null}catch{return null}}
function platformFor(host){if(host==='xingbox.me')return ['blog','FIELD NOTES'];if(host==='fanxing724.github.io')return ['personal','PERSONAL ORBIT'];if(host==='github.com')return ['github','GH'];if(host.endsWith('modelscope.cn'))return ['modelscope','MS'];if(host==='gitee.com')return ['gitee','G'];if(host==='cnb.cool')return ['cnb','CN'];if(host.endsWith('agentscope.io'))return ['agentscope','AS'];return ['website','↗']}
(async()=>{try{
 const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)throw Error('load');const {data}=await response.json();
 text('#profile-name',data.profileData?.statusTitle);text('#quote',typeof data.quoteData==='string'?data.quoteData:data.quoteData?.text);text('#place',data.locationData?.place);text('#work',data.locationData?.workStatus);
 if(data.web_info?.title)document.title=data.web_info.title;
 const avatar=safeUrl(data.imagesData?.find(i=>i.avatar)?.avatar);if(avatar)document.querySelector('#avatar').src=avatar.href;
 const tags=document.querySelector('.tags-section');tags.replaceChildren();for(const tag of data.tagsData||[]){const span=document.createElement('span');span.className='tag';span.textContent=tag;tags.append(span)}
 const sites=document.querySelector('#sites');sites.replaceChildren();
 for(const site of data.sitesData||[]){
  const url=safeUrl(site.url);if(!url)continue;const [platform,mark]=platformFor(url.hostname);const featured=['blog','personal'].includes(platform);
  const a=document.createElement('a');a.className='site-link'+(featured?' featured':'')+(platform==='personal'?' personal':'');a.dataset.platform=platform;a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
  const head=document.createElement('div');head.className='site-head';const icon=document.createElement('span');icon.className='site-icon';icon.textContent=mark;icon.setAttribute('aria-hidden','true');const arrow=document.createElement('span');arrow.className='site-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');head.append(icon,arrow);
  const info=document.createElement('div');info.className='site-info';const h=document.createElement('h3');h.textContent=site.name;const p=document.createElement('p');p.textContent=site.desc;info.append(h,p);
  const domain=document.createElement('span');domain.className='site-domain';domain.textContent=url.hostname.replace(/^www\./,'');
  a.append(head,info,domain);
  if(featured){const art=document.createElement('div');art.className='site-visual '+(platform==='blog'?'book':'orbits');art.setAttribute('aria-hidden','true');a.append(art)}
  sites.append(a);
 }
}catch{document.querySelector('#sites').replaceChildren();document.querySelector('#load-error').hidden=false}})();
