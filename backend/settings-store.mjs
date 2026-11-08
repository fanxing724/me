import {DEFAULT_SETTINGS,normalizeSettings} from '../public/static/settings-schema.mjs';
export class HomepageSettings {
 constructor(ctx){this.ctx=ctx;this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS revisions (seq INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT UNIQUE NOT NULL, settings TEXT NOT NULL, updated_at TEXT)');}
 current(){const rows=this.sql.exec('SELECT version,settings,updated_at FROM revisions ORDER BY seq DESC LIMIT 1').toArray();return rows.length?{version:rows[0].version,updatedAt:rows[0].updated_at,settings:JSON.parse(rows[0].settings)}:{version:'initial',updatedAt:null,settings:structuredClone(DEFAULT_SETTINGS)};}
 async fetch(request){
  const url=new URL(request.url);
  if(request.method==='GET'){
   if(url.pathname==='/history'){
    const version=url.searchParams.get('version');
    if(version){const row=this.sql.exec('SELECT version,settings,updated_at FROM revisions WHERE version=?',version).toArray()[0];return row?Response.json({version:row.version,updatedAt:row.updated_at,settings:JSON.parse(row.settings)}):Response.json({error:'版本不存在'},{status:404});}
    return Response.json({history:this.sql.exec('SELECT version,updated_at AS updatedAt FROM revisions ORDER BY seq DESC LIMIT 12').toArray()});
   }
   return Response.json(this.current());
  }
  if(request.method!=='POST'||url.pathname!=='/state')return new Response(null,{status:405});
  const input=await request.json();const {settings,errors}=normalizeSettings(input.settings);
  if(errors.length)return Response.json({error:errors.join('；')},{status:400});
  let result;
  this.ctx.storage.transactionSync(()=>{
   const before=this.current();
   if(input.expectedVersion!==before.version){result=Response.json({error:'设置已被其他页面更新，请先重新加载再保存。',version:before.version},{status:409});return;}
   if(JSON.stringify(before.settings)===JSON.stringify(settings)){result=Response.json(before);return;}
   if(before.version==='initial')this.sql.exec('INSERT INTO revisions (version,settings,updated_at) VALUES (?,?,?)','initial',JSON.stringify(DEFAULT_SETTINGS),null);
   const version=crypto.randomUUID(),updatedAt=new Date().toISOString();
   this.sql.exec('INSERT INTO revisions (version,settings,updated_at) VALUES (?,?,?)',version,JSON.stringify(settings),updatedAt);
   this.sql.exec('DELETE FROM revisions WHERE seq NOT IN (SELECT seq FROM revisions ORDER BY seq DESC LIMIT 12)');
   result=Response.json({version,updatedAt,settings});
  });return result;
 }
}
