/* VIVER space backend regression tests with a strictly isolated in-memory D1 emulator. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const users=new Map(),sessions=new Map(),limits=new Map(),workspaces=new Map(),teams=new Map(),members=new Map(),invites=new Map(),tasks=new Map();
const DB={prepare(sql){let args=[];
 const query={
  bind(...values){args=values;return query},
  async first(){
   const [a,b]=args;
   if(sql.includes('SELECT attempts FROM auth_limits'))return limits.get(a)||null;
   if(sql.includes('SELECT * FROM users WHERE username'))return [...users.values()].find(u=>u.username===a)||null;
   if(sql.includes('JOIN sessions s ON')){const s=sessions.get(a),u=s&&users.get(s.user_id);return s&&s.expires_at>b&&u?{id:u.id,username:u.username,token_hash:a}:null}
   if(sql.includes('SELECT payload,version,updated_at FROM workspaces'))return workspaces.get(a)||null;
   if(sql.includes('SELECT version FROM workspaces')){const w=workspaces.get(a);return w?{version:w.version}:null}
   if(sql.includes('COUNT(*) total FROM teams WHERE owner_id'))return {total:[...teams.values()].filter(x=>x.owner_id===a).length};
   if(sql.includes('SELECT role FROM team_members')){const m=members.get(a+'|'+b);return m?{role:m.role}:null}
   if(sql.includes('SELECT * FROM team_invites'))return invites.get(a)||null;
   if(sql.includes('COUNT(*) total FROM team_members'))return {total:[...members.values()].filter(x=>x.team_id===a).length};
   if(sql.includes('COUNT(*) total FROM team_tasks'))return {total:[...tasks.values()].filter(x=>x.team_id===a).length};
   if(sql.includes('SELECT * FROM team_tasks WHERE id')){const x=tasks.get(a);return x&&x.team_id===b?x:null}
   if(sql.includes('SELECT id,name,created_at FROM teams'))return teams.get(a)||null;
   throw Error('unmocked first '+sql)
  },
  async all(){
   const [a]=args;
   if(sql.includes('FROM teams t JOIN team_members m'))return {results:[...teams.values()].filter(x=>members.has(x.id+'|'+a)).map(x=>({...x,role:members.get(x.id+'|'+a).role}))};
   if(sql.includes('FROM users u JOIN team_members m'))return {results:[...members.values()].filter(x=>x.team_id===a).map(x=>({id:x.user_id,username:users.get(x.user_id).username,role:x.role}))};
   if(sql.includes('FROM team_tasks WHERE team_id'))return {results:[...tasks.values()].filter(x=>x.team_id===a)};
   throw Error('unmocked all '+sql)
  },
  async run(){
   const [a,b,c,d,e,f,g,h,i,j]=args;let changes=1;
   if(sql.startsWith('INSERT INTO auth_limits')){const old=limits.get(a);limits.set(a,{attempts:old&&old.reset_at>Date.now()?old.attempts+1:1,reset_at:old&&old.reset_at>Date.now()?old.reset_at:b})}
   else if(sql.startsWith('INSERT INTO users')){if([...users.values()].some(x=>x.username===b))throw Error('unique');users.set(a,{id:a,username:b,pass_salt:c,pass_hash:d,recovery_hash:e,created_at:f})}
   else if(sql.startsWith('UPDATE users SET')){const u=users.get(d);Object.assign(u,{pass_salt:a,pass_hash:b,recovery_hash:c})}
   else if(sql.startsWith('INSERT INTO sessions'))sessions.set(a,{token_hash:a,user_id:b,created_at:c,expires_at:d});
   else if(sql.startsWith('DELETE FROM sessions WHERE token_hash'))sessions.delete(a);
   else if(sql.startsWith('DELETE FROM sessions WHERE user_id'))for(const [key,x] of sessions)if(x.user_id===a)sessions.delete(key);
   else if(sql.startsWith('INSERT INTO workspaces')){if(workspaces.has(a))throw Error('unique');workspaces.set(a,{user_id:a,payload:b,version:c,updated_at:d})}
   else if(sql.startsWith('UPDATE workspaces SET')){const row=workspaces.get(d);if(!row||row.version!==e)changes=0;else Object.assign(row,{payload:a,version:b,updated_at:c})}
   else if(sql.startsWith('INSERT INTO teams'))teams.set(a,{id:a,name:b,owner_id:c,created_at:d});
   else if(sql.startsWith('INSERT INTO team_members'))members.set(a+'|'+b,{team_id:a,user_id:b,role:c,joined_at:d});
   else if(sql.startsWith('INSERT INTO team_invites'))invites.set(a,{code_hash:a,team_id:b,role:c,expires_at:d,created_at:e,used_by:null});
   else if(sql.startsWith('UPDATE team_invites SET')){const x=invites.get(b);if(!x||x.used_by||x.expires_at<=c)changes=0;else x.used_by=a}
   else if(sql.startsWith('INSERT INTO team_tasks'))tasks.set(a,{id:a,team_id:b,title:c,description:d,status:e,due:f,assignee_id:g,created_by:h,created_at:i,updated_at:j});
   else if(sql.startsWith('UPDATE team_tasks SET')){const x=tasks.get(f);if(!x||x.team_id!==g)changes=0;else Object.assign(x,{title:a,description:b,status:c,due:d,updated_at:e})}
   else throw Error('unmocked run '+sql);
   if(sql.includes('workspaces'))console.log('DEBUG SQL',sql,args);
   return {success:true,meta:{changes}}
  }
 };
 return query;
}};
const source=fs.readFileSync(path.join(__dirname,'../space-worker/src/index.js'),'utf8');
const sandbox={crypto:webcrypto,URL,Request,Response,TextEncoder,TextDecoder,btoa,atob,Uint8Array,Date,JSON,Error,console};
sandbox.globalThis=sandbox;
vm.runInNewContext(source.replace('export default {','globalThis.worker = {'),sandbox);
const worker=sandbox.worker,base='https://viver-space.flekideveloper.workers.dev';
function request(route,method='GET',token='',data=null,origin='https://flekideveloper.github.io'){
 return new Request(base+route,{method,headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.4',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined})
}
async function run(route,method='GET',token='',data=null,origin){
 const result=await worker.fetch(request(route,method,token,data,origin),{DB});
 return {status:result.status,body:await result.json(),headers:result.headers};
}
(async()=>{
 assert.equal((await run('/health')).body.service,'viver-space');
 assert.equal((await run('/v1/workspace')).status,401,'no unauthenticated cloud access');
 assert.equal((await run('/v1/auth/register','POST','',{username:'a',password:'short'})).status,400,'bad password rejected');
 const first=await run('/v1/auth/register','POST','',{username:'creator_one',password:'Strongpass123'});
 assert.equal(first.status,201,JSON.stringify(first.body));
 assert.equal(first.body.recovery.length,43);
 const u=first.body.user,token=first.body.token;
 assert.notEqual(users.get(u.id).pass_hash,'Strongpass123','password stored hashed');
 assert.notEqual(users.get(u.id).recovery_hash,first.body.recovery,'recovery key hashed');
 assert.equal((await run('/v1/auth/register','POST','',{username:'creator_one',password:'Strongpass123'})).status,409,'duplicate denied');
 assert.equal((await run('/v1/auth/login','POST','',{username:'creator_one',password:'wrong'})).status,401);
 const login=await run('/v1/auth/login','POST','',{username:'creator_one',password:'Strongpass123'});
 assert.equal(login.status,200);
 assert.notEqual(login.body.token,token,'new sessions randomized');
 assert.equal((await run('/v1/auth/me','GET',token)).body.user.username,'creator_one');
 assert.equal((await run('/v1/workspace','GET',token)).body.exists,false);
 const saved=await run('/v1/workspace','PUT',token,{version:0,workspace:{workspace:{plans:[{title:'private plan'}]}}});
 assert.equal(saved.status,200);
 assert.equal(saved.body.version,1);
 console.log('DEBUG WORKSPACE',saved,workspaces.size,[...workspaces.entries()]);
 assert.equal(workspaces.size,1,'cloud database row created');
 assert.equal(workspaces.get(u.id)?.version,1,'cloud row keeps correct numeric version');
 assert.equal((await run('/v1/workspace','PUT',token,{version:0,workspace:{}})).status,409,'version conflict avoids lost updates');
 assert.equal((await run('/v1/workspace','GET',token)).body.workspace.workspace.plans[0].title,'private plan');
 const second=await run('/v1/auth/register','POST','',{username:'editor_two',password:'Secure789pass'});
 assert.equal(second.status,201);
 const sToken=second.body.token;
 assert.equal((await run('/v1/workspace','GET',sToken)).body.exists,false,'no cross-account leakage');
 const create=await run('/v1/teams','POST',token,{name:'Creators'});
 assert.equal(create.status,201);
 const teamId=create.body.id;
 assert.equal((await run('/v1/teams/'+teamId,'GET',sToken)).status,403,'outsider denied');
 const invitation=await run('/v1/teams/'+teamId+'/invites','POST',token,{role:'viewer'});
 assert.equal(invitation.status,200);
 assert.equal((await run('/v1/teams/'+teamId+'/invites','POST',sToken,{role:'editor'})).status,403,'only owner may invite');
 assert.equal((await run('/v1/teams/join','POST',sToken,{code:invitation.body.code})).status,200);
 assert.equal((await run('/v1/teams/join','POST',sToken,{code:invitation.body.code})).status,404,'one-time code burned');
 assert.equal((await run('/v1/teams/'+teamId+'/tasks','POST',sToken,{title:'tamper'})).status,403,'viewer cannot write');
 const task=await run('/v1/teams/'+teamId+'/tasks','POST',token,{title:'Edit intro',status:'todo'});
 assert.equal(task.status,201);
 assert.equal((await run('/v1/teams/'+teamId+'/tasks/'+task.body.id,'PATCH',sToken,{title:'steal',status:'done'})).status,403,'viewer cannot update');
 const details=await run('/v1/teams/'+teamId,'GET',sToken);
 assert.equal(details.status,200);
 assert.equal(details.body.tasks[0].title,'Edit intro');
 assert.equal(details.body.members.length,2);
 const updated=await run('/v1/teams/'+teamId+'/tasks/'+task.body.id,'PATCH',token,{title:'Edit intro',status:'done'});
 assert.equal(updated.status,200);
 assert.equal((await run('/v1/teams/'+teamId,'GET',token)).body.tasks[0].status,'done');
 assert.equal((await run('/v1/teams','GET',token,null,'https://evil.example')).status,403,'forbidden Origin denied');
 const reset=await run('/v1/auth/recover','POST','',{username:'creator_one',recovery:first.body.recovery,password:'BrandNewPass123'});
 assert.equal(reset.status,200,'recovery grants new session');
 assert.notEqual(reset.body.recovery,first.body.recovery,'recovery rotates key');
 assert.equal((await run('/v1/auth/me','GET',token)).status,401,'recovery revokes old sessions');
 assert.equal((await run('/v1/auth/login','POST','',{username:'creator_one',password:'BrandNewPass123'})).status,200);
 assert.equal((await run('/v1/auth/logout','POST',sToken)).status,200);
 assert.equal((await run('/v1/auth/me','GET',sToken)).status,401,'logout revokes session');
 console.log('VIVER space backend: PASS — registration, sessions, recovery, cross-user isolation, optimistic backup, single-use invites, permissions');
})().catch(e=>{console.error(e);process.exit(1)});
