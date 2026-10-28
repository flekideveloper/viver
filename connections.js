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
 const fields={providers:{},connections:[]};
 let status='loading',busy=new Set(),popup=null,timer=null,lastRefresh=0;
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
   const r=await fetch(API+path,{method:options.method||'GET',headers:{Authorization:'Bearer '+key},signal:abort.signal,cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'HTTP '+r.status);
   return data;
  }finally{clearTimeout(timeout)}
 }
 function stateRow(provider){
  const active=fields.connections.find(x=>x.provider===provider.id&&x.connected);
  const expired=fields.connections.find(x=>x.provider===provider.id&&!x.connected);
  const ready=Boolean(fields.providers[provider.id]),disabled=busy.has(provider.id)||status==='loading'||(!active&&!ready);
  const label=active?say('Підключено','Connected'):expired?say('Час підключити знову','Reconnect needed'):ready?say('Не підключено','Not connected'):say('Потрібні ключі API','API keys required');
  const action=buttonLabel(ready,!!active);
  const statusClass=active?'linked':ready?'ready':'inactive';
  return '<div class="account-link-row"><span class="account-brand account-'+provider.id+'">'+({youtube:'▶',tiktok:'♪',twitch:'◪',x:'𝕏'}[provider.id])+'</span><div class="account-link-details"><strong>'+provider.label+'</strong><span class="account-link-status '+statusClass+'">'+escapeHTML(active?.label||label)+'</span></div><button type="button" class="secondary-button account-action" data-auth-provider="'+provider.id+'" data-auth-mode="'+(active?'disconnect':'connect')+'" '+(disabled?'disabled':'')+'>'+escapeHTML(action)+'</button></div>';
 }
 function render(){
  const box=$('#viver-accounts');if(!box)return;
  const note=$('#account-status-info');
  box.innerHTML=PROVIDERS.map(stateRow).join('');
  if(note){
   if(status==='offline')note.textContent=say('Сервер підключень зараз недоступний.','Connection server is currently unavailable.');
   else if(status==='loading')note.textContent=say('Перевірка підключень…','Checking connections…');
   else if(Object.values(fields.providers).some(Boolean))note.textContent=say('Доступ надається лише після підтвердження на сайті платформи.','Access is granted only after approval on the platform.');
   else note.textContent=say('Для авторизації потрібно додати ключі застосунків у Cloudflare.','To enable sign-in, configure app credentials in Cloudflare.');
  }
 }
 async function refresh(){
  if(status==='loading'&&lastRefresh)return;
  try{
   const data=await request('/connections');
   fields.providers=data.providers||{};fields.connections=data.connections||[];status='ready';lastRefresh=Date.now();
  }catch{status='offline';fields.providers={};fields.connections=[]}
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
  if(!confirm(say('Відключити '+provider+' від VIVER?','Disconnect '+provider+' from VIVER?')))return;
  busy.add(provider);render();
  try{
   await request('/connections/'+provider,{method:'DELETE'});
   await refresh();announce(say('Акаунт відключено','Account disconnected'));
  }catch(e){announce(e.message||say('Помилка відключення','Could not disconnect'))}
  finally{busy.delete(provider);render()}
 }
 $('#viver-accounts')?.addEventListener('click',e=>{
  const button=e.target.closest('[data-auth-provider]');if(!button||button.disabled)return;
  const provider=button.dataset.authProvider;if(!PROVIDERS.some(x=>x.id===provider))return;
  if(button.dataset.authMode==='disconnect')disconnect(provider);else start(provider);
 });
 window.addEventListener('message',event=>{
  if(event.origin!==API||event.data?.type!=='viver-oauth-complete')return;
  clearInterval(timer);timer=null;refresh();
 });
 window.addEventListener('focus',()=>{if(Date.now()-lastRefresh>4000)refresh()});
 window.addEventListener('hashchange',()=>{if(location.hash==='#platforms')refresh()});
 $('#language')?.addEventListener('change',render);
 window.VIVERConnections={refresh,request,start,getConnections:()=>fields.connections.map(x=>({...x})),getStatus:()=>status};
 render();refresh();
})();