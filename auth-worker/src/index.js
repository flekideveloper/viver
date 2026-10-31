/**
 * VIVER OAuth worker. Independent from other projects.
 * All provider credentials and tokens stay on this server, never on GitHub Pages.
 * Browser stores only an opaque random capability identifying its local connections.
 */
const SITE = 'https://flekideveloper.github.io';
const HOME = SITE + '/viver/#platforms';
const PROVIDERS = {
  youtube: {id:'GOOGLE_CLIENT_ID',secret:'GOOGLE_CLIENT_SECRET',scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
    authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token'},
  tiktok: {id:'TIKTOK_CLIENT_KEY',secret:'TIKTOK_CLIENT_SECRET',scope:'user.info.basic,user.info.profile,user.info.stats,video.list',
    authorize:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/'},
  twitch: {id:'TWITCH_CLIENT_ID',secret:'TWITCH_CLIENT_SECRET',scope:'moderator:read:followers',
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

/** Multi-channel YouTube vault. Legacy oauth_accounts contains the selected channel. */
const YOUTUBE_CHANNEL_LIMIT=3;
const validChannelId=id=>/^UC[A-Za-z0-9_-]{22}$/.test(String(id||''));
async function ensureYoutubeVault(env,clientHash){
 await env.DB.prepare("INSERT OR IGNORE INTO oauth_youtube_channels(client_hash,channel_id,label,avatar,token_enc,refresh_enc,expires_at,updated_at) SELECT client_hash,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at FROM oauth_accounts WHERE client_hash=? AND provider='youtube'").bind(clientHash).run();
}
async function youtubeVaultList(env,clientHash){
 await ensureYoutubeVault(env,clientHash);
 const rows=await env.DB.prepare('SELECT channel_id,label,avatar,expires_at,refresh_enc,updated_at FROM oauth_youtube_channels WHERE client_hash=? ORDER BY updated_at DESC').bind(clientHash).all();
 return rows.results||[];
}
async function selectYoutubeChannel(req,env){
 if(!config(env,'youtube'))return json({error:'youtube_not_configured'},409);
 const key=authHeader(req);if(!key)return json({error:'Connection key required'},401);
 let body;
 try{body=await req.json()}catch{return json({error:'invalid_request'},400)}
 const id=body?.channelId;
 if(!validChannelId(id))return json({error:'invalid_channel_id'},400);
 const clientHash=await hash(key);
 await ensureYoutubeVault(env,clientHash);
 const target=await env.DB.prepare('SELECT * FROM oauth_youtube_channels WHERE client_hash=? AND channel_id=?').bind(clientHash,id).first();
 if(!target)return json({error:'youtube_channel_not_connected'},404);
 await env.DB.prepare("INSERT INTO oauth_accounts(client_hash,provider,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,'youtube',?,?,?,?,?,?,?) ON CONFLICT(client_hash,provider) DO UPDATE SET subject=excluded.subject,label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at")
  .bind(clientHash,target.channel_id,target.label,target.avatar,target.token_enc,target.refresh_enc,target.expires_at,target.updated_at).run();
 // Caches for the previously selected channel do not belong to the new channel.
 await env.DB.prepare('DELETE FROM youtube_cache WHERE client_hash=? AND channel_id<>?').bind(clientHash,id).run();
 await env.DB.prepare('DELETE FROM youtube_analytics_cache WHERE client_hash=? AND channel_id<>?').bind(clientHash,id).run();
 await env.DB.prepare('DELETE FROM youtube_video_cache WHERE client_hash=? AND channel_id<>?').bind(clientHash,id).run();
 return json({ok:true,activeChannelId:id});
}
async function removeYoutubeChannel(req,env,id){
 const key=authHeader(req);if(!key)return json({error:'Connection key required'},401);
 if(!validChannelId(id))return json({error:'invalid_channel_id'},400);
 const clientHash=await hash(key);
 await ensureYoutubeVault(env,clientHash);
 const target=await env.DB.prepare('SELECT channel_id FROM oauth_youtube_channels WHERE client_hash=? AND channel_id=?').bind(clientHash,id).first();
 if(!target)return json({error:'youtube_channel_not_connected'},404);
 const selected=await env.DB.prepare("SELECT subject FROM oauth_accounts WHERE client_hash=? AND provider='youtube'").bind(clientHash).first();
 await env.DB.prepare('DELETE FROM oauth_youtube_channels WHERE client_hash=? AND channel_id=?').bind(clientHash,id).run();
 await env.DB.prepare('DELETE FROM youtube_snapshots WHERE client_hash=? AND channel_id=?').bind(clientHash,id).run();
 if(selected?.subject===id){
  const remaining=await env.DB.prepare('SELECT * FROM oauth_youtube_channels WHERE client_hash=? ORDER BY updated_at DESC LIMIT 1').bind(clientHash).first();
  if(remaining){
   await env.DB.prepare("UPDATE oauth_accounts SET subject=?,label=?,avatar=?,token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND provider='youtube'")
    .bind(remaining.channel_id,remaining.label,remaining.avatar,remaining.token_enc,remaining.refresh_enc,remaining.expires_at,remaining.updated_at,clientHash).run();
  }else{
   await env.DB.prepare("DELETE FROM oauth_accounts WHERE client_hash=? AND provider='youtube'").bind(clientHash).run();
  }
 }
 // Cache tables only retain the selected channel; removed-channel data must never leak.
 for(const table of ['youtube_cache','youtube_analytics_cache','youtube_video_cache']){
  await env.DB.prepare('DELETE FROM '+table+' WHERE client_hash=? AND channel_id=?').bind(clientHash,id).run();
 }
 return json({ok:true,activeChannelId:selected?.subject===id?(await env.DB.prepare("SELECT subject FROM oauth_accounts WHERE client_hash=? AND provider='youtube'").bind(clientHash).first())?.subject||null:selected?.subject||null});
}


/** Up to three independently authorized TikTok accounts per local connection key. */
const TIKTOK_ACCOUNT_LIMIT=3;
const validTikTokId=id=>typeof id==='string'&&id.length>0&&id.length<=200&&!/[\u0000-\u001f]/.test(id);
async function ensureTikTokVault(env,clientHash){
 await env.DB.prepare("INSERT OR IGNORE INTO oauth_tiktok_accounts(client_hash,open_id,label,avatar,token_enc,refresh_enc,expires_at,updated_at) SELECT client_hash,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at FROM oauth_accounts WHERE client_hash=? AND provider='tiktok'").bind(clientHash).run();
}
async function tiktokVaultList(env,clientHash){
 await ensureTikTokVault(env,clientHash);
 const rows=await env.DB.prepare('SELECT open_id,label,avatar,expires_at,refresh_enc,updated_at FROM oauth_tiktok_accounts WHERE client_hash=? ORDER BY updated_at DESC').bind(clientHash).all();
 return rows.results||[];
}
async function selectTikTokAccount(req,env){
 if(!config(env,'tiktok'))return json({error:'tiktok_not_configured'},409);
 const key=authHeader(req);if(!key)return json({error:'Connection key required'},401);
 let body;try{body=await req.json()}catch{return json({error:'invalid_request'},400)}
 if(!validTikTokId(body?.accountId))return json({error:'invalid_account_id'},400);
 const clientHash=await hash(key);
 await ensureTikTokVault(env,clientHash);
 const target=await env.DB.prepare('SELECT * FROM oauth_tiktok_accounts WHERE client_hash=? AND open_id=?').bind(clientHash,body.accountId).first();
 if(!target)return json({error:'tiktok_account_not_connected'},404);
 const previous=await env.DB.prepare("SELECT subject FROM oauth_accounts WHERE client_hash=? AND provider='tiktok'").bind(clientHash).first();
 await env.DB.prepare("INSERT INTO oauth_accounts(client_hash,provider,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,'tiktok',?,?,?,?,?,?,?) ON CONFLICT(client_hash,provider) DO UPDATE SET subject=excluded.subject,label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at")
  .bind(clientHash,target.open_id,target.label,target.avatar,target.token_enc,target.refresh_enc,target.expires_at,target.updated_at).run();
 if(previous?.subject!==target.open_id)await env.DB.prepare("DELETE FROM social_overview_cache WHERE client_hash=? AND provider='tiktok'").bind(clientHash).run();
 return json({ok:true,activeTikTokAccount:target.open_id});
}
async function removeTikTokAccount(req,env,rawId){
 const key=authHeader(req);if(!key)return json({error:'Connection key required'},401);
 let id;try{id=decodeURIComponent(rawId)}catch{return json({error:'invalid_account_id'},400)}
 if(!validTikTokId(id))return json({error:'invalid_account_id'},400);
 const clientHash=await hash(key);
 await ensureTikTokVault(env,clientHash);
 const account=await env.DB.prepare('SELECT open_id FROM oauth_tiktok_accounts WHERE client_hash=? AND open_id=?').bind(clientHash,id).first();
 if(!account)return json({error:'tiktok_account_not_connected'},404);
 const selected=await env.DB.prepare("SELECT subject FROM oauth_accounts WHERE client_hash=? AND provider='tiktok'").bind(clientHash).first();
 await env.DB.prepare('DELETE FROM oauth_tiktok_accounts WHERE client_hash=? AND open_id=?').bind(clientHash,id).run();
 await env.DB.prepare("DELETE FROM social_metric_snapshots WHERE client_hash=? AND provider='tiktok' AND subject=?").bind(clientHash,id).run();
 await env.DB.prepare("DELETE FROM social_overview_cache WHERE client_hash=? AND provider='tiktok' AND subject=?").bind(clientHash,id).run();
 let activeId=selected?.subject||null;
 if(activeId===id){
  const remaining=await env.DB.prepare('SELECT * FROM oauth_tiktok_accounts WHERE client_hash=? ORDER BY updated_at DESC LIMIT 1').bind(clientHash).first();
  if(remaining){
   await env.DB.prepare("UPDATE oauth_accounts SET subject=?,label=?,avatar=?,token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND provider='tiktok'")
    .bind(remaining.open_id,remaining.label,remaining.avatar,remaining.token_enc,remaining.refresh_enc,remaining.expires_at,remaining.updated_at,clientHash).run();
   activeId=remaining.open_id;
  }else{
   await env.DB.prepare("DELETE FROM oauth_accounts WHERE client_hash=? AND provider='tiktok'").bind(clientHash).run();
   activeId=null;
  }
 }
 return json({ok:true,activeTikTokAccount:activeId});
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
 if(provider==='youtube'){params.set('access_type','offline');params.set('prompt','select_account consent')}
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
  if(provider==='youtube')await ensureYoutubeVault(env,pending.client_hash);
  if(provider==='tiktok')await ensureTikTokVault(env,pending.client_hash);
  const previousChannel=provider==='youtube'?await env.DB.prepare('SELECT channel_id,refresh_enc FROM oauth_youtube_channels WHERE client_hash=? AND channel_id=?').bind(pending.client_hash,profile.id).first():null;
  if(provider==='youtube'&&!previousChannel){
   const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM oauth_youtube_channels WHERE client_hash=?').bind(pending.client_hash).first();
   if(Number(count?.total)>=YOUTUBE_CHANNEL_LIMIT)return textPage(false,'Maximum 3 YouTube channels are allowed. Remove a channel first.');
  }

  const previousTikTok=provider==='tiktok'?await env.DB.prepare('SELECT open_id,refresh_enc FROM oauth_tiktok_accounts WHERE client_hash=? AND open_id=?').bind(pending.client_hash,profile.id).first():null;
  if(provider==='tiktok'&&!previousTikTok){
   const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM oauth_tiktok_accounts WHERE client_hash=?').bind(pending.client_hash).first();
   if(Number(count?.total)>=TIKTOK_ACCOUNT_LIMIT)return textPage(false,'Maximum 3 TikTok accounts are allowed. Remove one first.');
  }
  const old=await env.DB.prepare('SELECT refresh_enc,subject FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(pending.client_hash,provider).first();
  if(provider!=='youtube'&&provider!=='tiktok'&&old?.subject&&old.subject!==profile.id){
   await env.DB.prepare('DELETE FROM social_overview_cache WHERE client_hash=? AND provider=?').bind(pending.client_hash,provider).run();
   await env.DB.prepare('DELETE FROM social_metric_snapshots WHERE client_hash=? AND provider=?').bind(pending.client_hash,provider).run();
  }
  if(provider==='tiktok'&&old?.subject&&old.subject!==profile.id){
   await env.DB.prepare("DELETE FROM social_overview_cache WHERE client_hash=? AND provider='tiktok'").bind(pending.client_hash).run();
  }
  if(provider==='youtube'&&old?.subject&&old.subject!==profile.id){
   await env.DB.prepare('DELETE FROM youtube_cache WHERE client_hash=?').bind(pending.client_hash).run();
   await env.DB.prepare('DELETE FROM youtube_analytics_cache WHERE client_hash=?').bind(pending.client_hash).run();
   await env.DB.prepare('DELETE FROM youtube_video_cache WHERE client_hash=?').bind(pending.client_hash).run();
  }
  const channelRefresh=refresh||(provider==='youtube'?previousChannel?.refresh_enc:provider==='tiktok'?previousTikTok?.refresh_enc:old?.refresh_enc)||null;
  if(provider==='tiktok'){
   try{
    await env.DB.prepare('INSERT INTO oauth_tiktok_accounts(client_hash,open_id,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(client_hash,open_id) DO UPDATE SET label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
     .bind(pending.client_hash,profile.id,profile.name.slice(0,120),profile.avatar.slice(0,500),access,channelRefresh,expires,now).run();
   }catch(e){if(String(e.message||e).includes('tiktok_account_limit'))return textPage(false,'Maximum 3 TikTok accounts are allowed. Remove one first.');throw e}
  }
  if(provider==='youtube'){
   await env.DB.prepare('INSERT INTO oauth_youtube_channels(client_hash,channel_id,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(client_hash,channel_id) DO UPDATE SET label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
    .bind(pending.client_hash,profile.id,profile.name.slice(0,120),profile.avatar.slice(0,500),access,channelRefresh,expires,now).run();
  }
  await env.DB.prepare('INSERT INTO oauth_accounts(client_hash,provider,subject,label,avatar,token_enc,refresh_enc,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(client_hash,provider) DO UPDATE SET subject=excluded.subject,label=excluded.label,avatar=excluded.avatar,token_enc=excluded.token_enc,refresh_enc=excluded.refresh_enc,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
    .bind(pending.client_hash,provider,profile.id,profile.name.slice(0,120),profile.avatar.slice(0,500),access,channelRefresh,expires,now).run();
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
  await env.DB.prepare('UPDATE oauth_accounts SET token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND provider=? AND subject=?')
   .bind(encryptedAccess,encryptedRefresh,expires,Date.now(),row.client_hash,row.provider,row.subject).run();
  if(row.provider==='tiktok'){
   await env.DB.prepare('UPDATE oauth_tiktok_accounts SET token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND open_id=?')
    .bind(encryptedAccess,encryptedRefresh,expires,Date.now(),row.client_hash,row.subject).run();
  }
  if(row.provider==='youtube'){
   await env.DB.prepare('UPDATE oauth_youtube_channels SET token_enc=?,refresh_enc=?,expires_at=?,updated_at=? WHERE client_hash=? AND channel_id=?')
    .bind(encryptedAccess,encryptedRefresh,expires,Date.now(),row.client_hash,row.subject).run();
  }
  return {...row,token_enc:encryptedAccess,refresh_enc:encryptedRefresh,expires_at:expires,expired:false};
 }catch(e){console.warn('VIVER refresh failed',row.provider);return {...row,expired:true}}
}

/** YouTube channel snapshot. Cached server-side to keep API quota predictable. */
const YOUTUBE_CACHE_MS=10*60*1000;
const asCount=value=>{
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=0?n:null;
};
async function youtubeApi(path,accessToken){
 const res=await fetch('https://www.googleapis.com/youtube/v3/'+path,{headers:{Authorization:'Bearer '+accessToken}});
 if(!res.ok){
  if(res.status===401)throw new Error('youtube_token_rejected');
  if(res.status===403)throw new Error('youtube_permission_or_quota');
  throw new Error('youtube_api_unavailable');
 }
 return res.json();
}
async function readYouTubeHistory(env,clientHash,channelId){
 const rows=await env.DB.prepare('SELECT date,view_count,subscriber_count,video_count FROM youtube_snapshots WHERE client_hash=? AND channel_id=? ORDER BY date DESC LIMIT 60').bind(clientHash,channelId).all();
 return (rows.results||[]).reverse().map(x=>({date:x.date,views:x.view_count,subscribers:x.subscriber_count,videos:x.video_count}));
}
async function youtubeStats(req,env){
 const capability=authHeader(req);
 if(!capability)return json({error:'Connection key required'},401);
 if(!config(env,'youtube'))return json({error:'youtube_not_configured'},409);
 const clientHash=await hash(capability);
 const row=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(clientHash,'youtube').first();
 if(!row)return json({error:'youtube_not_connected'},404);
 const active=await refreshIfNeeded(env,row);
 if(active.expired)return json({error:'youtube_reconnect_required'},401);
 const now=Date.now();
 const cached=await env.DB.prepare('SELECT channel_id,payload,updated_at FROM youtube_cache WHERE client_hash=?').bind(clientHash).first();
 if(cached&&cached.channel_id===row.subject&&now-cached.updated_at<YOUTUBE_CACHE_MS){
  try{
   const snapshot=JSON.parse(cached.payload);
   return json({...snapshot,history:await readYouTubeHistory(env,clientHash,row.subject),updatedAt:cached.updated_at,fromCache:true});
  }catch{ /* Corrupt cache: fetch live instead. */ }
 }
 let channel,latest=[];
 try{
  const accessToken=await decrypted(env,active.token_enc);
  const details=await youtubeApi('channels?part=snippet,statistics,contentDetails&mine=true',accessToken);
  channel=(details.items||[]).find(x=>x.id===row.subject)||details.items?.[0];
  if(!channel?.id||channel.id!==row.subject)return json({error:'youtube_channel_changed'},409);
  const playlist=channel.contentDetails?.relatedPlaylists?.uploads;
  if(playlist&&/^[A-Za-z0-9_-]+$/.test(playlist)){
   try{
    const items=await youtubeApi('playlistItems?part=snippet,contentDetails&maxResults=6&playlistId='+encodeURIComponent(playlist),accessToken);
    const videoIds=(items.items||[]).map(x=>x.contentDetails?.videoId||x.snippet?.resourceId?.videoId).filter(x=>/^[A-Za-z0-9_-]{11}$/.test(x)).slice(0,6);
    if(videoIds.length){
     const videoData=await youtubeApi('videos?part=snippet,statistics,status&id='+videoIds.join(','),accessToken);
     const indexed=new Map((videoData.items||[]).map(x=>[x.id,x]));
     latest=videoIds.map(id=>indexed.get(id)).filter(x=>x&&x.status?.privacyStatus==='public').map(x=>({
      id:x.id,title:String(x.snippet?.title||'YouTube video').slice(0,180),
      publishedAt:x.snippet?.publishedAt||'',views:asCount(x.statistics?.viewCount),
      likes:asCount(x.statistics?.likeCount),comments:asCount(x.statistics?.commentCount),
      url:'https://www.youtube.com/watch?v='+encodeURIComponent(x.id)
     })).slice(0,5);
    }
   }catch(err){console.warn('VIVER recent YouTube videos unavailable',err.message)}
  }
 }catch(err){
  console.warn('VIVER channel statistics failed',err.message);
  const error=['youtube_token_rejected','youtube_permission_or_quota'].includes(err.message)?err.message:'youtube_api_unavailable';
  return json({error},error==='youtube_token_rejected'?401:503);
 }
 const stats=channel.statistics||{};
 const snapshot={
  channel:{
   id:channel.id,title:String(channel.snippet?.title||row.label).slice(0,120),
   description:String(channel.snippet?.description||'').slice(0,300),
   avatar:String(channel.snippet?.thumbnails?.default?.url||'').slice(0,500),
   url:'https://www.youtube.com/channel/'+encodeURIComponent(channel.id),
   hiddenSubscribers:Boolean(stats.hiddenSubscriberCount)
  },
  totals:{
   views:asCount(stats.viewCount),
   subscribers:stats.hiddenSubscriberCount?null:asCount(stats.subscriberCount),
   videos:asCount(stats.videoCount)
  },
  recent:latest
 };
 await env.DB.prepare('INSERT INTO youtube_cache(client_hash,channel_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(client_hash) DO UPDATE SET channel_id=excluded.channel_id,payload=excluded.payload,updated_at=excluded.updated_at')
  .bind(clientHash,channel.id,JSON.stringify(snapshot),now).run();
 await env.DB.prepare('INSERT INTO youtube_snapshots(client_hash,channel_id,date,view_count,subscriber_count,video_count,recorded_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(client_hash,channel_id,date) DO UPDATE SET view_count=excluded.view_count,subscriber_count=excluded.subscriber_count,video_count=excluded.video_count,recorded_at=excluded.recorded_at')
  .bind(clientHash,channel.id,new Date(now).toISOString().slice(0,10),snapshot.totals.views??0,snapshot.totals.subscribers,snapshot.totals.videos??0,now).run();
 return json({...snapshot,history:await readYouTubeHistory(env,clientHash,channel.id),updatedAt:now,fromCache:false});
}

/* YouTube Analytics: real period metrics and discovery reports. No inferred historical data. */
const ANALYTICS_TTL=15*60*1000;
const REPORT_METRICS=['views','likes','comments','shares','subscribersGained','subscribersLost','estimatedMinutesWatched'];
const ALLOWED_STATS=new Set(REPORT_METRICS);
function dateUTC(offsetDays){const d=new Date();d.setUTCHours(12,0,0,0);d.setUTCDate(d.getUTCDate()+offsetDays);return d.toISOString().slice(0,10)}
function dateShift(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function metricNumber(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function reportRows(result){
 const head=(result.columnHeaders||[]).map(x=>x.name);
 return (result.rows||[]).map(row=>Object.fromEntries(head.map((name,i)=>[name,row[i]])));
}
async function analyticsQuery(accessToken,params){
 const u=new URL('https://youtubeanalytics.googleapis.com/v2/reports');
 const options={ids:'channel==MINE',...params};
 Object.entries(options).forEach(([key,value])=>u.searchParams.set(key,String(value)));
 const res=await fetch(u.toString(),{headers:{Authorization:'Bearer '+accessToken}});
 if(!res.ok){
  const data=await res.json().catch(()=>({}));
  const code=String(data.error?.message||'').toLowerCase();
  if(res.status===401||res.status===403&&(/scope|permission|insufficient authentication/.test(code)))
   throw Error('youtube_analytics_permission');
  if(res.status===403&&/not been used|disabled|enable the api|access not configured/.test(code))
   throw Error('youtube_analytics_api_disabled');
  if(res.status===403)throw Error('youtube_analytics_denied');
  throw Error('youtube_analytics_unavailable');
 }
 return reportRows(await res.json());
}
function sumReport(rows,keys){
 const totals=Object.fromEntries(keys.map(x=>[x,0]));
 for(const r of rows)for(const key of keys)totals[key]+=metricNumber(r[key]);
 totals.netSubscribers=totals.subscribersGained-totals.subscribersLost;
 return totals;
}
function changePct(current,previous){return previous>0?Math.round(((current-previous)/previous)*1000)/10:null}
function trafficLabel(type){return String(type||'').slice(0,65)}
async function youtubeAnalytics(req,env){
 const days=Number(new URL(req.url).searchParams.get('days')||7);
 if(![7,30,90].includes(days))return json({error:'invalid_period'},400);
 const capability=authHeader(req);if(!capability)return json({error:'Connection key required'},401);
 if(!config(env,'youtube'))return json({error:'youtube_not_configured'},409);
 const clientHash=await hash(capability);
 const row=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(clientHash,'youtube').first();
 if(!row)return json({error:'youtube_not_connected'},404);
 const active=await refreshIfNeeded(env,row);
 if(active.expired)return json({error:'youtube_reconnect_required'},401);
 const now=Date.now();
 const cached=await env.DB.prepare('SELECT channel_id,payload,updated_at FROM youtube_analytics_cache WHERE client_hash=?').bind(clientHash).first();
 if(cached&&cached.channel_id===row.subject&&now-cached.updated_at<ANALYTICS_TTL){
  try{const snapshot=JSON.parse(cached.payload);if((snapshot.period?.windowDays||7)===days)return json({...snapshot,updatedAt:cached.updated_at,fromCache:true})}catch{}
 }
 let accessToken;
 try{accessToken=await decrypted(env,active.token_enc)}
 catch{return json({error:'youtube_reconnect_required'},401)}
 const params={startDate:dateUTC(-(days*2+10)),endDate:dateUTC(-1),metrics:REPORT_METRICS.join(','),dimensions:'day',sort:'day'};
 let daily;
 try{daily=await analyticsQuery(accessToken,params)}
 catch(e){
  const known=['youtube_analytics_permission','youtube_analytics_api_disabled','youtube_analytics_denied','youtube_analytics_unavailable'];
  const code=known.includes(e.message)?e.message:'youtube_analytics_unavailable';
  return json({error:code},code==='youtube_analytics_permission'?403:503);
 }
 // YouTube omits the newest days until processing is finished; anchor on its last reported day.
 const dates=daily.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.day||''))).sort((a,b)=>a.day.localeCompare(b.day));
 const end=dates.length?dates.at(-1).day:null;
 if(!end)return json({empty:true,reason:'youtube_analytics_no_data',channel:{id:row.subject,label:row.label},period:null,updatedAt:now});
 const start=dateShift(end,1-days),priorEnd=dateShift(end,-days),priorStart=dateShift(end,1-days*2);
 const currentRows=dates.filter(x=>x.day>=start&&x.day<=end);
 const priorRows=dates.filter(x=>x.day>=priorStart&&x.day<=priorEnd);
 const current=sumReport(currentRows,REPORT_METRICS),previous=sumReport(priorRows,REPORT_METRICS);
 // For a recently created channel no prior-day rows might exist. Do not display a made-up percentage.
 const comparisonAvailable=priorRows.length>0;
 const growth={
  views:comparisonAvailable?changePct(current.views,previous.views):null,
  subscribersGained:comparisonAvailable?changePct(current.subscribersGained,previous.subscribersGained):null
 };
 const base={startDate:start,endDate:end};
 const baseSources={...base,metrics:'views',dimensions:'insightTrafficSourceType',sort:'-views',maxResults:15};
 const findTerms={...base,metrics:'views',dimensions:'insightTrafficSourceDetail',filters:'insightTrafficSourceType==YT_SEARCH',sort:'-views',maxResults:10};
 const sourcePromises=[
  analyticsQuery(accessToken,baseSources),
  analyticsQuery(accessToken,findTerms),
  analyticsQuery(accessToken,{...base,metrics:'views',dimensions:'deviceType',sort:'-views',maxResults:7}),
  analyticsQuery(accessToken,{...base,metrics:'views',dimensions:'country',sort:'-views',maxResults:7})
 ];
 const sections=await Promise.allSettled(sourcePromises);
 const get=(i)=>sections[i].status==='fulfilled'?sections[i].value:[];
 const traffic=get(0).map(x=>({type:trafficLabel(x.insightTrafficSourceType),views:metricNumber(x.views)})).filter(x=>x.views>0).slice(0,8);
 const searchTerms=get(1).map(x=>({term:String(x.insightTrafficSourceDetail||'').slice(0,120),views:metricNumber(x.views)})).filter(x=>x.term&&x.views>0).slice(0,8);
 const devices=get(2).map(x=>({type:String(x.deviceType||'').slice(0,60),views:metricNumber(x.views)})).filter(x=>x.views>0).slice(0,6);
 const countries=get(3).map(x=>({code:String(x.country||'').slice(0,3),views:metricNumber(x.views)})).filter(x=>x.views>0).slice(0,6);
 const payload={
  channel:{id:row.subject,label:row.label},
  period:{start,end,windowDays:days,comparisonStart:priorStart,comparisonEnd:priorEnd,comparisonAvailable,latestCompleteDay:end},
  current,previous:comparisonAvailable?previous:null,growth,
  daily:currentRows.map(x=>({date:x.day,views:metricNumber(x.views),subscribersGained:metricNumber(x.subscribersGained)})),
  traffic,searchTerms,devices,countries,
  availability:{
   traffic:sections[0].status==='fulfilled',searchTerms:sections[1].status==='fulfilled',
   devices:sections[2].status==='fulfilled',countries:sections[3].status==='fulfilled'
  }
 };
 await env.DB.prepare('INSERT INTO youtube_analytics_cache(client_hash,channel_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(client_hash) DO UPDATE SET channel_id=excluded.channel_id,payload=excluded.payload,updated_at=excluded.updated_at')
 .bind(clientHash,row.subject,JSON.stringify(payload),now).run();
 return json({...payload,updatedAt:now,fromCache:false});
}


/* Creator video studio: owned public uploads, real video reports and retention. */
const VIDEO_CACHE_MS=12*60*1000;
const validVideo=id=>/^[A-Za-z0-9_-]{11}$/.test(id||'');
async function ownedYoutube(req,env){
 const capability=authHeader(req);
 if(!capability)return {error:json({error:'Connection key required'},401)};
 const clientHash=await hash(capability);
 const row=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(clientHash,'youtube').first();
 if(!row)return {error:json({error:'youtube_not_connected'},404)};
 const active=await refreshIfNeeded(env,row);
 if(active.expired)return {error:json({error:'youtube_reconnect_required'},401)};
 return {clientHash,row,accessToken:await decrypted(env,active.token_enc)};
}
function publicVideo(v){
 const snippet=v.snippet||{},stats=v.statistics||{};
 return {id:v.id,title:String(snippet.title||'').slice(0,180),publishedAt:snippet.publishedAt||'',
  thumbnail:String(snippet.thumbnails?.medium?.url||snippet.thumbnails?.default?.url||'').slice(0,500),
  views:asCount(stats.viewCount),likes:asCount(stats.likeCount),comments:asCount(stats.commentCount),
  duration:v.contentDetails?.duration||'',url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.id)};
}
async function videoCatalog(env,owner,cursor=''){
 if(cursor&&!/^[A-Za-z0-9_-]{2,512}$/.test(cursor))throw Error('invalid_page_cursor');
 const cached=cursor?null:await env.DB.prepare('SELECT channel_id,payload,updated_at FROM youtube_video_cache WHERE client_hash=?').bind(owner.clientHash).first();
 if(cached&&cached.channel_id===owner.row.subject&&Date.now()-cached.updated_at<VIDEO_CACHE_MS){
  try{return {...JSON.parse(cached.payload),updatedAt:cached.updated_at,fromCache:true}}catch{}
 }
 const channels=await youtubeApi('channels?part=contentDetails&mine=true',owner.accessToken);
 const channel=(channels.items||[]).find(x=>x.id===owner.row.subject);
 const playlistId=channel?.contentDetails?.relatedPlaylists?.uploads;
 if(!playlistId||!/^[A-Za-z0-9_-]+$/.test(playlistId))return {channelId:owner.row.subject,videos:[],updatedAt:Date.now()};
 const listing=await youtubeApi('playlistItems?part=contentDetails&maxResults=50&playlistId='+encodeURIComponent(playlistId)+(cursor?'&pageToken='+encodeURIComponent(cursor):''),owner.accessToken);
 const ids=(listing.items||[]).map(x=>x.contentDetails?.videoId).filter(validVideo).slice(0,50);
 let videos=[];
 if(ids.length){
  const details=await youtubeApi('videos?part=snippet,statistics,contentDetails,status&id='+ids.join(','),owner.accessToken);
  const index=new Map((details.items||[]).map(x=>[x.id,x]));
  videos=ids.map(id=>index.get(id)).filter(x=>x&&x.status?.privacyStatus==='public'&&x.snippet?.channelId===owner.row.subject).map(publicVideo);
 }
 const start=dateUTC(-7),end=dateUTC(-1);
 try{
  if(videos.length){
   const report=await analyticsQuery(owner.accessToken,{startDate:start,endDate:end,dimensions:'video',
    filters:'video=='+videos.map(x=>x.id).join(','),metrics:'views,likes,comments,subscribersGained,estimatedMinutesWatched,averageViewDuration',
    sort:'-views',maxResults:50});
   const stats=new Map(report.map(r=>[r.video,r]));
   videos=videos.map(v=>{
    const r=stats.get(v.id);
    return {...v,week:r?{views:asCount(r.views),likes:asCount(r.likes),comments:asCount(r.comments),
     subscribersGained:asCount(r.subscribersGained),watchMinutes:asCount(r.estimatedMinutesWatched),
     avgViewSeconds:asCount(r.averageViewDuration)}:null};
   });
  }
 }catch(e){console.warn('VIVER video weekly analytics unavailable',e.message)}
 const timestamp=Date.now(),payload={channelId:owner.row.subject,videos,reportPeriod:{start,end},nextPageToken:listing.nextPageToken||null};
 if(!cursor)await env.DB.prepare('INSERT INTO youtube_video_cache(client_hash,channel_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(client_hash) DO UPDATE SET channel_id=excluded.channel_id,payload=excluded.payload,updated_at=excluded.updated_at')
  .bind(owner.clientHash,owner.row.subject,JSON.stringify(payload),timestamp).run();
 return {...payload,updatedAt:timestamp,fromCache:false};
}
async function youtubeVideoLibrary(req,env){
 const o=await ownedYoutube(req,env);if(o.error)return o.error;
 try{return json(await videoCatalog(env,o,new URL(req.url).searchParams.get('cursor')||''))}
 catch(e){console.warn('VIVER video catalog unavailable',e.message);return json({error:e.message==='invalid_page_cursor'?'invalid_page_cursor':'youtube_videos_unavailable'},e.message==='invalid_page_cursor'?400:503)}
}
async function youtubeVideoRetention(req,env,id){
 const o=await ownedYoutube(req,env);if(o.error)return o.error;
 if(!validVideo(id))return json({error:'invalid_video_id'},400);
 try{
  const ownership=await youtubeApi('videos?part=snippet,status&id='+encodeURIComponent(id),o.accessToken);
  const video=(ownership.items||[]).find(x=>x.id===id);
  if(!video||video.snippet?.channelId!==o.row.subject||video.status?.privacyStatus!=='public')return json({error:'video_not_in_channel'},404);
  const end=dateUTC(-1);
  const result=await analyticsQuery(o.accessToken,{startDate:'2015-01-01',endDate:end,filters:'video=='+id,
   dimensions:'elapsedVideoTimeRatio',metrics:'audienceWatchRatio',sort:'elapsedVideoTimeRatio'});
  return json({id,points:result.map(x=>({position:Number(x.elapsedVideoTimeRatio),ratio:Number(x.audienceWatchRatio)}))
    .filter(x=>Number.isFinite(x.position)&&Number.isFinite(x.ratio)&&x.position>=0&&x.position<=1&&x.ratio>=0).slice(0,200),
   period:{end},note:'audience retention can be unavailable for low traffic or recent uploads'});
 }catch(e){console.warn('VIVER retention report unavailable',e.message);return json({error:'youtube_retention_unavailable'},503)}
}
async function youtubeVideoCompare(req,env){
 const o=await ownedYoutube(req,env);if(o.error)return o.error;
 const url=new URL(req.url),a=url.searchParams.get('a'),b=url.searchParams.get('b');
 if(!validVideo(a)||!validVideo(b)||a===b)return json({error:'invalid_video_ids'},400);
 try{
  const ownership=await youtubeApi('videos?part=snippet,statistics,status&id='+encodeURIComponent(a+','+b),o.accessToken);
  const selected=[a,b].map(id=>(ownership.items||[]).find(v=>v.id===id&&v.snippet?.channelId===o.row.subject&&v.status?.privacyStatus==='public')).map(v=>v&&publicVideo(v));
  if(selected.some(x=>!x))return json({error:'video_not_in_channel'},404);
  const metrics='views,likes,comments,subscribersGained,estimatedMinutesWatched,averageViewDuration';
  const reports=await Promise.allSettled(selected.map(async v=>{
   const start=v.publishedAt?.slice(0,10);
   if(!/^\d{4}-\d\d-\d\d$/.test(start||''))return {...v,report:null};
   const expected=dateShift(start,6),end=expected<dateUTC(-1)?expected:dateUTC(-1);
   if(end<start)return {...v,report:null,partial:true};
   const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
   const rows=await analyticsQuery(o.accessToken,{startDate:start,endDate:end,filters:'video=='+v.id,metrics});
   const r=rows[0]||null;
   return {id:v.id,title:v.title,publishedAt:v.publishedAt,period:{start,end,days,complete:days===7},
    ...(r?{}:{report:null}),
    report:r?{views:asCount(r.views),likes:asCount(r.likes),comments:asCount(r.comments),
     subscribersGained:asCount(r.subscribersGained),watchMinutes:asCount(r.estimatedMinutesWatched),
     avgViewSeconds:asCount(r.averageViewDuration)}:null};
  }));
  return json({videos:reports.map((r,i)=>r.status==='fulfilled'?r.value:{id:selected[i].id,title:selected[i].title,error:'analytics_unavailable'}),
   comparable:reports.every(r=>r.status==='fulfilled'&&r.value?.period?.complete&&r.value?.report)});
 }catch(e){return json({error:'youtube_compare_unavailable'},503)}
}


/** Server-only read-only insights for each independently authorized network. */
const SOCIAL_CACHE_MS=15*60*1000;
const socialNumber=x=>x===null||x===undefined||x===''?null:(Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null);
const socialSafe=x=>String(x||'').slice(0,200);
async function providerJson(url,token,opts={}){
 const response=await fetch(url,{method:opts.method||'GET',headers:{Authorization:'Bearer '+token,...(opts.headers||{})},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
 if(!response.ok){
  if(response.status===401)throw Error('social_token_expired');
  if(response.status===403)throw Error('social_access_denied');
  if(response.status===429)throw Error('social_rate_limited');
  throw Error('social_provider_unavailable');
 }
 const result=await response.json();
 if(result.error&&typeof result.error==='object'&&result.error.code&&result.error.code!=='ok')throw Error('social_access_denied');
 return result;
}
async function socialDetails(provider,token,env){
 if(provider==='twitch'){
  const headers={'Client-Id':env.TWITCH_CLIENT_ID};
  const users=await providerJson('https://api.twitch.tv/helix/users',token,{headers});
  const user=users.data?.[0];if(!user?.id)throw Error('social_profile_unavailable');
  const id=encodeURIComponent(user.id);
  const calls=await Promise.allSettled([
   providerJson('https://api.twitch.tv/helix/channels/followers?broadcaster_id='+id,token,{headers}),
   providerJson('https://api.twitch.tv/helix/streams?user_id='+id,token,{headers}),
   providerJson('https://api.twitch.tv/helix/videos?user_id='+id+'&first=20&type=archive',token,{headers}),
   providerJson('https://api.twitch.tv/helix/clips?broadcaster_id='+id+'&first=20',token,{headers}),
   providerJson('https://api.twitch.tv/helix/channels?broadcaster_id='+id,token,{headers})
  ]);
  const get=i=>calls[i].status==='fulfilled'?calls[i].value:null;
  const follower=socialNumber(get(0)?.total);
  const stream=get(1)?.data?.[0],channel=get(4)?.data?.[0];
  const videos=(get(2)?.data||[]).filter(x=>x.id).map(x=>({
   id:socialSafe(x.id),title:socialSafe(x.title),publishedAt:String(x.published_at||x.created_at||''),
   url:String(x.url||'').startsWith('https://www.twitch.tv/')?x.url:'',
   views:socialNumber(x.view_count),kind:'vod',thumbnail:String(x.thumbnail_url||'').slice(0,400)
  }));
  const clips=(get(3)?.data||[]).filter(x=>x.id).map(x=>({
   id:socialSafe(x.id),title:socialSafe(x.title),publishedAt:String(x.created_at||''),
   url:String(x.url||'').startsWith('https://clips.twitch.tv/')||String(x.url||'').startsWith('https://www.twitch.tv/')?x.url:'',
   views:socialNumber(x.view_count),kind:'clip',thumbnail:String(x.thumbnail_url||'').slice(0,400)
  }));
  return {
   account:{id:String(user.id),label:socialSafe(user.display_name||user.login),avatar:String(user.profile_image_url||''),url:'https://www.twitch.tv/'+encodeURIComponent(user.login||'')},
   metrics:{followers:follower,liveViewers:stream?socialNumber(stream.viewer_count):null,vods:null,clips:null},
   live:stream?{online:true,title:socialSafe(stream.title),viewers:socialNumber(stream.viewer_count),game:socialSafe(stream.game_name),startedAt:stream.started_at}: {online:false,title:socialSafe(channel?.title),game:socialSafe(channel?.game_name)},
   content:[...videos,...clips].sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0,35),
   sections:{followers:calls[0].status==='fulfilled',live:calls[1].status==='fulfilled',vods:calls[2].status==='fulfilled',clips:calls[3].status==='fulfilled'},
   notes:['twitch_no_historical_audience_api']
  };
 }
 if(provider==='tiktok'){
  const fields='open_id,display_name,avatar_url,username,profile_deep_link,follower_count,following_count,likes_count,video_count';
  const userData=await providerJson('https://open.tiktokapis.com/v2/user/info/?fields='+fields,token);
  const user=userData.data?.user;if(!user?.open_id)throw Error('social_profile_unavailable');
  let list=null;
  try{
   list=await providerJson('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count',token,
   {method:'POST',headers:{'Content-Type':'application/json'},body:{max_count:20}});
  }catch(e){console.warn('VIVER TikTok video list unavailable',e.message)}
  const content=(list?.data?.videos||[]).map(x=>({
    id:String(x.id||'').slice(0,40),title:socialSafe(x.title||x.video_description),publishedAt:x.create_time?new Date(Number(x.create_time)*1000).toISOString():'',
    url:/^https:\/\/(www\.)?tiktok\.com\//.test(x.share_url||'')?String(x.share_url).slice(0,500):'',
    thumbnail:String(x.cover_image_url||'').slice(0,500),kind:'video',
    views:socialNumber(x.view_count),likes:socialNumber(x.like_count),comments:socialNumber(x.comment_count),shares:socialNumber(x.share_count)
   })).filter(x=>x.id);
  return {
    account:{id:String(user.open_id),label:socialSafe(user.display_name||user.username),avatar:String(user.avatar_url||''),
     url:user.username?'https://www.tiktok.com/@'+encodeURIComponent(user.username):''},
    metrics:{followers:socialNumber(user.follower_count),following:socialNumber(user.following_count),likes:socialNumber(user.likes_count),videos:socialNumber(user.video_count)},
    content,sections:{videos:!!list},notes:['tiktok_public_display_api_no_historical_view_reports']
  };
 }
 if(provider==='x'){
  const me=await providerJson('https://api.x.com/2/users/me?user.fields=public_metrics,profile_image_url,username,description',token);
  const user=me.data;if(!user?.id)throw Error('social_profile_unavailable');
  let timeline=null;
  try{timeline=await providerJson('https://api.x.com/2/users/'+encodeURIComponent(user.id)+'/tweets?max_results=25&tweet.fields=created_at,public_metrics,author_id&exclude=retweets',token)}
  catch(e){console.warn('VIVER X timeline unavailable',e.message)}
  const content=(timeline?.data||[]).filter(x=>String(x.author_id||user.id)===String(user.id)).map(x=>({
   id:String(x.id||'').slice(0,24),title:socialSafe(x.text||''),
   publishedAt:String(x.created_at||''),kind:'post',
   url:user.username?'https://x.com/'+encodeURIComponent(user.username)+'/status/'+encodeURIComponent(x.id):'',
   views:socialNumber(x.public_metrics?.impression_count),likes:socialNumber(x.public_metrics?.like_count),
   comments:socialNumber(x.public_metrics?.reply_count),shares:socialNumber(x.public_metrics?.retweet_count),
   quotes:socialNumber(x.public_metrics?.quote_count)
  }));
  const m=user.public_metrics||{};
  return {
   account:{id:String(user.id),label:socialSafe(user.name||user.username),avatar:String(user.profile_image_url||''),
    url:user.username?'https://x.com/'+encodeURIComponent(user.username):''},
   metrics:{followers:socialNumber(m.followers_count),following:socialNumber(m.following_count),posts:socialNumber(m.tweet_count),likes:socialNumber(m.like_count)},
   content,sections:{posts:!!timeline},notes:['x_timeline_and_insights_depend_on_api_plan']
  };
 }
 throw Error('invalid_social_provider');
}
async function socialOverview(req,env,provider){
 if(!['twitch','tiktok','x'].includes(provider))return json({error:'Unknown provider'},404);
 const key=authHeader(req);if(!key)return json({error:'Connection key required'},401);
 const clientHash=await hash(key);
 const row=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=? AND provider=?').bind(clientHash,provider).first();
 if(!row)return json({error:'social_not_connected'},404);
 const active=await refreshIfNeeded(env,row);
 if(active.expired)return json({error:'social_reconnect_required'},401);
 if(!config(env,provider))return json({error:'social_provider_not_configured'},409);
 const cached=await env.DB.prepare('SELECT subject,payload,updated_at FROM social_overview_cache WHERE client_hash=? AND provider=?').bind(clientHash,provider).first();
 if(cached&&cached.subject===row.subject&&Date.now()-cached.updated_at<SOCIAL_CACHE_MS){
  try{
   const payload=JSON.parse(cached.payload);
   const history=await env.DB.prepare('SELECT date,metrics FROM social_metric_snapshots WHERE client_hash=? AND provider=? AND subject=? ORDER BY date DESC LIMIT 45').bind(clientHash,provider,row.subject).all();
   return json({...payload,history:(history.results||[]).reverse().map(x=>({date:x.date,metrics:JSON.parse(x.metrics)})),updatedAt:cached.updated_at,fromCache:true});
  }catch{}
 }
 let details;
 try{details=await socialDetails(provider,await decrypted(env,active.token_enc),env)}
 catch(e){console.warn('VIVER social overview failed',provider,e.message);return json({error:['social_token_expired','social_access_denied','social_rate_limited'].includes(e.message)?e.message:'social_provider_unavailable'},
  e.message==='social_token_expired'?401:e.message==='social_access_denied'?403:e.message==='social_rate_limited'?429:503)}
 if(String(details.account?.id)!==String(row.subject))return json({error:'social_account_changed'},409);
 const now=Date.now(),payload={provider,...details};
 await env.DB.prepare('INSERT INTO social_overview_cache(client_hash,provider,subject,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(client_hash,provider) DO UPDATE SET subject=excluded.subject,payload=excluded.payload,updated_at=excluded.updated_at').bind(clientHash,provider,row.subject,JSON.stringify(payload),now).run();
 await env.DB.prepare('INSERT INTO social_metric_snapshots(client_hash,provider,subject,date,metrics,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(client_hash,provider,subject,date) DO UPDATE SET metrics=excluded.metrics,updated_at=excluded.updated_at').bind(clientHash,provider,row.subject,new Date(now).toISOString().slice(0,10),JSON.stringify(details.metrics),now).run();
 const h=await env.DB.prepare('SELECT date,metrics FROM social_metric_snapshots WHERE client_hash=? AND provider=? AND subject=? ORDER BY date DESC LIMIT 45').bind(clientHash,provider,row.subject).all();
 return json({...payload,history:(h.results||[]).reverse().map(x=>({date:x.date,metrics:JSON.parse(x.metrics)})),updatedAt:now,fromCache:false});
}

async function connections(req,env){
 const token=authHeader(req);if(!token)return json({error:'Connection key required'},401);
 const clientHash=await hash(token);
 const youtubeChannels=await youtubeVaultList(env,clientHash);
 const tiktokAccounts=await tiktokVaultList(env,clientHash);
 const rows=await env.DB.prepare('SELECT * FROM oauth_accounts WHERE client_hash=?').bind(clientHash).all();
 const items=[];
 for(const row of rows.results||[]){
  const active=await refreshIfNeeded(env,row);
  items.push({provider:row.provider,id:row.subject,label:row.label,avatar:row.avatar,connected:row.provider==='youtube'?youtubeChannels.some(x=>x.expires_at>Date.now()||x.refresh_enc):row.provider==='tiktok'?tiktokAccounts.some(x=>x.expires_at>Date.now()||x.refresh_enc):!active.expired,expires_at:active.expires_at});
 }
 return json({providers:allConfigs(env),connections:items,youtubeChannels:youtubeChannels.map(x=>({id:x.channel_id,label:x.label,avatar:x.avatar,canRefresh:Boolean(x.refresh_enc),expired:x.expires_at<=Date.now()})),activeYoutubeChannel:rows.results?.find(x=>x.provider==='youtube')?.subject||null,maxYoutubeChannels:YOUTUBE_CHANNEL_LIMIT,tiktokAccounts:tiktokAccounts.map(x=>({id:x.open_id,label:x.label,avatar:x.avatar,canRefresh:Boolean(x.refresh_enc),expired:x.expires_at<=Date.now()})),activeTikTokAccount:rows.results?.find(x=>x.provider==='tiktok')?.subject||null,maxTikTokAccounts:TIKTOK_ACCOUNT_LIMIT});
}
async function disconnect(req,env,provider){
 if(!PROVIDERS[provider])return json({error:'Unknown provider'},404);
 const token=authHeader(req);if(!token)return json({error:'Connection key required'},401);
 const hashKey=await hash(token);
 if(provider==='tiktok')await env.DB.prepare('DELETE FROM oauth_tiktok_accounts WHERE client_hash=?').bind(hashKey).run();
 if(provider==='youtube'){
  await env.DB.prepare('DELETE FROM oauth_youtube_channels WHERE client_hash=?').bind(hashKey).run();
  await env.DB.prepare('DELETE FROM youtube_cache WHERE client_hash=?').bind(hashKey).run();
  await env.DB.prepare('DELETE FROM youtube_snapshots WHERE client_hash=?').bind(hashKey).run();
  await env.DB.prepare('DELETE FROM youtube_analytics_cache WHERE client_hash=?').bind(hashKey).run();
  await env.DB.prepare('DELETE FROM youtube_video_cache WHERE client_hash=?').bind(hashKey).run();
 }
 await env.DB.prepare('DELETE FROM social_overview_cache WHERE client_hash=? AND provider=?').bind(hashKey,provider).run();
 await env.DB.prepare('DELETE FROM social_metric_snapshots WHERE client_hash=? AND provider=?').bind(hashKey,provider).run();
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
   if(method==='POST'&&path==='/youtube/channels/select')return selectYoutubeChannel(req,env);
   if(method==='POST'&&path==='/tiktok/accounts/select')return selectTikTokAccount(req,env);
   const removeTikTok=/^\/tiktok\/accounts\/([^/]+)$/.exec(path);
   if(method==='DELETE'&&removeTikTok)return removeTikTokAccount(req,env,removeTikTok[1]);
   const removeChannel=/^\/youtube\/channels\/(UC[A-Za-z0-9_-]{22})$/.exec(path);
   if(method==='DELETE'&&removeChannel)return removeYoutubeChannel(req,env,removeChannel[1]);
   if(method==='GET'&&path==='/youtube/stats')return youtubeStats(req,env);
   if(method==='GET'&&path==='/youtube/analytics')return youtubeAnalytics(req,env);
   const socialMatch=/^\/social\/(twitch|tiktok|x)\/overview$/.exec(path);
   if(method==='GET'&&socialMatch)return socialOverview(req,env,socialMatch[1]);
   if(method==='GET'&&path==='/youtube/videos')return youtubeVideoLibrary(req,env);
   if(method==='GET'&&path==='/youtube/videos/compare')return youtubeVideoCompare(req,env);
   const retention=/^\/youtube\/videos\/([A-Za-z0-9_-]{11})\/retention$/.exec(path);
   if(method==='GET'&&retention)return youtubeVideoRetention(req,env,retention[1]);
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
