/**
 * VIVER OAuth worker. Independent from other projects.
 * All provider credentials and tokens stay on this server, never on GitHub Pages.
 * Browser stores only an opaque random capability identifying its local connections.
 */
const SITE = 'https://flekideveloper.github.io';
const HOME = SITE + '/viver/#platforms';
const PROVIDERS = {
  youtube: {id:'GOOGLE_CLIENT_ID',secret:'GOOGLE_CLIENT_SECRET',scope:'https://www.googleapis.com/auth/youtube.readonly',
    authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token'},
  tiktok: {id:'TIKTOK_CLIENT_KEY',secret:'TIKTOK_CLIENT_SECRET',scope:'user.info.basic',
    authorize:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/'},
  twitch: {id:'TWITCH_CLIENT_ID',secret:'TWITCH_CLIENT_SECRET',scope:'',
    authorize:'https://id.twitch.tv/oauth2/authorize',token:'https://id.twitch.tv/oauth2/token'},
  x: {id:'X_CLIENT_ID',secret:'X_CLIENT_SECRET',scope:'users.read tweet.read offline.access',
    authorize:'https://x.com/i/oauth2/authorize',token:'https://api.x.com/2/oauth2/token'}
};
const toB64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const fromB64=str=>Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>toB64(crypto.getRandomValues(new Uint8Array(32)));
async function hash(value){return toB64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
function authHeader(req){
 const value=req.headers.get('Authorization')||'';
 const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
 return match?.[1]||null;
}
function config(env,p){const x=PROVIDERS[p];return !!x && Boolean(env[x.id]&&env[x.secret]&&env.TOKEN_KEY&&env.DB)}
function allConfigs(env){return Object.fromEntries(Object.keys(PROVIDERS).map(p=>[p,config(env,p)]))}
function headers(origin){return {'Access-Control-Allow-Origin':origin||SITE,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}}
function json(data,status=200,origin=SITE){return new Response(JSON.stringify(data),{status,headers:{...headers(origin),'Content-Type':'application/json; charset=utf-8'}})}
function textPage(success,message){
 const ok=success?'Підключення виконано':'Не вдалося підключити акаунт';
 const safe=String(message||'').replace(/[<>&"']/g,'');
 return new Response('<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VIVER</title><style>body{background:#15161b;color:#f4f4f6;font:15px system-ui;display:grid;place-items:center;min-height:95vh;text-align:center;margin:0}main{padding:28px;max-width:380px}p{color:#aeb0bd;line-height:1.6}a{color:#d1beff}</style><main><h2>'+ok+'</h2><p>'+safe+'</p><p><a href="'+HOME+'">Повернутися у VIVER</a></p></main><script>if(window.opener){window.opener.postMessage({type:"viver-oauth-complete",ok:'+success+'},"'+SITE+'")}</script></html>',{status:success?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
async function encrypted(env,data){
 const raw=fromB64(env.TOKEN_KEY);
 if(raw.length!==32)throw Error('Encryption key must be 32 bytes');
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(data));
 return toB64(iv)+'.'+toB64(new Uint8Array(ct));
}
async function decrypted(env,data){
 if(!data)return '';
 const [iv,ct]=data.split('.');
 const key=await crypto.subtle.importKey('raw',fromB64(env.TOKEN_KEY),'AES-GCM',false,['decrypt']);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(iv)},key,fromB64(ct)));
}
function redirectUri(request,provider){return new URL(request.url).origin+'/auth/callback/'+provider}
async function exchangeForm(url,form,extraHeaders={}){
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...extraHeaders},body:new URLSearchParams(form)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||!body.access_token)throw new Error('Provider token exchange failed ('+res.status+')');
 return body;
}
async function getProfile(provider,token,env){
 let endpoint,headers={'Authorization':'Bearer '+token};
 if(provider==='youtube')endpoint='https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';
 if(provider==='twitch'){endpoint='https://api.twitch.tv/helix/users';headers['Client-Id']=env.TWITCH_CLIENT_ID}
 if(provider==='tiktok')endpoint='https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url';
 if(provider==='x')endpoint='https://api.x.com/2/users/me?user.fields=profile_image_url';
 const res=await fetch(endpoint,{headers});
 if(!res.ok)throw new Error('Provider profile endpoint rejected request ('+res.status+')');
 const d=await res.json();
 if(provider==='youtube'){
  const x=d.items?.[0];if(!x?.id)throw Error('No YouTube channel available in this Google account');
  return {id:String(x.id),name:String(x.snippet?.title||'YouTube channel'),avatar:String(x.snippet?.thumbnails?.default?.url||'')};
 }
 if(provider==='tiktok'){
  if(d.error&&d.error.code!=='ok')throw Error('TikTok user info not available');
  const x=d.data?.user;if(!x?.open_id)throw Error('TikTok profile not available');
  return {id:String(x.open_id),name:String(x.display_name||'TikTok user'),avatar:String(x.avatar_url||'')};
 }
 if(provider==='twitch'){
  const x=d.data?.[0];if(!x?.id)throw Error('Twitch profile not available');
  return {id:String(x.id),name:String(x.display_name||x.login||'Twitch user'),avatar:String(x.profile_image_url||'')};
 }
 const x=d.data;if(!x?.id)throw Error('X profile not available');
 return {id:String(x.id),name:String(x.name||x.username||'X user'),avatar:String(x.profile_image_url||'')};
}
async function start(req,env,provider){
 if(!config(env,provider))return json({error:'Provider not configured'},409);
 const token=authHeader(req);if(!token)return json({error:'A local connection key is required'},401);
 const clientHash=await hash(token),now=Date.now();
 await env.DB.prepare('DELETE FROM oauth_pending WHERE created_at < ?').bind(now-600000).run();
 const existing=await env.DB.prepare('SELECT COUNT(*) AS total FROM oauth_pending WHERE client_hash=?').bind(clientHash).first();
 if(Number(existing?.total)>=4)return json({error:'Too many pending login attempts'},429);
 const state=random(),verifier=provider==='youtube'||provider==='x'?random():null;
 await env.DB.prepare('INSERT INTO oauth_pending(state,client_hash,provider,verifier,created_at) VALUES(?,?,?,?,?)').bind(state,clientHash,provider,verifier,now).run();
 const opts=PROVIDERS[provider],params=new URLSearchParams({response_type:'code',redirect_uri:redirectUri(req,provider),state});
 if(provider==='tiktok'){params.set('client_key',env[opts.id]);params.set('scope',opts.scope)}
 else{params.set('client_id',env[opts.id]);params.set('scope',opts.scope)}
 if(provider==='youtube'){params.set('access_type','offline');params.set('prompt','consent')}
 if(verifier){
  params.set('code_challenge',await hash(verifier));params.set('code_challenge_method','S256');
 }
 return json({url:opts.authorize+'?'+params.toString()},200,SITE);
}
async function callback(req,env,provider){
 const u=new URL(req.url),state=u.searchParams.get('state'),code=u.searchParams.get('code');
 if(!state||!/^[A-Za-z0-9_-]{43}$/.test(state))return textPage(false,'Invalid authorization state');
 const pending=await env.DB.prepare('SELECT * FROM oauth_pending WHERE state=? AND provider=?').bind(state,provider).first();
 if(!pending||Date.now()-pending.created_at>600000)return textPage(false,'Login expired. Try again.');
 await env.DB.prepare('DELETE FROM oauth_pending WHERE state=?').bind(state).run();
 if(!code||u.searchParams.get('error'))return textPage(false,'Authorization was canceled or denied.');
 if(!config(env,provider))return textPage(false,'This service is not configured yet.');
 try{
  const p=PROVIDERS[provider],form={client_id:env[p.id],code,redirect_uri:redirectUri(req,provider),grant_type:'authorization_code'};
  let extra={};
  if(provider==='tiktok'){delete form.client_id;form.client_key=env[p.id];form.client_secret=env[p.secret]}
  else if(provider==='x'){extra={Authorization:'Basic '+btoa(env[p.id]+':'+env[p.secret])}}
  else form.client_secret=env[p.secret];
  if(pending.verifier)form.code_verifier=pending.verifier;
  const grant=await exchangeForm(p.token,form,extra);
  const profile=await getProfile(provider,grant.access_token,env);
  const now=Date.now();
  const expires=now+Math.min(Math.max(Number(grant.expires_in)||3600,60),31536000)*1000;
  const access=await encrypted(env,grant.access_token);
  const refresh=grant.refresh_token?await encrypted(env,grant.refresh_token):null;
  const old=await env.DB.prepare('SELECT refresh_enc FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(pending.client_hash,provider).first();
  await env.DB.prepare('INSERT INTO oauth_accounts(client_hash,provider,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(client_hash,provider) DO UPDATE SET subject=excluded.subject,label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
    .bind(pending.client_hash,provider,profile.id,profile.name.slice(0,120),profile.avatar.slice(0,500),access,refresh||old?.refresh_enc||null,expires,now).run();
  return textPage(true,profile.name+' connected. You can return to VIVER.');
 }catch(err){console.error('VIVER OAuth callback failed',provider,err.message);return textPage(false,'Unable to complete authorization. Check app permissions and retry.')}
}
async function refreshIfNeeded(env,row){
 if(row.expires_at>Date.now()+120000)return row;
 if(!row.refresh_enc)return {...row,expired:true};
 const p=PROVIDERS[row.provider];if(!config(env,row.provider))return {...row,expired:true};
 try{
  const refresh=await decrypted(env,row.refresh_enc);
  const body={grant_type:'refresh_token',refresh_token:refresh};
  let extra={};
  if(row.provider==='tiktok'){body.client_key=env[p.id];body.client_secret=env[p.secret]}
  else if(row.provider==='x'){extra={Authorization:'Basic '+btoa(env[p.id]+':'+env[p.secret])}}
  else{body.client_id=env[p.id];body.client_secret=env[p.secret]}
  const next=await exchangeForm(p.token,body,extra);
  const encryptedAccess=await encrypted(env,next.access_token);
  const encryptedRefresh=next.refresh_token?await encrypted(env,next.refresh_token):row.refresh_enc;
  const expires=Date.now()+Math.max(60,Number(next.expires_in)||3600)*1000;
  await env.DB.prepare('UPDATE oauth_accounts SET token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND provider=?')
   .bind(encryptedAccess,encryptedRefresh,expires,Date.now(),row.client_hash,row.provider).run();
  return {...row,token_enc:encryptedAccess,refresh_enc:encryptedRefresh,expires_at:expires,expired:false};
 }catch(e){console.warn('VIVER refresh failed',row.provider);return {...row,expired:true}}
}
async function connections(req,env){
 const token=authHeader(req);if(!token)return json({error:'Connection key required'},401);
 const clientHash=await hash(token);
 const rows=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=?').bind(clientHash).all();
 const items=[];
 for(const row of rows.results||[]){
  const active=await refreshIfNeeded(env,row);
  items.push({provider:row.provider,label:row.label,avatar:row.avatar,connected:!active.expired,expires_at:active.expires_at});
 }
 return json({providers:allConfigs(env),connections:items});
}
async function disconnect(req,env,provider){
 if(!PROVIDERS[provider])return json({error:'Unknown provider'},404);
 const token=authHeader(req);if(!token)return json({error:'Connection key required'},401);
 const hashKey=await hash(token);
 await env.DB.prepare('DELETE FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(hashKey,provider).run();
 return json({ok:true});
}
export default {
 async fetch(req,env){
  const u=new URL(req.url),path=u.pathname,method=req.method,origin=req.headers.get('Origin');
  if(origin&&origin!==SITE)return json({error:'Origin not allowed'},403);
  if(method==='OPTIONS')return new Response(null,{status:204,headers:headers(SITE)});
  if(!env.DB)return json({error:'Database is not configured'},503);
  try{
   if(method==='GET'&&path==='/health')return json({ok:true,providers:allConfigs(env),frontend:SITE+'/viver/'});
   if(method==='GET'&&path==='/connections')return connections(req,env);
   const connect=/^\/auth\/start\/(youtube|tiktok|twitch|x)$/.exec(path);
   if(method==='POST'&&connect)return start(req,env,connect[1]);
   const callbackMatch=/^\/auth\/callback\/(youtube|tiktok|twitch|x)$/.exec(path);
   if(method==='GET'&&callbackMatch)return callback(req,env,callbackMatch[1]);
   const remove=/^\/connections\/(youtube|tiktok|twitch|x)$/.exec(path);
   if(method==='DELETE'&&remove)return disconnect(req,env,remove[1]);
   return json({error:'Not found'},404);
  }catch(err){console.error('VIVER auth backend',err.message);return json({error:'Server error'},500)}
 }
};
