'use strict';
/* VIVER creator dashboard: authentic YouTube Analytics reports and honest per-provider states. */
(()=>{
 const root=document.querySelector('#creator-overview');
 const content=document.querySelector('#creator-overview-content');
 const button=document.querySelector('#creator-refresh');
 if(!root||!content||!window.VIVERConnections)return;
 const client=window.VIVERConnections;
 const providers=[{id:'youtube',name:'YouTube',glyph:'▶'},{id:'tiktok',name:'TikTok',glyph:'♪'},{id:'twitch',name:'Twitch',glyph:'◪'},{id:'x',name:'X',glyph:'𝕏'}];
 const $=q=>document.querySelector(q);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ua=()=>document.documentElement.lang!=='en';
 const t=(a,b)=>ua()?a:b;
 const fmt=n=>n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat(ua()?'uk-UA':'en-US',{maximumFractionDigits:1}).format(Number(n));
 const pct=n=>n==null||!Number.isFinite(Number(n))?'—':(n>0?'+':'')+fmt(n)+'%';
 const displayDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return '—';return new Date(s+'T12:00:00Z').toLocaleDateString(ua()?'uk-UA':'en-US',{day:'numeric',month:'short',timeZone:'UTC'})};
 const sourceNames={
  YT_SEARCH:['Пошук YouTube','YouTube Search'],SHORTS:['Стрічка Shorts','Shorts feed'],
  RELATED_VIDEO:['Рекомендовані відео','Suggested videos'],YT_RELATED:['Рекомендовані відео','Suggested videos'],
  SUBSCRIBER:['Головна та підписки','Browse and subscriptions'],EXT_URL:['Зовнішні сайти й Google','External sites and Google'],
  YT_CHANNEL:['Сторінки каналів','Channel pages'],YT_OTHER_PAGE:['Інші сторінки YouTube','Other YouTube pages'],
  PLAYLIST:['Плейлисти','Playlists'],NOTIFICATION:['Сповіщення','Notifications'],
  END_SCREEN:['Кінцеві заставки','End screens'],ADVERTISING:['Реклама','Advertising'],
  HASHTAGS:['Хештеги','Hashtags'],SOUND_PAGE:['Сторінка звуку','Sound page'],
  DIRECT:['Прямі переходи','Direct traffic'],NO_LINK_OTHER:['Інші джерела','Other sources']
 };
 const deviceNames={MOBILE:['Телефони','Mobile'],DESKTOP:['Комп’ютери','Desktop'],TABLET:['Планшети','Tablet'],TV:['Телевізори','TV'],GAME_CONSOLE:['Ігрові консолі','Game consoles']};
 let current=null,error='',loading=false,lastFetch=0,activeChannel='',revision=0;
 const connected=()=>client.getConnections().filter(c=>c.connected);
 function metric(name,value,note,delta){
  let trend='';
  if(delta!==undefined)trend='<span class="creator-metric-trend '+(delta==null?'muted':delta>=0?'up':'down')+'">'+(delta==null?t('Немає бази для порівняння','No comparison yet'):pct(delta))+'</span>';
  return '<div class="creator-metric"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small>'+trend+'</div>';
 }
 function listRows(items,labeler,total,max=6){
  if(!items.length)return '<p class="creator-empty-small">'+esc(t('YouTube поки не надав дані для цього розділу.','YouTube has not provided data for this section yet.'))+'</p>';
  const biggest=Math.max(...items.map(x=>Number(x.views)||0),1);
  return items.slice(0,max).map(x=>{
   const label=labeler(x);
   const width=Math.max(1,Math.min(100,(Number(x.views)||0)/biggest*100));
   const share=total>0?' · '+fmt(Number(x.views)/total*100)+'%':'';
   return '<div class="creator-discovery-row"><div class="creator-discovery-line"><span title="'+esc(label)+'">'+esc(label)+'</span><small>'+fmt(x.views)+share+'</small></div><div class="creator-bar-track"><span style="width:'+width.toFixed(2)+'%"></span></div></div>';
  }).join('');
 }
 function section(title,body,subtitle=''){
  return '<div class="creator-breakdown"><div class="creator-breakdown-head"><h4>'+esc(title)+'</h4>'+(subtitle?'<small>'+esc(subtitle)+'</small>':'')+'</div>'+body+'</div>';
 }
 function chart(days){
  if(!Array.isArray(days)||days.length<2)return '';
  const points=days.map(x=>Number(x.views)||0),high=Math.max(...points,1);
  const coordinates=points.map((n,i)=>(18+(i/(points.length-1))*564).toFixed(1)+','+(96-n/high*77).toFixed(1)).join(' ');
  return '<div class="creator-spark"><div class="creator-breakdown-head"><h4>'+t('Перегляди за днями','Daily views')+'</h4></div><svg role="img" aria-label="'+esc(t('Графік переглядів за 7 днів','7-day views chart'))+'" viewBox="0 0 600 117"><path d="M18 96H582" stroke="currentColor" opacity=".13"/><polyline points="'+coordinates+'" fill="none" stroke="#bba8f2" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="creator-date-pair"><span>'+displayDate(days[0].date)+'</span><span>'+displayDate(days.at(-1).date)+'</span></div></div>';
 }
 function renderYouTube(connection){
  if(loading&&!current)return '<div class="creator-overview-alert">'+t('Завантажуємо аналітику YouTube…','Loading YouTube Analytics…')+'</div>';
  if(error){
   const copy={
    youtube_analytics_permission:[t('Потрібен додатковий дозвіл Google для YouTube Analytics.','Google needs another permission for YouTube Analytics.'),true],
    youtube_analytics_api_disabled:[t('У Google Cloud потрібно увімкнути YouTube Analytics API.','Enable YouTube Analytics API in Google Cloud.'),false],
    youtube_analytics_denied:[t('Google відхилив запит аналітики. Перевір API та дозволи застосунку.','Google denied the analytics request. Check your app permissions and API access.'),true],
    youtube_analytics_unavailable:[t('YouTube Analytics наразі не відповідає. Спробуй оновити.','YouTube Analytics is not responding. Try refreshing.'),false],
    youtube_reconnect_required:[t('Термін Google-доступу закінчився. Підключи YouTube ще раз.','Google authorization expired. Reconnect YouTube.'),true],
    youtube_not_connected:[t('Канал відключено. Повторно підключи YouTube.','Your channel was disconnected. Reconnect YouTube.'),true]
   }[error]||[t('Не вдалося завантажити аналітику. Спробуй оновити.','Could not load analytics. Try refreshing.'),false];
   return '<div class="creator-provider-head"><span class="creator-brand creator-brand-youtube">▶</span><div><strong>YouTube</strong><small>'+esc(connection.label||'')+'</small></div></div>'+
    '<div class="creator-overview-alert"><strong>'+esc(copy[0])+'</strong><p>'+esc(t('Попереднє підключення каналу не видалено.','Your existing channel connection has not been deleted.'))+'</p>'+
    (copy[1]?'<button type="button" class="secondary-button" data-creator-reauthorize="youtube">'+t('Оновити дозвіл Google','Update Google permission')+'</button>':'')+
    (error==='youtube_analytics_api_disabled'?'<a href="https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com" target="_blank" rel="noopener noreferrer">'+t('Увімкнути API у Google Cloud','Enable API in Google Cloud')+'</a>':'')+'</div>';
  }
  if(!current)return '<div class="creator-overview-alert">'+t('Підключено. Дані завантажаться під час відкриття Огляду.','Connected. Analytics loads when you open Overview.')+'</div>';
  const d=current;
  if(d.empty||!d.period)return '<div class="creator-overview-alert">'+t('YouTube ще не надав звітів за вибраний період. Дані з’являться після обробки переглядів.','YouTube has no reports available yet. Statistics appear after processing.')+'</div>';
  const a=d.current||{},g=d.growth||{},period=d.period;
  const metrics=[
   metric(t('Перегляди · 7 днів','Views · 7 days'),fmt(a.views),t('Порівняно з минулим тижнем','Versus previous 7 days'),g.views),
   metric(t('Нові підписники','New subscribers'),fmt(a.subscribersGained),t('Приріст отриманих підписок','Gained vs previous week'),g.subscribersGained),
   metric(t('Чистий приріст','Net subscribers'),(a.netSubscribers>0?'+':'')+fmt(a.netSubscribers),t('Нові мінус відписки','Gained minus lost')),
   metric(t('Лайки','Likes'),fmt(a.likes),t('За звітний період','In selected period')),
   metric(t('Коментарі','Comments'),fmt(a.comments),t('За звітний період','In selected period')),
   metric(t('Поширення','Shares'),fmt(a.shares),t('За звітний період','In selected period')),
   metric(t('Час перегляду','Watch time'),fmt(Math.round((Number(a.estimatedMinutesWatched)||0)/60*10)/10),t('Годин за період','Hours in period')),
   metric(t('Відписалися','Unsubscribed'),fmt(a.subscribersLost),t('Втрачено за 7 днів','Lost in 7 days'))
  ];
  const sourceLabel=x=>(sourceNames[x.type]||[x.type,x.type])[ua()?0:1];
  const deviceLabel=x=>(deviceNames[x.type]||[x.type,x.type])[ua()?0:1];
  const countryLabel=x=>{try{return new Intl.DisplayNames([ua()?'uk':'en'],{type:'region'}).of(x.code)||x.code}catch{return x.code}};
  return '<div class="creator-provider-head"><span class="creator-brand creator-brand-youtube">▶</span><div><strong>YouTube</strong><small>'+esc(connection.label||d.channel?.label||'')+'</small></div><span class="creator-connected-dot">'+t('Підключено','Connected')+'</span></div>'+
    '<div class="creator-period">'+t('7 останніх доступних днів: ','Last 7 available days: ')+displayDate(period.start)+' — '+displayDate(period.end)+' · '+t('Порівняння: ','Compared with: ')+displayDate(period.comparisonStart)+' — '+displayDate(period.comparisonEnd)+'</div>'+
    '<div class="creator-metric-grid creator-metric-compact">'+[metrics[0],metrics[1],metrics[3],metrics[4]].join('')+'</div>'+
    '<details class="creator-overview-more"><summary>'+t('Детальна аналітика · джерела переглядів та графіки','Detailed analytics · traffic sources and charts')+'</summary><div class="creator-metric-grid creator-metric-secondary">'+[metrics[2],metrics[5],metrics[6],metrics[7]].join('')+'</div>'+
    chart(d.daily)+
    '<div class="creator-discovery-grid">'+
     section(t('Джерела переглядів','Traffic sources'),listRows(d.traffic||[],sourceLabel,a.views),t('Як глядачі знаходять відео','How viewers find your videos'))+
     section(t('Що шукають у YouTube','YouTube search terms'),listRows(d.searchTerms||[],x=>x.term,a.views),t('Запити, які привели до переглядів','Searches that led to views'))+
     section(t('Пристрої перегляду','Viewing devices'),listRows(d.devices||[],deviceLabel,a.views),t('Де дивляться ваші відео','Where your videos are watched'))+
     section(t('Країни глядачів','Viewer countries'),listRows(d.countries||[],countryLabel,a.views),t('Основні країни за переглядами','Top countries by views'))+
    '</div><div class="creator-foot">'+t('Дані YouTube Analytics API, не оцінка. Звіти можуть надходити із затримкою. Оновлено: ','YouTube Analytics API data, not estimates. Reports may be delayed. Updated: ')+new Date(d.updatedAt).toLocaleString(ua()?'uk-UA':'en-US')+
    ' · '+t('Кеш ~15 хвилин','Cache ~15 minutes')+'</div></details>'+
    '<button type="button" class="creator-studio-jump" data-creator-open-platforms="1">'+t('Усі відео · порівняння · цілі ↗','Videos · comparisons · goals ↗')+'</button>';
 }
 function renderOther(connection){
  const p=providers.find(x=>x.id===connection.provider);
  if(!p)return '';
  return '<button class="creator-pending-platform creator-provider-jump" type="button" data-creator-open-provider="'+p.id+'"><span class="creator-brand creator-brand-'+p.id+'">'+esc(p.glyph)+'</span><span class="creator-provider-short"><strong>'+esc(p.name)+'</strong><small>'+esc(connection.label||'')+'</small><span>'+t('Переглянути аналітику та інструменти ↗','Open analytics and creator tools ↗')+'</span></span></button>';
 }
 function render(){
  $('#creator-overview-title').textContent=t('Аналітика соцмереж','Social analytics');
  $('#creator-overview-subtitle').textContent=t('Лише дані офіційних API підключених акаунтів','Official API data from connected accounts only');
  $('#creator-refresh-label').textContent=t('Оновити','Refresh');
  button.disabled=loading;
  const list=connected(),yt=list.find(x=>x.provider==='youtube');
  if(client.getStatus()==='loading'&&!list.length){content.innerHTML='<div class="creator-overview-alert">'+t('Перевіряємо підключені акаунти…','Checking connected accounts…')+'</div>';return}
  if(!list.length){
   content.innerHTML='<div class="creator-overview-alert"><p>'+t('Підключи соцмережу, щоб побачити реальну статистику тут.','Connect a social account to see verified stats here.')+'</p><button class="secondary-button" type="button" data-creator-open-platforms="1">'+t('Підключити акаунт','Connect account')+'</button></div>';
   return;
  }
  content.innerHTML=yt?'<div class="creator-youtube-data">'+renderYouTube(yt)+'</div>':'';
 }
 async function load(force=false){
  const yt=connected().find(x=>x.provider==='youtube');if(!yt||loading)return;
  if(activeChannel&&activeChannel!==yt.label){current=null;error='';lastFetch=0}
  activeChannel=yt.label;
  if(!force&&current&&Date.now()-lastFetch<120000)return;
  const seq=++revision;
  loading=true;render();
  try{
   const data=await client.request('/youtube/analytics');
   if(seq!==revision||!connected().some(x=>x.provider==='youtube'))return;
   current=data;error='';lastFetch=Date.now();
  }catch(e){
   if(seq!==revision)return;
   current=null;error=String(e.message||'youtube_analytics_unavailable');
  }finally{loading=false;render()}
 }
 function sync(){
  const yt=connected().find(x=>x.provider==='youtube');
  if(!yt){revision++;current=null;error='';lastFetch=0;activeChannel='';loading=false}
  render();
  if(yt&&$('#page-youtube')?.classList.contains('active'))load();
 }
 root.addEventListener('click',ev=>{
  if(ev.target.closest('[data-creator-open-platforms]'))window.VIVERCore?.nav?.(connected().some(x=>x.provider==='youtube')?'youtube':'platforms');
  const provider=ev.target.closest('[data-creator-open-provider]');
  if(provider){window.VIVERPlatformHub?.select?.(provider.dataset.creatorOpenProvider);return}
  if(ev.target.closest('[data-creator-reauthorize]'))client.start('youtube');
 });
 button.addEventListener('click',()=>{if(connected().some(x=>x.provider==='youtube'))load(true);else client.refresh()});
 window.addEventListener('viver-connections-updated',sync);
 window.addEventListener('hashchange',()=>setTimeout(sync,0));
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-page="youtube"],[data-goto="youtube"]'))setTimeout(sync,0)});
 $('#language')?.addEventListener('change',()=>setTimeout(render,0));
 window.VIVEROverviewAnalytics={load,render,sync};
 sync();
})();
