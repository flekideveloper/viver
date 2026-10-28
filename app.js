'use strict';
(()=>{
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const STORE='viver-workspace-v1',COLORS={yellow:'#ffe28c',pink:'#ffb9d5',lavender:'#cfc1ff',mint:'#a7ead4',blue:'#a7dfff',peach:'#ffcca7'};
 const platforms={youtube:{name:'YouTube',icon:'▶',slug:'youtube',url:'https://developers.google.com/youtube/analytics',console:'https://console.cloud.google.com/',steps:['Create an OAuth consent screen and OAuth web client in Google Cloud.','Request only the YouTube scopes needed by VIVER.','Run a secure backend to handle OAuth authorization and refresh tokens.','Read YouTube Analytics reports using the signed-in creator’s permissions.'],note:'Video and channel metrics are subject to YouTube’s API scopes, verification and quota limits.'},tiktok:{name:'TikTok',icon:'♪',slug:'tiktok',url:'https://developers.tiktok.com/',console:'https://developers.tiktok.com/',steps:['Register a TikTok developer application and request the products/scopes you need.','Complete any required app review and configure an approved redirect URI.','Handle OAuth tokens and refresh securely on a backend.','Only show metrics that TikTok actually exposes to this app and account.'],note:'Full creator analytics are not universally exposed by standard TikTok Login Kit; access may be limited.'},twitch:{name:'Twitch',icon:'◧',slug:'twitch',url:'https://dev.twitch.tv/docs/api/',console:'https://dev.twitch.tv/console/apps',steps:['Create a Twitch application in the developer console.','Register a redirect URI and obtain a client ID.','Use Twitch OAuth with appropriate scopes on a backend.','Query Helix endpoints; some analytics require broadcaster authorization or special access.'],note:'Some Twitch dashboard metrics are not available in public Helix endpoints.'},x:{name:'X (Twitter)',icon:'𝕏',slug:'x',url:'https://developer.x.com/en/docs',console:'https://developer.x.com/',steps:['Check which X API access tier and metrics are available for your intended use.','Register an application and configure OAuth permissions and callback.','Handle access tokens server-side, respecting rate limits.','Show only authorized post/account metrics from permitted endpoints.'],note:'Access tiers, pricing and available analytics can change; VIVER does not promise full X analytics without approved API access.'}};
 const fresh=()=>({version:1,theme:'dark',language:'en',plans:[],reminders:[],notes:[]});
 let state=fresh(),view='dashboard',activeReminders='open',noteColor='yellow',boardZoom=1,toastTimer=0,drag=null,initialBoard=false;
 const uid=()=>crypto.randomUUID?crypto.randomUUID():'v-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const validDate=s=>typeof s==='string'&&!Number.isNaN(new Date(s).getTime());
 const dateText=s=>validDate(s)?new Date(s).toLocaleString(state.language==='uk'?'uk-UA':'en-US',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 const fmtDay=s=>validDate(s)?new Date(s).toLocaleDateString(state.language==='uk'?'uk-UA':'en-US',{day:'numeric',month:'short'}):'—';
 const short=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function normalize(data){
  const base=fresh();if(!data||typeof data!=='object'||Array.isArray(data))return base;
  base.theme=data.theme==='light'?'light':'dark';base.language=data.language==='uk'?'uk':'en';
  if(Array.isArray(data.plans))base.plans=data.plans.slice(0,500).filter(p=>p&&typeof p.title==='string'&&validDate(p.date)).map(p=>({id:typeof p.id==='string'?p.id:uid(),title:p.title.slice(0,110),platform:['youtube','tiktok','twitch','x','other'].includes(p.platform)?p.platform:'other',date:p.date,status:['idea','draft','ready','published'].includes(p.status)?p.status:'idea',notes:String(p.notes||'').slice(0,350),created:Number(p.created)||Date.now()}));
  if(Array.isArray(data.reminders))base.reminders=data.reminders.slice(0,500).filter(r=>r&&typeof r.title==='string'&&validDate(r.due)).map(r=>({id:typeof r.id==='string'?r.id:uid(),title:r.title.slice(0,110),due:r.due,priority:['low','normal','high'].includes(r.priority)?r.priority:'normal',done:Boolean(r.done),notified:Boolean(r.notified),created:Number(r.created)||Date.now()}));
  if(Array.isArray(data.notes))base.notes=data.notes.slice(0,300).filter(n=>n&&typeof n.id==='string').map(n=>({id:n.id,text:String(n.text||'').slice(0,3000),color:COLORS[n.color]?n.color:'yellow',x:clamp(Number(n.x)||0,0,1385),y:clamp(Number(n.y)||0,0,795),z:clamp(Number(n.z)||1,0,9999999)}));
  return base;
 }
 try{state=normalize(JSON.parse(localStorage.getItem(STORE)))}catch{state=fresh()}
 function save(){
  try{localStorage.setItem(STORE,JSON.stringify(state));return true}
  catch{toast('Local storage is full or unavailable. Export a backup.');return false}
 }
 const tr={
  uk:{
   'Overview':'Огляд','Analytics':'Аналітика','Connections':'Підключення','Content planner':'Планування контенту','Reminders':'Нагадування','Idea board':'Дошка ідей','Settings':'Налаштування',
   'Your space to ':'Твій простір для ','create.':'творчості.','Make a ':'Склади ','plan.':'план.','The ':'Дошка ','idea board.':'ідей.','Your ':'Твій ','workspace.':'простір.','Understand your ':'Відстежуй ','growth.':'розвиток.','Connect your ':'Підключай ','world.':'світ.','Don’t forget ':'Не забудь ','a thing.':'нічого.',
   'Quick create':'Швидко створити','Coming up':'Найближчі справи','Content pipeline':'План контенту','Platform insights':'Статистика платформ','Open reminders':'Активні нагадування','Ideas captured':'Ідеї на дошці','Content plans':'Записи контенту',
   'YOUR CREATIVE HOME':'ТВІЙ ТВОРЧИЙ ПРОСТІР','YOUR CHANNELS':'ТВОЇ КАНАЛИ','CONTENT STUDIO':'СТУДІЯ КОНТЕНТУ','STAY ON TRACK':'НЕ ЗАБУВАЙ','CREATIVE SPACE':'ПРОСТІР ІДЕЙ','MAKE IT YOURS':'ТВОЇ НАЛАШТУВАННЯ','DATA & PERFORMANCE':'СТАТИСТИКА','NEW CONTENT':'НОВИЙ КОНТЕНТ','YOUR TO-DO LIST':'ТВОЇ СПРАВИ',
   'Add reminder':'Додати нагадування','New reminder':'Нове нагадування','New content plan':'Новий план','New sticky note':'Новий стікер','Content title':'Назва контенту','Platform':'Платформа','Scheduled date & time':'Дата і час','Stage':'Етап','Notes (optional)':'Нотатки (необов’язково)','Add content':'Додати контент',
   'What do you need to do?':'Що потрібно зробити?','When?':'Коли?','Priority':'Пріоритет','Your content':'Твій контент','Add to your pipeline':'Додати в план','All reminders':'Усі нагадування','All stages':'Усі етапи','Ideas':'Ідеї','Drafts':'Чернетки','Ready':'Готово','Published':'Опубліковано','Idea':'Ідея','Drafting':'Чернетка',
   'High priority':'Високий пріоритет','Normal priority':'Звичайний пріоритет','Low priority':'Низький пріоритет','Enable alerts':'Увімкнути сповіщення','Open':'Активні','All':'Усі','Done':'Виконані',
   'STICKY COLORS':'КОЛЬОРИ СТІКЕРІВ','Add sticky':'Додати стікер','Reset view':'Скинути масштаб','Big things start with small notes.':'Великі ідеї починаються з нотаток.','Make your first note':'Створити перший стікер',
   'Theme':'Тема','Language':'Мова','Backup & restore':'Резервні копії','Reminder alerts':'Сповіщення','Start fresh':'Очистити дані','Midnight':'Нічна','Daylight':'Світла','Dark':'Темна','Light':'Світла','Export JSON':'Експорт JSON','Import JSON':'Імпорт JSON','Delete local workspace':'Видалити локальні дані',
   'Manage browser alerts':'Сповіщення браузера','No connected data':'Немає підключених даних','Not connected':'Не підключено','Setup info':'Як налаштувати','Nothing to chart yet':'Даних для графіка поки немає',
   'Manage':'Керувати','No plans yet':'Планів поки немає','No reminders yet':'Нагадувань поки немає','No items yet':'Записів поки немає','Delete':'Видалити','No results':'Нічого не знайдено','Search your workspace…':'Пошук у просторі…'
  }
 };
 function t(s){return tr[state.language]?.[s]||s}
 function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4300)}
 const icon=id=>'<svg><use href="#ic-'+id+'"></use></svg>';
 const empty=(symbol,title,desc)=>'<div class="empty-small">'+icon(symbol)+'<strong>'+short(title)+'</strong><span>'+short(desc)+'</span></div>';
 const plannedCount=()=>state.plans.length;
 function renderTheme(){
  document.documentElement.dataset.theme=state.theme;
  $$('[data-theme-choice]').forEach(b=>{const yes=b.dataset.themeChoice===state.theme;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes))});
  const meta=$('meta[name="theme-color"]');if(meta)meta.content=state.theme==='dark'?'#0b0e15':'#f5f4f8';
 }
 function translate(){
  $$('[data-i18n]').forEach(el=>{const key={'nav-dashboard':'Overview','nav-analytics':'Analytics','nav-connections':'Connections','nav-planner':'Content planner','nav-reminders':'Reminders','nav-ideas':'Idea board','nav-settings':'Settings'}[el.dataset.i18n];if(key)el.textContent=t(key)});
  const title={'dashboard':'Overview',analytics:'Analytics',connections:'Connections',planner:'Content planner',reminders:'Reminders',ideas:'Idea board',settings:'Settings'}[view];
  $('#current-page').textContent=t(title||'Overview');
  $('#lang-select').value=state.language;
  $('#today-label').textContent=new Date().toLocaleDateString(state.language==='uk'?'uk-UA':'en-US',{weekday:'short',day:'numeric',month:'short'});
  const headMap=[
   ['#dash-title','Your space to ','create.'],
   ['#analytics-title','Understand your ','growth.'],
   ['#connections-title','Connect your ','world.'],
   ['#planner-title','Make a ','plan.'],
   ['#reminders-title','Don’t forget ','a thing.'],
   ['#ideas-title','The ','idea board.'],
   ['#settings-title','Your ','workspace.']
  ];
  headMap.forEach(([sel,start,end])=>{const node=$(sel);node.replaceChildren(document.createTextNode(t(start)));const em=document.createElement('em');em.textContent=t(end);node.append(em)});
  const replacements={
   '.button-quick span':'Quick create','.dash-upcoming .section-head h2':'Coming up','.dash-schedule .section-head h2':'Content pipeline',
   '.dash-connect .section-head h2':'Platform insights','.stat-card:nth-child(1)>span':'Content plans','.stat-card:nth-child(2)>span':'Open reminders',
   '.stat-card:nth-child(3)>span':'Ideas captured','.planner-layout .form-panel .section-head h2':'Add to your pipeline',
   '.planner-layout .list-panel .section-head h2':'Your content','.reminder-layout .form-panel .section-head h2':'New reminder',
   '.reminder-layout .list-panel .section-head h2':'Reminders',
   '#board-add':'Add sticky','#board-reset-view':'Reset view','#empty-add':'Make your first note',
   '.board-placeholder h3':'Big things start with small notes.',
   '.setting-card:nth-child(1) .section-head h2':'Theme','.setting-card:nth-child(2) .section-head h2':'Language',
   '.setting-card:nth-child(3) .section-head h2':'Backup & restore','.setting-card:nth-child(4) .section-head h2':'Reminder alerts',
   '.setting-card:nth-child(5) .section-head h2':'Start fresh'
  };
  for(const [sel,text] of Object.entries(replacements)){
   const el=$(sel);if(!el)continue;
   if(el.matches('button')&&el.querySelector('svg')){const txt=[...el.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(txt)txt.textContent=' '+t(text)}
   else el.textContent=t(text);
  }
  const quick=$('#quick-menu');
  const menuButtons=quick?.querySelectorAll('button')||[];
  ['New sticky note','New reminder','New content plan'].forEach((text,i)=>{const node=[...menuButtons[i]?.childNodes||[]].find(n=>n.nodeType===3);if(node)node.textContent=t(text)});
  $('#global-search-input').placeholder=t('Search your workspace…');
 }
 const views=['dashboard','analytics','connections','planner','reminders','ideas','settings'];
 function navigate(next,push=true){
  if(!views.includes(next))next='dashboard';view=next;
  $$('.view').forEach(el=>{el.classList.toggle('active',el.id==='view-'+next);el.setAttribute('aria-hidden',String(el.id!=='view-'+next))});
  $$('[data-view]').forEach(el=>{const active=el.dataset.view===next;el.classList.toggle('active',active);if(el.classList.contains('nav-item')){if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}});
  if(push)history.replaceState(null,'','#'+next);
  closeMobile();$('#quick-menu').hidden=true;
  translate();
  if(next==='ideas'&&!initialBoard){initialBoard=true;requestAnimationFrame(resetBoardViewport)}
  if(next==='settings')renderSettings();
  if(next==='dashboard')renderDashboard();
  if(next==='planner')renderPlanner();
  if(next==='reminders')renderReminders();
  if(next==='ideas')renderBoard();
  $('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
 }
 $$('[data-view]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.view)));
 window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(views.includes(id)&&view!==id)navigate(id,false)});
 const sidebar=$('#sidebar'),shade=$('#mobile-shade');
 function closeMobile(){sidebar.classList.remove('open');shade.classList.remove('show')}
 $('#menu-toggle').addEventListener('click',()=>{sidebar.classList.toggle('open');shade.classList.toggle('show')});
 shade.addEventListener('click',closeMobile);
 $('#quick-add').addEventListener('click',ev=>{ev.stopPropagation();$('#quick-menu').hidden=!$('#quick-menu').hidden});
 document.addEventListener('click',ev=>{if(!ev.target.closest('.quick-wrap'))$('#quick-menu').hidden=true});
 $$('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>{
  const section=btn.dataset.quick;navigate(section);
  if(section==='ideas')addNote();
  if(section==='planner')$('#plan-title').focus();
  if(section==='reminders')$('#reminder-title').focus();
 }));
 function renderDashboard(){
  $('#dash-plans').textContent=state.plans.length;
  $('#dash-reminders').textContent=state.reminders.filter(x=>!x.done).length;
  $('#dash-ideas').textContent=state.notes.length;
  const upcoming=state.reminders.filter(x=>!x.done).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,4);
  $('#dash-upcoming').innerHTML=upcoming.length?upcoming.map(x=>'<div class="dash-item"><span class="dash-item-icon">'+icon('bell')+'</span><div class="dash-item-body"><strong>'+short(x.title)+'</strong><small>'+short(dateText(x.due))+'</small></div>'+ (new Date(x.due)<new Date()?'<span class="chip">Overdue</span>':'')+'</div>').join(''):empty('clock',t('No reminders yet'),'Create a reminder and it will show up here.');
  const plans=state.plans.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,4);
  $('#dash-pipeline').innerHTML=plans.length?plans.map(p=>'<div class="dash-item"><span class="dash-item-icon">'+icon('calendar')+'</span><div class="dash-item-body"><strong>'+short(p.title)+'</strong><small>'+short(platformName(p.platform))+' · '+short(fmtDay(p.date))+'</small></div><span class="chip '+short(p.status)+'">'+short(stageName(p.status))+'</span></div>').join(''):empty('calendar',t('No plans yet'),'Add your first piece of content to get organized.');
  const list=['youtube','tiktok','twitch','x'];
  $('#dash-platform-list').innerHTML=list.map(key=>'<div class="platform-mini"><span class="mini-brand">'+short(platforms[key].icon)+'</span>'+short(platforms[key].name)+'<small>'+short(t('Not connected'))+'</small></div>').join('');
  $('#dash-board-caption').textContent=state.notes.length?state.notes.length+' ideas saved to your board.':'An empty board is a world of possibilities.';
  $('#planner-count').textContent=state.plans.length||'';
  $('#reminders-count').textContent=state.reminders.filter(x=>!x.done).length||'';
  $('#planner-total').textContent=state.plans.length+' '+(state.plans.length===1?'entry':'entries');
  $('#board-note-count').textContent=state.notes.length+' '+(state.notes.length===1?'note':'notes');
 }
 const platformName=id=>platforms[id]?.name||'Other';
 const stageName=id=>({idea:t('Idea'),draft:t('Drafting'),ready:t('Ready'),published:t('Published')})[id]||id;
 function defaultWhen(offset=1){
  const d=new Date();d.setDate(d.getDate()+offset);d.setHours(18,0,0,0);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 }
 function formInputDefaults(){
  if(!$('#plan-date').value)$('#plan-date').value=defaultWhen(1);
  if(!$('#reminder-due').value)$('#reminder-due').value=defaultWhen(0);
 }
 $('#plan-form').addEventListener('submit',ev=>{
  ev.preventDefault();
  const title=$('#plan-title').value.trim(),date=$('#plan-date').value,status=$('#plan-status').value;
  if(title.length<2||!validDate(date)){toast('Please enter a valid title and date.');return}
  state.plans.push({id:uid(),title:title.slice(0,110),platform:$('#plan-platform').value,date,status,notes:$('#plan-notes').value.trim().slice(0,350),created:Date.now()});
  if(!save())return;$('#plan-form').reset();formInputDefaults();renderPlanner();renderDashboard();toast('Content plan saved.');
 });
 function renderPlanner(){
  const filter=$('#plan-filter').value;
  const items=state.plans.filter(x=>filter==='all'||filter===x.status).sort((a,b)=>new Date(a.date)-new Date(b.date));
  $('#plan-list').innerHTML=items.length?items.map(p=>'<div class="pipeline-item" data-plan-id="'+short(p.id)+'"><span class="dash-item-icon">'+icon('calendar')+'</span><div class="pipeline-item-body"><strong>'+short(p.title)+'</strong><small>'+short(platformName(p.platform))+' · '+short(dateText(p.date))+'</small>'+(p.notes?'<small>'+short(p.notes)+'</small>':'')+'</div><select class="stage-select" data-plan-stage="'+short(p.id)+'" aria-label="Change stage">'+['idea','draft','ready','published'].map(k=>'<option value="'+k+'"'+(k===p.status?' selected':'')+'>'+short(stageName(k))+'</option>').join('')+'</select><div class="item-actions"><button class="del" data-plan-delete="'+short(p.id)+'" aria-label="Delete plan">'+icon('trash')+'</button></div></div>').join(''):empty('calendar',t('No plans yet'),'Your content schedule will appear here.');
  $('#planner-total').textContent=state.plans.length+' '+(state.plans.length===1?'entry':'entries');
 }
 $('#plan-list').addEventListener('change',ev=>{
  const el=ev.target.closest('[data-plan-stage]');if(!el)return;
  const item=state.plans.find(x=>x.id===el.dataset.planStage);if(!item)return;
  item.status=el.value;save();renderDashboard();renderPlanner();toast('Stage updated.');
 });
 $('#plan-list').addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-plan-delete]');if(!btn)return;
  if(!confirm('Delete this content plan?'))return;
  state.plans=state.plans.filter(x=>x.id!==btn.dataset.planDelete);save();renderPlanner();renderDashboard();
 });
 $('#plan-filter').addEventListener('change',renderPlanner);
 $('#reminder-form').addEventListener('submit',ev=>{
  ev.preventDefault();
  const title=$('#reminder-title').value.trim(),due=$('#reminder-due').value;
  if(title.length<2||!validDate(due)){toast('Please enter a title and a valid time.');return}
  state.reminders.push({id:uid(),title:title.slice(0,110),due,priority:$('#reminder-priority').value,done:false,notified:false,created:Date.now()});
  save();$('#reminder-form').reset();formInputDefaults();renderReminders();renderDashboard();toast('Reminder created.');
 });
 function renderReminders(){
  $$('.filter-tab').forEach(el=>el.classList.toggle('active',el.dataset.reminderFilter===activeReminders));
  const items=state.reminders.filter(x=>activeReminders==='all'||(activeReminders==='done'?x.done:!x.done)).sort((a,b)=>Number(a.done)-Number(b.done)||new Date(a.due)-new Date(b.due));
  $('#reminder-list').innerHTML=items.length?items.map(r=>{
   const overdue=!r.done&&new Date(r.due)<new Date();
   return '<div class="reminder-row '+(r.done?'is-done ':'')+(overdue?'overdue':'')+'"><button class="check-toggle '+(r.done?'done':'')+'" data-reminder-toggle="'+short(r.id)+'" aria-label="'+(r.done?'Mark incomplete':'Mark complete')+'">'+icon('check')+'</button><div class="reminder-body"><strong>'+short(r.title)+'</strong><small><span class="priority-dot '+short(r.priority)+'"></span>'+short(dateText(r.due))+' · '+short(r.priority)+' priority'+(overdue?' · Overdue':'')+'</small></div><div class="item-actions"><button class="del" data-reminder-delete="'+short(r.id)+'" aria-label="Delete reminder">'+icon('trash')+'</button></div></div>';
  }).join(''):empty('check',t('No reminders yet'),'Nothing on your list. A little breathing room!');
 }
 $('#reminder-list').addEventListener('click',ev=>{
  const toggle=ev.target.closest('[data-reminder-toggle]');
  if(toggle){const item=state.reminders.find(x=>x.id===toggle.dataset.reminderToggle);if(item){item.done=!item.done;if(!item.done)item.notified=false;save();renderReminders();renderDashboard()}return}
  const remove=ev.target.closest('[data-reminder-delete]');
  if(remove){state.reminders=state.reminders.filter(x=>x.id!==remove.dataset.reminderDelete);save();renderReminders();renderDashboard()}
 });
 $$('[data-reminder-filter]').forEach(el=>el.addEventListener('click',()=>{activeReminders=el.dataset.reminderFilter;renderReminders()}));
 function notificationStatus(){
  if(!('Notification' in window))return 'Browser notifications are not supported here.';
  return 'Permission: '+Notification.permission+'. Works while this tab is open.';
 }
 async function requestNotifications(){
  if(!('Notification' in window)){toast('Browser notifications are not supported.');return}
  if(!window.isSecureContext){toast('Notifications require HTTPS.');return}
  try{const result=await Notification.requestPermission();toast(result==='granted'?'Notifications enabled. Keep VIVER open to receive reminders.':'Notification permission: '+result);$('#notifications-status').textContent=notificationStatus()}
  catch{toast('Could not request notification permission.')}
 }
 $('#enable-notifications').addEventListener('click',requestNotifications);
 $('#settings-enable-notifications').addEventListener('click',requestNotifications);
 function checkDue(){
  const time=Date.now();let changed=false;
  for(const item of state.reminders){
   if(item.done||item.notified||!validDate(item.due))continue;
   const delta=time-new Date(item.due).getTime();
   if(delta<0)continue;
   item.notified=true;changed=true;
   if(delta<5*60*1000){
    if('Notification' in window&&Notification.permission==='granted'&&document.visibilityState==='visible'){
     try{new Notification('VIVER · Reminder',{body:item.title,tag:'viver-'+item.id})}catch{toast('Reminder: '+item.title)}
    }else if(document.visibilityState==='visible')toast('Reminder: '+item.title);
   }
  }
  if(changed){save();renderReminders();renderDashboard()}
 }
 const notesRoot=$('#board-notes'),stage=$('#whiteboard-stage'),scroller=$('#whiteboard-scroll');
 function colorOptions(selected){return Object.keys(COLORS).map(c=>'<option value="'+c+'"'+(c===selected?' selected':'')+'>'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>').join('')}
 function renderBoard(){
  notesRoot.innerHTML=state.notes.map(n=>'<article class="sticky-note" data-note-id="'+short(n.id)+'" style="left:'+n.x+'px;top:'+n.y+'px;z-index:'+n.z+';--sticky-color:'+COLORS[n.color]+'"><div class="sticky-header" data-note-drag="'+short(n.id)+'"><span>VIVER / IDEA</span><div class="sticky-actions"><button type="button" data-note-copy="'+short(n.id)+'" title="Duplicate note" aria-label="Duplicate note">'+icon('plus')+'</button><button type="button" data-note-delete="'+short(n.id)+'" title="Delete note" aria-label="Delete note">'+icon('close')+'</button></div></div><textarea maxlength="3000" spellcheck="true" placeholder="Write something brilliant…" data-note-text="'+short(n.id)+'">'+short(n.text)+'</textarea><div class="sticky-footer"><select data-note-color="'+short(n.id)+'" aria-label="Sticky color">'+colorOptions(n.color)+'</select></div></article>').join('');
  $('#board-placeholder').hidden=state.notes.length>0;
  $('#board-note-count').textContent=state.notes.length+' '+(state.notes.length===1?'note':'notes');
  $('#board-zoom').textContent=Math.round(boardZoom*100)+'%';
 }
 function addNote(position){
  const x=position?position.x:scroller.scrollLeft/boardZoom+scroller.clientWidth/boardZoom/2-110;
  const y=position?position.y:scroller.scrollTop/boardZoom+scroller.clientHeight/boardZoom/2-100;
  const z=Math.max(0,...state.notes.map(x=>x.z))+1;
  const note={id:uid(),text:'',color:noteColor,x:Math.round(clamp(x,15,1365)),y:Math.round(clamp(y,15,775)),z};
  state.notes.push(note);save();renderBoard();renderDashboard();
  const el=notesRoot.querySelector('[data-note-id="'+note.id+'"] textarea');el?.focus();
 }
 $('#board-add').addEventListener('click',()=>addNote());
 $('#empty-add').addEventListener('click',()=>addNote({x:705,y:392}));
 $$('.color-swatch').forEach(b=>b.addEventListener('click',()=>{noteColor=b.dataset.color;$$('.color-swatch').forEach(x=>x.classList.toggle('selected',x===b))}));
 notesRoot.addEventListener('input',ev=>{
  const el=ev.target.closest('[data-note-text]');if(!el)return;
  const n=state.notes.find(x=>x.id===el.dataset.noteText);if(n){n.text=el.value.slice(0,3000);save()}
 });
 notesRoot.addEventListener('change',ev=>{
  const el=ev.target.closest('[data-note-color]');if(!el)return;
  const n=state.notes.find(x=>x.id===el.dataset.noteColor);
  if(n&&COLORS[el.value]){n.color=el.value;save();el.closest('.sticky-note').style.setProperty('--sticky-color',COLORS[n.color])}
 });
 notesRoot.addEventListener('click',ev=>{
  const del=ev.target.closest('[data-note-delete]');
  if(del){state.notes=state.notes.filter(x=>x.id!==del.dataset.noteDelete);save();renderBoard();renderDashboard();return}
  const copy=ev.target.closest('[data-note-copy]');
  if(copy){
   const n=state.notes.find(x=>x.id===copy.dataset.noteCopy);if(!n)return;
   state.notes.push({...n,id:uid(),x:clamp(n.x+33,0,1380),y:clamp(n.y+33,0,795),z:Math.max(...state.notes.map(x=>x.z))+1});
   save();renderBoard();renderDashboard();
  }
 });
 notesRoot.addEventListener('pointerdown',ev=>{
  if(ev.button!==0||ev.target.closest('button')||ev.target.closest('textarea')||ev.target.closest('select'))return;
  const handle=ev.target.closest('[data-note-drag]');if(!handle)return;
  const n=state.notes.find(x=>x.id===handle.dataset.noteDrag);if(!n)return;
  const el=handle.closest('.sticky-note');
  n.z=Math.max(0,...state.notes.map(x=>x.z))+1;el.style.zIndex=n.z;
  drag={id:n.id,startX:ev.clientX,startY:ev.clientY,fromX:n.x,fromY:n.y,node:el,pointerId:ev.pointerId};
  handle.setPointerCapture?.(ev.pointerId);handle.style.cursor='grabbing';ev.preventDefault();
 });
 notesRoot.addEventListener('pointermove',ev=>{
  if(!drag||drag.pointerId!==ev.pointerId)return;
  const n=state.notes.find(x=>x.id===drag.id);if(!n)return;
  n.x=Math.round(clamp(drag.fromX+(ev.clientX-drag.startX)/boardZoom,0,1385));
  n.y=Math.round(clamp(drag.fromY+(ev.clientY-drag.startY)/boardZoom,0,795));
  drag.node.style.left=n.x+'px';drag.node.style.top=n.y+'px';
 });
 const endDrag=()=>{if(!drag)return;drag=null;save()};
 notesRoot.addEventListener('pointerup',endDrag);notesRoot.addEventListener('pointercancel',endDrag);
 window.addEventListener('pointerup',endDrag);
 stage.addEventListener('dblclick',ev=>{
  if(ev.target.closest('.sticky-note')||ev.target.closest('.board-placeholder'))return;
  const r=stage.getBoundingClientRect();
  addNote({x:(ev.clientX-r.left)/boardZoom-105,y:(ev.clientY-r.top)/boardZoom-30});
 });
 function updateZoom(next){boardZoom=clamp(Math.round(next*10)/10,.5,1.5);stage.style.transform='scale('+boardZoom+')';renderBoard()}
 $('#board-zoom-in').addEventListener('click',()=>updateZoom(boardZoom+.1));
 $('#board-zoom-out').addEventListener('click',()=>updateZoom(boardZoom-.1));
 function resetBoardViewport(){
  const w=1600*boardZoom,h=1000*boardZoom;
  scroller.scrollLeft=Math.max(0,(w-scroller.clientWidth)/2);
  scroller.scrollTop=Math.max(0,(h-scroller.clientHeight)/2);
 }
 $('#board-reset-view').addEventListener('click',()=>{updateZoom(1);resetBoardViewport()});
 $('#board-clear').addEventListener('click',()=>{
  if(!state.notes.length)return;
  if(!confirm('Delete ALL your sticky notes? This cannot be undone.'))return;
  state.notes=[];save();renderBoard();renderDashboard();toast('Board cleared.');
 });
 function renderSettings(){
  renderTheme();
  $('#lang-select').value=state.language;
  $('#notifications-status').textContent=notificationStatus();
 }
 $$('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{state.theme=b.dataset.themeChoice;save();renderTheme();toast('Appearance updated.')}));
 $('#lang-select').addEventListener('change',ev=>{state.language=ev.target.value==='uk'?'uk':'en';save();translate();renderDashboard();renderPlanner();renderReminders();toast('Language preference saved.')});
 $('#export-data').addEventListener('click',()=>{
  const data=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(data),link=document.createElement('a');
  link.href=url;link.download='viver-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Backup exported.');
 });
 $('#import-data').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  try{
   if(file.size>2*1024*1024)throw Error('Maximum backup size is 2 MB.');
   const data=JSON.parse(await file.text());
   if(data?.version!==1||!Array.isArray(data.plans)||!Array.isArray(data.reminders)||!Array.isArray(data.notes))throw Error('This is not a valid VIVER backup.');
   if(!confirm('Replace your current local workspace with this backup?'))return;
   state=normalize(data);
   if(!save())throw Error('Could not save this backup.');
   renderAll();navigate('dashboard');toast('Backup imported.');
  }catch(err){toast(err.message||'Import failed')}finally{ev.target.value=''}
 });
 $('#reset-data').addEventListener('click',()=>{
  if(!confirm('Delete all locally saved VIVER plans, reminders and notes? This cannot be undone.'))return;
  if(!confirm('Confirm: permanently clear this workspace on this device?'))return;
  state=fresh();save();updateZoom(1);renderAll();navigate('dashboard');toast('Local workspace cleared.');
 });
 function providerInfo(key){
  const p=platforms[key];if(!p)return;
  const dialog=$('#provider-dialog');
  $('#provider-dialog-content').innerHTML='<div class="provider-logo '+p.slug+'">'+short(p.icon)+'</div><h2>'+short(p.name)+' integration</h2><span class="provider-status">Not connected · Setup required</span><p>VIVER cannot access your account or statistics until you configure an approved app and a secure backend.</p><ul>'+p.steps.map(s=>'<li>'+short(s)+'</li>').join('')+'</ul><p>'+short(p.note)+'</p><p><a target="_blank" rel="noopener noreferrer" href="'+short(p.url)+'">Official developer documentation ↗</a></p>';
  dialog.showModal();
 }
 $$('[data-provider-info]').forEach(b=>b.addEventListener('click',()=>providerInfo(b.dataset.providerInfo)));
 $('#analytics-platforms').innerHTML=Object.values(platforms).map(p=>'<div class="analytics-platform"><span class="provider-logo '+p.slug+'" style="width:34px;height:34px;border-radius:9px;font-size:16px">'+short(p.icon)+'</span><div><strong>'+short(p.name)+'</strong><small>Not connected</small></div></div>').join('');
 const dialogClose=d=>{d?.addEventListener('click',ev=>{if(ev.target===d)d.close()})};
 dialogClose($('#provider-dialog'));dialogClose($('#search-dialog'));
 const searchDialog=$('#search-dialog'),searchInput=$('#global-search-input');
 function openSearch(){searchDialog.showModal();searchInput.value='';renderSearch();searchInput.focus()}
 $('#top-search').addEventListener('click',openSearch);
 document.addEventListener('keydown',ev=>{
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(searchDialog.open)searchDialog.close();else openSearch()}
  if(ev.key==='Escape'){closeMobile();$('#quick-menu').hidden=true}
 });
 function renderSearch(){
  const q=searchInput.value.toLowerCase().trim();
  if(!q){$('#global-search-results').innerHTML='<p class="search-hint">Search your saved plans, reminders and sticky notes.</p>';return}
  const items=[
   ...state.plans.filter(x=>x.title.toLowerCase().includes(q)||x.notes.toLowerCase().includes(q)).slice(0,10).map(x=>({title:x.title,kind:'Content planner',view:'planner'})),
   ...state.reminders.filter(x=>x.title.toLowerCase().includes(q)).slice(0,10).map(x=>({title:x.title,kind:'Reminder',view:'reminders'})),
   ...state.notes.filter(x=>x.text.toLowerCase().includes(q)).slice(0,10).map(x=>({title:x.text.trim().slice(0,100)||'Empty note',kind:'Idea board',view:'ideas',noteId:x.id}))
  ].slice(0,20);
  $('#global-search-results').innerHTML=items.length?items.map(x=>'<button class="search-result" data-search-view="'+short(x.view)+'" data-search-note="'+short(x.noteId||'')+'"><span>'+short(x.title)+'</span><small>'+short(x.kind)+'</small></button>').join(''):'<p class="search-hint">'+short(t('No results'))+'</p>';
 }
 searchInput.addEventListener('input',renderSearch);
 $('#global-search-results').addEventListener('click',ev=>{
  const b=ev.target.closest('[data-search-view]');if(!b)return;
  searchDialog.close();navigate(b.dataset.searchView);
  if(b.dataset.searchNote){const el=notesRoot.querySelector('[data-note-id="'+b.dataset.searchNote+'"]');if(el){scroller.scrollLeft=Number.parseFloat(el.style.left)*boardZoom-120;scroller.scrollTop=Number.parseFloat(el.style.top)*boardZoom-120;el.querySelector('textarea')?.focus()}}
 });
 function renderAll(){renderTheme();formInputDefaults();translate();renderDashboard();renderPlanner();renderReminders();renderBoard();renderSettings()}
 renderAll();
 navigate(location.hash&&views.includes(location.hash.slice(1))?location.hash.slice(1):'dashboard',false);
 setInterval(checkDue,30000);
 checkDue();
})();
