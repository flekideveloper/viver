'use strict';
/* VIVER platform-specific studio. Provider tabs exist ONLY for actively connected accounts.
   TikTok/Twitch/X use official authenticated read-only APIs; historical stats start with real snapshots. */
(()=>{
 const sidebar=document.querySelector('#sidebar-social');
 const outer=document.querySelector('#social-sidebar-nav');
 const social=document.querySelector('#social-studio-panel');
 if(!sidebar||!outer||!social||!window.VIVERConnections)return;
 const auth=window.VIVERConnections,core=window.VIVERCore;
 const $=q=>document.querySelector(q);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ua=()=>document.documentElement.lang!=='en';
 const text=(uk,en)=>ua()?uk:en;
 const number=x=>x===null||x===undefined||!Number.isFinite(Number(x))?'—':new Intl.NumberFormat(ua()?'uk-UA':'en-US').format(Number(x));
 const name={youtube:'YouTube',twitch:'Twitch',tiktok:'TikTok',x:'X'};
 const symbol={youtube:'▶',twitch:'◈',tiktok:'♪',x:'𝕏'};
 const KEY='viver-social-studio-v1';
 const initial=['youtube','twitch','tiktok','x'];
 let selected='youtube',inner='overview',data=null,loading=false,error='',lastUpdate=0,serial=0,knownKey='',detailId='',compareA='',compareB='',alertNote='';
 let settings={};
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))settings=saved}catch{}
 const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}};
 const connections=()=>auth.getConnections().filter(x=>x.connected&&initial.includes(x.provider));
 const active=()=>connections().find(x=>x.provider===selected);
 const accountKey=()=>data?.account?.id?selected+':'+data.account.id:null;
 const local=()=>{
  const k=accountKey();if(!k)return null;
  if(!settings[k])settings[k]={goals:[],alerts:[],seen:null,links:{},baseline:{}};
  const x=settings[k];
  if(!Array.isArray(x.goals))x.goals=[];
  if(!Array.isArray(x.alerts))x.alerts=[];
  if(!x.links||typeof x.links!=='object')x.links={};
  if(!x.baseline||typeof x.baseline!=='object')x.baseline={};
  return x;
 };
 const validNumeric=x=>x!==null&&x!==undefined&&Number.isFinite(Number(x));
 const kinds={
  followers:[text('Фоловери / підписники','Followers'), 'followers'],
  likes:[text('Лайки профілю','Profile likes'),'likes'],
  videos:[text('Відео','Videos'),'videos'],
  posts:[text('Пости','Posts'),'posts'],
  following:[text('Підписки','Following'),'following']
 };
 const statsLabels={
  followers:[text('Підписники / фоловери','Followers'),'followers'],
  following:[text('Підписки','Following'),'following'],
  likes:[text('Лайки','Likes'),'likes'],
  videos:[text('Відео','Videos'),'videos'],
  posts:[text('Пости','Posts'),'posts'],
  liveViewers:[text('Зараз дивляться','Watching now'),'liveViewers']
 };
 const linkOK=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(['www.twitch.tv','clips.twitch.tv','www.tiktok.com','tiktok.com','x.com'].includes(u.hostname))}catch{return false}};
 const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(ua()?'uk-UA':'en-US',{day:'numeric',month:'short',year:'numeric'})};
 const norm=s=>String(s||'').toLocaleLowerCase().replace(/[^a-zа-яіїєґ0-9]+/giu,' ').trim().replace(/\s+/g,' ');
 const dayUTC=days=>{const d=new Date();d.setUTCHours(12,0,0,0);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
 const anchorDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s:null;
 function validHistory(metric){
  const rows=(data?.history||[]).filter(x=>anchorDate(x.date)&&validNumeric(x.metrics?.[metric]));
  const latest=rows.at(-1);
  if(!latest)return {value:null,baseline:null};
  const dateTarget=new Date(latest.date+'T12:00:00Z');dateTarget.setUTCDate(dateTarget.getUTCDate()-7);
  const past=rows.find(x=>x.date===dateTarget.toISOString().slice(0,10));
  return {value:Number(latest.metrics[metric]),baseline:past?Number(past.metrics[metric]):null,baselineDate:past?.date};
 }
 function valueCard(key,value){
  const delta=validHistory(key);
  let extra='';
  if(delta.baseline!==null&&delta.value!==null){
   const change=delta.value-delta.baseline;
   extra='<small class="social-card-trend '+(change>=0?'positive':'negative')+'">'+(change>0?'+':'')+number(change)+' · '+text('за 7 днів','in 7 days')+'</small>';
  }else extra='<small>'+text('Для історії потрібні щоденні знімки','History builds from daily snapshots')+'</small>';
  return '<div class="social-stat-card"><span>'+escape(statsLabels[key]?.[0]||key)+'</span><strong>'+number(value)+'</strong>'+extra+'</div>';
 }
 function addAlert(uk,en,key){
  const s=local();if(!s||s.alerts.some(x=>x.key===key))return;
  s.alerts.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2),key,uk,en,at:Date.now(),read:false});
  s.alerts=s.alerts.slice(0,35);store();
 }
 function observe(){
  const s=local();if(!s||!data)return;
  const items=data.content||[];
  if(Array.isArray(s.seen)){
   const prev=new Set(s.seen);
   for(const item of items.filter(x=>!prev.has(x.id)).slice(0,12)){
    addAlert(text('Нова публікація: ','New post: ')+String(item.title||'').slice(0,90),
     'New post: '+String(item.title||'').slice(0,90),'new:'+item.id);
   }
  }
  // First observation is a baseline, not a fabricated "new publication".
  s.seen=items.map(x=>x.id);
  const now=Date.now();
  for(const g of s.goals){
   const v=data.metrics?.[g.metric];
   if(validNumeric(v)&&Number(v)>=Number(g.target)&&!g.achieved){
    g.achieved=now;
    addAlert('Ціль виконано: '+(g.title||g.metric)+' · '+number(g.target),
     'Goal reached: '+(g.title||g.metric)+' · '+number(g.target),'goal:'+g.id);
   }
  }
  // Only report measurable increases from recorded past observations.
  const followers=data.metrics?.followers;
  if(validNumeric(followers)){
   const prev=s.baseline.followers;
   if(prev&&Number(followers)>prev.value&&now-prev.time>=3600000){
    addAlert('Нові підписники: +'+number(Number(followers)-prev.value),
     'Follower growth: +'+number(Number(followers)-prev.value),'followers:'+new Date(now).toISOString().slice(0,10));
   }
   if(!prev||now-prev.time>=3600000)s.baseline.followers={value:Number(followers),time:now};
  }
  store();
 }
 function syncPlanner(){
  const s=local();if(!s||!Array.isArray(data?.content)||!core?.state?.plans)return;
  let changed=false;
  for(const item of data.content){
   const p=core.state.plans.find(p=>p.platform===selected&&(s.links[item.id]===p.id||(!s.links[item.id]&&norm(p.title)===norm(item.title))));
   if(!p)continue;
   s.links[item.id]=p.id;
   if(p.status!=='published'){p.status='published';changed=true}
  }
  if(changed){core.save();core.renderHome();core.renderPlans()}
  store();
 }
 function contentList(limit=25){
  const rows=(data?.content||[]).slice(0,limit);
  if(!rows.length)return '<p class="social-empty">'+text('Публікацій немає або цей список не дозволений поточним API-доступом.','No posts yet, or the current API access does not permit listing them.')+'</p>';
  return '<div class="social-post-list">'+rows.map(x=>'<div class="social-post-row"><div class="social-post-info"><strong>'+escape(x.title||text('Без назви','Untitled'))+'</strong><span>'+date(x.publishedAt)+' · '+(x.kind==='clip'?'Clip':x.kind==='vod'?'VOD':x.kind==='post'?text('Пост','Post'):text('Відео','Video'))+'</span></div><div class="social-post-metrics">'+(validNumeric(x.views)?number(x.views)+' '+text('переглядів','views'):'')+(validNumeric(x.likes)?' · ♥ '+number(x.likes):'')+(validNumeric(x.comments)?' · ◇ '+number(x.comments):'')+'</div>'+
   (linkOK(x.url)?'<a class="social-post-link" href="'+escape(x.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+text('Відкрити публікацію','Open post')+'">↗</a>':'')+'</div>').join('')+'</div>';
 }
 function mainView(){
  if(!data)return '';
  const account=data.account||{},metrics=data.metrics||{};
  const metricKeys=Object.keys(statsLabels).filter(k=>k in metrics&&metrics[k]!==null);
  const profile=linkOK(account.url)?'<a class="social-profile-action" href="'+escape(account.url)+'" target="_blank" rel="noopener noreferrer">'+text('Відкрити профіль ↗','Open profile ↗')+'</a>':'';
  const live=data.live?(data.live.online?'<div class="social-live live"><span>● LIVE</span><strong>'+escape(data.live.title||'')+'</strong><small>'+number(data.live.viewers)+' '+text('глядачів','viewers')+' · '+escape(data.live.game||'')+'</small></div>':
   '<div class="social-live"><span>'+text('Зараз не в ефірі','Currently offline')+'</span><small>'+escape(data.live.title||'')+'</small></div>'):'';
  const avatar=String(account.avatar||'');
  const avatarHTML=/^https:\/\//.test(avatar)?'<img class="social-profile-avatar" src="'+escape(avatar)+'" alt="" referrerpolicy="no-referrer" loading="lazy">':'<span class="social-profile-avatar social-profile-fallback">'+symbol[selected]+'</span>';
  return '<div class="social-profile">'+avatarHTML+'<div><strong>'+escape(account.label||name[selected])+'</strong><span>'+text('Реальні дані платформи · ','Official platform data · ')+new Date(data.updatedAt).toLocaleString(ua()?'uk-UA':'en-US')+'</span></div>'+profile+'</div>'+
   (live||'')+'<div class="social-stat-grid">'+(metricKeys.length?metricKeys.map(k=>valueCard(k,metrics[k])).join(''):'<p class="social-empty">'+text('Профіль не повернув доступних лічильників.','No profile metrics returned.')+'</p>')+'</div>'+
   '<div class="social-two-panels"><section class="social-section"><h3>'+text('Останні публікації','Recent content')+'</h3>'+contentList(6)+'</section>'+
   '<section class="social-section"><h3>'+text('Історія показників','Metric history')+'</h3>'+historyView()+'</section></div>'+
   '<p class="social-api-note">'+text('Зрізи та історія залежать від дозволів сервісу. Показники за 7 днів з’являться після двох реальних знімків із різницею 7 днів.','Reports depend on official permissions. 7-day changes require two actual snapshots 7 days apart.')+'</p>';
 }
 function historyView(){
  const h=data?.history||[];
  if(!h.length)return '<p class="social-empty">'+text('Знімків ще немає.','No snapshots yet.')+'</p>';
  return '<div class="social-snapshot-list">'+h.slice(-8).reverse().map(x=>'<div><span>'+escape(x.date)+'</span><strong>'+text('Підписники: ','Followers: ')+number(x.metrics?.followers)+'</strong></div>').join('')+'</div>';
 }
 function mediaView(){return '<p class="social-api-note">'+text('Лише власні публічні матеріали, доступні через офіційний API.','Only your own public content available to the official API.')+'</p>'+contentList(35)}
 function goalView(){
  const state=local();if(!state)return '';
  const options=Object.keys(kinds).filter(k=>data.metrics&&k in data.metrics&&data.metrics[k]!==null);
  const cards=state.goals.map(g=>{
   const measured=data.metrics[g.metric],percent=validNumeric(measured)?Math.min(100,Math.max(0,100*Number(measured)/g.target)):0;
   return '<div class="social-goal-card"><div class="social-goal-header"><strong>'+escape(g.title||kinds[g.metric]?.[0]||g.metric)+'</strong><button type="button" data-social-goal-remove="'+escape(g.id)+'" aria-label="'+text('Видалити ціль','Remove goal')+'">×</button></div><span>'+number(measured)+' / '+number(g.target)+'</span><div class="social-progress"><span style="width:'+percent.toFixed(1)+'%"></span></div></div>';
  }).join('');
  return '<div class="social-goal-grid">'+cards+'</div>'+
   (options.length?'<form class="social-goal-form" id="social-goal-form"><label>'+text('Показник','Metric')+'<select name="metric">'+options.map(k=>'<option value="'+escape(k)+'">'+escape(kinds[k]?.[0]||k)+'</option>').join('')+'</select></label><label>'+text('Мета','Target')+'<input name="target" type="number" min="1" max="1000000000000" required placeholder="1000"></label><label>'+text('Назва','Title')+'<input name="title" maxlength="64" placeholder="'+text('Моя ціль','My goal')+'"></label><button class="secondary-button" type="submit">'+text('Додати ціль','Add goal')+'</button></form>':
     '<p class="social-api-note">'+text('Цілі стануть доступні, коли API поверне числові показники.','Goals require numeric account metrics from the API.')+'</p>');
 }
 function alertView(){
  const s=local();if(!s)return '';
  const unread=s.alerts.filter(x=>!x.read).length;
  return '<div class="social-tools-row"><span>'+unread+' '+text('непрочитаних','unread')+'</span><button class="text-button" type="button" data-social-read="1">'+text('Прочитати всі','Mark all read')+'</button></div>'+
   (s.alerts.length?'<div class="social-notices">'+s.alerts.map(x=>'<div class="social-notice '+(x.read?'':'unread')+'"><strong>'+escape(ua()?x.uk:x.en)+'</strong><small>'+new Date(x.at).toLocaleString(ua()?'uk-UA':'en-US')+'</small></div>').join('')+'</div>':
    '<p class="social-empty">'+text('Після першого знімка VIVER помічатиме нові публікації, приріст фоловерів і досягнуті цілі під час використання сайту.','After the first snapshot, VIVER will notice uploads, follower growth and goal milestones while the site is open.')+'</p>');
 }
 function plannerView(){
  const s=local();if(!s||!core)return '';
  const plans=core.state.plans.filter(p=>p.platform===selected);
  return '<p class="social-api-note">'+text('Точні збіги назв синхронізуються автоматично. Інші записи можна прив’язати вручну; VIVER нічого не публікує.','Exact matching titles sync automatically. Link other posts manually; VIVER never publishes content.')+'</p>'+
   '<div class="social-plan-list">'+(data.content||[]).map(x=>{
    const p=plans.find(p=>p.id===s.links[x.id]);
    const others=plans.filter(p=>p.status!=='published');
    return '<div class="social-plan-row"><div><strong>'+escape(x.title||'')+'</strong><small>'+(p?text('Пов’язано: ','Linked: ')+escape(p.title):text('Не пов’язано з планом','Not linked to planner'))+'</small></div>'+
    (p?'<button class="secondary-button" type="button" data-social-open-plan="'+escape(p.id)+'">'+text('План','Plan')+'</button>':
    '<div class="social-plan-actions">'+(others.length?'<select data-social-link-select="'+escape(x.id)+'" aria-label="'+text('Вибери план','Choose plan')+'"><option value="">'+text('Вибери план','Choose plan')+'</option>'+others.map(p=>'<option value="'+escape(p.id)+'">'+escape(p.title.slice(0,70))+'</option>').join('')+'</select><button class="secondary-button" type="button" data-social-link="'+escape(x.id)+'">'+text('Зв’язати','Link')+'</button>':'')+
    '<button class="secondary-button" type="button" data-social-import="'+escape(x.id)+'">'+text('У планер','Add to planner')+'</button></div>')+'</div>';
   }).join('')+'</div>';
 }
 function compareView(){
  const posts=(data?.content||[]).filter(x=>x.id);
  if(posts.length<2)return '<p class="social-empty">'+text('Потрібно мінімум два доступні публічні матеріали.','At least two public posts are needed.')+'</p>';
  const options=posts.map(x=>'<option value="'+escape(x.id)+'">'+escape((x.title||x.id).slice(0,90))+'</option>').join('');
  const chosen=posts.filter(x=>x.id===compareA||x.id===compareB);
  const rows=chosen.length===2?'<div class="social-compare-grid">'+chosen.map(x=>'<article class="social-compare-card"><strong>'+escape(x.title||x.id)+'</strong><small>'+date(x.publishedAt)+'</small><div>'+['views','likes','comments','shares'].filter(k=>validNumeric(x[k])).map(k=>'<div><span>'+escape(({views:text('Перегляди','Views'),likes:text('Лайки','Likes'),comments:text('Коментарі','Comments'),shares:text('Поширення','Shares')})[k])+'</span><strong>'+number(x[k])+'</strong></div>').join('')+'</div></article>').join('')+'</div>':'';
  return '<p class="social-api-note">'+text('Порівняння доступних накопичених публічних лічильників — НЕ за перші 7 днів, якщо API не має історичного звіту.','Comparison of available lifetime public counters — NOT first-7-day analytics unless provided by the API.')+'</p>'+
   '<form id="social-compare-form" class="social-compare-controls"><label>'+text('Перша публікація','First post')+'<select name="a" required><option value="">'+text('Обрати','Select')+'</option>'+options+'</select></label><label>'+text('Друга публікація','Second post')+'<select name="b" required><option value="">'+text('Обрати','Select')+'</option>'+options+'</select></label><button class="secondary-button" type="submit">'+text('Порівняти','Compare')+'</button></form>'+rows;
 }
 function renderSocial(){
  if(!active()||selected==='youtube')return;
  $('#social-studio-title').textContent=name[selected]+' · Creator Studio';
  $('#social-studio-subtitle').textContent=escape(active().label||name[selected]);
  $('#social-studio-reload-label').textContent=text('Оновити','Refresh');
  $('#social-studio-reload').disabled=loading;
  const tabs={overview:text('Огляд','Overview'),content:text('Контент','Content'),planner:text('Планер','Planner'),goals:text('Цілі','Goals'),alerts:text('Сповіщення','Alerts'),compare:text('Порівняння','Compare')};
  $('#social-studio-tabs').innerHTML=Object.entries(tabs).map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(inner===id)+'" class="'+(inner===id?'active':'')+'" data-social-inner="'+id+'">'+label+'</button>').join('');
  const box=$('#social-studio-content');
  if(loading&&!data)box.innerHTML='<p class="social-empty">'+text('Отримуємо дані офіційного API…','Loading official API metrics…')+'</p>';
  else if(error){
   const descriptions={social_not_connected:text('Акаунт не підключено.','Account not connected.'),
    social_reconnect_required:text('Потрібно повторно підключити акаунт.','Reconnect your account.'),
    social_token_expired:text('Термін авторизації закінчився.','Authorization has expired.'),
    social_access_denied:text('API обмежує цей доступ або потрібні додаткові дозволи.','API access is restricted or additional permissions are needed.'),
    social_rate_limited:text('Вичерпано ліміт запитів API.','API rate limit reached.'),
    social_provider_unavailable:text('API тимчасово недоступний або тариф не дозволяє отримати дані.','API unavailable or the current plan does not allow this data.'),
    social_account_changed:text('Акаунт змінився. Повторно підключи профіль.','Account changed. Reconnect the profile.')};
   box.innerHTML='<div class="social-error">'+escape(descriptions[error]||text('Не вдалося отримати статистику.','Unable to load statistics.'))+
    '<p>'+text('Попередні підключення не видаляються.','Existing connections remain unchanged.')+'</p><button type="button" class="secondary-button" data-social-reauthorize="1">'+text('Оновити дозвіл','Update authorization')+'</button></div>';
  }else if(!data)box.innerHTML='<p class="social-empty">'+text('Відкрий вкладку, щоб завантажити статистику.','Open this tab to load statistics.')+'</p>';
  else{const views={overview:mainView,content:mediaView,planner:plannerView,goals:goalView,alerts:alertView,compare:compareView};box.innerHTML=views[inner]()}
 }
 async function fetchSelected(force=false){
  if(selected==='youtube'||!active()||loading)return;
  const id=selected+':'+active().label;
  if(!force&&data&&knownKey===id&&Date.now()-lastUpdate<120000)return;
  const idSeq=++serial;
  loading=true;error='';renderSocial();
  try{
   const response=await auth.request('/social/'+selected+'/overview');
   if(serial!==idSeq||!active()||response.account?.label!==active().label)return;
   data=response;knownKey=id;lastUpdate=Date.now();observe();syncPlanner();
  }catch(e){if(serial===idSeq){error=String(e.message||'social_provider_unavailable');data=null}}
  finally{if(serial===idSeq){loading=false;renderSocial()}}
 }
 function select(provider){
  if(!connections().some(c=>c.provider===provider))return;
  if(provider!==selected){serial++;data=null;error='';knownKey='';lastUpdate=0;loading=false;inner='overview';detailId='';compareA='';compareB=''}
  selected=provider;
  if(core?.page!==provider)core?.nav?.(provider);
  renderSidebar();
  if(provider!=='youtube')fetchSelected();
 }
 function renderSidebar(){
  const list=connections();
  sidebar.hidden=!list.length;
  $('#sidebar-social-heading').textContent=text('СОЦМЕРЕЖІ','SOCIAL NETWORKS');
  if(!list.length){outer.replaceChildren();social.hidden=true;return}
  outer.innerHTML=initial.filter(id=>list.some(x=>x.provider===id)).map(id=>{
   const isActive=core?.page===id;
   return '<button class="nav-item social-nav-button '+(isActive?'active':'')+'" type="button" data-page="'+id+'" aria-current="'+(isActive?'page':'false')+'"><span class="sidebar-social-mark connected-platform-'+id+'">'+symbol[id]+'</span><span>'+name[id]+'</span></button>';
  }).join('');
 }
 function sync(){
  const list=connections(),page=core?.page;
  // Restore a bookmarked provider URL after OAuth is verified on page reload.
  const fragment=location.hash.slice(1);
  if(initial.includes(fragment)&&list.some(x=>x.provider===fragment)&&page!==fragment)core?.nav?.(fragment,false);
  const current=core?.page;
  if(initial.includes(current)&&!list.some(x=>x.provider===current)){
   serial++;data=null;knownKey='';error='';loading=false;lastUpdate=0;
   core?.nav?.('platforms');
  }
  const now=core?.page;
  if(initial.includes(now)&&list.some(x=>x.provider===now)){
   if(selected!==now){serial++;data=null;error='';knownKey='';lastUpdate=0;loading=false;inner='overview';compareA='';compareB=''}
   selected=now;
  }
  if(!list.some(x=>x.provider===selected)){
   serial++;data=null;error='';knownKey='';loading=false;lastUpdate=0;selected=list[0]?.provider||'youtube';
  }
  if(active()&&selected!=='youtube'&&knownKey&&knownKey!==selected+':'+active().label){
   serial++;data=null;error='';knownKey='';loading=false;lastUpdate=0;
  }
  renderSidebar();
  const displayed=core?.page===selected&&list.some(x=>x.provider===selected);
  if(displayed&&selected!=='youtube'){
   const target=document.getElementById('social-mount-'+selected);
   if(target&&social.parentNode!==target)target.appendChild(social);
   social.hidden=false;
   renderSocial();
   fetchSelected();
  }else{
   social.hidden=true;
  }
 }
 function planOpen(id){
  if(!core)return;
  core.nav('planner');$('#plan-filter').value='all';core.renderPlans();
  [...document.querySelectorAll('[data-plan-edit]')].find(x=>x.dataset.planEdit===id)?.click();
 }
 function connectPlan(id,planId){
  const s=local(),p=core?.state?.plans?.find(x=>x.id===planId&&x.platform===selected);
  if(!s||!p||!data?.content?.some(x=>x.id===id))return;
  s.links[id]=p.id;p.status='published';
  core.save();core.renderHome();core.renderPlans();store();renderSocial();
 }
 outer.addEventListener('click',()=>setTimeout(sync,0));
 social.addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-social-inner]');if(btn){inner=btn.dataset.socialInner;renderSocial();return}
  if(ev.target.closest('[data-social-reauthorize]')){auth.start(selected);return}
  const x=ev.target.closest('[data-social-goal-remove]');if(x){const s=local();s.goals=s.goals.filter(g=>g.id!==x.dataset.socialGoalRemove);store();renderSocial();return}
  if(ev.target.closest('[data-social-read]')){const s=local();for(const a of s.alerts)a.read=true;store();renderSocial();return}
  const open=ev.target.closest('[data-social-open-plan]');if(open){planOpen(open.dataset.socialOpenPlan);return}
  const link=ev.target.closest('[data-social-link]');
  if(link){const select=[...social.querySelectorAll('[data-social-link-select]')].find(x=>x.dataset.socialLinkSelect===link.dataset.socialLink);if(select?.value)connectPlan(link.dataset.socialLink,select.value);return}
  const add=ev.target.closest('[data-social-import]');
  if(add){
   const item=data?.content?.find(x=>x.id===add.dataset.socialImport),s=local();
   if(!item||!s||!core||core.state.plans.length>=500)return;
   const existing=core.state.plans.find(p=>p.id===s.links[item.id]);
   if(existing){planOpen(existing.id);return}
   const timestamp=Number.isFinite(Date.parse(item.publishedAt))?new Date(item.publishedAt):new Date();
   const plan={id:core.uid(),title:String(item.title||name[selected]+' post').slice(0,110),date:timestamp.toISOString().slice(0,16),
    platform:selected,status:'published',notes:String(item.url||'').slice(0,350),checks:[],created:Date.now()};
   core.state.plans.push(plan);s.links[item.id]=plan.id;core.save();core.renderHome();core.renderPlans();store();renderSocial();
  }
 });
 social.addEventListener('submit',ev=>{
  if(ev.target.id==='social-goal-form'){
   ev.preventDefault();const f=new FormData(ev.target),metric=String(f.get('metric')),target=Number(f.get('target'));
   if(!Object.hasOwn(kinds,metric)||!validNumeric(data?.metrics?.[metric])||!Number.isSafeInteger(target)||target<1||target>1e12)return;
   const s=local();if(s.goals.length>=12)return;
   s.goals.push({id:core.uid(),metric,target,title:String(f.get('title')||'').slice(0,64)});store();observe();renderSocial();
  }else if(ev.target.id==='social-compare-form'){
   ev.preventDefault();const f=new FormData(ev.target),a=f.get('a'),b=f.get('b');
   if(!a||!b||a===b||!data?.content?.some(x=>x.id===a)||!data?.content?.some(x=>x.id===b))return;
   compareA=a;compareB=b;renderSocial();
   const form=$('#social-compare-form');if(form){form.elements.a.value=a;form.elements.b.value=b}
  }
 });
 $('#social-studio-reload').addEventListener('click',()=>fetchSelected(true));
 window.addEventListener('viver-connections-updated',()=>setTimeout(sync,0));
 window.addEventListener('hashchange',()=>setTimeout(sync,0));
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-page],[data-goto]'))setTimeout(sync,0)});
 $('#language')?.addEventListener('change',()=>setTimeout(sync,0));
 window.VIVERPlatformHub={select,sync,getSelected:()=>selected};
 sync();
})();