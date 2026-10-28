'use strict';
/* VIVER Creator Studio — read-only official YouTube API + local private preferences.
   Never exposes OAuth access tokens or invents missing analytics. */
(()=>{
 const root=document.querySelector('#studio-panel'),body=document.querySelector('#studio-body');
 const home=document.querySelector('#creator-home-tools');
 const auth=window.VIVERConnections,core=window.VIVERCore;
 if(!root||!home||!auth||!core)return;
 const $=q=>document.querySelector(q);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ua=()=>document.documentElement.lang!=='en';
 const t=(uk,en)=>ua()?uk:en;
 const number=n=>n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat(ua()?'uk-UA':'en-US',{maximumFractionDigits:1}).format(Number(n));
 const day=s=>s&&/^\d{4}-\d{2}-\d{2}$/.test(String(s).slice(0,10))?new Date(String(s).slice(0,10)+'T12:00:00Z').toLocaleDateString(ua()?'uk-UA':'en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'—';
 const validId=s=>/^[A-Za-z0-9_-]{11}$/.test(String(s||''));
 const KEY='viver-creator-studio-v1';
 const kinds={subscribers:[t('Підписники','Subscribers'),'subscribers'],views:[t('Перегляди каналу','Channel views'),'views'],videos:[t('Відео','Videos'),'videos']};
 let memory={},tab='videos',catalog=null,channelStats=null,retention=null,comparison=null,selection='',loading=false,loadingStats=false,error='',lastFetch=0,seq=0,channel='',compareA='',compareB='';
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'{}');
  memory=v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 }catch{}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(memory))}catch{}}
 function space(){
  if(!channel)return null;
  const d=memory[channel];
  if(!d||typeof d!=='object')memory[channel]={goals:[],alerts:[],seen:null,links:{},achieved:{},baseline:{}};
  const x=memory[channel];
  if(!Array.isArray(x.goals))x.goals=[];
  if(!Array.isArray(x.alerts))x.alerts=[];
  if(!x.links||typeof x.links!=='object')x.links={};
  if(!x.achieved||typeof x.achieved!=='object')x.achieved={};
  if(!x.baseline||typeof x.baseline!=='object')x.baseline={};
  return x;
 }
 function linked(){return auth.getConnections().some(x=>x.provider==='youtube'&&x.connected)}
 function toast(uk,en){core.toast(t(uk,en))}
 function pushAlert(textUk,textEn,key){
  const s=space();if(!s||s.alerts.some(x=>x.key===key))return;
  s.alerts.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,8),key,uk:textUk,en:textEn,read:false,when:Date.now()});
  s.alerts=s.alerts.slice(0,40);save();
 }
 function normalize(x){return String(x||'').toLocaleLowerCase().replace(/[^a-zа-яіїєґ0-9]+/giu,' ').trim().replace(/\s+/g,' ')}
 function syncPublished(){
  const s=space();if(!s||!catalog?.videos)return;
  const plans=core.state.plans||[];let changed=0;
  for(const video of catalog.videos){
   const candidate=plans.find(p=>p.platform==='youtube'&&(s.links[video.id]===p.id||(!s.links[video.id]&&normalize(p.title)===normalize(video.title))));
   if(!candidate)continue;
   if(s.links[video.id]!==candidate.id)s.links[video.id]=candidate.id;
   if(candidate.status!=='published'){candidate.status='published';changed++}
  }
  if(changed){core.save();core.renderHome();core.renderPlans();toast('Планер оновлено: '+changed+' опублікованих відео','Planner updated: '+changed+' published videos')}
  save();
 }
 function monitorVideos(){
  if(!catalog?.videos||!channel)return;
  const s=space(),ids=catalog.videos.map(v=>v.id);
  if(Array.isArray(s.seen)){
   const old=new Set(s.seen);
   for(const v of catalog.videos.filter(x=>!old.has(x.id))){
    pushAlert('Нове відео: '+v.title,'New upload: '+v.title,'upload:'+v.id);
   }
  }
  s.seen=ids;
  const now=Date.now();
  for(const v of catalog.videos){
   const last=s.baseline[v.id],views=Number(v.views);
   if(Number.isFinite(views)&&views>=0&&last&&now-last.time>=3600000&&last.views>=100&&views-last.views>=100&&views>=last.views*1.5){
    pushAlert('Відео різко зростає: '+v.title+' ('+number(last.views)+' → '+number(views)+')',
      'Video views are rising fast: '+v.title+' ('+number(last.views)+' → '+number(views)+')',
      'surge:'+v.id+':'+new Date(now).toISOString().slice(0,10));
   }
   if(Number.isFinite(views)&&views>=0&&(!last||now-last.time>=3600000))s.baseline[v.id]={views,time:now};
  }
  save();
 }
 function checkGoals(){
  if(!channelStats?.totals)return;
  const s=space();
  for(const g of s.goals){
   const metric=Number(channelStats.totals[g.type]);
   if(Number.isFinite(metric)&&metric>=Number(g.target)&&!s.achieved[g.id]){
    s.achieved[g.id]=Date.now();
    pushAlert('Ціль досягнута: '+(g.label||kinds[g.type]?.[0]||g.type)+' — '+number(g.target),
      'Goal reached: '+(g.label||g.type)+' — '+number(g.target),'goal:'+g.id);
   }
  }
  save();
 }
 async function load(force=false){
  if(!linked()||loading||(!force&&catalog&&Date.now()-lastFetch<120000))return;
  loading=true;error='';render();
  const serial=++seq;
  try{
   const response=await auth.request('/youtube/videos');
   if(serial!==seq||!linked())return;
   if(channel&&response.channelId!==channel){catalog=null;retention=null;comparison=null}
   channel=response.channelId;
   catalog=response;lastFetch=Date.now();
   syncPublished();monitorVideos();
  }catch(e){if(serial===seq){error=String(e.message||'youtube_videos_unavailable');catalog=null}}
  finally{if(serial===seq){loading=false;render();loadChannelStats()}}
 }
 async function loadChannelStats(){
  if(!linked()||!channel||loadingStats)return;
  loadingStats=true;
  const id=channel;
  try{
   const stats=await auth.request('/youtube/stats');
   if(channel!==id||!linked())return;
   channelStats=stats;checkGoals();render();
  }catch{}finally{loadingStats=false}
 }
 function videoRow(v){
  const active=selection===v.id;
  return '<button type="button" class="studio-video-row '+(active?'active':'')+'" data-studio-video="'+esc(v.id)+'">'+
   (v.thumbnail&&/^https:\/\//.test(v.thumbnail)?'<img src="'+esc(v.thumbnail)+'" alt="" referrerpolicy="no-referrer" loading="lazy">':'<span class="studio-video-fallback">▶</span>')+
   '<span class="studio-video-title"><strong>'+esc(v.title)+'</strong><small>'+day(v.publishedAt)+' · '+t('усього','total')+' '+number(v.views)+' '+t('переглядів','views')+'</small></span>'+
   '<span class="studio-video-arrow">›</span></button>';
 }
 function stat(label,value){return '<div class="studio-mini-stat"><span>'+esc(label)+'</span><strong>'+esc(number(value))+'</strong></div>'}
 function videoDetail(v){
  const week=v.week;
  let retentionHtml='';
  if(retention?.id===v.id){
   if(retention.points?.length>1){
    const points=retention.points.slice().sort((a,b)=>a.position-b.position);
    const ceiling=Math.max(1,...points.map(x=>x.ratio));
    const xy=points.map(x=>(16+x.position*568).toFixed(1)+','+(106-x.ratio/ceiling*87).toFixed(1)).join(' ');
    retentionHtml='<div class="studio-retention"><div class="studio-muted">'+t('Утримання глядачів · від початку до кінця відео','Audience retention · from start to finish')+'</div><svg viewBox="0 0 600 125" role="img" aria-label="Audience retention"><path d="M16 106H584" stroke="currentColor" opacity=".2"/><polyline points="'+xy+'" stroke="#bba7ed" fill="none" stroke-width="3" stroke-linecap="round"/></svg><div class="studio-range"><span>0%</span><span>100%</span></div></div>';
   }else retentionHtml='<p class="studio-muted">'+t('YouTube не повернув достатньо даних для графіка утримання.','YouTube did not return enough retention data.')+'</p>';
  }
  return '<div class="studio-detail"><div class="studio-section-heading"><strong>'+esc(v.title)+'</strong><a href="'+esc(v.url)+'" target="_blank" rel="noopener noreferrer">YouTube ↗</a></div>'+
   '<div class="studio-mini-grid">'+stat(t('Перегляди','Views'),v.views)+stat(t('Лайки','Likes'),v.likes)+stat(t('Коментарі','Comments'),v.comments)+'</div>'+
   '<p class="studio-muted">'+t('За 7 останніх днів','Past 7 days')+'</p>'+
   (week?'<div class="studio-mini-grid">'+stat(t('Перегляди','Views'),week.views)+stat(t('Нові підписки','New subscribers'),week.subscribersGained)+stat(t('Середній перегляд (с)','Avg view (s)'),week.avgViewSeconds)+'</div>':
    '<p class="studio-muted">'+t('YouTube Analytics ще не надав тижневий звіт для цього відео.','YouTube Analytics has no weekly report for this video yet.')+'</p>')+
   '<button type="button" class="secondary-button" data-studio-retention="'+esc(v.id)+'">'+t('Показати утримання','View retention')+'</button>'+retentionHtml+'</div>';
 }
 function videosTab(){
  if(!catalog)return '<div class="studio-empty">'+(loading?t('Завантажуємо відео…','Loading videos…'):esc(error||t('Не вдалося отримати список відео.','Unable to load video list.')))+'</div>';
  if(!catalog.videos?.length)return '<div class="studio-empty">'+t('Публічних відео поки немає.','No public videos yet.')+'</div>';
  const selected=catalog.videos.find(x=>x.id===selection)||null;
  return '<div class="studio-toolbar"><span>'+catalog.videos.length+' '+t('останніх публічних відео · офіційний API','recent public videos · official API')+'</span><span>'+day(catalog.updatedAt&&new Date(catalog.updatedAt).toISOString().slice(0,10))+'</span></div>'+
   '<div class="studio-two-col"><div class="studio-video-list">'+catalog.videos.map(videoRow).join('')+'</div><div class="studio-video-detail">'+(selected?videoDetail(selected):
   '<div class="studio-empty">'+t('Вибери відео, щоб побачити статистику та утримання.','Choose a video for its statistics and retention.')+'</div>')+'</div></div>';
 }
 function plannerTab(){
  if(!catalog)return '<div class="studio-empty">'+t('Завантажуємо список відео…','Loading video list…')+'</div>';
  const s=space(),plans=core.state.plans.filter(x=>x.platform==='youtube');
  const free=plans.filter(x=>x.status!=='published');
  return '<div class="studio-toolbar">'+t('Точний збіг назв публікацій синхронізується автоматично. Решту можна пов’язати вручну.','Exact published-title matches sync automatically. Link the rest manually.')+'</div>'+
   '<div class="studio-published-list">'+catalog.videos.slice(0,35).map(v=>{
    const linkedPlan=plans.find(p=>p.id===s.links[v.id]);
    const choices=free.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title.slice(0,80))+'</option>').join('');
    return '<div class="studio-published-row"><div><strong>'+esc(v.title)+'</strong><small>'+day(v.publishedAt)+' · '+(linkedPlan?t('Пов’язано: ','Linked: ')+esc(linkedPlan.title):t('Немає зв’язку з планом','Not linked to a plan'))+'</small></div>'+
     (linkedPlan?'<button class="secondary-button" type="button" data-studio-open-plan="'+esc(linkedPlan.id)+'">'+t('План','Plan')+'</button>':
     '<div class="studio-published-actions">'+(choices?'<select aria-label="'+t('Вибери запис плану','Choose planned post')+'" data-studio-plan="'+esc(v.id)+'"><option value="">'+t('Обрати план','Choose plan')+'</option>'+choices+'</select><button class="secondary-button" type="button" data-studio-link="'+esc(v.id)+'">'+t('Зв’язати','Link')+'</button>':'')+
     '<button class="secondary-button" type="button" data-studio-import="'+esc(v.id)+'">'+t('У планер','To planner')+'</button></div>')+'</div>';
   }).join('')+'</div>';
 }
 function goalProgress(g){
  const val=channelStats?.totals?.[g.type],valid=val!=null&&Number.isFinite(Number(val));
  const pct=valid?Math.min(100,Number(val)/Number(g.target)*100):0;
  return '<div class="studio-goal"><div class="studio-goal-head"><strong>'+esc(g.label||kinds[g.type]?.[0]||g.type)+'</strong><button type="button" aria-label="'+t('Видалити ціль','Delete goal')+'" data-studio-delete-goal="'+esc(g.id)+'">×</button></div>'+
   '<div class="studio-goal-numbers">'+(valid?number(val)+' / '+number(g.target)+' · '+Math.floor(pct)+'%':t('Завантажуємо лічильник…','Loading channel total…'))+'</div>'+
   '<div class="studio-progress-track"><div style="width:'+Math.max(0,pct).toFixed(2)+'%"></div></div></div>';
 }
 function goalsTab(){
  const s=space();
  return '<div class="studio-toolbar">'+t('Цілі зберігаються тільки в цьому браузері. Прогрес береться з реального лічильника каналу.','Goals stay in this browser. Progress uses real channel totals.')+'</div>'+
   '<div class="studio-goals-grid">'+(s.goals.length?s.goals.map(goalProgress).join(''):'<p class="studio-muted">'+t('Поки немає цілей. Додай першу нижче.','No goals yet. Add your first one below.')+'</p>')+'</div>'+
   '<form id="studio-goal-form" class="studio-goal-form"><label>'+t('Показник','Metric')+'<select name="type"><option value="subscribers">'+t('Підписники','Subscribers')+'</option><option value="views">'+t('Перегляди каналу','Channel views')+'</option><option value="videos">'+t('Відео','Videos')+'</option></select></label>'+
   '<label>'+t('Мета','Target')+'<input type="number" name="target" min="1" max="1000000000000" required placeholder="1000"></label>'+
   '<label>'+t('Назва (необов’язково)','Title (optional)')+'<input name="label" maxlength="54" placeholder="'+t('Моя ціль','My goal')+'"></label>'+
   '<button class="secondary-button" type="submit">'+t('Додати ціль','Add goal')+'</button></form>';
 }
 function alertsTab(){
  const s=space();
  return '<div class="studio-toolbar"><span>'+t('Події зберігаються локально. Перевірка працює під час відкриття VIVER.','Alerts are stored locally and checked while VIVER is open.')+'</span>'+
   '<button class="text-button" type="button" data-studio-read="1">'+t('Прочитати всі','Mark all read')+'</button></div>'+
   (s.alerts.length?'<div class="studio-alerts-list">'+s.alerts.map(a=>'<div class="studio-alert '+(a.read?'':'unread')+'"><strong>'+esc(ua()?a.uk:a.en)+'</strong><small>'+new Date(a.when).toLocaleString(ua()?'uk-UA':'en-US')+'</small></div>').join('')+'</div>':
   '<div class="studio-empty">'+t('Подій поки немає. VIVER повідомить про нове відео, різкий приріст переглядів або досягнуту ціль.','No alerts yet. VIVER will flag new uploads, unusually fast growth or a reached goal.')+'</div>');
 }
 function compareCard(v){
  if(v.error||!v.report)return '<div class="studio-compare-card"><strong>'+esc(v.title||v.id)+'</strong><p class="studio-muted">'+t('Аналітика поки недоступна.','Analytics unavailable yet.')+'</p></div>';
  return '<div class="studio-compare-card"><strong>'+esc(v.title)+'</strong><small>'+day(v.period.start)+' — '+day(v.period.end)+' · '+v.period.days+'/7 '+t('днів','days')+'</small>'+
   '<div class="studio-mini-grid">'+stat(t('Перегляди','Views'),v.report.views)+stat(t('Лайки','Likes'),v.report.likes)+stat(t('Нові підписники','Subscribers'),v.report.subscribersGained)+
    stat(t('Коментарі','Comments'),v.report.comments)+stat(t('Час перегляду (хв)','Watch (min)'),v.report.watchMinutes)+stat(t('Середній перегляд (с)','Average (s)'),v.report.avgViewSeconds)+'</div></div>';
 }
 function compareTab(){
  if(!catalog?.videos?.length)return '<div class="studio-empty">'+t('Для порівняння потрібні опубліковані відео.','Published videos are required for comparison.')+'</div>';
  const opts=catalog.videos.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.title.slice(0,95))+'</option>').join('');
  let result='';
  if(comparison?.videos?.length){
   result='<div class="studio-compare-results">'+comparison.videos.map(compareCard).join('')+'</div>'+
    '<p class="studio-muted">'+(comparison.comparable?t('Порівняно повні перші 7 календарних днів після публікації.','Compared each video’s complete first 7 calendar days after release.'):
      t('Принаймні одне відео ще не має повних 7 днів. Результати неповні, переможця не визначаємо.','At least one video has fewer than 7 complete days. Results are partial; no winner is declared.'))+'</p>';
  }
  return '<div class="studio-toolbar">'+t('Порівняння за перші 7 днів після публікації (не за весь час).','Compare first 7 days after publishing (not lifetime totals).')+'</div>'+
   '<form id="studio-compare-form" class="studio-compare-form"><label>'+t('Перше відео','First video')+'<select name="a" required><option value="">'+t('Обери відео','Choose a video')+'</option>'+opts+'</select></label>'+
   '<label>'+t('Друге відео','Second video')+'<select name="b" required><option value="">'+t('Обери відео','Choose a video')+'</option>'+opts+'</select></label>'+
   '<button class="secondary-button" type="submit">'+t('Порівняти','Compare')+'</button></form>'+result;
 }
 function renderHome(){
  const s=space(),goal=$('#creator-home-goals'),alert=$('#creator-home-alerts');
  if(!s){home.hidden=true;return}
  home.hidden=false;
  const first=s.goals[0],count=s.alerts.filter(x=>!x.read).length,metric=first&&channelStats?.totals?.[first.type];
  goal.innerHTML='<button type="button" data-studio-jump="goals" class="creator-home-tool"><span>◎ '+t('Цілі','Goals')+'</span><strong>'+
   (first?(esc(first.label||kinds[first.type]?.[0]||first.type)+' · '+(metric!=null?number(metric)+' / ':'')+number(first.target)):t('Додати ціль','Set a goal'))+'</strong></button>';
  alert.innerHTML='<button type="button" data-studio-jump="alerts" class="creator-home-tool"><span>♧ '+t('Сповіщення','Alerts')+'</span><strong>'+count+' '+t('нових','unread')+'</strong></button>';
 }
 function render(){
  root.hidden=!linked();
  if(!linked()){home.hidden=true;return}
  $('#studio-heading').textContent=t('Мій YouTube · Creator Studio','My YouTube · Creator Studio');
  $('#studio-caption').textContent=t('Відео, планер, цілі, події та порівняння','Videos, planner, goals, alerts and comparisons');
  $('#studio-reload-text').textContent=t('Оновити','Refresh');
  $('#studio-reload').disabled=loading;
  const dict={videos:[t('Відео','Videos')],planner:[t('Планер','Planner')],goals:[t('Цілі','Goals')],alerts:[t('Сповіщення','Alerts')],compare:[t('Порівняння','Compare')]};
  for(const btn of root.querySelectorAll('[data-studio-tab]')){
   btn.classList.toggle('active',btn.dataset.studioTab===tab);
   btn.setAttribute('aria-selected',String(btn.dataset.studioTab===tab));
   btn.textContent=dict[btn.dataset.studioTab][0];
  }
  const s=space(),badge=$('#studio-alert-count'),unread=s?s.alerts.filter(x=>!x.read).length:0;
  if(badge){badge.hidden=!unread;badge.textContent=unread?String(unread):''}
  const views={videos:videosTab,planner:plannerTab,goals:goalsTab,alerts:alertsTab,compare:compareTab};
  body.innerHTML=views[tab]();
  renderHome();
 }
 function jump(next){tab=next;core.nav('platforms');render();load()}
 function openPlan(planId){
  core.nav('planner');$('#plan-filter').value='all';core.renderPlans();
  const target=[...document.querySelectorAll('[data-plan-edit]')].find(x=>x.dataset.planEdit===planId);target?.click();
 }
 function handleLink(videoId,planId){
  const s=space(),video=catalog?.videos?.find(x=>x.id===videoId),plan=core.state.plans.find(x=>x.id===planId);
  if(!s||!video||!plan||plan.platform!=='youtube')return;
  s.links[videoId]=planId;plan.status='published';core.save();save();core.renderHome();core.renderPlans();toast('Відео пов’язано з планом','Video linked to plan');render();
 }
 function importVideo(id){
  const v=catalog?.videos?.find(x=>x.id===id),s=space();if(!v||!s)return;
  let existing=core.state.plans.find(x=>s.links[id]===x.id);
  if(existing){openPlan(existing.id);return}
  if(core.state.plans.length>=500){toast('Досягнуто ліміту планера','Planner limit reached');return}
  const when=Number.isFinite(Date.parse(v.publishedAt))?new Date(v.publishedAt).toISOString().slice(0,16):new Date().toISOString().slice(0,16);
  const plan={id:core.uid(),title:v.title.slice(0,110),date:when,platform:'youtube',status:'published',
   notes:('YouTube: '+v.url).slice(0,350),checks:[],created:Date.now()};
  core.state.plans.push(plan);s.links[id]=plan.id;core.save();save();core.renderHome();core.renderPlans();toast('Відео додано до планера','Video added to planner');render();
 }
 root.addEventListener('click',async ev=>{
  const tabButton=ev.target.closest('[data-studio-tab]');
  if(tabButton){tab=tabButton.dataset.studioTab;render();if(tab==='goals')loadChannelStats();return}
  const videoButton=ev.target.closest('[data-studio-video]');
  if(videoButton){selection=videoButton.dataset.studioVideo;retention=null;render();return}
  const ret=ev.target.closest('[data-studio-retention]');
  if(ret){
   const id=ret.dataset.studioRetention;
   body.querySelector('[data-studio-retention]').disabled=true;
   try{retention=await auth.request('/youtube/videos/'+id+'/retention')}
   catch{retention={id,points:[]}}
   if(selection===id)render();return;
  }
  const link=ev.target.closest('[data-studio-link]');
  if(link){const selected=body.querySelector('[data-studio-plan="'+link.dataset.studioLink+'"]');if(selected?.value)handleLink(link.dataset.studioLink,selected.value);return}
  const add=ev.target.closest('[data-studio-import]');if(add){importVideo(add.dataset.studioImport);return}
  const open=ev.target.closest('[data-studio-open-plan]');if(open){openPlan(open.dataset.studioOpenPlan);return}
  const del=ev.target.closest('[data-studio-delete-goal]');
  if(del){const s=space();s.goals=s.goals.filter(x=>x.id!==del.dataset.studioDeleteGoal);save();render();return}
  const mark=ev.target.closest('[data-studio-read]');
  if(mark){for(const a of space().alerts)a.read=true;save();render();return}
 });
 body.addEventListener('submit',async ev=>{
  if(ev.target.id==='studio-goal-form'){
   ev.preventDefault();const form=new FormData(ev.target),type=form.get('type'),target=Number(form.get('target'));
   if(!kinds[type]||!Number.isSafeInteger(target)||target<1||target>1e12)return;
   const s=space();if(s.goals.length>=12){toast('Максимум 12 цілей','Up to 12 goals');return}
   s.goals.push({id:core.uid(),type,target,label:String(form.get('label')||'').trim().slice(0,54)});save();checkGoals();render();return;
  }
  if(ev.target.id==='studio-compare-form'){
   ev.preventDefault();const form=new FormData(ev.target),a=String(form.get('a')),b=String(form.get('b'));
   if(!validId(a)||!validId(b)||a===b){toast('Обери два різні відео','Choose two different videos');return}
   compareA=a;compareB=b;comparison=null;body.querySelector('[type="submit"]').disabled=true;
   try{comparison=await auth.request('/youtube/videos/compare?a='+encodeURIComponent(a)+'&b='+encodeURIComponent(b))}
   catch{toast('Не вдалося порівняти відео','Video comparison unavailable')}
   render();
   const formNext=$('#studio-compare-form');if(formNext){formNext.elements.a.value=a;formNext.elements.b.value=b}
  }
 });
 home.addEventListener('click',ev=>{const btn=ev.target.closest('[data-studio-jump]');if(btn)jump(btn.dataset.studioJump)});
 $('#studio-reload').addEventListener('click',()=>load(true));
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-page="platforms"],[data-goto="platforms"]'))setTimeout(update,0)});
 window.addEventListener('hashchange',()=>setTimeout(update,0));
 $('#language')?.addEventListener('change',()=>setTimeout(render,0));
 function update(){
  if(!linked()){
   seq++;catalog=null;channelStats=null;channel='';error='';loading=false;selection='';comparison=null;retention=null;lastFetch=0;render();return;
  }
  render();
  if(core.page==='home'||core.page==='platforms')load();
 }
 window.addEventListener('viver-connections-updated',update);
 window.VIVERStudio={update,load,getCatalog:()=>catalog,openTab:jump};
 update();
})();