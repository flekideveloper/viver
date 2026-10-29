'use strict';
/* VIVER Next: local creator scripts, accurate analytics and in-tab smart alerts. */
(()=>{
 const core=window.VIVERCore,auth=window.VIVERConnections;
 if(!core)return;
 const $=q=>document.querySelector(q),esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[k]));
 const ua=()=>document.documentElement.lang!=='en',t=(a,b)=>ua()?a:b;
 const STUDIO='viver-studio-v2',ALERTS='viver-smart-alerts-v1',INSIGHTS='viver-insights-v1';
 const read=(key,fallback)=>{try{const o=JSON.parse(localStorage.getItem(key)||'null');return o&&typeof o==='object'?o:fallback}catch{return fallback}};
 const write=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data))}catch{core.toast(t('Не вдалося зберегти','Save failed'))}};
 const tools=read(STUDIO,{}),alerts=read(ALERTS,{items:[],quiet:false,start:22,end:8,notifications:false}),insights=read(INSIGHTS,{channels:{}});
 let selection='',insightsBusy=false,insightsReport=null,insightsError='',lastInsights=0,insightsDays=7;
 const make=(parent,selector,title)=>{
  const box=document.createElement('details');box.className='vs-card vs-expander';box.id=selector;
  const s=document.createElement('summary');s.textContent=title;box.append(s);
  const content=document.createElement('div');content.className='vs-detail-body';box.append(content);parent.append(box);return content
 };
 const planner=$('#page-planner'),reminders=$('#page-reminders'),youtube=$('#page-youtube');
 if(!planner||!reminders||!youtube)return;
 const studio=make(planner,'vs-studio-plus','Content Studio 2.0 — '+t('сценарії та робочий процес','scripts & workflow'));
 const notice=make(reminders,'vs-smart-notices',t('Розумні сповіщення','Smart notifications'));
 const advanced=make(youtube,'vs-advanced-insights','YouTube Analytics+ · '+t('історія та порівняння','history & comparisons'));
 function renderStudio(){
  const plans=core.state.plans.slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!plans.length){studio.innerHTML='<p class="vs-muted">'+t('Спочатку створи запис у Планері. Потім зможеш додати сценарій, посилання та етапи підготовки.','First add a post in Planner. Then create its script, resources and production checklist.')+'</p>';return}
  if(!plans.some(x=>x.id===selection))selection=plans[0].id;
  const p=plans.find(x=>x.id===selection),meta=tools[selection]||{};
  studio.innerHTML='<label>'+t('Контент','Content')+'<select id="vs-studio-select">'+plans.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===selection?'selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select></label>'+
   '<form id="vs-studio-form" class="vs-form">'+
   '<label>'+t('Коротка ідея / бриф','Brief / idea')+'<textarea name="brief" rows="3" maxlength="1500">'+esc(meta.brief||'')+'</textarea></label>'+
   '<label>'+t('Сценарій відео','Video script')+'<textarea name="script" rows="8" maxlength="12000" placeholder="'+t('Хук, основна частина, фінал…','Hook, main segment, ending…')+'">'+esc(meta.script||'')+'</textarea></label>'+
   '<label>'+t('Ресурси (одне посилання HTTPS на рядок)','Resources (one HTTPS link per line)')+'<textarea name="resources" rows="3" maxlength="2000">'+esc(meta.resources||'')+'</textarea></label>'+
   '<div class="vs-actions"><button class="primary-button" type="submit">'+t('Зберегти Studio','Save Studio')+'</button><button class="secondary-button" type="button" data-vs-studio-template="youtube">'+t('Чекліст YouTube','YouTube checklist')+'</button><button class="secondary-button" type="button" data-vs-studio-template="live">'+t('Чекліст стриму','Stream checklist')+'</button></div></form>'+
   '<p class="vs-hint">'+t('Текст зберігається на пристрої й потрапляє до хмарної копії VIVER ID тільки після натискання «Зберегти у хмарі».','Scripts are local until you explicitly save your VIVER ID cloud backup.')+'</p>';
 }
 studio.addEventListener('change',e=>{if(e.target.id==='vs-studio-select'){selection=e.target.value;renderStudio()}});
 studio.addEventListener('submit',e=>{
  if(e.target.id!=='vs-studio-form')return;e.preventDefault();if(!selection)return;
  const v=Object.fromEntries(new FormData(e.target));
  if(String(v.resources||'').split(/\n/).filter(x=>x.trim()).some(x=>!/^https:\/\//.test(x.trim()))){core.toast(t('Посилання повинні починатися з https://','Links must use https://'));return}
  tools[selection]={brief:String(v.brief||'').slice(0,1500),script:String(v.script||'').slice(0,12000),resources:String(v.resources||'').slice(0,2000),savedAt:Date.now()};
  write(STUDIO,tools);core.toast(t('Сценарій збережено','Script saved'));
 });
 studio.addEventListener('click',e=>{
  const type=e.target.closest('[data-vs-studio-template]')?.dataset.vsStudioTemplate;
  if(!type||!selection)return;
  const p=core.state.plans.find(x=>x.id===selection);if(!p)return;
  const todo=type==='youtube'?
   [t('Написати сценарій','Write script'),t('Зняти відео','Record video'),t('Зробити монтаж','Edit video'),t('Зробити обкладинку','Create thumbnail'),t('Перевірити назву й опис','Review title and description'),t('Опублікувати','Publish')]:
   [t('Підготувати сцену OBS','Prepare OBS scene'),t('Перевірити звук','Check audio'),t('Створити обкладинку','Make thumbnail'),t('Перевірити інтернет','Test connection'),t('Провести ефір','Go live')];
  const known=new Set((p.checks||[]).map(x=>x.text.toLowerCase()));
  for(const text of todo){if(!known.has(text.toLowerCase())&&p.checks.length<60)p.checks.push({id:core.uid(),text,done:false})}
  core.save();core.renderPlans();core.toast(t('Етапи додано в чекліст плану','Steps added to plan checklist'));
 });
 const localeTime=(date)=>date.toLocaleString(ua()?'uk-UA':'en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 function inQuiet(){
  if(!alerts.quiet)return false;
  const h=new Date().getHours(),a=Number(alerts.start),b=Number(alerts.end);
  return a===b?false:a<b?h>=a&&h<b:h>=a||h<b;
 }
 function inspect(){
  const timestamp=Date.now();
  if(!Array.isArray(alerts.items))alerts.items=[];
  const collect=(key,title,kind)=>{
   if(alerts.items.some(x=>x.key===key))return;
   alerts.items.unshift({key,title,kind,at:timestamp,read:false});
  };
  for(const p of core.state.plans){
   if(p.status==='published'||p.status==='ready')continue;
   const delta=Date.parse(p.date)-timestamp;
   if(delta>0&&delta<=24*3600000)collect('plan:'+p.id+':'+p.date,t('План незабаром: ','Plan due soon: ')+p.title,'plan');
  }
  for(const r of core.state.reminders){
   if(r.done)continue;
   const delta=Date.parse(r.due)-timestamp;
   if(delta<=0&&delta>=-48*3600000)collect('reminder:'+r.id+':'+r.due,t('Нагадування: ','Reminder: ')+r.title,'reminder');
  }
  alerts.items=alerts.items.slice(0,100);
  write(ALERTS,alerts);renderNotices();
 }
 function renderNotices(){
  const items=alerts.items||[],unread=items.filter(x=>!x.read).length;
  notice.innerHTML='<p class="vs-muted">'+t('Локальні нагадування під час відкритої вкладки. Без фонових push-сповіщень і без вигаданих аналітичних сигналів.','Local alerts while the tab is open. No background push notifications or invented analytics signals.')+'</p>'+
   '<div class="vs-actions"><button type="button" class="secondary-button" data-vs-alerts="scan">'+t('Перевірити зараз','Check now')+'</button><button type="button" class="secondary-button" data-vs-alerts="read">'+t('Прочитати всі','Mark all read')+' ('+unread+')</button><button type="button" class="secondary-button" data-vs-alerts="enable">'+t('Сповіщення браузера','Browser notifications')+'</button></div>'+
   '<label class="vs-checkbox"><input id="vs-quiet-toggle" type="checkbox" '+(alerts.quiet?'checked':'')+'>'+t('Тихі години','Quiet hours')+'</label>'+
   '<div class="vs-inline"><label>'+t('Від','From')+'<input id="vs-quiet-start" type="number" min="0" max="23" value="'+Number(alerts.start||0)+'"></label><label>'+t('До','To')+'<input id="vs-quiet-end" type="number" min="0" max="23" value="'+Number(alerts.end||0)+'"></label></div>'+
   '<div class="vs-alert-list">'+(items.length?items.slice(0,40).map(x=>'<div class="vs-alert '+(x.read?'':'unread')+'"><span>'+esc(x.title)+'<small>'+localeTime(new Date(x.at))+'</small></span><button type="button" class="secondary-button" data-vs-alert-key="'+esc(x.key)+'">'+(x.read?'✓':t('Прочитано','Read'))+'</button></div>').join(''):'<p class="vs-muted">'+t('Поки немає сповіщень','No alerts yet')+'</p>')+'</div>';
 }
 notice.addEventListener('click',async e=>{
  const key=e.target.closest('[data-vs-alert-key]')?.dataset.vsAlertKey;
  if(key){const x=alerts.items.find(x=>x.key===key);if(x)x.read=true;write(ALERTS,alerts);renderNotices();return}
  const act=e.target.closest('[data-vs-alerts]')?.dataset.vsAlerts;
  if(act==='read'){alerts.items.forEach(x=>x.read=true);write(ALERTS,alerts);renderNotices()}
  if(act==='scan')inspect();
  if(act==='enable'){
   if(!('Notification' in window)){core.toast(t('Браузер не підтримує сповіщення','Notifications unsupported'));return}
   try{const allowed=await Notification.requestPermission();alerts.notifications=allowed==='granted';write(ALERTS,alerts);core.toast(allowed==='granted'?t('Сповіщення ввімкнено','Notifications enabled'):t('Доступ не надано','Permission not granted'))}catch{}
  }
 });
 notice.addEventListener('change',e=>{
  if(e.target.id==='vs-quiet-toggle')alerts.quiet=e.target.checked;
  if(e.target.id==='vs-quiet-start')alerts.start=Math.min(23,Math.max(0,Number(e.target.value)||0));
  if(e.target.id==='vs-quiet-end')alerts.end=Math.min(23,Math.max(0,Number(e.target.value)||0));
  write(ALERTS,alerts);renderNotices();
 });
 let delivered=new Set();
 function tick(){
  const prev=new Set((alerts.items||[]).map(x=>x.key));
  inspect();
  if(!alerts.notifications||inQuiet()||!('Notification' in window)||Notification.permission!=='granted')return;
  for(const a of (alerts.items||[]).filter(x=>!x.read&&!prev.has(x.key))){
   if(delivered.has(a.key))continue;delivered.add(a.key);
   try{new Notification('VIVER',{body:a.title,tag:a.key})}catch{}
  }
 }
 function number(n){return n==null?'—':new Intl.NumberFormat(ua()?'uk-UA':'en-US').format(n)}
 const channelId=()=>auth?.getActiveYoutubeChannel?.()||'';
 async function gather(){
  if(insightsBusy)return;
  const id=channelId();
  if(!id||!auth){insightsReport=null;renderInsights();return}
  insightsBusy=true;insightsError='';renderInsights();
  try{
   const [stats,analytics]=await Promise.allSettled([auth.request('/youtube/stats'),auth.request('/youtube/analytics?days='+insightsDays)]);
   if(stats.status==='fulfilled'&&stats.value.channel?.id===id){
    const s=stats.value;
    insights.channels[id]={id,title:s.channel.title,totals:s.totals,history:s.history||[],observedAt:Date.now()};
    write(INSIGHTS,insights);
   }
   if(analytics.status==='fulfilled'&&analytics.value.channel?.id===id)insightsReport=analytics.value;
   else{insightsReport=null;if(analytics.status==='rejected')insightsError=String(analytics.reason?.message||'analytics_unavailable')}
   lastInsights=Date.now();
  }catch(e){insightsError=e.message||'unavailable'}
  finally{insightsBusy=false;renderInsights()}
 }
 function spark(history){
  if(!history||history.length<2)return '<p class="vs-muted">'+t('Замало історичних вимірювань','Not enough saved snapshots')+'</p>';
  const points=history.slice(-60).map(x=>Number(x.views)||0),hi=Math.max(...points,1),lo=Math.min(...points);
  const coords=points.map((x,i)=>(12+i/(points.length-1)*576).toFixed(1)+','+(105-(x-lo)/(hi-lo||1)*83).toFixed(1)).join(' ');
  return '<svg class="vs-spark" viewBox="0 0 600 120" role="img" aria-label="'+t('Історія загальних переглядів каналу','Observed channel lifetime views')+'"><polyline fill="none" stroke="currentColor" stroke-width="3" points="'+coords+'"/></svg>';
 }
 function renderInsights(){
  const id=channelId(),record=insights.channels[id],values=Object.values(insights.channels||{}).sort((a,b)=>(b.observedAt||0)-(a.observedAt||0));
  advanced.innerHTML='<div class="vs-actions"><label>'+t('Період','Period')+' <select id="vs-insights-days"><option value="7" '+(insightsDays===7?'selected':'')+'>7 '+t('днів','days')+'</option><option value="30" '+(insightsDays===30?'selected':'')+'>30 '+t('днів','days')+'</option><option value="90" '+(insightsDays===90?'selected':'')+'>90 '+t('днів','days')+'</option></select></label><button type="button" class="primary-button" id="vs-insights-refresh" '+(insightsBusy?'disabled':'')+'>'+t('Оновити через YouTube API','Refresh from YouTube API')+'</button></div>'+
   (id?'<p class="vs-hint">'+t('Дані лише підключеного каналу. Історія записується в день фактичного перегляду статистики, не відновлюється заднім числом.','Data from your authorized channel only. Snapshots are recorded when checked, not fabricated for missing days.')+'</p>':'<p class="vs-muted">'+t('Спочатку підключи YouTube-канал','Connect a YouTube channel first')+'</p>')+
   (insightsError?'<p class="vs-error">'+esc(insightsError)+'</p>':'')+
   (record?'<div class="vs-analytics-stats"><div><span>'+t('Усі перегляди','Lifetime views')+'</span><strong>'+number(record.totals?.views)+'</strong></div><div><span>'+t('Підписники','Subscribers')+'</span><strong>'+number(record.totals?.subscribers)+'</strong></div><div><span>'+t('Відео','Videos')+'</span><strong>'+number(record.totals?.videos)+'</strong></div></div>'+
   '<h3>'+t('Історія зафіксованих загальних переглядів','Observed lifetime-view history')+'</h3>'+spark(record.history||[]):'')+
   (insightsReport?.period?'<h3>'+t('YouTube Analytics за ','YouTube Analytics for ')+esc(insightsReport.period.windowDays||7)+' '+t('днів','days')+'</h3><div class="vs-analytics-stats"><div><span>'+t('Перегляди','Views')+'</span><strong>'+number(insightsReport.current?.views)+'</strong></div><div><span>'+t('Чистий приріст підписників','Net subscribers')+'</span><strong>'+number(insightsReport.current?.netSubscribers)+'</strong></div><div><span>'+t('Час перегляду (год)','Watch hours')+'</span><strong>'+number(Math.round((insightsReport.current?.estimatedMinutesWatched||0)/60))+'</strong></div></div>':'')+
   '<h3>'+t('Підключені канали: останні збережені вимірювання','Channels: last saved observations')+'</h3>'+
   '<div class="vs-observations">'+(values.length?values.map(x=>'<div><strong>'+esc(x.title)+'</strong><span>'+number(x.totals?.views)+' '+t('переглядів','views')+' · '+number(x.totals?.subscribers)+' '+t('підписників','subscribers')+'</span><small>'+localeTime(new Date(x.observedAt))+'</small></div>').join(''):'<p>'+t('Вимірювань ще немає','No saved measurements yet')+'</p>')+'</div>'+
   '<p class="vs-hint">'+t('Звіти за 30 і 90 днів стосуються активного каналу. Міжканальне порівняння — останні зафіксовані вимірювання в різний час.','30/90-day reports apply to the active channel. Cross-channel comparisons use last observed snapshots at potentially different times.')+'</p>';
 }
 advanced.addEventListener('click',e=>{if(e.target.closest('#vs-insights-refresh'))gather()});
 advanced.addEventListener('change',e=>{if(e.target.id==='vs-insights-days'){const days=Number(e.target.value);if(![7,30,90].includes(days))return;insightsDays=days;insightsReport=null;gather()}});
 document.querySelector('#language')?.addEventListener('change',()=>{renderStudio();renderNotices();renderInsights()});
 window.addEventListener('viver-youtube-channel-switched',()=>{insightsReport=null;insightsError='';lastInsights=0;renderInsights();if(advanced.parentElement?.open)gather()});
 advanced.parentElement?.addEventListener('toggle',()=>{if(advanced.parentElement.open&&Date.now()-lastInsights>300000)gather()});
 window.addEventListener('viver-connections-updated',()=>{if(advanced.parentElement?.open&&channelId()&&Date.now()-lastInsights>300000)gather()});
 window.addEventListener('viver-studio-updated',renderStudio);
 setInterval(tick,60000);
 renderStudio();renderNotices();renderInsights();inspect();
})();
