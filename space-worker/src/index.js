/* VIVER ID and Teams — independent of the social OAuth Worker and other products. */
const SITE='https://flekideveloper.github.io';
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const rand=(n=32)=>b64(crypto.getRandomValues(new Uint8Array(n)));
const now=()=>Date.now();
async function digest(s){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))))}
async function passwordHash(password,salt){
 const k=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:from64(salt),iterations:120000,hash:'SHA-256'},k,256);
 return b64(new Uint8Array(bits));
}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0}
function headers(){return {'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers(),'Content-Type':'application/json; charset=utf-8'}})}
async function body(req){if(Number(req.headers.get('content-length')||0)>1500000)throw Error('too_large');const raw=await req.text();if(raw.length>1500000)throw Error('too_large');try{return JSON.parse(raw)}catch{throw Error('invalid_json')}}
function username(s){return typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}$/.test(s)?s.toLowerCase():null}
function goodPass(s){return typeof s==='string'&&s.length>=6&&s.length<=128&&(s.match(/\p{L}/gu)||[]).length>=4&&/[0-9]/.test(s)&&/[^\p{L}0-9\s]/u.test(s)}
async function limit(env,req,purpose,who,max){
 const remote=req.headers.get('CF-Connecting-IP')||'unknown';
 const key=await digest(purpose+':'+remote+':'+(who||''));
 const expires=now()+3600000;
 await env.DB.prepare('INSERT INTO auth_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').bind(key,expires,now(),now()).run();
 const row=await env.DB.prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(key).first();
 return Number(row?.attempts||0)<=max;
}
async function session(env,uid){
 const token=rand();const ts=now();
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(await digest(token),uid,ts,ts+30*86400000).run();
 return token;
}
async function identity(req,env){
 const token=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get('Authorization')||'')?.[1];
 if(!token)return null;
 return await env.DB.prepare('SELECT u.id,u.username,s.token_hash FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),now()).first();
}
async function register(req,env){
 const b=await body(req),name=username(b.username);
 if(!name||!goodPass(b.password))return reply({error:'invalid_credentials_rules'},400);
 if(!await limit(env,req,'register','',5))return reply({error:'rate_limited'},429);
 const salt=rand(16),id=rand(18),recover=rand(),ts=now();
 try{await env.DB.prepare('INSERT INTO users(id,username,pass_salt,pass_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id,name,salt,await passwordHash(b.password,salt),await digest(recover),ts).run()}
 catch{return reply({error:'username_taken'},409)}
 return reply({user:{id,username:name},token:await session(env,id),recovery:recover},201);
}
async function login(req,env){
 const b=await body(req),name=username(b.username);
 if(!name||typeof b.password!=='string')return reply({error:'invalid_credentials'},401);
 if(!await limit(env,req,'login',name,15))return reply({error:'rate_limited'},429);
 const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(name).first();
 if(!user||!equal(await passwordHash(b.password,user.pass_salt),user.pass_hash))return reply({error:'invalid_credentials'},401);
 return reply({user:{id:user.id,username:user.username},token:await session(env,user.id)});
}
async function recover(req,env){
 const b=await body(req),name=username(b.username);
 if(!name||!goodPass(b.password)||typeof b.recovery!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(b.recovery))return reply({error:'invalid_recovery'},400);
 if(!await limit(env,req,'recover',name,8))return reply({error:'rate_limited'},429);
 const u=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(name).first();
 if(!u||!equal(await digest(b.recovery),u.recovery_hash))return reply({error:'invalid_recovery'},401);
 const salt=rand(16),newRecovery=rand();
 await env.DB.prepare('UPDATE users SET pass_salt=?,pass_hash=?,recovery_hash=? WHERE id=?').bind(salt,await passwordHash(b.password,salt),await digest(newRecovery),u.id).run();
 await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run();
 return reply({user:{id:u.id,username:u.username},recovery:newRecovery,token:await session(env,u.id)});
}
async function workspace(req,env,u){
 if(req.method==='GET'){
  const row=await env.DB.prepare('SELECT payload,version,updated_at FROM workspaces WHERE user_id=?').bind(u.id).first();
  return reply(row?{exists:true,workspace:JSON.parse(row.payload),version:row.version,updatedAt:row.updated_at}:{exists:false,version:0});
 }
 const b=await body(req),v=b.version;
 if(!Number.isSafeInteger(v)||v<0||!b.workspace||typeof b.workspace!=='object'||Array.isArray(b.workspace))return reply({error:'invalid_workspace'},400);
 const payload=JSON.stringify(b.workspace);
 if(payload.length>1000000)return reply({error:'workspace_too_large'},413);
 const existing=await env.DB.prepare('SELECT version FROM workspaces WHERE user_id=?').bind(u.id).first(),current=existing?.version||0;
 if(current!==v)return reply({error:'version_conflict',version:current},409);
 const next=current+1,t=now();
 if(existing){
  const result=await env.DB.prepare('UPDATE workspaces SET payload=?,version=?,updated_at=? WHERE user_id=? AND version=?').bind(payload,next,t,u.id,current).run();
  if(!result.meta?.changes)return reply({error:'version_conflict'},409);
 }else{
  try{await env.DB.prepare('INSERT INTO workspaces(user_id,payload,version,updated_at) VALUES(?,?,?,?)').bind(u.id,payload,next,t).run()}
  catch{return reply({error:'version_conflict'},409)}
 }
 return reply({ok:true,version:next,updatedAt:t});
}
async function member(env,teamId,userId){
 return env.DB.prepare('SELECT role FROM team_members WHERE team_id=? AND user_id=?').bind(teamId,userId).first();
}
async function listTeams(env,u){
 const rows=await env.DB.prepare('SELECT t.id,t.name,m.role,t.created_at FROM teams t JOIN team_members m ON t.id=m.team_id WHERE m.user_id=? ORDER BY t.created_at DESC LIMIT 30').bind(u.id).all();
 return reply({teams:rows.results||[]});
}
async function createTeam(req,env,u){
 const b=await body(req),name=typeof b.name==='string'?b.name.trim():'';
 if(!name||name.length>65)return reply({error:'invalid_team_name'},400);
 const count=await env.DB.prepare('SELECT COUNT(*) total FROM teams WHERE owner_id=?').bind(u.id).first();
 if(Number(count?.total)>=5)return reply({error:'team_limit'},409);
 const id=rand(18),t=now();
 await env.DB.prepare('INSERT INTO teams(id,name,owner_id,created_at) VALUES(?,?,?,?)').bind(id,name,u.id,t).run();
 await env.DB.prepare('INSERT INTO team_members(team_id,user_id,role,joined_at) VALUES(?,?,?,?)').bind(id,u.id,'owner',t).run();
 return reply({id,name,role:'owner'},201);
}
async function invite(req,env,u,id){
 const m=await member(env,id,u.id);if(!m||m.role!=='owner')return reply({error:'forbidden'},403);
 const b=await body(req),role=b.role==='viewer'?'viewer':'editor';
 const code=rand(),expiry=now()+3*86400000;
 await env.DB.prepare('INSERT INTO team_invites(code_hash,team_id,role,expires_at,created_at) VALUES(?,?,?,?,?)').bind(await digest(code),id,role,expiry,now()).run();
 return reply({code,role,expiresAt:expiry});
}
async function join(req,env,u){
 const b=await body(req),code=String(b.code||'');
 if(!/^[A-Za-z0-9_-]{43}$/.test(code))return reply({error:'invalid_invite'},400);
 const row=await env.DB.prepare('SELECT * FROM team_invites WHERE code_hash=?').bind(await digest(code)).first();
 if(!row||row.used_by||row.expires_at<now())return reply({error:'invalid_invite'},404);
 const existing=await member(env,row.team_id,u.id);if(existing)return reply({error:'already_a_member'},409);
 const count=await env.DB.prepare('SELECT COUNT(*) total FROM team_members WHERE team_id=?').bind(row.team_id).first();
 if(Number(count?.total)>=15)return reply({error:'team_full'},409);
 const used=await env.DB.prepare('UPDATE team_invites SET used_by=? WHERE code_hash=? AND used_by IS NULL AND expires_at>?').bind(u.id,await digest(code),now()).run();
 if(!used.meta?.changes)return reply({error:'invite_used'},409);
 await env.DB.prepare('INSERT INTO team_members(team_id,user_id,role,joined_at) VALUES(?,?,?,?)').bind(row.team_id,u.id,row.role,now()).run();
 return reply({ok:true,teamId:row.team_id,role:row.role});
}
async function teamDetails(env,u,id){
 const m=await member(env,id,u.id);if(!m)return reply({error:'forbidden'},403);
 const t=await env.DB.prepare('SELECT id,name,created_at FROM teams WHERE id=?').bind(id).first();
 const people=await env.DB.prepare('SELECT u.id,u.username,m.role FROM users u JOIN team_members m ON u.id=m.user_id WHERE m.team_id=? ORDER BY m.joined_at').bind(id).all();
 const tasks=await env.DB.prepare('SELECT * FROM team_tasks WHERE team_id=? ORDER BY updated_at DESC LIMIT 200').bind(id).all();
 return reply({team:{...t,role:m.role},members:people.results||[],tasks:tasks.results||[]});
}
async function teamTask(req,env,u,id,taskId){
 const m=await member(env,id,u.id);if(!m||m.role==='viewer')return reply({error:'forbidden'},403);
 const b=await body(req),name=typeof b.title==='string'?b.title.trim():'';
 const status=['todo','doing','review','done'].includes(b.status)?b.status:'todo';
 if(req.method==='POST'){
  if(!name||name.length>140)return reply({error:'invalid_task'},400);
  const count=await env.DB.prepare('SELECT COUNT(*) total FROM team_tasks WHERE team_id=?').bind(id).first();
  if(Number(count?.total)>=200)return reply({error:'task_limit'},409);
  const newId=rand(18),t=now();
  await env.DB.prepare('INSERT INTO team_tasks(id,team_id,title,description,status,due,assignee_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(newId,id,name,String(b.description||'').slice(0,1500),status,String(b.due||'').slice(0,16),null,u.id,t,t).run();
  return reply({id:newId,ok:true},201);
 }
 if(req.method==='PATCH'){
  const old=await env.DB.prepare('SELECT * FROM team_tasks WHERE id=? AND team_id=?').bind(taskId,id).first();
  if(!old)return reply({error:'task_not_found'},404);
  if(!name||name.length>140)return reply({error:'invalid_task'},400);
  await env.DB.prepare('UPDATE team_tasks SET title=?,description=?,status=?,due=?,updated_at=? WHERE id=? AND team_id=?').bind(name,String(b.description||'').slice(0,1500),status,String(b.due||'').slice(0,16),now(),taskId,id).run();
  return reply({ok:true});
 }
 return reply({error:'not_found'},404);
}
export default {
 async fetch(req,env){
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==SITE)return reply({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
  if(!env.DB)return reply({error:'database_unavailable'},503);
  const route=new URL(req.url).pathname;
  try{
   if(req.method==='GET'&&route==='/health')return reply({ok:true,service:'viver-space',version:1});
   if(req.method==='POST'&&route==='/v1/auth/register')return register(req,env);
   if(req.method==='POST'&&route==='/v1/auth/login')return login(req,env);
   if(req.method==='POST'&&route==='/v1/auth/recover')return recover(req,env);
   const u=await identity(req,env);
   if(!u)return reply({error:'authentication_required'},401);
   if(req.method==='GET'&&route==='/v1/auth/me')return reply({user:{id:u.id,username:u.username}});
   if(req.method==='POST'&&route==='/v1/auth/logout'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(u.token_hash).run();return reply({ok:true})}
   if((req.method==='GET'||req.method==='PUT')&&route==='/v1/workspace')return workspace(req,env,u);
   if(req.method==='GET'&&route==='/v1/teams')return listTeams(env,u);
   if(req.method==='POST'&&route==='/v1/teams')return createTeam(req,env,u);
   if(req.method==='POST'&&route==='/v1/teams/join')return join(req,env,u);
   const invitePath=/^\/v1\/teams\/([A-Za-z0-9_-]{24})\/invites$/.exec(route);
   if(req.method==='POST'&&invitePath)return invite(req,env,u,invitePath[1]);
   const teamPath=/^\/v1\/teams\/([A-Za-z0-9_-]{24})$/.exec(route);
   if(req.method==='GET'&&teamPath)return teamDetails(env,u,teamPath[1]);
   const taskPath=/^\/v1\/teams\/([A-Za-z0-9_-]{24})\/tasks(?:\/([A-Za-z0-9_-]{24}))?$/.exec(route);
   if(taskPath&&((req.method==='POST'&&!taskPath[2])||(req.method==='PATCH'&&taskPath[2])))return teamTask(req,env,u,taskPath[1],taskPath[2]);
   return reply({error:'not_found'},404);
  }catch(e){console.error('VIVER space API',e?.message);return reply({error:e?.message==='too_large'?'too_large':e?.message==='invalid_json'?'invalid_json':'server_error'},e?.message==='too_large'?413:e?.message==='invalid_json'?400:500)}
 }
};
