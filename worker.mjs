export default {async fetch(request, env) {
 const path=new URL(request.url).pathname;
 let response;
 try {
  if(['/manage','/login','/logout'].includes(path)||path.startsWith('/api/')) response=await handleRequest(request,env);
  else response=await env.ASSETS.fetch(request);
 } catch {return new Response('服务暂时不可用',{status:503});}
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(path==='/manage'||path==='/login'||path.startsWith('/api/'))headers.set('Cache-Control','no-store');
 headers.set('X-Frame-Options','DENY');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
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

  // IP获取API
  if (path === '/api/visitor-ip' && request.method === 'GET') {
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
      const locationParts = [country, region, city].filter(part => part && part !== '未知');
      const location = locationParts.length > 0 ? locationParts.join(' ') : '未知位置';

      const response = {
        ip: displayIP,
        fullIP: clientIP,
        country: country,
        region: region,
        city: city,
        location: location,
        displayText: `${displayIP}<br>(${location} 的好友)`
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

// 登录页面
function getLoginPage(errorMessage = '') {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - Home管理</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="/static/fontawesome.css" rel="stylesheet">
    <link rel="shortcut icon" href="/static/star.svg">
    <style>
      .form-input {
        border: 1px solid #d1d5db;
        transition: border-color 0.2s ease;
      }
      .form-input:focus {
        outline: none;
        border-color: #6b7280;
        box-shadow: 0 0 0 1px #6b7280;
      }
      .btn {
        transition: all 0.2s ease;
      }
      .btn:hover {
        transform: translateY(-1px);
      }
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 350px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      .notification.show {
        transform: translateX(0);
      }
      .notification.error {
        background-color: #dc2626;
      }
    </style>
  </head>
  <body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <h2 class="text-2xl font-medium text-gray-900 mb-4">登录</h2>
      ${errorMessage ? `<p class="text-red-600 text-sm mb-4">${errorMessage}</p>` : ''}
      <form action="/login" method="POST">
        <div class="mb-4">
          <label class="block text-sm text-gray-600 mb-1">用户名</label>
          <input type="text" name="username" class="form-input w-full px-3 py-2 rounded" required>
        </div>
        <div class="mb-4">
          <label class="block text-sm text-gray-600 mb-1">密码</label>
          <input type="password" name="password" class="form-input w-full px-3 py-2 rounded" required>
        </div>
        <button type="submit" class="btn w-full px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded">
          <i class="fas fa-sign-in-alt mr-1"></i>登录
        </button>
      </form>
    </div>
  </body>
  </html>
  `;
}

// 管理页面
function getManagementPage() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home管理</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="/static/fontawesome.css" rel="stylesheet">
    <link rel="shortcut icon" href="/static/star.svg">
    <style>
      .tab-content { 
        display: none; 
      }
      .tab-content.active { 
        display: block; 
      }
      .tab-button.active { 
        background-color: #374151;
        color: white;
        border-color: #374151;
      }
      .tab-button {
        transition: all 0.2s ease;
      }
      .tab-button:hover {
        background-color: #f3f4f6;
        border-color: #d1d5db;
      }
      .tab-button.active:hover {
        background-color: #4b5563;
      }
      .form-input {
        border: 1px solid #d1d5db;
        transition: border-color 0.2s ease;
      }
      .form-input:focus {
        outline: none;
        border-color: #6b7280;
        box-shadow: 0 0 0 1px #6b7280;
      }
      .btn {
        transition: all 0.2s ease;
      }
      .btn:hover {
        transform: translateY(-1px);
      }
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 350px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      .notification.show {
        transform: translateX(0);
      }
      .notification.success { background-color: #059669; }
      .notification.error { background-color: #dc2626; }
      .notification.warning { background-color: #d97706; }
      .notification.info { background-color: #0891b2; }
    </style>
  </head>
  <body class="bg-gray-50 min-h-screen">
    <!-- 顶部导航 -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-4 py-3">
        <div class="flex justify-between items-center">
          <div class="flex items-center">
            <i class="fas fa-database text-gray-600 mr-2"></i>
            <h1 class="text-lg font-medium text-gray-900">Home管理</h1>
            <div class="ml-3 w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
          <div class="flex items-center space-x-2">
            <a href="/logout" class="btn px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm">
              <i class="fas fa-sign-out-alt mr-1"></i>登出
            </a>
          </div>
        </div>
      </div>
    </nav>
  
    <div class="max-w-6xl mx-auto p-4">
      <!-- 状态面板 -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="text-gray-500">状态:</span>
            <span id="dataStatus" class="ml-2 font-medium">等待加载</span>
          </div>
          <div>
            <span class="text-gray-500">最后更新:</span>
            <span id="lastUpdate" class="ml-2">--</span>
          </div>
          <div class="text-right">
            <button onclick="showPasswordModal()" class="btn px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm">
              <i class="fas fa-key mr-1"></i>修改密码
            </button>
          </div>
        </div>
      </div>
      
      <!-- 标签页 -->
      <div class="bg-white rounded-lg border border-gray-200 mb-4">
        <div class="border-b border-gray-200 p-4">
          <div class="flex flex-wrap gap-2">
            <button onclick="showTab('basic')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">基本信息</button>
            <button onclick="showTab('timeline')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">时间线</button>
            <button onclick="showTab('projects')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">项目</button>
            <button onclick="showTab('sites')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">站点</button>
            <button onclick="showTab('skills')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">技能</button>
            <button onclick="showTab('social')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">社交</button>
            <button onclick="showTab('tags')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">标签</button>
            <button onclick="showTab('images')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">图片</button>
            <button onclick="showTab('json')" class="tab-button px-3 py-1.5 border border-gray-300 rounded text-sm">JSON</button>
            <div class="ml-auto flex items-center gap-2">
              <label class="inline-flex items-center text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded cursor-pointer">
                <input type="checkbox" id="iceToggle" class="mr-2">
                开启夏日空调（ice）
              </label>
              <label class="inline-flex items-center text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded cursor-pointer">
                <input type="checkbox" id="themaToggle" class="mr-2">
                开启背景切换（thema）
              </label>
            </div>
          </div>

        </div>
  
        <!-- 基本信息 -->
        <div id="basic" class="tab-content p-4">
          <h3 class="font-medium text-gray-900 mb-4">基本信息</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">GitHub用户名</label>
              <input type="text" id="github" class="form-input w-full px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">网站标题</label>
              <input type="text" id="webTitle" class="form-input w-full px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">网站图标URL</label>
              <input type="text" id="webIcon" class="form-input w-full px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">状态标题</label>
              <input type="text" id="statusTitle" class="form-input w-full px-3 py-2 rounded" placeholder="Full Stack Developer">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">状态表情</label>
              <input type="text" id="statusEmoji" class="form-input w-full px-3 py-2 rounded" placeholder="😊">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">位置</label>
              <input type="text" id="locationPlace" class="form-input w-full px-3 py-2 rounded" placeholder="China-AnyWhere">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">工作状态</label>
              <input type="text" id="workStatus" class="form-input w-full px-3 py-2 rounded" placeholder="流浪">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">头像装饰表情（用逗号分隔）</label>
              <input type="text" id="avatarDecorations" class="form-input w-full px-3 py-2 rounded" placeholder="🦄,😊,🎯">
            </div>
            <div class="lg:col-span-2">
              <label class="block text-sm text-gray-600 mb-1">个人引言</label>
              <textarea id="quote" class="form-input w-full px-3 py-2 rounded h-20 resize-none"></textarea>
            </div>
          </div>
        </div>


        <!-- 时间线 -->
        <div id="timeline" class="tab-content p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-medium text-gray-900">时间线管理</h3>
            <button onclick="addTimelineItem()" class="btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-plus mr-1"></i>添加
            </button>
          </div>
          <div id="timelineList" class="space-y-3"></div>
        </div>
  
        <!-- 项目 -->
        <div id="projects" class="tab-content p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-medium text-gray-900">项目管理</h3>
            <button onclick="addProject()" class="btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-plus mr-1"></i>添加
            </button>
          </div>
          <div id="projectsList" class="space-y-3"></div>
        </div>
  
        <!-- 站点 -->
        <div id="sites" class="tab-content p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-medium text-gray-900">站点管理</h3>
            <button onclick="addSite()" class="btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-plus mr-1"></i>添加
            </button>
          </div>
          <div id="sitesList" class="space-y-3"></div>
        </div>
  
        <!-- 技能 -->
        <div id="skills" class="tab-content p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-medium text-gray-900">技能管理</h3>
            <button onclick="addSkill()" class="btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-plus mr-1"></i>添加
            </button>
          </div>
          <div id="skillsList" class="space-y-3"></div>
        </div>
  
        <!-- 社交 -->
        <div id="social" class="tab-content p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-medium text-gray-900">社交链接</h3>
            <button onclick="addSocial()" class="btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-plus mr-1"></i>添加
            </button>
          </div>
          <div id="socialList" class="space-y-3"></div>
        </div>
  
        <!-- 标签 -->
        <div id="tags" class="tab-content p-4">
          <h3 class="font-medium text-gray-900 mb-4">标签管理</h3>
          <div class="flex gap-2 mb-4">
            <input type="text" id="newTag" placeholder="输入标签名称" class="form-input flex-1 px-3 py-2 rounded">
            <button onclick="addTag()" class="btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">添加</button>
          </div>
          <div id="tagsList" class="flex flex-wrap gap-2"></div>
        </div>
  
        <!-- 图片 -->
        <div id="images" class="tab-content p-4">
          <h3 class="font-medium text-gray-900 mb-4">图片设置</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">头像URL</label>
              <input type="text" id="avatar" class="form-input w-full px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">背景图片URL</label>
              <input type="text" id="bgImage" class="form-input w-full px-3 py-2 rounded">
            </div>
          </div>
        </div>
  
        <!-- JSON编辑 -->
        <div id="json" class="tab-content p-4">
          <h3 class="font-medium text-gray-900 mb-4">JSON编辑器</h3>
          <div class="mb-4">
            <textarea id="dataInput" class="form-input w-full h-80 px-3 py-2 rounded font-mono text-sm resize-none" placeholder="JSON数据将显示在这里..."></textarea>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="loadJsonData()" class="btn px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm">
              <i class="fas fa-download mr-1"></i>加载数据
            </button>
            <button onclick="saveJsonData()" class="btn px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
              <i class="fas fa-save mr-1"></i>保存数据
            </button>
            <button onclick="exportToJson()" class="btn px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm">
              <i class="fas fa-export mr-1"></i>导出表单
            </button>
          </div>
        </div>
      </div>
  
      <!-- 操作按钮 -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <div class="flex flex-col sm:flex-row gap-2 justify-center">
          <button onclick="loadAllData()" class="btn px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded">
            <i class="fas fa-sync mr-1"></i>重新加载
          </button>
          <button onclick="saveAllData()" class="btn px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded">
            <i class="fas fa-save mr-1"></i>保存所有更改
          </button>
        </div>
      </div>
    </div>
  
    <!-- 密码修改模态框 -->
    <div id="passwordModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-medium text-gray-900">修改登录信息</h3>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <label class="block text-sm text-gray-600 mb-1">新用户名</label>
            <input type="text" id="newUsername" class="form-input w-full px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">新密码</label>
            <input type="password" id="newPassword" class="form-input w-full px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">确认密码</label>
            <input type="password" id="confirmPassword" class="form-input w-full px-3 py-2 rounded">
          </div>
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            注意：修改后需要重新登录，密码长度不少于12位
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex gap-2">
          <button onclick="hidePasswordModal()" class="flex-1 btn px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded">取消</button>
          <button onclick="changePassword()" class="flex-1 btn px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded">确认</button>
        </div>
      </div>
    </div>
  
  <script>
    let currentData = { data: {} };
  
    // 标签页切换
    function showTab(tabName, evt = null) {
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      document.getElementById(tabName).classList.add('active');
      if (evt) {
        evt.target.classList.add('active');
      } else {
        const button = document.querySelector(\`.tab-button[onclick="showTab('\${tabName}')"]\`);
        if (button) button.classList.add('active');
      }
    }
  
    // 加载数据
    async function loadAllData() {
      const statusEl = document.getElementById('dataStatus');
      const lastUpdateEl = document.getElementById('lastUpdate');
      
      statusEl.textContent = '加载中...';
      statusEl.className = 'ml-2 font-medium text-orange-600';
      
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        currentData = data;
        populateFields(data.data);
        
        statusEl.textContent = '数据已加载';
        statusEl.className = 'ml-2 font-medium text-green-600';
        
        // 显示从KV获取的最后更新时间
        if (data.last_time) {
          const lastTime = new Date(data.last_time);
          lastUpdateEl.textContent = lastTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } else {
          lastUpdateEl.textContent = '从未更新';
        }
        
        showTab('basic');
        showNotification('数据加载成功', 'success');
      } catch (error) {
        statusEl.textContent = '加载失败';
        statusEl.className = 'ml-2 font-medium text-red-600';
        showNotification('加载失败: ' + error.message, 'error');
      }
    }
  
        // 填充表单
    function populateFields(data) {
      document.getElementById('github').value = data.github || '';
      document.getElementById('webTitle').value = data.web_info?.title || '';
            document.getElementById('webIcon').value = data.web_info?.icon || '';
      document.getElementById('quote').value = data.quoteData || '';

      // 布尔开关
      document.getElementById('iceToggle').checked = !!data.ice;
      document.getElementById('themaToggle').checked = !!data.thema;
      
      // 填充个人信息
      document.getElementById('statusTitle').value = data.profileData?.statusTitle || '';
      document.getElementById('statusEmoji').value = data.profileData?.statusEmoji || '';
      document.getElementById('locationPlace').value = data.locationData?.place || '';
      document.getElementById('workStatus').value = data.locationData?.workStatus || '';
      
      // 填充头像装饰
      if (data.profileData?.avatarDecorations && Array.isArray(data.profileData.avatarDecorations)) {
        document.getElementById('avatarDecorations').value = data.profileData.avatarDecorations.join(',');
      }

      const avatar = data.imagesData?.find(img => img.avatar);
      const bgImage = data.imagesData?.find(img => img.bg_image);
      document.getElementById('avatar').value = avatar?.avatar || '';
      document.getElementById('bgImage').value = bgImage?.bg_image || '';

      renderTimeline(data.timelineData || []);
      renderProjects(data.projectsData || []);
      renderSites(data.sitesData || []);
      renderSkills(data.skillsData || []);
      renderSocial(data.socialData || []);
      renderTags(data.tagsData || []);
    }
  
    // 渲染时间线
    function renderTimeline(timeline) {
      const container = document.getElementById('timelineList');
      container.innerHTML = '';
      timeline.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 border border-gray-200 rounded p-3';
                 div.innerHTML = \`
           <div class="flex flex-wrap gap-2">
             <input type="text" value="\${item.title}" onchange="updateTimelineTitle(\${index}, this.value)" 
                    placeholder="事件标题" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <input type="date" value="\${item.date}" onchange="updateTimelineDate(\${index}, this.value)" 
                    class="form-input w-auto px-2 py-1 rounded text-sm">
             <button onclick="removeTimelineItem(\${index})" 
                     class="btn px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs whitespace-nowrap">
               <i class="fas fa-trash mr-1"></i>删除
             </button>
           </div>
         \`;
        container.appendChild(div);
      });
    }
  
    // 渲染项目
    function renderProjects(projects) {
      const container = document.getElementById('projectsList');
      container.innerHTML = '';
      projects.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 border border-gray-200 rounded p-3';
                 div.innerHTML = \`
           <div class="flex flex-wrap gap-2 mb-2">
             <input type="text" value="\${item.name}" onchange="updateProjectName(\${index}, this.value)" 
                    placeholder="项目名称" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <input type="text" value="\${item.url}" onchange="updateProjectUrl(\${index}, this.value)" 
                    placeholder="项目链接" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <input type="text" value="\${item.icon}" onchange="updateProjectIcon(\${index}, this.value)" 
                    placeholder="图标" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <button onclick="removeProject(\${index})" 
                     class="btn px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs whitespace-nowrap">
               <i class="fas fa-trash mr-1"></i>删除
             </button>
           </div>
           <textarea onchange="updateProjectDesc(\${index}, this.value)" 
                     placeholder="项目描述" class="form-input w-full px-2 py-1 rounded text-sm h-16 resize-none">\${item.desc}</textarea>
         \`;
        container.appendChild(div);
      });
    }
  
    // 渲染站点
    function renderSites(sites) {
      const container = document.getElementById('sitesList');
      container.innerHTML = '';
      sites.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 border border-gray-200 rounded p-3';
                 div.innerHTML = \`
           <div class="flex flex-wrap gap-2 mb-2">
             <input type="text" value="\${item.name}" onchange="updateSiteName(\${index}, this.value)" 
                    placeholder="站点名称" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <input type="text" value="\${item.url}" onchange="updateSiteUrl(\${index}, this.value)" 
                    placeholder="站点链接" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <input type="text" value="\${item.icon}" onchange="updateSiteIcon(\${index}, this.value)" 
                    placeholder="图标" class="form-input flex-1 min-w-0 px-2 py-1 rounded text-sm">
             <button onclick="removeSite(\${index})" 
                     class="btn px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs whitespace-nowrap">
               <i class="fas fa-trash mr-1"></i>删除
             </button>
           </div>
           <textarea onchange="updateSiteDesc(\${index}, this.value)" 
                     placeholder="站点描述" class="form-input w-full px-2 py-1 rounded text-sm h-16 resize-none">\${item.desc}</textarea>
         \`;
        container.appendChild(div);
      });
    }
  
    // 渲染技能
    function renderSkills(skills) {
      const container = document.getElementById('skillsList');
      container.innerHTML = '';
      skills.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 border border-gray-200 rounded p-3';
        div.innerHTML = \`
          <div class="flex gap-3">
            <input type="text" value="\${item.name}" onchange="updateSkillName(\${index}, this.value)" 
                   placeholder="技能名称" class="form-input flex-1 px-2 py-1 rounded text-sm">
            <input type="text" value="\${item.icon}" onchange="updateSkillIcon(\${index}, this.value)" 
                   placeholder="图标" class="form-input flex-1 px-2 py-1 rounded text-sm">
            <button onclick="removeSkill(\${index})" 
                    class="btn px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        \`;
        container.appendChild(div);
      });
    }
  
    // 渲染社交
    function renderSocial(social) {
      const container = document.getElementById('socialList');
      container.innerHTML = '';
      social.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 border border-gray-200 rounded p-3';
        div.innerHTML = \`
          <div class="flex gap-3">
            <input type="text" value="\${item.url}" onchange="updateSocialUrl(\${index}, this.value)" 
                   placeholder="链接地址" class="form-input flex-1 px-2 py-1 rounded text-sm">
            <input type="text" value="\${item.ico}" onchange="updateSocialIcon(\${index}, this.value)" 
                   placeholder="图标类名" class="form-input flex-1 px-2 py-1 rounded text-sm">
            <button onclick="removeSocial(\${index})" 
                    class="btn px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        \`;
        container.appendChild(div);
      });
    }
  
    // 渲染标签
    function renderTags(tags) {
      const container = document.getElementById('tagsList');
      container.innerHTML = '';
      if (tags.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">暂无标签</p>';
        return;
      }
      tags.forEach((tag, index) => {
        const span = document.createElement('span');
        span.className = 'inline-flex items-center bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm';
        span.innerHTML = \`
          \${tag}
          <button onclick="removeTag(\${index})" class="ml-1 text-red-500 hover:text-red-700">
            <i class="fas fa-times text-xs"></i>
          </button>
        \`;
        container.appendChild(span);
      });
    }
  
    // 添加函数
    function addTimelineItem() {
      if (!currentData.data.timelineData) currentData.data.timelineData = [];
      currentData.data.timelineData.push({ title: '新时间线', date: new Date().toISOString().split('T')[0] });
      renderTimeline(currentData.data.timelineData);
    }
  
    function addProject() {
      if (!currentData.data.projectsData) currentData.data.projectsData = [];
      currentData.data.projectsData.push({ name: '新项目', url: '', desc: '', icon: '' });
      renderProjects(currentData.data.projectsData);
    }
  
    function addSite() {
      if (!currentData.data.sitesData) currentData.data.sitesData = [];
      currentData.data.sitesData.push({ name: '新站点', url: '', desc: '', icon: '' });
      renderSites(currentData.data.sitesData);
    }
  
    function addSkill() {
      if (!currentData.data.skillsData) currentData.data.skillsData = [];
      currentData.data.skillsData.push({ name: '新技能', icon: '' });
      renderSkills(currentData.data.skillsData);
    }
  
    function addSocial() {
      if (!currentData.data.socialData) currentData.data.socialData = [];
      currentData.data.socialData.push({ url: '', ico: '' });
      renderSocial(currentData.data.socialData);
    }
  
    function addTag() {
      const input = document.getElementById('newTag');
      const tag = input.value.trim();
      if (tag) {
        if (!currentData.data.tagsData) currentData.data.tagsData = [];
        currentData.data.tagsData.push(tag);
        input.value = '';
        renderTags(currentData.data.tagsData);
      }
    }
  
    // 更新函数
    function updateTimelineTitle(index, value) {
      currentData.data.timelineData[index].title = value;
    }
    function updateTimelineDate(index, value) {
      currentData.data.timelineData[index].date = value;
    }
    function updateProjectName(index, value) {
      currentData.data.projectsData[index].name = value;
    }
    function updateProjectUrl(index, value) {
      currentData.data.projectsData[index].url = value;
    }
    function updateProjectIcon(index, value) {
      currentData.data.projectsData[index].icon = value;
    }
    function updateProjectDesc(index, value) {
      currentData.data.projectsData[index].desc = value;
    }
    function updateSiteName(index, value) {
      currentData.data.sitesData[index].name = value;
    }
    function updateSiteUrl(index, value) {
      currentData.data.sitesData[index].url = value;
    }
    function updateSiteIcon(index, value) {
      currentData.data.sitesData[index].icon = value;
    }
    function updateSiteDesc(index, value) {
      currentData.data.sitesData[index].desc = value;
    }
    function updateSkillName(index, value) {
      currentData.data.skillsData[index].name = value;
    }
    function updateSkillIcon(index, value) {
      currentData.data.skillsData[index].icon = value;
    }
    function updateSocialUrl(index, value) {
      currentData.data.socialData[index].url = value;
    }
    function updateSocialIcon(index, value) {
      currentData.data.socialData[index].ico = value;
    }
  
    // 删除函数
    function removeTimelineItem(index) {
      currentData.data.timelineData.splice(index, 1);
      renderTimeline(currentData.data.timelineData);
    }
    function removeProject(index) {
      currentData.data.projectsData.splice(index, 1);
      renderProjects(currentData.data.projectsData);
    }
    function removeSite(index) {
      currentData.data.sitesData.splice(index, 1);
      renderSites(currentData.data.sitesData);
    }
    function removeSkill(index) {
      currentData.data.skillsData.splice(index, 1);
      renderSkills(currentData.data.skillsData);
    }
    function removeSocial(index) {
      currentData.data.socialData.splice(index, 1);
      renderSocial(currentData.data.socialData);
    }
    function removeTag(index) {
      currentData.data.tagsData.splice(index, 1);
      renderTags(currentData.data.tagsData);
    }
  
        // 收集表单数据
    function collectFormData() {
      currentData.data.github = document.getElementById('github').value;
      currentData.data.web_info = {
        title: document.getElementById('webTitle').value,
        icon: document.getElementById('webIcon').value
      };
      currentData.data.quoteData = document.getElementById('quote').value;

      // 收集开关
      currentData.data.ice = !!document.getElementById('iceToggle').checked;
      currentData.data.thema = !!document.getElementById('themaToggle').checked;

      // 收集个人信息数据
      currentData.data.profileData = {
        statusTitle: document.getElementById('statusTitle').value,
        statusEmoji: document.getElementById('statusEmoji').value,
        avatarDecorations: document.getElementById('avatarDecorations').value.split(',').map(s => s.trim()).filter(s => s)
      };

      // 收集位置信息数据
      currentData.data.locationData = {
        place: document.getElementById('locationPlace').value,
        workStatus: document.getElementById('workStatus').value
      };

      const avatar = document.getElementById('avatar').value;
      const bgImage = document.getElementById('bgImage').value;
      currentData.data.imagesData = [];
      if (avatar) currentData.data.imagesData.push({ avatar });
      if (bgImage) currentData.data.imagesData.push({ bg_image: bgImage });
    }
  
    // 保存数据
    async function saveAllData() {
      const statusEl = document.getElementById('dataStatus');
      const lastUpdateEl = document.getElementById('lastUpdate');
      
      statusEl.textContent = '保存中...';
      statusEl.className = 'ml-2 font-medium text-orange-600';
      
      try {
        collectFormData();
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentData)
        });
        const result = await response.json();
        
        statusEl.textContent = '保存成功';
        statusEl.className = 'ml-2 font-medium text-green-600';
        
        // 使用服务器返回的更新时间
        if (result.last_time) {
          const lastTime = new Date(result.last_time);
          lastUpdateEl.textContent = lastTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          // 更新本地数据的时间戳
          currentData.last_time = result.last_time;
        } else {
          lastUpdateEl.textContent = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
        
        showNotification('保存成功', 'success');
      } catch (error) {
        statusEl.textContent = '保存失败';
        statusEl.className = 'ml-2 font-medium text-red-600';
        showNotification('保存失败: ' + error.message, 'error');
      }
    }
  
    // JSON 编辑功能
    async function loadJsonData() {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        document.getElementById('dataInput').value = JSON.stringify(data, null, 2);
        showNotification('JSON数据加载成功', 'success');
      } catch (error) {
        showNotification('加载JSON失败: ' + error.message, 'error');
      }
    }
    
    async function saveJsonData() {
      try {
        const jsonText = document.getElementById('dataInput').value;
        if (!jsonText.trim()) {
          showNotification('请输入JSON数据', 'warning');
          return;
        }
        
        const data = JSON.parse(jsonText);
        const response = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        
        showNotification('JSON保存成功', 'success');
        currentData = data;
        populateFields(data.data);
        
        const statusEl = document.getElementById('dataStatus');
        const lastUpdateEl = document.getElementById('lastUpdate');
        statusEl.textContent = '数据已更新';
        statusEl.className = 'ml-2 font-medium text-green-600';
        
        // 使用服务器返回的更新时间
        if (result.last_time) {
          const lastTime = new Date(result.last_time);
          lastUpdateEl.textContent = lastTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          // 更新本地数据的时间戳
          currentData.last_time = result.last_time;
        } else {
          lastUpdateEl.textContent = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
        
      } catch (error) {
        if (error instanceof SyntaxError) {
          showNotification('JSON格式错误', 'error');
        } else {
          showNotification('保存失败: ' + error.message, 'error');
        }
      }
    }
  
    function exportToJson() {
      collectFormData();
      document.getElementById('dataInput').value = JSON.stringify(currentData, null, 2);
      showNotification('已导出到JSON编辑器', 'success');
    }
    
    // 密码修改
    function showPasswordModal() {
      document.getElementById('passwordModal').style.display = 'flex';
    }
    
    function hidePasswordModal() {
      document.getElementById('passwordModal').style.display = 'none';
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    }
    
    async function changePassword() {
      const newUsername = document.getElementById('newUsername').value.trim();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (!newUsername || !newPassword) {
        showNotification('用户名和密码不能为空', 'warning');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showNotification('两次输入的密码不一致', 'warning');
        return;
      }
      
      if (newPassword.length < 12) {
        showNotification('密码长度不能少于6位', 'warning');
        return;
      }
      
      try {
        const response = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: newUsername,
            password: newPassword
          })
        });
        
        const result = await response.json();
        if (response.ok) {
          showNotification('密码修改成功，3秒后跳转到登录页面', 'success');
          setTimeout(() => {
            window.location.href = '/logout';
          }, 3000);
        } else {
          showNotification(result.error || '修改失败', 'error');
        }
      } catch (error) {
        showNotification('修改失败: ' + error.message, 'error');
      }
    }
  
    // 通知系统
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = \`notification \${type}\`;
      notification.innerHTML = \`
        <div class="flex items-center justify-between">
          <span>\${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-3 hover:opacity-75">
            <i class="fas fa-times"></i>
          </button>
        </div>
      \`;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);
      
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }, 3000);
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveAllData();
      }
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        loadAllData();
      }
    });
  
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
      loadAllData();
    });
  </script>
  </body>
  </html>
  `;
}
