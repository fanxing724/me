import {DEFAULT_SETTINGS} from '../public/static/settings-schema.mjs';
export {HomepageSettings} from './settings-store.mjs';
import {adminPage,loginPage} from '../admin/pages.mjs';
const PUBLIC_ORIGINS=new Set(['https://cf.724520.xyz','https://eo.724520.xyz']);
const STATIC=new Set(['/static/admin.js','/static/admin-custom.js','/static/admin-custom.css','/static/settings-schema.mjs','/static/admin.css','/static/admin-theme.css','/static/star.svg','/assets/avatar-fast.webp']);
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 let response;
 const publicData=['/api/data','/api/settings','/api/music'].includes(path)&&['GET','HEAD'].includes(request.method);
 const publicCounter=path==='/api/pageviews';
 const origin=request.headers.get('Origin');
 try{
  if(request.method==='OPTIONS'){
   if((publicData||['/api/data','/api/settings','/api/music'].includes(path)||publicCounter)&&PUBLIC_ORIGINS.has(origin))return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':publicCounter?'GET, HEAD, POST':'GET, HEAD','Vary':'Origin','Cache-Control':'no-store'}});
   return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
  }
  if(path==='/')response=new Response(null,{status:302,headers:{Location:'/manage'}});
  else if(STATIC.has(path)&&['GET','HEAD'].includes(request.method))response=await env.ASSETS.fetch(request);
  else if(['/api/settings','/api/settings/history','/api/music'].includes(path))response=await settingsAPI(request,env);
  else if(publicCounter)response=await publicPageviews(request,env);
  else if(['/manage','/login','/logout','/api/data','/api/change-password'].includes(path)){
   if(!['GET','HEAD','POST'].includes(request.method))response=new Response(null,{status:405});
   else if(request.method==='POST'&&(origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))response=Response.json({error:'Forbidden'},{status:403});
   else if(path==='/login'&&['GET','HEAD'].includes(request.method))response=new Response(null,{status:302,headers:{Location:'/manage'}});
   else response=await handleRequest(request.method==='HEAD'?new Request(request.url,{method:'GET',headers:request.headers}):request,env);
  }else response=new Response('Not found',{status:404});
 }catch{response=Response.json({error:'Service unavailable'},{status:503});}
 const headers=new Headers(response.headers);
 for(const key of [...headers.keys()])if(key.toLowerCase().startsWith('access-control-'))headers.delete(key);
 if((publicData||publicCounter)&&PUBLIC_ORIGINS.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
 headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(path==='/logout')headers.set('Set-Cookie','auth_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}};
async function publicPageviews(request,env){
 if(!['GET','HEAD','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD, POST'}});
 if(request.method==='POST'&&!PUBLIC_ORIGINS.has(request.headers.get('Origin')))return Response.json({error:'Forbidden'},{status:403});
 if(!env.PAGE_VIEWS)return Response.json({error:'Counter unavailable'},{status:503});
 const counter=env.PAGE_VIEWS.get(env.PAGE_VIEWS.idFromName('homepage'));
 return counter.fetch(new Request('https://counter/',{method:request.method==='POST'?'POST':'GET'}));
}
async function hashPassword(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');}
async function passwordCredentials(username,password){const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');return {username,salt,hash:await hashPassword(password,salt)};}
async function handleRequest(request, env) {
  const url = new URL(request.url)
  const path = url.pathname


  // 获取KV命名空间
  const kv = env.MY_HOME_KV // 需在Workers dashboard中绑定
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV namespace not bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 检查登录状态（除了登录页面和API接口）
  if (path === '/manage' && !(await checkAuth(request, kv))) {
    return new Response(getLoginPage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // 处理登录请求
  if (path === '/login' && request.method === 'POST') {
    return await handleLogin(request, kv)
  }

  // 处理登出请求
  if (path === '/logout') {
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/manage',
        'Set-Cookie': 'auth_token=; Path=/; Max-Age=0'
      }
    })
  }

  if (path === '/api/data' && request.method === 'GET') {
    try {
      // 从KV获取数据
      const data = await kv.get('portfolio_data', { type: 'json' })
      if (!data) {
        // 返回默认的空数据结构
        const defaultData = {
          data: {
            github: '',
            web_info: {},
            quoteData: '',
            timelineData: [],
            projectsData: [],
            sitesData: [],
            skillsData: [],
            socialData: [],
            tagsData: [],
            imagesData: [],
            profileData: {},
            locationData: {},
            ice: false,
            thema: false
          },
          last_time: null
        }
        return new Response(JSON.stringify(defaultData), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  if (path === '/api/data' && request.method === 'POST') {
    // 检查是否已登录
    if (!(await checkAuth(request, kv))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    try {
      const newData = await request.json()
      // 验证数据格式
      if (!newData.data || typeof newData.data !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid data format: data must be an object' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      // 设置默认字段
      const requiredFields = ['github', 'web_info', 'quoteData', 'timelineData', 'projectsData', 'sitesData', 'skillsData', 'socialData', 'tagsData', 'imagesData', 'profileData', 'locationData', 'ice', 'thema'];
      for (const field of requiredFields) {
        if (!(field in newData.data)) {
          if (field.endsWith('Data')) {
            newData.data[field] = [];
          } else if (field === 'web_info' || field === 'profileData' || field === 'locationData') {
            newData.data[field] = {};
          } else if (field === 'ice' || field === 'thema') {
            newData.data[field] = false;
          } else {
            newData.data[field] = '';
          }
        }
      }
      // 添加最后更新时间
      newData.last_time = new Date().toISOString()

      // 存储到KV
      await kv.put('portfolio_data', JSON.stringify(newData))
      return new Response(JSON.stringify({
        message: 'Data updated successfully',
        last_time: newData.last_time
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  // 密码修改API
  if (path === '/api/change-password' && request.method === 'POST') {
    // 检查是否已登录
    if (!(await checkAuth(request, kv))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    try {
      const { username, password } = await request.json()
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      // 更新管理员凭证
      if (typeof password !== 'string' || password.length < 12) return Response.json({error:'密码至少需要12位'}, {status:400});
      const newCreds = await passwordCredentials(username, password)
      await kv.put('admin_credentials', JSON.stringify(newCreds))
      await kv.put('secret_key', crypto.randomUUID() + crypto.randomUUID())

      return new Response(JSON.stringify({ message: 'Password updated successfully' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  // 管理页面
  if (path === '/manage') {
    return new Response(getManagementPage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response('Not found', { status: 404 })
}

// 检查认证状态
async function checkAuth(request, kv) {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return false

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const trimmed = cookie.trim()
      const index = trimmed.indexOf('=')
      if(index > 0){
        return [trimmed.substring(0, index), trimmed.substring(index + 1)]
      }
      return ['', '']
    })
  )

  const authToken = cookies.auth_token
  if (!authToken) return false

  try {
    return await verifyToken(authToken, kv)
  } catch {
    return false
  }
}

// 生成带签名的token
async function generateToken(username, kv) {
  let secretKey = await kv.get('secret_key')
  if (!secretKey) {
    secretKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    await kv.put('secret_key', secretKey)
  }

  const payload = {
    username: username,
    timestamp: Date.now(),
    salt: Math.random().toString(36).substring(2)
  }

  const payloadStr = JSON.stringify(payload)
  const payloadBase64 = btoa(payloadStr)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadBase64)
  )

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return `${payloadBase64}.${signatureBase64}`
}

async function verifyToken(token, kv) {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payloadBase64, signatureBase64] = parts

  const secretKey = await kv.get('secret_key')
  if (!secretKey) return false

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0))

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(payloadBase64)
    )

    if (!isValid) return false
    const payload = JSON.parse(atob(payloadBase64))
    const now = Date.now()
    return (now - payload.timestamp) < 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// 处理登录
async function handleLogin(request, kv) {
  try {
    const formData = await request.formData()
    const username = formData.get('username')
    const password = formData.get('password')

    let adminCreds = await kv.get('admin_credentials', { type: 'json' })
    if (!adminCreds?.hash || !adminCreds?.salt) return new Response('管理员尚未初始化',{status:503});
    if (typeof username === 'string' && typeof password === 'string' && username === adminCreds.username && await hashPassword(password,adminCreds.salt) === adminCreds.hash) {
      const token = await generateToken(username, kv)

      return new Response('', {
        status: 302,
        headers: {
          'Location': '/manage',
          'Set-Cookie': `auth_token=${token}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`
        }
      })
    } else {
      return new Response(getLoginPage('用户名或密码错误'), {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    }
  } catch (error) {
    return new Response(getLoginPage('登录失败，请重试'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// The management HTML remains behind the existing /manage authentication gate.
function getLoginPage(errorMessage = '') {
 const message=String(errorMessage).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return loginPage.replace('<!--LOGIN_ERROR-->', message ? '<p class="login-error" role="alert">'+message+'</p>' : '');
}
function getManagementPage() { return adminPage; }


async function settingsAPI(request,env){
 const url=new URL(request.url),history=url.pathname==='/api/settings/history',write=request.method==='POST';
 if(!['GET','HEAD',...(url.pathname==='/api/settings'?['POST']:[])].includes(request.method))return new Response(null,{status:405});
 if(write&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))return Response.json({error:'Forbidden'},{status:403});
 if((history||write)&&!(await checkAuth(request,env.MY_HOME_KV)))return Response.json({error:'Unauthorized'},{status:401});
 if(write){const length=Number(request.headers.get('Content-Length')||0);if(length>262144)return new Response(null,{status:413});}
 if(!env.SITE_SETTINGS)return Response.json({error:'Settings unavailable'},{status:503});
 const target=env.SITE_SETTINGS.get(env.SITE_SETTINGS.idFromName('homepage-settings'));
 let body;
 if(write){body=await request.text();if(new TextEncoder().encode(body).length>262144)return new Response(null,{status:413});try{JSON.parse(body);}catch{return Response.json({error:'无效的 JSON 设置'},{status:400});}}
 const response=await target.fetch(new Request('https://settings/'+(history?'history'+url.search:'state'),{method:write?'POST':'GET',...(write?{body,headers:{'Content-Type':'application/json'}}:{})}));
 if(url.pathname==='/api/music'&&response.ok){const config=await response.json(),music=config.settings.music;return Response.json({...music,...(music.source==='tracks'?{meting:null}:{}),version:config.version});}
 return response;
}
