/* Isolated VIVER OAuth Worker tests; never use real platform credentials. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../auth-worker/src/index.js'),'utf8');
const pending=new Map(),accounts=new Map();
const DB={
 prepare(sql){const entry={sql,values:[],bind(...args){this.values=args;return this},
  async first(){
   const [a,b]=this.values;
   if(sql.includes('COUNT(*)'))return {total:[...pending.values()].filter(v=>v.client_hash===a).length};
   if(sql.includes('FROM oauth_pending'))return pending.get(a)&&pending.get(a).provider===b?pending.get(a):null;
   if(sql.includes('FROM oauth_accounts'))return accounts.get(a+'|'+b)||null;
   return null
  },
  async all(){const [hash]=this.values;return {results:[...accounts.values()].filter(v=>v.client_hash===hash)}},
  async run(){
   const v=this.values;
   if(sql.includes('DELETE FROM oauth_pending WHERE created_at')){for(const [k,p] of pending){if(p.created_at<v[0])pending.delete(k)}}
   if(sql.includes('INSERT INTO oauth_pending'))pending.set(v[0],{state:v[0],client_hash:v[1],provider:v[2],verifier:v[3],created_at:v[4]});
   if(sql.includes('DELETE FROM oauth_pending WHERE state'))pending.delete(v[0]);
   if(sql.includes('INSERT INTO oauth_accounts'))accounts.set(v[0]+'|'+v[1],{client_hash:v[0],provider:v[1],subject:v[2],label:v[3],avatar:v[4],token_enc:v[5],refresh_enc:v[6],expires_at:v[7],updated_at:v[8]});
   if(sql.includes('DELETE FROM oauth_accounts'))accounts.delete(v[0]+'|'+v[1]);
   return {success:true}
  }};return entry}
};
const testKey=btoa(String.fromCharCode(...new Uint8Array(32).fill(8))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const env={DB,TOKEN_KEY:testKey,GOOGLE_CLIENT_ID:'test-google',GOOGLE_CLIENT_SECRET:'fake-secret',TIKTOK_CLIENT_KEY:'test-tiktok',TIKTOK_CLIENT_SECRET:'fake-secret',TWITCH_CLIENT_ID:'test-twitch',TWITCH_CLIENT_SECRET:'fake-secret',X_CLIENT_ID:'test-x',X_CLIENT_SECRET:'fake-secret'};
const seen=[];
const mockFetch=async(url,opts)=>{
 seen.push({url:String(url),body:String(opts?.body||'')});
 if(String(url).includes('oauth2.googleapis.com/token'))return Response.json({access_token:'secret-access-token',refresh_token:'secret-refresh-token',expires_in:3600});
 if(String(url).includes('youtube/v3/channels'))return Response.json({items:[{id:'test-channel',snippet:{title:'Creator Test',thumbnails:{}}}]});
 return Response.json({error:'mock provider not implemented'}, {status:404});
};
const sandbox={crypto:webcrypto,URL,URLSearchParams,TextEncoder,TextDecoder,Request,Response,fetch:mockFetch,btoa,atob,console,Uint8Array,Date,JSON,Error};
sandbox.globalThis=sandbox;
vm.runInNewContext(source.replace('export default {','globalThis.worker = {'),sandbox,{filename:'auth-worker/src/index.js'});
const worker=sandbox.worker;
const key='V'.repeat(43),base='https://viver-auth.flekideveloper.workers.dev';
const req=(path,method='GET',origin='https://flekideveloper.github.io',token=key)=>new Request(base+path,{method,headers:{Origin:origin,Authorization:'Bearer '+token}});
(async()=>{
 assert.equal((await worker.fetch(req('/health'),{DB})).status,200);
 const health=await (await worker.fetch(req('/health'),{DB})).json();
 assert.equal(health.providers.youtube,false,'missing provider secrets are honestly disabled');
 assert.equal((await worker.fetch(req('/connections'),env)).status,200);
 assert.equal((await worker.fetch(req('/connections','GET','https://bad.example'),env)).status,403,'foreign origin rejected');
 assert.equal((await worker.fetch(req('/connections','GET','https://flekideveloper.github.io','invalid'),env)).status,401,'random key is required');
 for(const provider of ['youtube','tiktok','twitch','x']){
  const result=await worker.fetch(req('/auth/start/'+provider,'POST'),env);
  assert.equal(result.status,200,'can authorize '+provider);
  const data=await result.json(),url=new URL(data.url);
  assert(url.searchParams.get('state')?.length===43);
  assert.equal(url.searchParams.get('redirect_uri'),base+'/auth/callback/'+provider);
  if(provider==='x'||provider==='youtube')assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  if(provider==='tiktok')assert.equal(url.searchParams.get('client_key'),'test-tiktok');
  if(provider==='twitch')assert.equal(url.hostname,'id.twitch.tv');
 }
 const state=[...pending.values()].find(v=>v.provider==='youtube').state;
 const callback=await worker.fetch(req('/auth/callback/youtube?code=test-code&state='+state),env);
 assert.equal(callback.status,200,'OAuth callback stored verified account');
 assert.equal(pending.has(state),false,'state is one-time');
 assert.equal(accounts.size,1,'account stored');
 const dbRecord=[...accounts.values()][0];
 assert(!dbRecord.token_enc.includes('secret-access-token'),'tokens encrypted in database');
 assert(!dbRecord.refresh_enc.includes('secret-refresh-token'),'refresh tokens encrypted in database');
 const status=await (await worker.fetch(req('/connections'),env)).json();
 assert.equal(status.connections[0].label,'Creator Test');
 assert.equal(status.connections[0].connected,true);
 assert(!JSON.stringify(status).includes('secret-access-token'),'no credentials in browser response');
 assert.equal((await worker.fetch(req('/connections/youtube','DELETE'),env)).status,200);
 assert.equal(accounts.size,0,'disconnect clears encrypted tokens');
 console.log('VIVER OAuth tests: PASS — four authorization URLs, PKCE, CORS, encrypted token storage, one-time state and unlink');
})().catch(e=>{console.error(e);process.exit(1)});
