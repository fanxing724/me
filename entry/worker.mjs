export default {fetch(request){
 const url=new URL(request.url);const headers={'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(['/manage','/login','/logout'].includes(url.pathname))return new Response(null,{status:302,headers:{...headers,Location:'https://admin.724520.xyz/manage'}});
 if(url.pathname!=='/')return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});
 return new Response(null,{status:302,headers:{...headers,Location:'https://cdn.724520.xyz/'+url.search}});
}};
