import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {upstreamJSON} from '../edge-functions/_lib/common.js';
import {onRequest as counter} from '../edge-functions/api/pageviews.js';
import {DEFAULT_SETTINGS} from '../public/static/settings-schema.mjs';
test('EO upstream calls work without AbortSignal.timeout and report HTTP rejection safely',async()=>{
 const fetchBefore=globalThis.fetch,timeoutBefore=AbortSignal.timeout;
 try{
  AbortSignal.timeout=undefined;let options;
  globalThis.fetch=async(url,init)=>{options=init;assert.equal(url,'https://admin.724520.xyz/api/pageviews');return Response.json({total:10});};
  const response=await counter({request:new Request('https://eo.724520.xyz/api/pageviews')});assert.equal(response.status,200);assert.equal((await response.json()).total,10);assert.equal(options.redirect,'manual');assert.equal(options.method,'GET');
  globalThis.fetch=async()=>new Response('challenge',{status:403});const failed=await counter({request:new Request('https://eo.724520.xyz/api/pageviews')});assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'Counter unavailable',code:'UPSTREAM_HTTP',upstreamStatus:403});
 }finally{globalThis.fetch=fetchBefore;AbortSignal.timeout=timeoutBefore;}
});
test('EO settings snapshot triggers a read-only browser request to the public backend',async()=>{
 const calls=[],snapshot={version:'snapshot',settings:DEFAULT_SETTINGS},live={version:'latest',settings:DEFAULT_SETTINGS};
 const context=vm.createContext({window:{},location:{origin:'https://eo.724520.xyz'},document:{readyState:'loading',addEventListener(){},getElementById:()=>({textContent:JSON.stringify(snapshot)})},AbortSignal,URL,console,fetch:async(url,options)=>{calls.push({url,options});return url==='/api/settings'?Response.json(snapshot,{headers:{'X-Homepage-Settings':'snapshot'}}):Response.json(live);}});
 vm.runInContext(readFileSync(new URL('../public/static/site-custom.js',import.meta.url),'utf8'),context);await context.window.homepageSettingsReady;assert.equal(context.window.homepageSettingsVersion,'latest');assert.equal(calls.length,2);assert.equal(calls[1].url,'https://admin.724520.xyz/api/settings');assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.credentials,'omit');
});
async function runCounter(fail){const calls=[],target={textContent:''};const context=vm.createContext({window:{homepageSettingsReady:Promise.resolve({modules:{pageviews:true,footer:true}})},location:{origin:'https://eo.724520.xyz'},document:{getElementById:()=>target,prerendering:false},AbortSignal,console,fetch:async(url,options)=>{calls.push({url,method:options.method});return fail&&options.method==='POST'?new Response(null,{status:503}):Response.json({total:42});}});await vm.runInContext(readFileSync(new URL('../public/static/pageviews.js',import.meta.url),'utf8'),context);for(let i=0;i<20&&!target.textContent;i++)await new Promise(resolve=>setImmediate(resolve));return{calls,target};}
test('EO sends one count POST directly to the backend',async()=>{const{calls,target}=await runCounter(false);assert.deepEqual(calls,[{url:'https://admin.724520.xyz/api/pageviews',method:'POST'}]);assert.equal(target.textContent,'42 次');});
test('failed count is never retried; fallback only reads total',async()=>{const{calls,target}=await runCounter(true);assert.deepEqual(calls.map(c=>c.method),['POST','GET']);assert.equal(target.textContent,'42 次');assert.match(target.title,/本次计数状态暂时无法确认/);});
