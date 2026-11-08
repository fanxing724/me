import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {HomepageSettings} from '../backend/settings-store.mjs';
import admin from '../backend/worker.mjs';
import frontend from '../worker.mjs';
import gateway from '../gateway/worker.mjs';
import upstream from '../gateway/vendor/Blog-CDN-Gateway.mjs';
import entry from '../entry/worker.mjs';
import {DEFAULT_SETTINGS,normalizeSettings} from '../public/static/settings-schema.mjs';
function store(){
 const db=new DatabaseSync(':memory:');
 const ctx={storage:{sql:{exec(sql,...args){const stmt=db.prepare(sql);const rows=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);return{toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
 return{db,service:new HomepageSettings(ctx)};
}
test('settings reject invalid URLs, hidden all-lines state and malformed lists',()=>{
 assert.equal(normalizeSettings(DEFAULT_SETTINGS).errors.length,0);
 const value=structuredClone(DEFAULT_SETTINGS);value.cdn.edgeoneEnabled=false;value.cdn.cloudflareEnabled=false;value.footer.sourceURL='javascript:alert(1)';value.layout.order=['sites'];assert.ok(normalizeSettings(value).errors.length>=3);
});
test('settings CAS rejects stale writers and preserves last 12 revisions',async()=>{
 const{db,service}=store();try{
  const get=async()=>await(await service.fetch(new Request('https://settings/state'))).json();
  const save=(state,version)=>service.fetch(new Request('https://settings/state',{method:'POST',body:JSON.stringify({settings:state,expectedVersion:version})}));
  let before=await get();assert.equal(before.version,'initial');const next=structuredClone(before.settings);next.music.title='Published';assert.equal((await save(next,before.version)).status,200);
  assert.equal((await save(DEFAULT_SETTINGS,'initial')).status,409);assert.equal((await get()).settings.music.title,'Published');
  before=await get();await save(before.settings,before.version);assert.equal((await get()).version,before.version,'no-op saves must not add revisions');
  for(let i=0;i<15;i++){before=await get();before.settings.footer.tagline='revision '+i;await save(before.settings,before.version);}
  const history=await(await service.fetch(new Request('https://settings/history'))).json();assert.equal(history.history.length,12);assert.equal((await get()).settings.footer.tagline,'revision 14');
 }finally{db.close();}
});
test('admin settings writes/history require login; public CORS stays explicit',async()=>{
 const env={MY_HOME_KV:{get:async()=>null},SITE_SETTINGS:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json({version:'initial',settings:DEFAULT_SETTINGS})})}};
 let response=await admin.fetch(new Request('https://admin.724520.xyz/api/settings',{method:'POST',headers:{Origin:'https://admin.724520.xyz'},body:'{}'}),env);assert.equal(response.status,401);
 response=await admin.fetch(new Request('https://admin.724520.xyz/api/settings/history'),env);assert.equal(response.status,401);
 response=await admin.fetch(new Request('https://admin.724520.xyz/api/settings',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'}),env);assert.equal(response.status,403);
 response=await admin.fetch(new Request('https://admin.724520.xyz/api/settings',{headers:{Origin:'https://eo.724520.xyz'}}),env);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://eo.724520.xyz');
 response=await admin.fetch(new Request('https://admin.724520.xyz/api/settings',{headers:{Origin:'https://other.example'}}),env);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('public frontend strips cookies and cannot write admin data',async()=>{
 let calls=0;const env={HOME_BACKEND:{fetch:async request=>{calls++;assert.equal(request.headers.get('Cookie'),null);return Response.json({data:{sitesData:[]}});}}};
 let response=await frontend.fetch(new Request('https://cf.724520.xyz/api/data',{headers:{Cookie:'private=fixture'}}),env);assert.equal(response.status,200);assert.equal(calls,1);
 response=await frontend.fetch(new Request('https://cf.724520.xyz/api/data',{method:'POST',body:'{}'}),env);assert.equal(response.status,405);assert.equal(calls,1);
 response=await frontend.fetch(new Request('https://cf.724520.xyz/manage'),env);assert.equal(response.headers.get('Location'),'https://admin.724520.xyz/manage');
});
test('health probes do not touch backend or counter',async()=>{
 const env={HOME_BACKEND:{fetch:()=>{throw Error('must not call backend');}},PAGE_VIEWS:{get:()=>{throw Error('must not touch counter');}}};
 const response=await frontend.fetch(new Request('https://cf.724520.xyz/cdn-check',{headers:{Origin:'https://cdn.724520.xyz'}}),env);assert.equal(response.status,200);assert.equal((await response.json()).line,'cloudflare');
});
test('gateway keeps upstream CSS and uses local background + embedded avatar',async()=>{
 const response=await gateway.fetch(new Request('https://cdn.724520.xyz/?manual=1'));const html=await response.text();const original=await(await upstream.fetch(new Request('https://example.com/'),{IMG:['/assets/cdn-background-v1.webp']})).text();
 assert.equal(html.match(/<style>([\s\S]*?)<\/style>/)[1],original.match(/<style>([\s\S]*?)<\/style>/)[1]);assert.ok(html.includes('data:image/webp;base64,'));assert.ok(html.includes('/assets/cdn-background-v1.webp'));assert.ok(html.includes('const autoJump=false'));assert.ok(html.includes("new URL('/cdn-check',url)"));
 const head=await gateway.fetch(new Request('https://cdn.724520.xyz/',{method:'HEAD'}));assert.equal(await head.text(),'');
});
test('entry redirects only navigation; query preserved and admin independent',async()=>{
 let response=entry.fetch(new Request('https://724520.xyz/?from=test'));assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'https://cdn.724520.xyz/?from=test');assert.equal(response.headers.get('Cache-Control'),'no-store');
 response=entry.fetch(new Request('https://724520.xyz/manage'));assert.equal(response.headers.get('Location'),'https://admin.724520.xyz/manage');
 assert.equal(entry.fetch(new Request('https://724520.xyz/api/data')).status,404);assert.equal(entry.fetch(new Request('https://724520.xyz/',{method:'POST'})).status,405);
});
test('published templates have no account IDs or real KV bindings',()=>{
 for(const file of ['wrangler.jsonc','wrangler.backend.jsonc','wrangler.gateway.jsonc','wrangler.entry.jsonc']){const config=JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));assert.equal(config.account_id,undefined);for(const binding of config.kv_namespaces||[])assert.match(binding.id,/^0+$/);}
});
