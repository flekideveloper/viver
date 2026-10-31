'use strict';
/** VIVER social accounts: all provider tokens stay on the VIVER Cloudflare Worker. */
(()=>{
 const API='https://viver-auth.flekideveloper.workers.dev';
 const KEY='viver-connect-key-v1';
 const PROVIDERS=[
  {id:'youtube',label:'YouTube'},
  {id:'tiktok',label:'TikTok'},
  {id:'twitch',label:'Twitch'},
  {id:'x',label:'X'}
 ];
 const $=sel=>document.querySelector(sel);
 const $all=sel=>[...document.querySelectorAll(sel)];
 const lang=()=>document.documentElement.lang==='en'?'en':'uk';
 const say=(uk,en)=>lang()==='uk'?uk:en;
 const escapeHTML=text=>String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const buttonLabel=(ready,connected)=>{
  if(connected)return say('Відключити','Disconnect');
  if(!ready)return say('Потрібне налаштування','Setup needed');
  return say('Підключити','Connect');
 };
 const fields={providers:{},connections:[],youtubeChannels:[],activeYoutubeChannel:null,maxYoutubeChannels:3,tiktokAccounts:[],activeTikTokAccount:null,maxTikTokAccounts:3};
 let status='loading',busy=new Set(),popup=null,timer=null,lastRefresh=0,refreshSerial=0;
 function getKey(){
  try{
   let k=localStorage.getItem(KEY);
   if(k&&/^[A-Za-z0-9_-]{43}$/.test(k))return k;
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   k=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
   localStorage.setItem(KEY,k);
   return k;
  }catch{return null}
 }
 async function request(path,options={}){
  const key=getKey();if(!key)throw Error(say('Немає доступу до локального сховища','Local storage unavailable'));
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{
   const r=await fetch(API+path,{method:options.method||'GET',headers:{Authorization:'Bearer '+key,...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{}),signal:abort.signal,cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'HTTP '+r.status);
   return data;
  }finally{clearTimeout(timeout)}
 }
 function stateRow(provider){
  const active=fields.connections.find(x=>x.provider===provider.id&&x.connected);
  const expired=fields.connections.find(x=>x.provider===provider.id&&!x.connected);
  const ready=Boolean(fields.providers[provider.id]),disabled=busy.has(provider.id)||status==='loading'||status==='offline'||(!active&&!ready);
  const label=active?say('Підключено','Connected'):expired?say('Час підключити знову','Reconnect needed'):ready?say('Не підключено','Not connected'):say('Потрібні ключі API','API keys required');
  const action=buttonLabel(ready,!!active);
  const statusClass=active?'linked':ready?'ready':'inactive';
  if(provider.id==='youtube'){
   const channels=fields.youtubeChannels,amount=channels.length,max=fields.maxYoutubeChannels;
   const add=ready&&status!=='offline'&&amount<max?'<button type="button" class="secondary-button account-action" data-youtube-add="1" '+(busy.has('youtube')||status==='offline'?'disabled':'')+'>'+say('+ Додати канал','+ Add channel')+'</button>':'';
   const manage=amount?'<span class="account-link-status '+statusClass+'">'+escapeHTML(say('Каналів: ','Channels: ')+amount+'/'+max)+'</span>':'<span class="account-link-status '+statusClass+'">'+escapeHTML(label)+'</span>';
   return '<div class="account-link-row"><span class="account-brand account-youtube">▶</span><div class="account-link-details"><strong>YouTube</strong>'+manage+'<small>'+escapeHTML(active?.label||'')+'</small></div>'+add+
   (amount?'<button type="button" class="secondary-button account-action" data-auth-provider="youtube" data-auth-mode="disconnect" '+(disabled?'disabled':'')+'>'+say('Відключити всі','Disconnect all')+'</button>':
    '<button type="button" class="secondary-button account-action" data-auth-provider="youtube" data-auth-mode="connect" '+(disabled?'disabled':'')+'>'+escapeHTML(action)+'</button>')+'</div>';
  }
  if(provider.id==='tiktok'){
   const accounts=fields.tiktokAccounts,amount=accounts.length,max=fields.maxTikTokAccounts;
   const add=ready&&status!=='offline'&&amount<max?'<button type="button" class="secondary-button account-action" data-tiktok-add="1" '+(busy.has('tiktok')?'disabled':'')+'>'+say('+ Додати акаунт','+ Add account')+'</button>':'';
   const manage=amount?escapeHTML(say('Акаунтів: ','Accounts: ')+amount+'/'+max):escapeHTML(label);
   return '<div class="account-link-row"><span class="account-brand account-tiktok">♪</span><div class="account-link-details"><strong>TikTok</strong><span class="account-link-status '+statusClass+'">'+manage+'</span><small>'+escapeHTML(active?.label||'')+'</small></div>'+add+
    (amount?'<button type="button" class="secondary-button account-action" data-auth-provider="tiktok" data-auth-mode="disconnect" '+(disabled?'disabled':'')+'>'+say('Відключити всі','Disconnect all')+'</button>':
     '<button type="button" class="secondary-button account-action" data-auth-provider="tiktok" data-auth-mode="connect" '+(disabled?'disabled':'')+'>'+escapeHTML(action)+'</button>')+'</div>';
  }
  return '<div class="account-link-row"><span class="account-brand account-'+provider.id+'">'+({youtube:'▶',tiktok:'♪',twitch:'◪',x:'𝕏'}[provider.id])+'</span><div class="account-link-details"><strong>'+provider.label+'</strong><span class="account-link-status '+statusClass+'">'+escapeHTML(active?.label||label)+'</span></div><button type="button" class="secondary-button account-action" data-auth-provider="'+provider.id+'" data-auth-mode="'+(active?'disconnect':'connect')+'" '+(disabled?'disabled':'')+'>'+escapeHTML(action)+'</button></div>';
 }

 function renderYoutubeSwitcher(){
  const container=$('#youtube-accounts-switcher');if(!container)return;
  const list=fields.youtubeChannels,activeId=fields.activeYoutubeChannel,limit=fields.maxYoutubeChannels;
  container.hidden=!list.length;
  if(!list.length)return;
  $('#youtube-accounts-title').textContent=say('Мої YouTube-канали','My YouTube channels');
  $('#youtube-accounts-limit').textContent=list.length+' / '+limit;
  $('#youtube-add-channel-label').textContent=say('Додати канал','Add channel');
  $('#youtube-add-channel').hidden=list.length>=limit;
  $('#youtube-add-channel').disabled=busy.has('youtube')||status==='offline';
  $('#youtube-channel-options').innerHTML=list.map(c=>{
   const selected=c.id===activeId;
   const image=c.avatar&&/^https:\/\//.test(c.avatar)?'<img src="'+escapeHTML(c.avatar)+'" referrerpolicy="no-referrer" alt="">':'<span class="youtube-switcher-placeholder">▶</span>';
   return '<div class="youtube-switcher-card '+(selected?'selected':'')+'"><button type="button" class="youtube-switcher-choice" data-youtube-select="'+escapeHTML(c.id)+'" aria-pressed="'+selected+'" '+(busy.has('youtube')||status==='offline'?'disabled':'')+'>'+image+'<span class="youtube-switcher-name"><strong>'+escapeHTML(c.label)+'</strong><small>'+(selected?say('Активний канал','Active channel'):say('Перемкнутися','Switch channel'))+'</small></span></button>'+
    '<button type="button" class="youtube-switcher-remove" data-youtube-remove="'+escapeHTML(c.id)+'" title="'+say('Відключити тільки цей канал','Disconnect this channel')+'" aria-label="'+say('Відключити канал ','Disconnect channel ')+escapeHTML(c.label)+'" '+(busy.has('youtube')||status==='offline'?'disabled':'')+'>×</button></div>';
  }).join('');
 }
 function renderTikTokSwitcher(){
  const container=$('#tiktok-accounts-switcher');if(!container)return;
  const list=fields.tiktokAccounts,activeId=fields.activeTikTokAccount,limit=fields.maxTikTokAccounts;
  container.hidden=!list.length;
  if(!list.length)return;
  $('#tiktok-accounts-title').textContent=say('Мої TikTok-акаунти','My TikTok accounts');
  $('#tiktok-accounts-limit').textContent=list.length+' / '+limit;
  $('#tiktok-add-account-label').textContent=say('Додати акаунт','Add account');
  $('#tiktok-add-account').hidden=list.length>=limit;
  $('#tiktok-add-account').disabled=busy.has('tiktok')||status==='offline';
  $('#tiktok-account-options').innerHTML=list.map(c=>{
   const selected=c.id===activeId;
   const avatar=c.avatar&&/^https:\/\//.test(c.avatar)?'<img src="'+escapeHTML(c.avatar)+'" referrerpolicy="no-referrer" alt="">':'<span class="youtube-switcher-placeholder">♪</span>';
   return '<div class="youtube-switcher-card '+(selected?'selected':'')+'"><button type="button" class="youtube-switcher-choice" data-tiktok-select="'+escapeHTML(c.id)+'" aria-pressed="'+selected+'" '+(busy.has('tiktok')||status==='offline'?'disabled':'')+'>'+avatar+'<span class="youtube-switcher-name"><strong>'+escapeHTML(c.label)+'</strong><small>'+(selected?say('Активний акаунт','Active account'):say('Перемкнутися','Switch account'))+'</small></span></button>'+
    '<button type="button" class="youtube-switcher-remove" data-tiktok-remove="'+escapeHTML(c.id)+'" title="'+say('Відключити тільки цей акаунт','Disconnect only this account')+'" aria-label="'+say('Відключити акаунт ','Disconnect account ')+escapeHTML(c.label)+'" '+(busy.has('tiktok')||status==='offline'?'disabled':'')+'>×</button></div>';
  }).join('');
 }
 async function chooseTikTokAccount(id){
  if(fields.activeTikTokAccount===id||!fields.tiktokAccounts.some(x=>x.id===id))return;
  busy.add('tiktok');render();
  try{
   await request('/tiktok/accounts/select',{method:'POST',body:{accountId:id}});
   await refresh();announce(say('TikTok-акаунт змінено','TikTok account switched'));
  }catch(e){announce(e.message||say('Не вдалося змінити акаунт','Unable to switch account'))}
  finally{busy.delete('tiktok');render()}
 }
 async function removeTikTokAccount(id){
  const account=fields.tiktokAccounts.find(x=>x.id===id);if(!account)return;
  if(!confirm(say('Відключити TikTok «'+account.label+'»? Його збережену статистику буде видалено.','Disconnect TikTok '+account.label+'? Its saved statistics will be deleted.')))return;
  busy.add('tiktok');render();
  try{
   await request('/tiktok/accounts/'+encodeURIComponent(id),{method:'DELETE'});
   await refresh();announce(say('TikTok-акаунт відключено','TikTok account disconnected'));
  }catch(e){announce(e.message||say('Помилка відключення','Unable to disconnect account'))}
  finally{busy.delete('tiktok');render()}
 }
 async function chooseYoutubeChannel(id){
  if(fields.activeYoutubeChannel===id)return;
  if(!fields.youtubeChannels.some(x=>x.id===id))return;
  busy.add('youtube');render();
  try{
   await request('/youtube/channels/select',{method:'POST',body:{channelId:id}});
   await refresh();
   announce(say('YouTube-канал змінено','YouTube channel switched'));
  }catch(e){announce(e.message||say('Не вдалося змінити канал','Unable to switch channel'))}
  finally{busy.delete('youtube');render()}
 }
 async function removeYoutubeChannel(id){
  const channel=fields.youtubeChannels.find(x=>x.id===id);if(!channel)return;
  if(!confirm(say('Відключити канал «'+channel.label+'»? Його збережені графіки на сервері буде видалено.','Disconnect '+channel.label+'? Its saved server-side statistics will be deleted.')))return;
  busy.add('youtube');render();
  try{
   await request('/youtube/channels/'+encodeURIComponent(id),{method:'DELETE'});
   await refresh();announce(say('Канал відключено','Channel disconnected'));
  }catch(e){announce(e.message||say('Помилка відключення','Unable to disconnect channel'))}
  finally{busy.delete('youtube');render()}
 }
 function render(){
  const box=$('#viver-accounts');if(!box)return;
  const note=$('#account-status-info');
  box.innerHTML=PROVIDERS.map(stateRow).join('');
  renderYoutubeSwitcher();
  renderTikTokSwitcher();
  if(note){
   if(status==='offline')note.textContent=say('Сервер підключень недоступний. Показано останній відомий стан; дії тимчасово вимкнені.','Connection server unavailable. Last known status is shown; actions are temporarily disabled.');
   else if(status==='loading')note.textContent=say('Перевірка підключень…','Checking connections…');
   else if(Object.values(fields.providers).some(Boolean))note.textContent=say('Доступ надається лише після підтвердження на сайті платформи.','Access is granted only after approval on the platform.');
   else note.textContent=say('Для авторизації потрібно додати ключі застосунків у Cloudflare.','To enable sign-in, configure app credentials in Cloudflare.');
  }
 }
 async function refresh(){
  if(status==='loading'&&lastRefresh)return;
  const requestId=++refreshSerial;
  try{
   const data=await request('/connections');
   // Discard stale responses from an earlier request (including earlier switches).
   if(requestId!==refreshSerial)return;
   const previousChannel=fields.activeYoutubeChannel,previousTikTok=fields.activeTikTokAccount;
   fields.providers=data.providers||{};fields.connections=data.connections||[];fields.youtubeChannels=data.youtubeChannels||[];fields.activeYoutubeChannel=data.activeYoutubeChannel||null;fields.maxYoutubeChannels=data.maxYoutubeChannels||3;
   fields.tiktokAccounts=data.tiktokAccounts||[];fields.activeTikTokAccount=data.activeTikTokAccount||null;fields.maxTikTokAccounts=data.maxTikTokAccounts||3;
   status='ready';lastRefresh=Date.now();
   if(previousChannel!==fields.activeYoutubeChannel)window.dispatchEvent(new CustomEvent('viver-youtube-channel-switched',{detail:{channelId:fields.activeYoutubeChannel}}));
   if(previousTikTok!==fields.activeTikTokAccount)window.dispatchEvent(new CustomEvent('viver-tiktok-account-switched',{detail:{accountId:fields.activeTikTokAccount}}));
  }catch{
   if(requestId!==refreshSerial)return;
   // A temporary offline error must not be treated as a genuine disconnection.
   status='offline';
  }
  render();
  window.dispatchEvent(new Event('viver-connections-updated'));
 }
 function announce(text){const t=$('#toast');if(t){t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200)}}
 async function start(provider){
  busy.add(provider);render();
  try{
   const result=await request('/auth/start/'+provider,{method:'POST'});
   const url=new URL(result.url);
   if(!['accounts.google.com','www.tiktok.com','id.twitch.tv','x.com'].includes(url.host)||url.protocol!=='https:')throw Error('Authorization domain not allowed');
   popup=window.open(url.href,'viver-'+provider,'popup=yes,width=590,height=720');
   if(!popup)window.location.assign(url.href);
   clearInterval(timer);let ticks=0;
   timer=setInterval(async()=>{
    ticks++;
    if(ticks>60||(popup&&popup.closed)){clearInterval(timer);timer=null}
    await refresh();
   },2500);
  }catch(e){announce(e.message||say('Не вдалося розпочати авторизацію','Could not begin authorization'))}
  finally{busy.delete(provider);render()}
 }
 async function disconnect(provider){
  if(!confirm(provider==='youtube'?say('Відключити ВСІ YouTube-канали від VIVER? Їхню серверну історію буде видалено.','Disconnect ALL YouTube channels? Their saved server history will be deleted.'):provider==='tiktok'?say('Відключити ВСІ TikTok-акаунти від VIVER? Їхню серверну статистику буде видалено.','Disconnect ALL TikTok accounts? Their saved server statistics will be deleted.'):say('Відключити '+provider+' від VIVER?','Disconnect '+provider+' from VIVER?')))return;
  busy.add(provider);render();
  try{
   await request('/connections/'+provider,{method:'DELETE'});
   await refresh();announce(say('Акаунт відключено','Account disconnected'));
  }catch(e){announce(e.message||say('Помилка відключення','Could not disconnect'))}
  finally{busy.delete(provider);render()}
 }
 $('#viver-accounts')?.addEventListener('click',e=>{
  if(e.target.closest('[data-youtube-add]')){start('youtube');return}
  if(e.target.closest('[data-tiktok-add]')){start('tiktok');return}
  const button=e.target.closest('[data-auth-provider]');if(!button||button.disabled)return;
  const provider=button.dataset.authProvider;if(!PROVIDERS.some(x=>x.id===provider))return;
  if(button.dataset.authMode==='disconnect')disconnect(provider);else start(provider);
 });

 $('#youtube-channel-options')?.addEventListener('click',event=>{
  const rm=event.target.closest('[data-youtube-remove]');
  if(rm){removeYoutubeChannel(rm.dataset.youtubeRemove);return}
  const sel=event.target.closest('[data-youtube-select]');
  if(sel)chooseYoutubeChannel(sel.dataset.youtubeSelect);
 });
 $('#youtube-add-channel')?.addEventListener('click',()=>start('youtube'));
 $('#tiktok-account-options')?.addEventListener('click',event=>{
  const rm=event.target.closest('[data-tiktok-remove]');
  if(rm){removeTikTokAccount(rm.dataset.tiktokRemove);return}
  const sel=event.target.closest('[data-tiktok-select]');
  if(sel)chooseTikTokAccount(sel.dataset.tiktokSelect);
 });
 $('#tiktok-add-account')?.addEventListener('click',()=>start('tiktok'));
 window.addEventListener('message',event=>{
  if(event.origin!==API||event.data?.type!=='viver-oauth-complete')return;
  clearInterval(timer);timer=null;refresh();
 });
 window.addEventListener('focus',()=>{if(Date.now()-lastRefresh>4000)refresh()});
 window.addEventListener('hashchange',()=>{if(location.hash==='#platforms')refresh()});
 $('#language')?.addEventListener('change',render);
 window.VIVERConnections={refresh,request,start,getConnections:()=>fields.connections.map(x=>({...x})),getStatus:()=>status,getYouTubeChannels:()=>fields.youtubeChannels.map(x=>({...x})),getActiveYoutubeChannel:()=>fields.activeYoutubeChannel,selectYouTubeChannel:chooseYoutubeChannel,getTikTokAccounts:()=>fields.tiktokAccounts.map(x=>({...x})),getActiveTikTokAccount:()=>fields.activeTikTokAccount,selectTikTokAccount:chooseTikTokAccount};
 render();refresh();
})();