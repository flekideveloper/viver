/* Isolated VIVER OAuth Worker tests; never use real platform credentials. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../auth-worker/src/index.js'),'utf8');
const youtubeVault=new Map(),tiktokVault=new Map(),pending=new Map(),accounts=new Map(),youtubeCache=new Map(),snapshots=new Map(),analyticsCache=new Map(),videoCache=new Map(),socialCache=new Map(),socialHistory=new Map();
const DB={
 prepare(sql){const entry={sql,values:[],bind(...args){this.values=args;return this},
  async first(){
   const [a,b]=this.values;
   if(sql.includes('COUNT(*)'))return {total:sql.includes('oauth_youtube_channels')?[...youtubeVault.values()].filter(v=>v.client_hash===a).length:sql.includes('oauth_tiktok_accounts')?[...tiktokVault.values()].filter(v=>v.client_hash===a).length:[...pending.values()].filter(v=>v.client_hash===a).length};
   if(sql.includes('FROM oauth_pending'))return pending.get(a)&&pending.get(a).provider===b?pending.get(a):null;
   if(sql.includes('FROM oauth_youtube_channels'))return b?youtubeVault.get(a+'|'+b)||null:[...youtubeVault.values()].filter(v=>v.client_hash===a).sort((x,y)=>y.updated_at-x.updated_at)[0]||null;
    if(sql.includes('FROM oauth_tiktok_accounts'))return b?tiktokVault.get(a+'|'+b)||null:[...tiktokVault.values()].filter(v=>v.client_hash===a).sort((x,y)=>y.updated_at-x.updated_at)[0]||null;
   if(sql.includes('SELECT subject FROM oauth_accounts'))return accounts.get(a+'|'+(sql.includes("provider='tiktok'")?'tiktok':'youtube'))||null;
   if(sql.includes('FROM social_overview_cache'))return socialCache.get(a+'|'+b)||null;
   if(sql.includes('FROM youtube_video_cache'))return videoCache.get(a)||null;
   if(sql.includes('FROM youtube_analytics_cache'))return analyticsCache.get(a)||null;
   if(sql.includes('FROM youtube_cache'))return youtubeCache.get(a)||null;
   if(sql.includes('FROM oauth_accounts'))return accounts.get(a+'|'+b)||null;
   return null
  },
  async all(){const [h,id,subject]=this.values;if(sql.includes('FROM oauth_youtube_channels'))return {results:[...youtubeVault.values()].filter(v=>v.client_hash===h).sort((a,b)=>b.updated_at-a.updated_at)};if(sql.includes('FROM oauth_tiktok_accounts'))return {results:[...tiktokVault.values()].filter(v=>v.client_hash===h).sort((a,b)=>b.updated_at-a.updated_at)};if(sql.includes('social_metric_snapshots'))return {results:[...socialHistory.values()].filter(x=>x.client_hash===h&&x.provider===id&&x.subject===subject).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,45)};
   if(sql.includes('youtube_snapshots'))return {results:[...snapshots.values()].filter(x=>x.client_hash===h&&x.channel_id===id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60)};
   return {results:[...accounts.values()].filter(v=>v.client_hash===h)}},
  async run(){
   const v=this.values;
   if(sql.includes('DELETE FROM oauth_pending WHERE created_at')){for(const [k,p] of pending){if(p.created_at<v[0])pending.delete(k)}}
   if(sql.includes('INSERT INTO oauth_pending'))pending.set(v[0],{state:v[0],client_hash:v[1],provider:v[2],verifier:v[3],created_at:v[4]});
   if(sql.includes('DELETE FROM oauth_pending WHERE state'))pending.delete(v[0]);
   if(sql.includes('INSERT OR IGNORE INTO oauth_youtube_channels')){
    const x=accounts.get(v[0]+'|youtube');if(x&&!youtubeVault.has(v[0]+'|'+x.subject))youtubeVault.set(v[0]+'|'+x.subject,{client_hash:v[0],channel_id:x.subject,label:x.label,avatar:x.avatar,token_enc:x.token_enc,refresh_enc:x.refresh_enc,expires_at:x.expires_at,updated_at:x.updated_at});
   }
   if(sql.includes('INSERT OR IGNORE INTO oauth_tiktok_accounts')){
     const x=accounts.get(v[0]+'|tiktok');if(x&&!tiktokVault.has(v[0]+'|'+x.subject))tiktokVault.set(v[0]+'|'+x.subject,{client_hash:v[0],open_id:x.subject,label:x.label,avatar:x.avatar,token_enc:x.token_enc,refresh_enc:x.refresh_enc,expires_at:x.expires_at,updated_at:x.updated_at});
    }
    if(sql.includes('INSERT INTO oauth_tiktok_accounts')){
     const k=v[0]+'|'+v[1];if(!tiktokVault.has(k)&&[...tiktokVault.values()].filter(a=>a.client_hash===v[0]).length>=3)throw Error('tiktok_account_limit');
     tiktokVault.set(k,{client_hash:v[0],open_id:v[1],label:v[2],avatar:v[3],token_enc:v[4],refresh_enc:v[5],expires_at:v[6],updated_at:v[7]});
    }
    if(sql.includes('UPDATE oauth_tiktok_accounts SET')){const x=tiktokVault.get(v[4]+'|'+v[5]);if(x)Object.assign(x,{token_enc:v[0],refresh_enc:v[1],expires_at:v[2],updated_at:v[3]})}
    if(sql.includes('INSERT INTO oauth_youtube_channels'))youtubeVault.set(v[0]+'|'+v[1],{client_hash:v[0],channel_id:v[1],label:v[2],avatar:v[3],token_enc:v[4],refresh_enc:v[5],expires_at:v[6],updated_at:v[7]});
   if(sql.includes('UPDATE oauth_youtube_channels SET')){const x=youtubeVault.get(v[4]+'|'+v[5]);if(x)Object.assign(x,{token_enc:v[0],refresh_enc:v[1],expires_at:v[2],updated_at:v[3]})}
   if(sql.includes('INSERT INTO oauth_accounts')){const v2=sql.includes("'youtube'")?[v[0],'youtube',...v.slice(1)]:sql.includes("'tiktok'")?[v[0],'tiktok',...v.slice(1)]:v;accounts.set(v2[0]+'|'+v2[1],{client_hash:v2[0],provider:v2[1],subject:v2[2],label:v2[3],avatar:v2[4],token_enc:v2[5],refresh_enc:v2[6],expires_at:v2[7],updated_at:v2[8]})}
   if(sql.includes('UPDATE oauth_accounts SET subject=')){const x=accounts.get(v[7]+'|'+(sql.includes("provider='tiktok'")?'tiktok':'youtube'));if(x)Object.assign(x,{subject:v[0],label:v[1],avatar:v[2],token_enc:v[3],refresh_enc:v[4],expires_at:v[5],updated_at:v[6]})}
   if(sql.includes('UPDATE oauth_accounts SET token_enc=')){const x=accounts.get(v[4]+'|'+v[5]);if(x)Object.assign(x,{token_enc:v[0],refresh_enc:v[1],expires_at:v[2],updated_at:v[3]})}
   if(sql.includes('INSERT INTO social_overview_cache'))socialCache.set(v[0]+'|'+v[1],{client_hash:v[0],provider:v[1],subject:v[2],payload:v[3],updated_at:v[4]});
   if(sql.includes('INSERT INTO social_metric_snapshots'))socialHistory.set(v[0]+'|'+v[1]+'|'+v[2]+'|'+v[3],{client_hash:v[0],provider:v[1],subject:v[2],date:v[3],metrics:v[4],updated_at:v[5]});
   if(sql.includes('INSERT INTO youtube_video_cache'))videoCache.set(v[0],{client_hash:v[0],channel_id:v[1],payload:v[2],updated_at:v[3]});
   if(sql.includes('INSERT INTO youtube_analytics_cache'))analyticsCache.set(v[0],{client_hash:v[0],channel_id:v[1],payload:v[2],updated_at:v[3]});
   if(sql.includes('INSERT INTO youtube_cache'))youtubeCache.set(v[0],{client_hash:v[0],channel_id:v[1],payload:v[2],updated_at:v[3]});
   if(sql.includes('INSERT INTO youtube_snapshots'))snapshots.set(v[0]+'|'+v[1]+'|'+v[2],{client_hash:v[0],channel_id:v[1],date:v[2],view_count:v[3],subscriber_count:v[4],video_count:v[5],recorded_at:v[6]});
   if(sql.includes('DELETE FROM social_overview_cache')){const k=v[0]+'|'+(sql.includes("provider='tiktok'")?'tiktok':v[1]);if(!sql.includes('subject=?')||socialCache.get(k)?.subject===v.at(-1))socialCache.delete(k)}
   if(sql.includes('DELETE FROM social_metric_snapshots')){for(const [k,row] of socialHistory){if(row.client_hash===v[0]&&row.provider===(sql.includes("provider='tiktok'")?'tiktok':v[1])&&(!sql.includes('subject=?')||row.subject===v.at(-1)))socialHistory.delete(k)}}
   if(sql.includes('DELETE FROM youtube_video_cache'))videoCache.delete(v[0]);
   if(sql.includes('DELETE FROM youtube_analytics_cache'))analyticsCache.delete(v[0]);
   if(sql.includes('DELETE FROM youtube_cache'))youtubeCache.delete(v[0]);
   if(sql.includes('DELETE FROM youtube_snapshots')){for(const [k,row] of snapshots){if(row.client_hash===v[0]&&(v.length<2||row.channel_id===v[1]))snapshots.delete(k)}}
   if(sql.includes('DELETE FROM oauth_youtube_channels')){for(const [k,row] of youtubeVault){if(row.client_hash===v[0]&&(v.length<2||row.channel_id===v[1]))youtubeVault.delete(k)}}
    if(sql.includes('DELETE FROM oauth_tiktok_accounts')){for(const [k,row] of tiktokVault){if(row.client_hash===v[0]&&(v.length<2||row.open_id===v[1]))tiktokVault.delete(k)}}
   if(sql.includes('DELETE FROM oauth_accounts'))accounts.delete(v[0]+'|'+(sql.includes("provider='tiktok'")?'tiktok':v[1]));
   return {success:true}
  }};return entry}
};
const testKey=btoa(String.fromCharCode(...new Uint8Array(32).fill(8))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const env={DB,TOKEN_KEY:testKey,GOOGLE_CLIENT_ID:'test-google',GOOGLE_CLIENT_SECRET:'fake-secret',TIKTOK_CLIENT_KEY:'test-tiktok',TIKTOK_CLIENT_SECRET:'fake-secret',TWITCH_CLIENT_ID:'test-twitch',TWITCH_CLIENT_SECRET:'fake-secret',X_CLIENT_ID:'test-x',X_CLIENT_SECRET:'fake-secret'};
const seen=[];
const mockFetch=async(url,opts)=>{
 seen.push({url:String(url),body:String(opts?.body||'')});
 if(String(url).includes('youtubeanalytics.googleapis.com/v2/reports')){
  const u=new URL(String(url)),dim=u.searchParams.get('dimensions'),toObj=(headers,rows)=>({columnHeaders:headers.map(name=>({name})),rows});
  if(dim==='elapsedVideoTimeRatio')return Response.json(toObj([dim,'audienceWatchRatio'],[[0,0.92],[0.5,0.68],[1,0.45]]));
  if(dim==='video')return Response.json(toObj(['video','views','likes','comments','subscribersGained','estimatedMinutesWatched','averageViewDuration'],[['AbCdEfGhIjK',250,21,5,3,300,65]]));
  if(!dim)return Response.json(toObj(u.searchParams.get('metrics').split(','),[[440,30,7,6,600,64]]));
  if(dim==='day'){
   const date=new Date(u.searchParams.get('endDate')+'T12:00:00Z');
   const metrics=u.searchParams.get('metrics').split(',');
   const startDate=new Date(u.searchParams.get('startDate')+'T12:00:00Z');
   const requested=Math.round((date-startDate)/86400000)+1;
   const count=requested>150?180:requested>60?60:14;
   const rows=Array.from({length:count},(_,i)=>{
    const d=new Date(date);d.setUTCDate(d.getUTCDate()-count+1+i);
    const current=i>=count/2;
    const fields={views:current?200:100,likes:current?11:7,comments:current?3:2,shares:1,subscribersGained:current?3:2,subscribersLost:1,estimatedMinutesWatched:current?600:300};
    return [d.toISOString().slice(0,10),...metrics.map(k=>fields[k])];
   });
   return Response.json(toObj(['day',...metrics],rows));
  }
  if(dim==='insightTrafficSourceType')return Response.json(toObj([dim,'views'],[['YT_SEARCH',450],['SHORTS',350],['EXT_URL',100]]));
  if(dim==='insightTrafficSourceDetail')return Response.json(toObj([dim,'views'],[['how to make videos',350],['funny editing',100]]));
  if(dim==='deviceType')return Response.json(toObj([dim,'views'],[['MOBILE',900],['DESKTOP',500]]));
  if(dim==='country')return Response.json(toObj([dim,'views'],[['UA',900],['PL',500]]));
 }

 if(String(url).includes('open.tiktokapis.com/v2/oauth/token/')){
  const code=new URLSearchParams(String(opts?.body||'')).get('code')||'dummy-code';
  const suffix=/^account[234]$/.test(code)?code.at(-1):'1';
  return Response.json({access_token:'social-test-access-tt'+suffix,refresh_token:'social-test-refresh-tt'+suffix,expires_in:3600});
 }
 if(String(url).includes('id.twitch.tv/oauth2/token')||String(url).includes('api.x.com/2/oauth2/token'))
  return Response.json({access_token:'social-test-access',refresh_token:'social-test-refresh',expires_in:3600});
 if(String(url).includes('api.twitch.tv/helix/users'))
  return Response.json({data:[{id:'twitch-42',display_name:'Twitch Creator',login:'twitchcreator',profile_image_url:'https://example.com/ava.jpg'}]});
 if(String(url).includes('api.twitch.tv/helix/channels/followers'))
  return Response.json({total:126,data:[]});
 if(String(url).includes('api.twitch.tv/helix/streams?'))
  return Response.json({data:[{title:'Playing a game',viewer_count:19,game_name:'Fortnite',started_at:'2026-10-28T19:00:00Z'}]});
 if(String(url).includes('api.twitch.tv/helix/videos?'))
  return Response.json({data:[{id:'test-vod',title:'Last broadcast',view_count:220,created_at:'2026-10-27T20:00:00Z',url:'https://www.twitch.tv/videos/123456'}]});
 if(String(url).includes('api.twitch.tv/helix/clips?'))
  return Response.json({data:[{id:'clip-1',title:'Cool clip',view_count:50,created_at:'2026-10-27T11:00:00Z',url:'https://clips.twitch.tv/Testing'}]});
 if(String(url).includes('api.twitch.tv/helix/channels?'))
  return Response.json({data:[{title:'Test Twitch Channel',game_name:'Fortnite'}]});
 if(String(url).includes('open.tiktokapis.com/v2/user/info/')){
  const match=/social-test-access-tt([1234])$/.exec(opts?.headers?.Authorization||'');
  const n=match?Number(match[1]):1;
  return Response.json({data:{user:{open_id:'tiktok-'+(30+n),display_name:'TikTok Creator '+n,username:'ttcreator'+n,avatar_url:'https://example.com/tt.jpg',follower_count:404+n-1,following_count:22,likes_count:1900,video_count:10}},error:{code:'ok'}});
 }
 if(String(url).includes('open.tiktokapis.com/v2/video/list/'))
  return Response.json({data:{videos:[{id:'tt111',title:'New TikTok',create_time:1793116800,view_count:900,like_count:45,comment_count:8,share_count:5,share_url:'https://www.tiktok.com/@ttcreator/video/123'}]},error:{code:'ok'}});
 if(String(url).includes('api.x.com/2/users/me'))
  return Response.json({data:{id:'x-456',name:'X Creator',username:'xcreator',profile_image_url:'https://example.com/x.jpg',public_metrics:{followers_count:83,following_count:13,tweet_count:21}}});
 if(String(url).includes('api.x.com/2/users/x-456/tweets'))
  return Response.json({data:[{id:'2233',author_id:'x-456',text:'My own post',created_at:'2026-10-27T12:00:00Z',public_metrics:{like_count:10,retweet_count:2,reply_count:1,impression_count:800}}]});
 if(String(url).includes('oauth2.googleapis.com/token')){
  const code=String(opts?.body||'');
  const channel=code.includes('code=channel4')?'4':code.includes('code=channel3')?'3':code.includes('code=channel2')?'2':'1';
  return Response.json({access_token:'secret-access-token-'+channel,refresh_token:'secret-refresh-token-'+channel,expires_in:3600});
 }
 if(String(url).includes('youtube/v3/channels')){
  const token=opts?.headers?.Authorization||'';
  const n=token.endsWith('-2')?2:token.endsWith('-3')?3:token.endsWith('-4')?4:1;
  const id=['',"UCAAAAAAAAAAAAAAAAAAAAAA","UCBBBBBBBBBBBBBBBBBBBBBB","UCCCCCCCCCCCCCCCCCCCCCCC","UCDDDDDDDDDDDDDDDDDDDDDD"][n];
  return Response.json({items:[{id,snippet:{title:n===1?'Creator Test':'Channel '+n,description:'Test channel',thumbnails:{default:{url:'https://example.com/avatar.jpg'}}},statistics:{viewCount:String(n===1?15200:n*1000),subscriberCount:'789',videoCount:'12',hiddenSubscriberCount:false},contentDetails:{relatedPlaylists:{uploads:'UUTESTUPLOADS'}}}]});
 }
 if(String(url).includes('youtube/v3/playlistItems')){
  const cursor=new URL(url).searchParams.get('pageToken');
  return cursor==='NEXT_PAGE'?Response.json({items:[{contentDetails:{videoId:'LmNoPqRsTuV'}}]}):Response.json({items:[{contentDetails:{videoId:'AbCdEfGhIjK'}}],nextPageToken:'NEXT_PAGE'});
 }
 if(String(url).includes('youtube/v3/videos')){
  const ids=(new URL(url).searchParams.get('id')||'').split(',');
  const known=[
   {id:'AbCdEfGhIjK',snippet:{channelId:"UCAAAAAAAAAAAAAAAAAAAAAA",title:'Latest clip',publishedAt:'2026-10-20T12:00:00Z',thumbnails:{default:{url:'https://example.com/thumb.jpg'}}},status:{privacyStatus:'public'},contentDetails:{duration:'PT3M40S'},statistics:{viewCount:'420',likeCount:'30',commentCount:'7'}},
   {id:'LmNoPqRsTuV',snippet:{channelId:"UCAAAAAAAAAAAAAAAAAAAAAA",title:'Older clip',publishedAt:'2026-10-15T12:00:00Z'},status:{privacyStatus:'public'},contentDetails:{duration:'PT2M'},statistics:{viewCount:'300',likeCount:'15',commentCount:'4'}}
  ];
  return Response.json({items:known.filter(x=>ids.includes(x.id))});
 }
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
 assert.equal((await worker.fetch(req('/youtube/stats','GET','https://bad.example'),env)).status,403,'YouTube stats enforce allowed Origin');
 assert.equal((await worker.fetch(req('/youtube/stats','GET','https://flekideveloper.github.io','invalid'),env)).status,401,'YouTube stats require capability');
 const live=await worker.fetch(req('/youtube/stats'),env);assert.equal(live.status,200,'connected user receives live metrics');
 const metrics=await live.json();assert.equal(metrics.totals.views,15200);assert.equal(metrics.totals.subscribers,789);
 assert.equal(metrics.totals.videos,12);assert.equal(metrics.recent[0].title,'Latest clip');
 assert.equal(metrics.history.length,1,'first true daily snapshot created');
 assert.equal(metrics.fromCache,false,'first snapshot fetched from YouTube');
 assert(!JSON.stringify(metrics).includes('secret-access-token'),'client receives no YouTube token');
 const calls=seen.filter(x=>x.url.includes('youtube/v3/')).length;
 const cached=await (await worker.fetch(req('/youtube/stats'),env)).json();
 assert.equal(cached.fromCache,true,'repeated reads use server-side cache');
 assert.equal(seen.filter(x=>x.url.includes('youtube/v3/')).length,calls,'cache prevents extra YouTube API calls');
 assert.equal(youtubeCache.size,1,'cache stored privately');assert.equal(snapshots.size,1,'history stored privately');
 const authorize=await (await worker.fetch(req('/auth/start/youtube','POST'),env)).json();
 assert(new URL(authorize.url).searchParams.get('scope').includes('yt-analytics.readonly'),'YouTube now requests read-only Analytics permission');
 pending.delete(new URL(authorize.url).searchParams.get('state')); // This simulated scope probe never completes OAuth.
 assert.equal((await worker.fetch(req('/youtube/analytics','GET','https://evil.example'),env)).status,403,'analytics CORS denies unknown domain');
 assert.equal((await worker.fetch(req('/youtube/analytics','GET','https://flekideveloper.github.io','bad'),env)).status,401,'analytics requires local capability');
 const analyticsResponse=await worker.fetch(req('/youtube/analytics'),env);
 assert.equal(analyticsResponse.status,200,'analytics endpoint provides successful report');
 const analytics=await analyticsResponse.json();
 assert.equal(analytics.current.views,1400,'last available week sums views');
 assert.equal(analytics.previous.views,700,'prior 7 days sums views');
 assert.equal(analytics.growth.views,100,'weekly view growth percentage is correct');
 assert.equal(analytics.current.subscribersGained,21,'weekly gained subscribers are correct');
 assert.equal(analytics.current.subscribersLost,7,'lost subscribers are counted');
 assert.equal(analytics.current.netSubscribers,14,'net subscriber gain is measured');
 assert.equal(analytics.growth.subscribersGained,50,'new subscriber growth compared to previous week');
 assert.equal(analytics.current.likes,77,'weekly likes counted');
 assert.equal(analytics.current.comments,21,'weekly comments counted');
 assert.equal(analytics.daily.length,7);
 assert.equal(analytics.traffic[0].type,'YT_SEARCH');
 assert.equal(analytics.searchTerms[0].term,'how to make videos');
 assert.equal(analytics.devices[0].type,'MOBILE');
 assert.equal(analytics.countries[0].code,'UA');
 assert(!JSON.stringify(analytics).includes('secret-access-token'),'analytics response contains no credentials');
 const reportRequests=seen.filter(x=>x.url.includes('youtubeanalytics.googleapis.com')).length;
 assert.equal((await (await worker.fetch(req('/youtube/analytics'),env)).json()).fromCache,true,'analytics report cached');
 assert.equal(seen.filter(x=>x.url.includes('youtubeanalytics.googleapis.com')).length,reportRequests,'cache avoids repeated YouTube API queries');
 assert.equal(analyticsCache.size,1,'analytics cache in separate table');
 assert.equal((await worker.fetch(req('/youtube/analytics?days=0'),env)).status,400,'invalid period rejected');
 const monthly=await (await worker.fetch(req('/youtube/analytics?days=30'),env)).json();
 assert.equal(monthly.period.windowDays,30,'monthly report labelled');
 assert.equal(monthly.daily.length,30,'thirty actual provider daily rows');
 assert.equal(monthly.current.views,6000,'thirty-day views summed correctly');
 assert.equal((await (await worker.fetch(req('/youtube/analytics?days=30'),env)).json()).fromCache,true,'monthly cache reused');
 const quarterly=await (await worker.fetch(req('/youtube/analytics?days=90'),env)).json();
 assert.equal(quarterly.period.windowDays,90,'quarterly report labelled');
 assert.equal(quarterly.daily.length,90,'ninety actual provider daily rows');
 assert.equal(quarterly.current.views,18000,'ninety-day views summed correctly');
 assert.equal((await (await worker.fetch(req('/youtube/analytics'),env)).json()).period.windowDays,7,'weekly default stays compatible');
 assert.equal((await worker.fetch(req('/youtube/videos','GET','https://evil.example'),env)).status,403,'video library enforces frontend origin');
 assert.equal((await worker.fetch(req('/youtube/videos','GET','https://flekideveloper.github.io','bad'),env)).status,401,'video library requires capability');
 const videoResponse=await worker.fetch(req('/youtube/videos'),env);
 assert.equal(videoResponse.status,200,'video library authorized');
 const videos=await videoResponse.json();
 assert.equal(videos.videos.length,1,'only owned public videos are listed');
 assert.equal(videos.videos[0].views,420,'actual video totals from Data API');
 assert.equal(videos.videos[0].week.views,250,'actual per-video week from Analytics API');
 assert.equal(videos.videos[0].week.subscribersGained,3);
 assert(!JSON.stringify(videos).includes('secret-access-token'),'video catalog exposes no access tokens');
 assert.equal((await (await worker.fetch(req('/youtube/videos'),env)).json()).fromCache,true,'video library cached in D1');
 assert.equal(videos.nextPageToken,'NEXT_PAGE','real YouTube page token returned for older videos');
 const second=await (await worker.fetch(req('/youtube/videos?cursor=NEXT_PAGE'),env)).json();
 assert.equal(second.videos.length,1,'older upload page loaded');
 assert.equal(second.videos[0].id,'LmNoPqRsTuV','pagination returned the correct older upload');
 assert.equal(second.nextPageToken,null,'pagination ends naturally');
 assert.equal((await worker.fetch(req('/youtube/videos?cursor=%3Cscript%3E'),env)).status,400,'bad pagination cursor rejected');
 const retentionResponse=await worker.fetch(req('/youtube/videos/AbCdEfGhIjK/retention'),env);
 assert.equal(retentionResponse.status,200,'owned-video retention endpoint works');
 const retention=await retentionResponse.json();
 assert.equal(retention.points.length,3);
 assert.equal(retention.points[1].ratio,0.68);
 assert.equal((await worker.fetch(req('/youtube/videos/XxYyZzAaBbC/retention'),env)).status,404,'unowned video not queryable');
 const comparison=await (await worker.fetch(req('/youtube/videos/compare?a=AbCdEfGhIjK&b=XxYyZzAaBbC'),env)).json();
 assert.equal(comparison.error,'video_not_in_channel','unowned video comparison forbidden');
 assert.equal((await worker.fetch(req('/youtube/videos/compare?a=AbCdEfGhIjK&b=AbCdEfGhIjK'),env)).status,400,'same video not allowed');
 const validCompare=await (await worker.fetch(req('/youtube/videos/compare?a=AbCdEfGhIjK&b=LmNoPqRsTuV'),env)).json();
 assert.equal(validCompare.videos.length,2,'two owned videos can be compared even across pagination');
 assert.equal(validCompare.videos[0].report.views,440,'first 7-day report reflects Google metrics');
 assert.equal(validCompare.videos[1].report.views,440,'second 7-day report reflects Google metrics');
 assert.equal(validCompare.comparable,true,'two mature reports are marked comparable');
 // Three independent channel identities in one local VIVER installation.
 assert.equal(youtubeVault.size,1,'first channel migrated to the encrypted vault');
 const initialChannels=await (await worker.fetch(req('/connections'),env)).json();
 assert.equal(initialChannels.youtubeChannels.length,1);
 assert.equal(initialChannels.activeYoutubeChannel,"UCAAAAAAAAAAAAAAAAAAAAAA");
 for(const n of [2,3]){
  const auth=await (await worker.fetch(req('/auth/start/youtube','POST'),env)).json();
  const st=new URL(auth.url).searchParams.get('state');
  const cb=await worker.fetch(req('/auth/callback/youtube?code=channel'+n+'&state='+st),env);
  assert.equal(cb.status,200,'additional YouTube channel #'+n+' added with consent');
 }
 assert.equal(youtubeVault.size,3,'max three distinct channels stored');
 const all=await (await worker.fetch(req('/connections'),env)).json();
 assert.equal(all.youtubeChannels.length,3,'all three channels shown to browser without tokens');
 assert.equal(all.activeYoutubeChannel,"UCCCCCCCCCCCCCCCCCCCCCCC",'latest connected channel becomes active');
 assert(!JSON.stringify(all).includes('secret-access-token'),'secret tokens never appear in channel picker');
 assert.equal((await worker.fetch(req('/youtube/channels/select','POST','https://bad.example'),env)).status,403,'channel selection checks origin');
 const swapRequest=(id,token=key)=>new Request(base+'/youtube/channels/select',{method:'POST',headers:{Origin:'https://flekideveloper.github.io',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({channelId:id})});
 assert.equal((await worker.fetch(swapRequest("UCBBBBBBBBBBBBBBBBBBBBBB",'wrong'),env)).status,401,'channel selection rejects unknown capability');
 assert.equal((await worker.fetch(swapRequest("UCAAAAAAAAAAAAAAAAAAAAAA"),env)).status,200,'switching to initial channel works');
 const afterSwitch=await (await worker.fetch(req('/connections'),env)).json();
 assert.equal(afterSwitch.activeYoutubeChannel,"UCAAAAAAAAAAAAAAAAAAAAAA",'active account switches without losing other channels');
 assert.equal(youtubeVault.size,3,'switch preserves all authorized channels');
 assert(snapshots.size>=1,'historical measurements survive channel switching');
 const fourthAuth=await (await worker.fetch(req('/auth/start/youtube','POST'),env)).json();
 const fourthState=new URL(fourthAuth.url).searchParams.get('state');
 const denied=await worker.fetch(req('/auth/callback/youtube?code=channel4&state='+fourthState),env);
 assert.equal(denied.status,400,'fourth distinct YouTube channel rejected');
 assert.equal(youtubeVault.size,3,'limit cannot replace existing channels');
 assert.equal((await worker.fetch(req('/youtube/channels/'+"UCBBBBBBBBBBBBBBBBBBBBBB",'DELETE'),env)).status,200,'can unlink a single channel');
 assert.equal(youtubeVault.size,2,'removal leaves the other two accounts intact');
 const updated=await (await worker.fetch(req('/connections'),env)).json();
 assert.equal(updated.youtubeChannels.length,2);
 assert.equal(updated.activeYoutubeChannel,"UCAAAAAAAAAAAAAAAAAAAAAA");
 assert.equal((await worker.fetch(req('/youtube/channels/'+"UCAAAAAAAAAAAAAAAAAAAAAA",'DELETE'),env)).status,200,'can unlink active channel');
 assert.equal((await (await worker.fetch(req('/connections'),env)).json()).activeYoutubeChannel,"UCCCCCCCCCCCCCCCCCCCCCCC",'another channel automatically becomes active');
 assert.equal((await worker.fetch(req('/connections/youtube','DELETE'),env)).status,200);
 assert.equal(youtubeVault.size,0,'disconnect all clears every authorized YouTube channel');
 assert.equal(videoCache.size,0,'video library cache erased on disconnect');
 assert.equal(analyticsCache.size,0,'analytics cache purged on disconnect');
 assert.equal(youtubeCache.size,0,'disconnect erases channel cache');
 assert.equal(snapshots.size,0,'disconnect erases snapshots');
 assert.equal((await worker.fetch(req('/youtube/stats'),env)).status,404,'unlinked user cannot see channel metrics');

 // Each network only becomes queryable after its own verified provider callback.
 for(const provider of ['twitch','tiktok','x']){
  assert.equal((await worker.fetch(req('/social/'+provider+'/overview'),env)).status,404,'social endpoint denies disconnected '+provider);
  const state=[...pending.values()].find(p=>p.provider===provider)?.state;
  assert(state,'OAuth authorization state exists for '+provider);
  const linked=await worker.fetch(req('/auth/callback/'+provider+'?code=dummy-code&state='+state),env);
  assert.equal(linked.status,200,'official provider flow links '+provider);
  assert.equal((await worker.fetch(req('/social/'+provider+'/overview','GET','https://evil.example'),env)).status,403,'origin enforced for '+provider);
  assert.equal((await worker.fetch(req('/social/'+provider+'/overview','GET','https://flekideveloper.github.io','invalid'),env)).status,401,'capability enforced for '+provider);
  const insight=await (await worker.fetch(req('/social/'+provider+'/overview'),env)).json();
  assert.equal(insight.provider,provider);
  assert(insight.account?.id,'profile is verified');
  assert.equal(insight.history.length,1,'first observed daily snapshot');
  assert(!JSON.stringify(insight).includes('social-test-access'),'no OAuth access tokens leaked');
  assert.equal((await (await worker.fetch(req('/social/'+provider+'/overview'),env)).json()).fromCache,true,'separate server cache for '+provider);
  if(provider==='twitch'){assert.equal(insight.metrics.followers,126);assert.equal(insight.live.viewers,19);assert.equal(insight.content[0].kind,'vod')}
  if(provider==='tiktok'){assert.equal(insight.metrics.followers,404);assert.equal(insight.metrics.likes,1900);assert.equal(insight.content[0].views,900)}
  if(provider==='x'){assert.equal(insight.metrics.followers,83);assert.equal(insight.content[0].views,800)}
 }
 assert.equal(socialCache.size,3,'three isolated social caches');
 for(const provider of ['twitch','tiktok','x']){
  assert.equal((await worker.fetch(req('/connections/'+provider,'DELETE'),env)).status,200);
  assert.equal((await worker.fetch(req('/social/'+provider+'/overview'),env)).status,404,'disconnected '+provider+' never exposes data');
 }
 assert.equal(socialCache.size,0,'unlink clears all social caches');
 assert.equal(socialHistory.size,0,'unlink clears social snapshots');

 assert.equal(accounts.size,0,'disconnect clears encrypted tokens');
 console.log('VIVER OAuth tests: PASS — OAuth, PKCE, encrypted tokens, live YouTube metrics, cache, history, no token leaks, disconnect');
})().catch(e=>{console.error(e);process.exit(1)});
