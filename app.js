'use strict';
(()=>{
const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const KEY='viver-workspace-v1',COLORS={yellow:'#ffdf82',pink:'#f9b8c4',lavender:'#cdbdfa',mint:'#aae7c8',blue:'#acdaff',peach:'#facaa3'};
const fresh=()=>({version:1,theme:'dark',language:'uk',plans:[],reminders:[],notes:[]});
const uid=()=>crypto.randomUUID?.()||'v-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const validDate=s=>typeof s==='string'&&s.length>0&&Number.isFinite(new Date(s).getTime());
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const translations={
 uk:{workspace:'РОБОЧИЙ ПРОСТІР',home:'Огляд',planner:'Планер',reminders:'Нагадування',board:'Дошка ідей',platforms:'Платформи',settings:'Налаштування',local:'Дані на цьому пристрої',
 overviewTitle:'Огляд',scheduled:'Заплановано',content:'Контент',openTasks:'Активні нагадування',tasks:'Завдання',notes:'Стікери',ideas:'Ідеї',upcoming:'Найближче',viewAll:'Усі',contentPlan:'Контент-план',
 newPost:'Новий запис',title:'Назва',platform:'Платформа',stage:'Стан',date:'Дата й час',details:'Нотатка',optional:'Необов’язково',other:'Інше',idea:'Ідея',draft:'У процесі',ready:'Готово',published:'Опубліковано',addPost:'Додати запис',myContent:'Мій контент',all:'Усі',cancel:'Скасувати',saveChanges:'Зберегти зміни',editPost:'Редагувати запис',contentPlaceholder:'Назва відео або стриму',
 alerts:'Сповіщення',newReminder:'Нове нагадування',taskPlaceholder:'Що потрібно зробити?',priority:'Пріоритет',normal:'Звичайний',high:'Високий',low:'Низький',addReminder:'Додати',myReminders:'Мої нагадування',open:'Активні',done:'Готові',editReminder:'Редагувати нагадування',
 sticky:'Стікер',emptyBoard:'Тут починаються ідеї',addFirst:'Додати стікер',pending:'Не підключено',unavailable:'Недоступно',apiNotice:'Аналітика з’явиться після підключення офіційних API. Зараз доступу до акаунтів немає.',
 appearance:'Вигляд',dark:'Темна',light:'Світла',language:'Мова',backup:'Резервна копія',export:'Експорт',import:'Імпорт',reset:'Видалити локальні дані',delete:'Видалити',storageNotice:'Нагадування, планер і стікери зберігаються лише в цьому браузері.',searchPlaceholder:'Знайти в моїх записах…',close:'Закрити',
 noReminders:'Нагадувань ще немає',noPlans:'Записів ще немає',noResults:'Нічого не знайдено',noNotes:'Нотатка',emptyNote:'Нова ідея…',edit:'Редагувати',duplicate:'Дублювати',remove:'Видалити',overdue:'Прострочено',
 created:'Збережено',updated:'Оновлено',removed:'Видалено',confirmDelete:'Видалити запис?',confirmAll:'Видалити всі локальні дані VIVER? Цю дію не можна скасувати.',confirmAgain:'Підтверди остаточне видалення всіх нотаток і планів.',confirmImport:'Замінити поточні записи даними з файлу?',badBackup:'Невірний файл резервної копії',tooLarge:'Максимальний розмір файлу — 2 МБ',backupDone:'Копію збережено',importDone:'Копію відновлено',storageFail:'Не вдалося зберегти дані. Зроби резервну копію.',notificationOn:'Сповіщення увімкнено, поки VIVER відкритий',notificationOff:'Браузер не дозволяє сповіщення',notificationUnsupported:'У цьому браузері сповіщення недоступні',notifyPrefix:'Нагадування: ',noteCount:'сті́керів'},
 en:{workspace:'WORKSPACE',home:'Overview',planner:'Planner',reminders:'Reminders',board:'Idea board',platforms:'Platforms',settings:'Settings',local:'Stored on this device',
 overviewTitle:'Overview',scheduled:'Scheduled',content:'Content',openTasks:'Open reminders',tasks:'Tasks',notes:'Sticky notes',ideas:'Ideas',upcoming:'Up next',viewAll:'View all',contentPlan:'Content plan',
 newPost:'New content',title:'Title',platform:'Platform',stage:'Status',date:'Date & time',details:'Note',optional:'Optional',other:'Other',idea:'Idea',draft:'In progress',ready:'Ready',published:'Published',addPost:'Add content',myContent:'My content',all:'All',cancel:'Cancel',saveChanges:'Save changes',editPost:'Edit content',contentPlaceholder:'Video or stream title',
 alerts:'Notifications',newReminder:'New reminder',taskPlaceholder:'What needs doing?',priority:'Priority',normal:'Normal',high:'High',low:'Low',addReminder:'Add',myReminders:'My reminders',open:'Open',done:'Done',editReminder:'Edit reminder',
 sticky:'Sticky note',emptyBoard:'Your ideas start here',addFirst:'Add sticky note',pending:'Not connected',unavailable:'Unavailable',apiNotice:'Analytics will appear after official API integration. No accounts are currently connected.',
 appearance:'Appearance',dark:'Dark',light:'Light',language:'Language',backup:'Backup',export:'Export',import:'Import',reset:'Delete local data',delete:'Delete',storageNotice:'Reminders, plans and notes are stored only in this browser.',searchPlaceholder:'Search your workspace…',close:'Close',
 noReminders:'No reminders yet',noPlans:'No content yet',noResults:'No results',noNotes:'Note',emptyNote:'New idea…',edit:'Edit',duplicate:'Duplicate',remove:'Delete',overdue:'Overdue',
 created:'Saved',updated:'Updated',removed:'Deleted',confirmDelete:'Delete this item?',confirmAll:'Delete all local VIVER data? This cannot be undone.',confirmAgain:'Confirm permanently clearing all notes and plans.',confirmImport:'Replace current workspace with this backup?',badBackup:'Invalid backup file',tooLarge:'Maximum file size is 2 MB',backupDone:'Backup exported',importDone:'Backup restored',storageFail:'Unable to save data. Export a backup.',notificationOn:'Notifications enabled while VIVER is open',notificationOff:'Browser notifications were not allowed',notificationUnsupported:'Notifications not available in this browser',notifyPrefix:'Reminder: ',noteCount:'notes'}
};
let state=fresh();
function normalise(d){
 const s=fresh();if(!d||typeof d!=='object'||Array.isArray(d))return s;
 s.theme=d.theme==='light'?'light':'dark';s.language=d.language==='en'?'en':'uk';
 if(Array.isArray(d.plans))s.plans=d.plans.slice(0,500).filter(p=>p&&typeof p.title==='string'&&validDate(p.date)).map(p=>({id:String(p.id||uid()).slice(0,90),title:p.title.slice(0,110),date:p.date,platform:['youtube','tiktok','twitch','x','other'].includes(p.platform)?p.platform:'other',status:['idea','draft','ready','published'].includes(p.status)?p.status:'idea',notes:String(p.notes||'').slice(0,350),created:Number(p.created)||Date.now()}));
 if(Array.isArray(d.reminders))s.reminders=d.reminders.slice(0,500).filter(r=>r&&typeof r.title==='string'&&validDate(r.due)).map(r=>({id:String(r.id||uid()).slice(0,90),title:r.title.slice(0,110),due:r.due,priority:['low','normal','high'].includes(r.priority)?r.priority:'normal',done:!!r.done,notified:!!r.notified,created:Number(r.created)||Date.now()}));
 if(Array.isArray(d.notes))s.notes=d.notes.slice(0,300).filter(n=>n&&typeof n.id==='string').map(n=>({id:n.id.slice(0,90),text:String(n.text||'').slice(0,3000),color:COLORS[n.color]?n.color:'yellow',x:clamp(Number(n.x)||0,0,1345),y:clamp(Number(n.y)||0,0,750),z:clamp(Number(n.z)||1,1,9999999)}));
 return s;
}
try{const stored=localStorage.getItem(KEY);if(stored)state=normalise(JSON.parse(stored))}catch(e){console.warn('VIVER storage unavailable',e)}
const t=k=>translations[state.language]?.[k]||k;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch(e){toast(t('storageFail'));return false}};
const icon=name=>'<svg><use href="#i-'+name+'"></use></svg>';
let page='home',editingPlan='',editingReminder='',reminderFilter='open',noteColor='yellow',zoom=1,boardCentered=false,drag=null,toastTimer;
const dateFmt=s=>new Date(s).toLocaleString(state.language==='uk'?'uk-UA':'en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',year:'numeric'});
const timeMs=s=>new Date(s).getTime();
const stageLabel=s=>t(({idea:'idea',draft:'draft',ready:'ready',published:'published'})[s]||'idea');
const empty=k=>'<div class="empty-state">'+esc(t(k))+'</div>';
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
function lang(){
 document.documentElement.lang=state.language;
 $$('[data-t]').forEach(el=>{el.textContent=t(el.dataset.t)});
 $$('[data-ph]').forEach(el=>{el.placeholder=t(el.dataset.ph)});
 $('#language').value=state.language;
 $('#page-heading').textContent=t(page);
 $('#today').textContent=new Date().toLocaleDateString(state.language==='uk'?'uk-UA':'en-US',{day:'numeric',month:'long',year:'numeric'});
 renderHome();renderPlans();renderReminders();renderBoard();
}
function theme(){
 document.documentElement.dataset.theme=state.theme;
 $('meta[name="theme-color"]').content=state.theme==='dark'?'#111215':'#f8f8f7';
 $$('[data-theme-option]').forEach(el=>el.classList.toggle('active',el.dataset.themeOption===state.theme));
}
function nav(next,updateHash=true){
 if(!['home','planner','reminders','board','platforms','settings'].includes(next))next='home';
 page=next;
 $$('.page').forEach(el=>{const active=el.id==='page-'+page;el.classList.toggle('active',active);el.setAttribute('aria-hidden',String(!active))});
 $$('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('#page-heading').textContent=t(page);
 if(updateHash&&location.hash!=='#'+page)history.pushState(null,'','#'+page);
 $('#sidebar').classList.remove('open');$('#scrim').classList.remove('show');
 if(page==='board'&&!boardCentered){boardCentered=true;requestAnimationFrame(centerBoard)}
 if(page==='board')renderBoard();
 window.scrollTo({top:0,behavior:'instant'});
}
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.page)));
$$('[data-goto]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.goto)));
const syncLocation=()=>{const key=location.hash.slice(1);if(key!==page)nav(key,false)};
window.addEventListener('hashchange',syncLocation);
window.addEventListener('popstate',syncLocation);
$('#menu').addEventListener('click',()=>{$('#sidebar').classList.toggle('open');$('#scrim').classList.toggle('show')});
$('#scrim').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#scrim').classList.remove('show')});
function renderHome(){
 $('#stat-plans').textContent=state.plans.filter(p=>p.status!=='published').length;
 $('#stat-reminders').textContent=state.reminders.filter(r=>!r.done).length;
 $('#stat-notes').textContent=state.notes.length;
 const rem=state.reminders.filter(r=>!r.done).sort((a,b)=>timeMs(a.due)-timeMs(b.due)).slice(0,5);
 const plans=state.plans.filter(p=>p.status!=='published').sort((a,b)=>timeMs(a.date)-timeMs(b.date)).slice(0,5);
 $('#home-reminders').innerHTML=rem.length?rem.map(r=>'<div class="compact-item"><span><strong>'+esc(r.title)+'</strong><small>'+esc(dateFmt(r.due))+'</small></span>'+(timeMs(r.due)<Date.now()?'<b class="overdue">!</b>':'')+'</div>').join(''):empty('noReminders');
 $('#home-plans').innerHTML=plans.length?plans.map(p=>'<div class="compact-item"><span><strong>'+esc(p.title)+'</strong><small>'+esc(p.platform.toUpperCase())+' · '+esc(stageLabel(p.status))+'</small></span><span class="compact-date">'+esc(dateFmt(p.date))+'</span></div>').join(''):empty('noPlans');
 const open=state.reminders.filter(r=>!r.done).length;
 $('#nav-reminder-count').textContent=open;$('#nav-reminder-count').hidden=!open;
}
function defaults(){
 const d=new Date(Date.now()+86400000);d.setHours(18,0,0,0);const toInput=x=>new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16);
 if(!$('#plan-date').value)$('#plan-date').value=toInput(d);
 if(!$('#reminder-due').value)$('#reminder-due').value=toInput(d);
}
function clearPlan(){
 editingPlan='';$('#plan-form').reset();defaults();$('#plan-form-heading').textContent=t('newPost');$('#plan-save').textContent=t('addPost');$('#plan-cancel').hidden=true;
}
function clearReminder(){
 editingReminder='';$('#reminder-form').reset();defaults();$('#reminder-form-heading').textContent=t('newReminder');$('#reminder-save').textContent=t('addReminder');$('#reminder-cancel').hidden=true;
}
$('#plan-cancel').addEventListener('click',clearPlan);
$('#reminder-cancel').addEventListener('click',clearReminder);
$('#plan-form').addEventListener('submit',ev=>{
 ev.preventDefault();const title=$('#plan-title').value.trim(),date=$('#plan-date').value;
 if(!title||!validDate(date))return;
 const record={title:title.slice(0,110),date,platform:$('#plan-platform').value,status:$('#plan-status').value,notes:$('#plan-notes').value.trim().slice(0,350)};
 const existing=state.plans.find(p=>p.id===editingPlan);
 if(existing)Object.assign(existing,record);else state.plans.push({...record,id:uid(),created:Date.now()});
 save();clearPlan();renderPlans();renderHome();toast(t(existing?'updated':'created'));
});
function renderPlans(){
 const filter=$('#plan-filter').value;
 const filtered=state.plans.filter(p=>filter==='all'||p.status===filter).sort((a,b)=>timeMs(a.date)-timeMs(b.date));
 $('#plan-count').textContent=state.plans.length+'';
 $('#plan-list').innerHTML=filtered.length?filtered.map(p=>'<div class="list-item"><div class="list-item-info"><strong>'+esc(p.title)+'</strong><small>'+esc(p.platform.toUpperCase())+' · '+esc(dateFmt(p.date))+(p.notes?' · '+esc(p.notes):'')+'</small></div><select class="stage-select" aria-label="'+esc(t('stage'))+'" data-plan-stage="'+esc(p.id)+'">'+['idea','draft','ready','published'].map(k=>'<option value="'+k+'"'+(k===p.status?' selected':'')+'>'+esc(stageLabel(k))+'</option>').join('')+'</select><div class="item-actions"><button type="button" data-plan-edit="'+esc(p.id)+'" title="'+esc(t('edit'))+'" aria-label="'+esc(t('edit'))+'">'+icon('edit')+'</button><button type="button" class="delete" data-plan-delete="'+esc(p.id)+'" title="'+esc(t('remove'))+'" aria-label="'+esc(t('remove'))+'">'+icon('trash')+'</button></div></div>').join(''):empty('noPlans');
}
$('#plan-filter').addEventListener('change',renderPlans);
$('#plan-list').addEventListener('change',ev=>{
 const select=ev.target.closest('[data-plan-stage]');if(!select)return;
 const p=state.plans.find(p=>p.id===select.dataset.planStage);if(!p)return;p.status=select.value;save();renderHome();renderPlans();
});
$('#plan-list').addEventListener('click',ev=>{
 const edit=ev.target.closest('[data-plan-edit]');
 if(edit){
  const p=state.plans.find(p=>p.id===edit.dataset.planEdit);if(!p)return;
  editingPlan=p.id;$('#plan-title').value=p.title;$('#plan-date').value=p.date;$('#plan-status').value=p.status;$('#plan-platform').value=p.platform;$('#plan-notes').value=p.notes;
  $('#plan-form-heading').textContent=t('editPost');$('#plan-save').textContent=t('saveChanges');$('#plan-cancel').hidden=false;$('#plan-title').focus();return;
 }
 const del=ev.target.closest('[data-plan-delete]');
 if(del&&confirm(t('confirmDelete'))){state.plans=state.plans.filter(p=>p.id!==del.dataset.planDelete);if(editingPlan===del.dataset.planDelete)clearPlan();save();renderPlans();renderHome()}
});
$('#reminder-form').addEventListener('submit',ev=>{
 ev.preventDefault();const title=$('#reminder-title').value.trim(),due=$('#reminder-due').value;if(!title||!validDate(due))return;
 const existing=state.reminders.find(r=>r.id===editingReminder);
 const record={title:title.slice(0,110),due,priority:$('#reminder-priority').value};
 if(existing){Object.assign(existing,record);existing.notified=false}else state.reminders.push({...record,id:uid(),done:false,notified:false,created:Date.now()});
 save();clearReminder();renderReminders();renderHome();toast(t(existing?'updated':'created'));
});
function renderReminders(){
 $$('#reminder-tabs [data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===reminderFilter));
 const filtered=state.reminders.filter(r=>reminderFilter==='all'||(reminderFilter==='done'?r.done:!r.done)).sort((a,b)=>Number(a.done)-Number(b.done)||timeMs(a.due)-timeMs(b.due));
 $('#reminder-list').innerHTML=filtered.length?filtered.map(r=>'<div class="list-item '+(r.done?'item-done':'')+'"><button type="button" class="check-box '+(r.done?'checked':'')+'" data-reminder-toggle="'+esc(r.id)+'" aria-label="'+esc(r.done?t('open'):t('done'))+'">'+icon('check')+'</button><div class="list-item-info"><strong>'+esc(r.title)+'</strong><small class="'+(!r.done&&timeMs(r.due)<Date.now()?'overdue':'')+'">'+esc(dateFmt(r.due))+' · '+esc(t(r.priority))+'</small></div><div class="item-actions"><button type="button" data-reminder-edit="'+esc(r.id)+'" title="'+esc(t('edit'))+'" aria-label="'+esc(t('edit'))+'">'+icon('edit')+'</button><button type="button" class="delete" data-reminder-delete="'+esc(r.id)+'" title="'+esc(t('remove'))+'" aria-label="'+esc(t('remove'))+'">'+icon('trash')+'</button></div></div>').join(''):empty('noReminders');
}
$$('#reminder-tabs [data-filter]').forEach(b=>b.addEventListener('click',()=>{reminderFilter=b.dataset.filter;renderReminders()}));
$('#reminder-list').addEventListener('click',ev=>{
 const toggle=ev.target.closest('[data-reminder-toggle]');
 if(toggle){const r=state.reminders.find(r=>r.id===toggle.dataset.reminderToggle);if(!r)return;r.done=!r.done;if(!r.done)r.notified=false;save();renderReminders();renderHome();return}
 const edit=ev.target.closest('[data-reminder-edit]');
 if(edit){const r=state.reminders.find(r=>r.id===edit.dataset.reminderEdit);if(!r)return;editingReminder=r.id;$('#reminder-title').value=r.title;$('#reminder-due').value=r.due;$('#reminder-priority').value=r.priority;$('#reminder-form-heading').textContent=t('editReminder');$('#reminder-save').textContent=t('saveChanges');$('#reminder-cancel').hidden=false;$('#reminder-title').focus();return}
 const del=ev.target.closest('[data-reminder-delete]');
 if(del&&confirm(t('confirmDelete'))){state.reminders=state.reminders.filter(r=>r.id!==del.dataset.reminderDelete);if(editingReminder===del.dataset.reminderDelete)clearReminder();save();renderReminders();renderHome()}
});
async function notifications(){
 if(!('Notification' in window)||!window.isSecureContext){toast(t('notificationUnsupported'));return}
 try{const result=await Notification.requestPermission();toast(t(result==='granted'?'notificationOn':'notificationOff'))}catch{toast(t('notificationOff'))}
}
$('#enable-alerts').addEventListener('click',notifications);
function notifyDue(){
 let changed=false;
 for(const r of state.reminders){
  if(r.done||r.notified||timeMs(r.due)>Date.now())continue;
  r.notified=true;changed=true;
  if(Date.now()-timeMs(r.due)>300000)continue;
  if('Notification' in window&&Notification.permission==='granted'){
   try{new Notification('VIVER',{body:r.title,tag:'viver-'+r.id})}catch{if(!document.hidden)toast(t('notifyPrefix')+r.title)}
  }else if(!document.hidden)toast(t('notifyPrefix')+r.title);
 }
 if(changed){save();renderReminders();renderHome()}
}
setInterval(notifyDue,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)notifyDue()});
const stage=$('#board-surface'),sizer=$('#board-sizer'),scroll=$('#board-scroll'),layer=$('#notes-layer');
function setZoom(next){
 zoom=clamp(Math.round(next*10)/10,.5,1.3);
 stage.style.transform='scale('+zoom+')';sizer.style.width=1560*zoom+'px';sizer.style.height=960*zoom+'px';
 $('#zoom-label').textContent=Math.round(zoom*100)+'%';
}
$('#zoom-in').addEventListener('click',()=>setZoom(zoom+.1));
$('#zoom-out').addEventListener('click',()=>setZoom(zoom-.1));
function centerBoard(){
 scroll.scrollLeft=Math.max(0,(1560*zoom-scroll.clientWidth)/2);
 scroll.scrollTop=Math.max(0,(960*zoom-scroll.clientHeight)/2);
}
function renderBoard(){
 layer.innerHTML=state.notes.map(n=>'<article class="sticky" data-note="'+esc(n.id)+'" style="left:'+n.x+'px;top:'+n.y+'px;z-index:'+n.z+';--sticky:'+COLORS[n.color]+'"><div class="sticky-head" data-drag="'+esc(n.id)+'"><span class="sticky-grip">⠿</span><div class="sticky-actions"><button type="button" title="'+esc(t('duplicate'))+'" data-copy="'+esc(n.id)+'" aria-label="'+esc(t('duplicate'))+'">+</button><button type="button" title="'+esc(t('remove'))+'" data-remove="'+esc(n.id)+'" aria-label="'+esc(t('remove'))+'">×</button></div></div><textarea maxlength="3000" data-note-text="'+esc(n.id)+'" placeholder="'+esc(t('emptyNote'))+'">'+esc(n.text)+'</textarea><div class="sticky-bottom"><select data-note-color="'+esc(n.id)+'" aria-label="Колір">'+Object.keys(COLORS).map(c=>'<option value="'+c+'"'+(n.color===c?' selected':'')+'>'+c+'</option>').join('')+'</select></div></article>').join('');
 $('#board-empty').hidden=state.notes.length>0;
 $('#note-count').textContent=state.notes.length+'';
}
function addNote(position){
 const x=position?.x??(scroll.scrollLeft+scroll.clientWidth/2)/zoom-107;
 const y=position?.y??(scroll.scrollTop+scroll.clientHeight/2)/zoom-100;
 const z=Math.max(0,...state.notes.map(n=>n.z))+1;
 const n={id:uid(),text:'',color:noteColor,x:Math.round(clamp(x,8,1345)),y:Math.round(clamp(y,8,750)),z};
 state.notes.push(n);save();renderBoard();renderHome();
 layer.querySelector('[data-note="'+n.id+'"] textarea')?.focus();
}
$('#add-note').addEventListener('click',()=>addNote());
$('#empty-add').addEventListener('click',()=>addNote({x:670,y:380}));
$$('#note-colors .swatch').forEach(b=>b.addEventListener('click',()=>{noteColor=b.dataset.color;$$('#note-colors .swatch').forEach(x=>x.classList.toggle('selected',x===b))}));
layer.addEventListener('input',ev=>{
 const input=ev.target.closest('[data-note-text]');if(!input)return;
 const n=state.notes.find(n=>n.id===input.dataset.noteText);if(n){n.text=input.value.slice(0,3000);save()}
});
layer.addEventListener('change',ev=>{
 const sel=ev.target.closest('[data-note-color]');if(!sel)return;
 const n=state.notes.find(n=>n.id===sel.dataset.noteColor);if(n&&COLORS[sel.value]){n.color=sel.value;save();sel.closest('.sticky').style.setProperty('--sticky',COLORS[sel.value])}
});
layer.addEventListener('click',ev=>{
 const remove=ev.target.closest('[data-remove]');
 if(remove){state.notes=state.notes.filter(n=>n.id!==remove.dataset.remove);save();renderBoard();renderHome();return}
 const copy=ev.target.closest('[data-copy]');
 if(copy){const n=state.notes.find(n=>n.id===copy.dataset.copy);if(!n)return;
  state.notes.push({...n,id:uid(),x:clamp(n.x+30,0,1345),y:clamp(n.y+30,0,750),z:Math.max(...state.notes.map(x=>x.z))+1});
  save();renderBoard();renderHome()}
});
layer.addEventListener('pointerdown',ev=>{
 if(ev.button!==0||ev.target.closest('button,textarea,select'))return;
 const grip=ev.target.closest('[data-drag]');if(!grip)return;
 const n=state.notes.find(n=>n.id===grip.dataset.drag);if(!n)return;
 const el=grip.closest('.sticky');n.z=Math.max(0,...state.notes.map(n=>n.z))+1;el.style.zIndex=n.z;
 drag={id:n.id,x:ev.clientX,y:ev.clientY,fromX:n.x,fromY:n.y,pointer:ev.pointerId,el};
 grip.setPointerCapture(ev.pointerId);ev.preventDefault();
});
layer.addEventListener('pointermove',ev=>{
 if(!drag||drag.pointer!==ev.pointerId)return;
 const n=state.notes.find(n=>n.id===drag.id);if(!n)return;
 n.x=Math.round(clamp(drag.fromX+(ev.clientX-drag.x)/zoom,0,1345));n.y=Math.round(clamp(drag.fromY+(ev.clientY-drag.y)/zoom,0,750));
 drag.el.style.left=n.x+'px';drag.el.style.top=n.y+'px';
});
function finishDrag(){if(drag){drag=null;save()}}
layer.addEventListener('pointerup',finishDrag);layer.addEventListener('pointercancel',finishDrag);window.addEventListener('pointerup',finishDrag);
stage.addEventListener('dblclick',ev=>{
 if(ev.target.closest('.sticky,.board-empty'))return;
 const rect=stage.getBoundingClientRect();
 addNote({x:(ev.clientX-rect.left)/zoom-100,y:(ev.clientY-rect.top)/zoom-40});
});
function renderTheme(){document.documentElement.dataset.theme=state.theme;$$('[data-theme-option]').forEach(b=>b.classList.toggle('active',b.dataset.themeOption===state.theme))}
$$('[data-theme-option]').forEach(b=>b.addEventListener('click',()=>{state.theme=b.dataset.themeOption;save();renderTheme()}));
$('#language').addEventListener('change',ev=>{state.language=ev.target.value==='en'?'en':'uk';save();lang();if(editingPlan){$('#plan-form-heading').textContent=t('editPost');$('#plan-save').textContent=t('saveChanges')}if(editingReminder){$('#reminder-form-heading').textContent=t('editReminder');$('#reminder-save').textContent=t('saveChanges')}});
$('#export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='viver-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(t('backupDone'));
});
$('#import').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(file.size>2097152)throw Error(t('tooLarge'));
  const raw=JSON.parse(await file.text());
  if(raw?.version!==1||!Array.isArray(raw.plans)||!Array.isArray(raw.reminders)||!Array.isArray(raw.notes))throw Error(t('badBackup'));
  if(!confirm(t('confirmImport')))return;
  const next=normalise(raw);state=next;save();editingPlan='';editingReminder='';clearPlan();clearReminder();renderTheme();lang();nav('home');toast(t('importDone'));
 }catch(e){toast(e.message||t('badBackup'))}finally{ev.target.value=''}
});
$('#reset').addEventListener('click',()=>{
 if(!confirm(t('confirmAll'))||!confirm(t('confirmAgain')))return;
 state=fresh();save();clearPlan();clearReminder();renderTheme();lang();nav('home');toast(t('removed'));
});
const searchDialog=$('#search-dialog'),searchInput=$('#search-input');
function openSearch(){
 searchInput.value='';renderSearch();
 if(!searchDialog.open)searchDialog.showModal();searchInput.focus();
}
function renderSearch(){
 const q=searchInput.value.trim().toLowerCase();
 if(!q){$('#search-results').innerHTML='';return}
 const arr=[
 ...state.plans.filter(p=>p.title.toLowerCase().includes(q)||p.notes.toLowerCase().includes(q)).slice(0,10).map(p=>({title:p.title,kind:t('planner'),target:'planner'})),
 ...state.reminders.filter(r=>r.title.toLowerCase().includes(q)).slice(0,10).map(r=>({title:r.title,kind:t('reminders'),target:'reminders'})),
 ...state.notes.filter(n=>n.text.toLowerCase().includes(q)).slice(0,10).map(n=>({title:n.text||t('emptyNote'),kind:t('board'),target:'board',note:n.id}))
 ].slice(0,25);
 $('#search-results').innerHTML=arr.length?arr.map(a=>'<button class="search-result" type="button" data-search-target="'+a.target+'" data-search-note="'+esc(a.note||'')+'"><span>'+esc(a.title.slice(0,130))+'</span><small>'+esc(a.kind)+'</small></button>').join(''):empty('noResults');
}
$('#search-open').addEventListener('click',openSearch);
$('#search-close').addEventListener('click',()=>searchDialog.close());
searchInput.addEventListener('input',renderSearch);
$('#search-results').addEventListener('click',ev=>{
 const item=ev.target.closest('[data-search-target]');if(!item)return;
 searchDialog.close();nav(item.dataset.searchTarget);
 if(item.dataset.searchNote){const el=layer.querySelector('[data-note="'+CSS.escape(item.dataset.searchNote)+'"]');if(el){scroll.scrollLeft=Number.parseFloat(el.style.left)*zoom-120;scroll.scrollTop=Number.parseFloat(el.style.top)*zoom-120;el.querySelector('textarea')?.focus()}}
});
document.addEventListener('keydown',ev=>{
 if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(searchDialog.open)searchDialog.close();else openSearch()}
 if(ev.key==='Escape'){$('#sidebar').classList.remove('open');$('#scrim').classList.remove('show')}
});
defaults();renderTheme();setZoom(1);lang();nav(['home','planner','reminders','board','platforms','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'home',false);notifyDue();
})();