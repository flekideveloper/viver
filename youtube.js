'use strict';
/* Read-only YouTube Studio overview. All OAuth tokens remain server-side. */
(()=>{
 const $=q=>document.querySelector(q);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ua=()=>document.documentElement.lang!=='en';
 const tr=(uk,en)=>ua()?uk:en;
 const fmt=n=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat(ua()?'uk-UA':'en-US').format(Number(n));
 const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString(ua()?'uk-UA':'en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
 const panel=$('#youtube-live-panel'),status=$('#youtube-live-status'),dataEl=$('#youtube-live-data'),button=$('#youtube-refresh');
 if(!panel||!window.VIVERConnections)return;
 let model=null,loading=false,lastFetch=0,wasConnected=false,errorMessage='';
 const client=window.VIVERConnections;
 const linked=()=>client.getConnections().some(x=>x.provider==='youtube'&&x.connected);
 function state(message){
  status.textContent=message;status.hidden=!message;
 }
 function render(){
  if(!linked()){panel.hidden=true;model=null;lastFetch=0;wasConnected=false;errorMessage='';return}
  panel.hidden=false;
  $('#youtube-section-title').textContent=tr('Мій канал','My channel');
  $('#youtube-refresh-text').textContent=tr('Оновити','Refresh');
  button.disabled=loading;
  if(!model){dataEl.hidden=true;state(loading?tr('Отримуємо статистику каналу…','Loading channel statistics…'):(errorMessage||tr('Натисни «Оновити», щоб завантажити статистику.','Press Refresh to load your statistics.')));return}
  dataEl.hidden=false;
  if(!loading)state('');
  const ch=model.channel||{},totals=model.totals||{};
  const safeChannel=/^UC[A-Za-z0-9_-]{22}$/.test(ch.id||'')?'https://www.youtube.com/channel/'+ch.id:null;
  $('#youtube-channel-profile').innerHTML=
   (ch.avatar&&/^https:\/\//i.test(ch.avatar)?'<img class="youtube-channel-avatar" alt="" src="'+esc(ch.avatar)+'" referrerpolicy="no-referrer">':'<span class="youtube-channel-avatar placeholder">▶</span>')+
   '<div class="youtube-channel-caption"><strong>'+esc(ch.title||tr('YouTube-канал','YouTube channel'))+'</strong><span>'+esc(ch.description||tr('Офіційна статистика каналу','Official channel statistics'))+'</span></div>'+
   (safeChannel?'<a class="youtube-profile-link" href="'+esc(safeChannel)+'" target="_blank" rel="noopener noreferrer">'+tr('Канал ↗','Channel ↗')+'</a>':'');
  const cards=[
   {label:tr('Перегляди','Views'),value:fmt(totals.views),description:tr('Усього на каналі','Channel total')},
   {label:tr('Підписники','Subscribers'),value:ch.hiddenSubscribers?tr('Приховано','Hidden'):fmt(totals.subscribers),description:tr('YouTube округлює показник','Rounded by YouTube')},
   {label:tr('Публічні відео','Public videos'),value:fmt(totals.videos),description:tr('За даними YouTube','Reported by YouTube')}
  ];
  $('#youtube-live-metrics').innerHTML=cards.map(x=>'<div class="youtube-metric"><span>'+esc(x.label)+'</span><strong>'+esc(x.value)+'</strong><small>'+esc(x.description)+'</small></div>').join('');
  const history=Array.isArray(model.history)?model.history.filter(x=>x&&/^\d{4}-\d\d-\d\d$/.test(x.date)&&Number.isFinite(Number(x.views))):[];
  const trend=$('#youtube-history');trend.hidden=history.length<2;
  if(history.length>=2){
   const arr=history.slice(-30),numbers=arr.map(x=>Number(x.views)),minimum=Math.min(...numbers),maximum=Math.max(...numbers),spread=Math.max(1,maximum-minimum);
   const points=arr.map((r,i)=>(32+(i/(arr.length-1))*576).toFixed(2)+','+(124-(Number(r.views)-minimum)/spread*96).toFixed(2)).join(' ');
   trend.innerHTML='<div class="youtube-subtitle">'+tr('Історія загальних переглядів','Total views over time')+'<small>'+tr('Збережені знімки VIVER, не історична аналітика YouTube','Recorded VIVER snapshots, not past YouTube analytics')+'</small></div>'+
    '<svg viewBox="0 0 640 150" role="img" aria-label="'+esc(tr('Динаміка переглядів','Views trend'))+'"><path d="M32 124H608" stroke="currentColor" opacity=".2" fill="none"/><polyline points="'+points+'" fill="none" stroke="#b9a7f3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '<div class="youtube-history-ends"><span>'+esc(arr[0].date)+' · '+fmt(arr[0].views)+'</span><span>'+esc(arr.at(-1).date)+' · '+fmt(arr.at(-1).views)+'</span></div>';
  }
  const recent=Array.isArray(model.recent)?model.recent.filter(x=>x&&/^[A-Za-z0-9_-]{11}$/.test(x.id)):[];
  $('#youtube-latest').innerHTML='<div class="youtube-subtitle">'+tr('Останні публічні відео','Recent public videos')+'</div>'+
   (recent.length?recent.map(x=>
     '<a class="youtube-video" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v='+encodeURIComponent(x.id)+'"><span class="youtube-video-name"><strong>'+esc(x.title||'YouTube')+'</strong><small>'+esc(x.publishedAt?new Date(x.publishedAt).toLocaleDateString(ua()?'uk-UA':'en-US'):'')+'</small></span><span class="youtube-video-views">'+fmt(x.views)+' '+tr('переглядів','views')+' ↗</span></a>'
    ).join(''):'<p class="youtube-muted">'+tr('Публічних відео поки немає або вони недоступні через API.','No public videos yet, or they are unavailable through the API.')+'</p>');
  $('#youtube-live-foot').textContent=tr('Дані YouTube API · Оновлено: ','YouTube API data · Updated: ')+time(model.updatedAt)+' · '+tr('Кеш до 10 хвилин','Cached for up to 10 minutes')+
   (history.length<2?' · '+tr('Історія почне з’являтися після наступних днів оновлень.','History will appear after future days of updates.'):'');
 }
 async function load(force=false){
  if(!linked()||loading||(model&&!force&&Date.now()-lastFetch<60000))return;
  loading=true;errorMessage='';render();
  try{
   const x=await client.request('/youtube/stats');
   if(!linked())return;
   model=x;lastFetch=Date.now();state('');render();
  }catch(e){
   if(!linked())return;
   model=null;
   const error=String(e.message||'');
   const messages={
    youtube_not_connected:tr('Канал не підключено.','Channel not connected.'),
    youtube_reconnect_required:tr('Google просить повторно підключити канал.','Google requires you to reconnect your channel.'),
    youtube_token_rejected:tr('Доступ Google закінчився. Підключи YouTube повторно.','Your Google authorization expired. Reconnect YouTube.'),
    youtube_permission_or_quota:tr('YouTube API відхилив запит. Перевір доступ до API та квоту в Google Cloud.','YouTube API rejected the request. Check the enabled API and quotas in Google Cloud.'),
    youtube_channel_changed:tr('Канал змінився. Підключи YouTube повторно.','Your channel changed. Reconnect YouTube.'),
    youtube_api_unavailable:tr('YouTube API наразі недоступний. Спробуй згодом.','YouTube API is unavailable. Try again later.')
   };
   dataEl.hidden=true;errorMessage=messages[error]||tr('Не вдалося отримати статистику YouTube. Перевір з’єднання та повтори спробу.','Could not load YouTube statistics. Check your connection and retry.');
  }finally{loading=false;render()}
 }
 function update(){
  const isConnected=linked();
  if(!isConnected){render();return}
  const justConnected=!wasConnected;wasConnected=true;render();
  if(location.hash==='#platforms'||$('#page-platforms')?.classList.contains('active'))load(justConnected);
 }
 window.addEventListener('viver-connections-updated',update);
 window.addEventListener('hashchange',update);
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-page="platforms"],[data-goto="platforms"]'))setTimeout(update,0)});
 $('#language')?.addEventListener('change',()=>{if(model)render()});
 button.addEventListener('click',()=>load(true));
 window.VIVERYoutube={update,load};
 update();
})();