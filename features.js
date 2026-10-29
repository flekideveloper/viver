'use strict';
(()=>{
const c=window.VIVERCore;
if(!c){console.error('VIVER core unavailable');return}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const S=()=>c.state,E=s=>c.esc(s),save=()=>c.save(),toast=s=>c.toast(s),L=()=>S().language;
const msg=(uk,en)=>L()==='uk'?uk:en;
const stages=['idea','script','record','edit','ready','published'];
const stageName=s=>({idea:msg('Ідея','Idea'),draft:msg('У процесі','In progress'),script:msg('Сценарій','Script'),record:msg('Запис','Recording'),edit:msg('Монтаж','Editing'),ready:msg('Готово','Ready'),published:msg('Опубліковано','Published')})[s]||s;
const keyOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
let planMode='list',calendarMonth=new Date(),selectedDay=keyOf(new Date()),expandedChecks=new Set(),connecting='',selectedGroup='all',pendingImage='',editingNoteDetail='';
calendarMonth.setDate(1);calendarMonth.setHours(12,0,0,0);
const asInput=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
function setMode(mode){
 if(!['list','board'].includes(mode))mode='list';planMode=mode;
 $$('#plan-modes button').forEach(b=>b.classList.toggle('active',b.dataset.planMode===mode));
 const list=mode==='list';$('#page-planner .workspace-grid').hidden=!list;
 $('#planner-visual').hidden=list;
 if(!list)renderVisual();
}
$('#plan-modes').addEventListener('click',ev=>{const b=ev.target.closest('[data-plan-mode]');if(b)setMode(b.dataset.planMode)});
function changeMonth(direction){
 calendarMonth.setDate(1);calendarMonth.setMonth(calendarMonth.getMonth()+direction);
 selectedDay=keyOf(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1));
 renderCalendar();
}
$('#calendar-prev').addEventListener('click',()=>changeMonth(-1));
$('#calendar-next').addEventListener('click',()=>changeMonth(1));
$('#calendar-today').addEventListener('click',()=>{calendarMonth=new Date();calendarMonth.setDate(1);selectedDay=keyOf(new Date());renderCalendar()});
$('#planner-new').addEventListener('click',()=>{setMode('list');$('#plan-new-top').click()});
function createForDay(type,day=selectedDay){
 c.nav(type==='reminder'?'reminders':'planner');
 if(type==='reminder'){
  $('#reminder-new-top').click();
  $('#reminder-due').value=day+'T18:00';
  $('#reminder-title').focus();
 }else{
  setMode('list');$('#plan-new-top').click();
  $('#plan-date').value=day+'T18:00';
  $('#plan-title').focus();
 }
}
$('#calendar-add-plan').addEventListener('click',()=>createForDay('plan'));
$('#calendar-add-reminder').addEventListener('click',()=>createForDay('reminder'));
const plan=x=>S().plans.find(p=>p.id===x);
function openPlan(id){
 c.nav('planner');setMode('list');
 $('#plan-filter').value='all';expandedChecks.add(id);
 c.renderPlans();
 const edit=$$('#plan-list [data-plan-edit]').find(x=>x.dataset.planEdit===id);
 if(edit)edit.click();
 $('#plan-title').scrollIntoView({behavior:'smooth',block:'center'});
}
function renderVisual(){
 if(planMode==='board')renderKanban();
}
const weekNames=()=>L()==='uk'?['Пн','Вт','Ср','Чт','Пт','Сб','Нд']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function reminderAppearsOnDate(r,date){
 if(r.done||!r.due||date<r.due.slice(0,10))return false;
 if(date===r.due.slice(0,10))return true;
 if(!r.repeat||r.repeat==='none')return false;
 const dateParts=date.split('-').map(Number),dueParts=r.due.slice(0,10).split('-').map(Number);
 const day=new Date(dateParts[0],dateParts[1]-1,dateParts[2],12);
 if(r.repeat==='daily')return true;
 if(r.repeat==='weekdays')return Array.isArray(r.weekdays)&&r.weekdays.includes(day.getDay());
 if(r.repeat==='monthly'){
  const last=new Date(dateParts[0],dateParts[1],0).getDate();
  return dateParts[2]===Math.min(r.anchorDay||dueParts[2],last);
 }
 if(r.repeat==='weekly'){
  const a=Date.UTC(...[dueParts[0],dueParts[1]-1,dueParts[2]]);
  const b=Date.UTC(...[dateParts[0],dateParts[1]-1,dateParts[2]]);
  return (b-a)%(7*86400000)===0;
 }
 return false;
}
const remindersOnDate=date=>S().reminders.filter(r=>reminderAppearsOnDate(r,date));

function renderCalendar(){
 if(!c.hasViverId?.()){$('#calendar-content').replaceChildren();$('#calendar-day-items').replaceChildren();return}
 const month=calendarMonth.getMonth(),year=calendarMonth.getFullYear();
 $('#calendar-month').textContent=calendarMonth.toLocaleDateString(L()==='uk'?'uk-UA':'en-US',{month:'long',year:'numeric'});
 const start=new Date(year,month,1,12),offset=(start.getDay()+6)%7;
 const first=new Date(start);first.setDate(first.getDate()-offset);
 const dayCells=[];
 const dayCount=Math.ceil((offset+new Date(year,month+1,0).getDate())/7)*7;
 for(let i=0;i<dayCount;i++){
  const day=new Date(first);day.setDate(first.getDate()+i);
  const k=keyOf(day),current=day.getMonth()===month,today=k===keyOf(new Date()),selected=k===selectedDay;
  const plans=S().plans.filter(p=>p.date.slice(0,10)===k);
  const reminders=remindersOnDate(k);
  const entries=[
   ...plans.slice(0,3).map(p=>'<button draggable="true" data-calendar-plan="'+E(p.id)+'" class="calendar-event" title="'+E(p.title)+'">'+E(p.title)+'</button>'),
   ...reminders.slice(0,Math.max(0,3-plans.length)).map(r=>'<button data-calendar-reminder="'+E(r.id)+'" class="calendar-event reminder-event" title="'+E(r.title)+'">'+(r.repeat&&r.repeat!=='none'?'↻ ':'• ')+E(r.title)+'</button>')
  ].join('');
  const more=plans.length+reminders.length-3;
  dayCells.push('<div class="calendar-cell '+(current?'':'outside ')+(today?'today ':'')+(selected?'selected':'')+'" data-calendar-day="'+k+'"><button type="button" class="calendar-date" data-calendar-select="'+k+'" aria-label="'+k+'">'+day.getDate()+'</button><div class="day-events">'+entries+(more>0?'<small>+'+more+'</small>':'')+'</div></div>');
 }
 $('#calendar-content').innerHTML='<div class="calendar-grid">'+weekNames().map(n=>'<div class="calendar-weekday">'+n+'</div>').join('')+dayCells.join('')+'</div>';
 renderAgenda();
}
function renderAgenda(){
 const d=new Date(selectedDay+'T12:00:00');
 $('#calendar-selected-date').textContent=d.toLocaleDateString(L()==='uk'?'uk-UA':'en-US',{weekday:'long',day:'numeric',month:'long'});
 const plans=S().plans.filter(p=>p.date.slice(0,10)===selectedDay).sort((a,b)=>a.date.localeCompare(b.date));
 const reminders=remindersOnDate(selectedDay).sort((a,b)=>a.due.localeCompare(b.due));
 const rows=[
  ...plans.map(p=>({id:p.id,kind:'plan',date:p.date,title:p.title,tag:stageName(p.status)})),
  ...reminders.map(r=>({id:r.id,kind:'reminder',date:selectedDay+r.due.slice(10),title:r.title,tag:(r.repeat&&r.repeat!=='none'?'↻ ':'')+msg('Нагадування','Reminder')}))
 ].sort((a,b)=>a.date.localeCompare(b.date));
 $('#calendar-day-items').innerHTML=rows.length?rows.map(x=>'<button type="button" class="agenda-row" data-agenda-'+x.kind+'="'+E(x.id)+'"><span class="agenda-time">'+E(x.date.slice(11,16))+'</span><span class="agenda-body"><strong>'+E(x.title)+'</strong><small>'+E(x.tag)+'</small></span><span class="agenda-chevron">›</span></button>').join(''):'<p class="agenda-empty">'+msg('На цей день нічого немає.','Nothing planned for this day.')+'</p>';
}
$('#calendar-day-items').addEventListener('click',ev=>{
 const planBtn=ev.target.closest('[data-agenda-plan]');if(planBtn){openPlan(planBtn.dataset.agendaPlan);return}
 const remBtn=ev.target.closest('[data-agenda-reminder]');
 if(remBtn){c.nav('reminders');const edit=$('#reminder-list [data-reminder-edit]').find(b=>b.dataset.reminderEdit===remBtn.dataset.agendaReminder);edit?.click()}
});
function renderKanban(){
 const columns=stages.map(stage=>{
  const items=S().plans.filter(p=>p.status===stage||(stage==='script'&&p.status==='draft')).sort((a,b)=>new Date(a.date)-new Date(b.date));
  return '<div class="kanban-column" data-kanban-column="'+stage+'"><div class="kanban-column-head"><strong>'+E(stageName(stage))+'</strong><span>'+items.length+'</span></div><div class="kanban-cards">'+items.map(p=>{
   const checks=p.checks||[],done=checks.filter(ch=>ch.done).length;
   return '<button class="kanban-card" type="button" draggable="true" data-kanban-plan="'+E(p.id)+'"><strong>'+E(p.title)+'</strong><small>'+E(p.platform.toUpperCase())+' · '+E(c.dateFmt(p.date))+'</small>'+(checks.length?'<span class="kanban-progress">☑ '+done+'/'+checks.length+'</span>':'')+'</button>';
  }).join('')+'</div></div>';
 }).join('');
 $('#planner-visual-content').innerHTML='<div class="kanban-board">'+columns+'</div>';
}
function handleContentClick(ev){
 const p=ev.target.closest('[data-kanban-plan],[data-calendar-plan]');
 if(p){openPlan(p.dataset.kanbanPlan||p.dataset.calendarPlan);return}
 const rem=ev.target.closest('[data-calendar-reminder]');
 if(rem){c.nav('reminders');const edit=$$('#reminder-list [data-reminder-edit]').find(b=>b.dataset.reminderEdit===rem.dataset.calendarReminder);edit?.click();return}
 const day=ev.target.closest('[data-calendar-select],[data-calendar-day]');
 if(day){
  const date=day.dataset.calendarSelect||day.dataset.calendarDay;
  if(!date)return;
  selectedDay=date;
  const selected=new Date(date+'T12:00:00');
  if(calendarMonth.getMonth()!==selected.getMonth()||calendarMonth.getFullYear()!==selected.getFullYear())calendarMonth=new Date(selected.getFullYear(),selected.getMonth(),1);
  renderCalendar();
 }
}
function handleDragStart(ev){
 const item=ev.target.closest('[data-kanban-plan],[data-calendar-plan]');if(!item)return;
 ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',item.dataset.kanbanPlan||item.dataset.calendarPlan);
}
function handleDragOver(ev){
 if(ev.target.closest('[data-kanban-column],[data-calendar-day]')){ev.preventDefault();ev.dataTransfer.dropEffect='move'}
}
function handleDrop(ev){
 const col=ev.target.closest('[data-kanban-column]'),cell=ev.target.closest('[data-calendar-day]');
 if(!col&&!cell)return;ev.preventDefault();
 const id=ev.dataTransfer.getData('text/plain'),p=plan(id);if(!p)return;
 if(col)p.status=col.dataset.kanbanColumn;
 else if(cell)p.date=cell.dataset.calendarDay+p.date.slice(10);
 if(!save())return;
 c.renderPlans();c.renderHome();renderCalendar();toast(msg('План оновлено','Plan updated'));
}
for(const selector of ['#planner-visual-content','#calendar-content']){
 const root=$(selector);
 root.addEventListener('click',handleContentClick);
 root.addEventListener('dragstart',handleDragStart);
 root.addEventListener('dragover',handleDragOver);
 root.addEventListener('drop',handleDrop);
}
function checklistHTML(p){
 const checks=p.checks||[],done=checks.filter(ch=>ch.done).length,opened=expandedChecks.has(p.id);
 return '<div class="checklist-wrap"><button class="checklist-toggle" type="button" data-check-open="'+E(p.id)+'">'+(checks.length?'☑ '+done+'/'+checks.length:msg('+ Завдання','+ Tasks'))+'</button>'+(opened?'<div class="checklist-editor">'+checks.map(ch=>'<div class="check-item"><label><input type="checkbox" data-check-toggle="'+E(p.id)+'" data-check-id="'+E(ch.id)+'" '+(ch.done?'checked':'')+'><span class="'+(ch.done?'complete':'')+'">'+E(ch.text)+'</span></label><button type="button" aria-label="Delete task" data-check-del="'+E(p.id)+'" data-check-id="'+E(ch.id)+'">×</button></div>').join('')+'<form class="check-add" data-check-form="'+E(p.id)+'"><input required name="task" maxlength="120" placeholder="'+msg('Нове завдання…','New task…')+'"><button type="submit">+</button></form></div>':'')+'</div>';
}
function onPlansRendered(){
 $$('#plan-list .list-item').forEach(el=>{
  const id=el.querySelector('[data-plan-edit]')?.dataset.planEdit,p=plan(id);
  if(!p)return;
  if(!Array.isArray(p.checks))p.checks=[];
  const wrapper=document.createElement('div');wrapper.className='checklist-host';wrapper.innerHTML=checklistHTML(p);el.append(wrapper);
 });
 renderVisual();
 if(c.page==='calendar')renderCalendar();
}
$('#plan-list').addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-check-open],[data-check-del]');if(!btn)return;
 ev.preventDefault();ev.stopPropagation();
 const id=btn.dataset.checkOpen||btn.dataset.checkDel,p=plan(id);if(!p)return;
 if(btn.hasAttribute('data-check-open')){if(expandedChecks.has(id))expandedChecks.delete(id);else expandedChecks.add(id)}
 else{p.checks=(p.checks||[]).filter(ch=>ch.id!==btn.dataset.checkId);save()}
 c.renderPlans();
});
$('#plan-list').addEventListener('change',ev=>{
 const input=ev.target.closest('[data-check-toggle]');if(!input)return;
 const p=plan(input.dataset.checkToggle),ch=p?.checks?.find(ch=>ch.id===input.dataset.checkId);
 if(ch){ch.done=input.checked;save();c.renderPlans()}
});
$('#plan-list').addEventListener('submit',ev=>{
 const form=ev.target.closest('[data-check-form]');if(!form)return;
 ev.preventDefault();ev.stopPropagation();const p=plan(form.dataset.checkForm),value=form.elements.task.value.trim();
 if(!p||!value)return;if(!Array.isArray(p.checks))p.checks=[];
 if(p.checks.length>=60){toast(msg('Ліміт: 60 завдань','Limit: 60 tasks'));return}
 p.checks.push({id:c.uid(),text:value.slice(0,120),done:false});save();c.renderPlans();
 const field=$$('#plan-list [data-check-form]').find(x=>x.dataset.checkForm===p.id)?.elements.task;field?.focus();
});
function recurrenceText(r){
 return {daily:msg('Щодня','Daily'),weekly:msg('Щотижня','Weekly'),monthly:msg('Щомісяця','Monthly'),weekdays:msg('Вибрані дні','Selected days')}[r.repeat]||'';
}
$('#reminder-repeat').addEventListener('change',()=>{$('#reminder-weekdays').hidden=$('#reminder-repeat').value!=='weekdays'});
function setReminderRepeat(r){
 $('#reminder-repeat').value=r.repeat||'none';$('#reminder-weekdays').hidden=$('#reminder-repeat').value!=='weekdays';
 $$('#reminder-weekdays input').forEach(x=>x.checked=(r.weekdays||[]).includes(Number(x.value)));
}
function nextOccurrence(r){
 const current=new Date(r.due),now=new Date(),next=new Date(current);
 const steps=(r.repeat==='weekdays'?370:r.repeat==='monthly'?72:800);
 const days=r.weekdays?.length?r.weekdays:[current.getDay()];
 for(let i=0;i<steps;i++){
  if(r.repeat==='daily')next.setDate(next.getDate()+1);
  else if(r.repeat==='weekly')next.setDate(next.getDate()+7);
  else if(r.repeat==='monthly'){
   const day=r.anchorDay||current.getDate();
   const target=new Date(next.getFullYear(),next.getMonth()+1,1,next.getHours(),next.getMinutes());
   target.setDate(Math.min(day,new Date(target.getFullYear(),target.getMonth()+1,0).getDate()));
   next.setTime(target.getTime());
  }else if(r.repeat==='weekdays'){
   do{next.setDate(next.getDate()+1)}while(!days.includes(next.getDay()));
  }else return null;
  if(next>now)return asInput(next);
 }
 return asInput(next);
}
function advanceReminder(r){
 const next=nextOccurrence(r);
 if(next){r.due=next;r.done=false;r.notified=false;toast(msg('Перенесено на наступну дату','Moved to the next date'))}
 else r.done=true;
}
function onRemindersRendered(){
 $$('#reminder-list .list-item').forEach(el=>{
  const id=el.querySelector('[data-reminder-edit]')?.dataset.reminderEdit;
  const r=S().reminders.find(x=>x.id===id),label=r&&recurrenceText(r);
  if(!label)return;
  const small=el.querySelector('.list-item-info small');if(!small)return;
  const badge=document.createElement('span');badge.className='recurrence-badge';badge.textContent=' · ↻ '+label;small.append(badge);
 });
}
const board=$('#board-scroll'),layer=$('#notes-layer'),filter=$('#board-group-filter'),LINES=$('#board-connections');
function drawBoardLines(){
 const groups=selectedGroup,visible=id=>{const n=S().notes.find(n=>n.id===id);return !!n&&(groups==='all'||n.group===groups)};
 const lines=[];for(const n of S().notes){
  if(!visible(n.id))continue;
  for(const target of n.links||[]){
   const to=S().notes.find(x=>x.id===target);
   if(!to||!visible(target))continue;
   const x=n.x+107,y=n.y+102,x2=to.x+107,y2=to.y+102;
   lines.push('<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" stroke="#9b8ba9" stroke-width="2" opacity=".78" stroke-dasharray="6 5" />');
  }
 }
 LINES.innerHTML=lines.join('');
}
function onBoardRendered(){
 const groups=[...new Set(S().notes.map(n=>n.group).filter(Boolean))].sort();
 if(selectedGroup!=='all'&&!groups.includes(selectedGroup))selectedGroup='all';
 filter.innerHTML='<option value="all">'+msg('Усі групи','All groups')+'</option>'+groups.map(g=>'<option value="'+E(g)+'"'+(g===selectedGroup?' selected':'')+'>'+E(g)+'</option>').join('');
 $$('#notes-layer .sticky').forEach(el=>{
  const n=S().notes.find(n=>n.id===el.dataset.note);if(!n)return;
  el.hidden=selectedGroup!=='all'&&n.group!==selectedGroup;
  const top=el.querySelector('.sticky-actions');
  top.insertAdjacentHTML('afterbegin','<button type="button" data-note-menu="'+E(n.id)+'" title="'+msg('Дії','Actions')+'" aria-label="'+msg('Дії','Actions')+'">···</button>');
  el.insertAdjacentHTML('beforeend','<div class="note-menu" hidden data-menu-for="'+E(n.id)+'"><button type="button" data-note-action="details" data-action-id="'+E(n.id)+'">'+msg('Деталі','Details')+'</button><button type="button" data-note-action="image" data-action-id="'+E(n.id)+'">'+msg('Зображення','Image')+'</button><button type="button" data-note-action="connect" data-action-id="'+E(n.id)+'">'+msg('З’єднати','Connect')+'</button>'+(n.image?'<button type="button" data-note-action="remove-image" data-action-id="'+E(n.id)+'">'+msg('Прибрати зображення','Remove image')+'</button>':'')+'</div>');
  if(n.group)el.querySelector('.sticky-head').insertAdjacentHTML('afterend','<span class="sticky-group">'+E(n.group)+'</span>');
  if(n.image)el.querySelector('.sticky-bottom').insertAdjacentHTML('beforebegin','<img class="sticky-photo" alt="" src="'+E(n.image)+'">');
  if(n.link&&/^https:\/\//i.test(n.link))el.querySelector('.sticky-bottom').insertAdjacentHTML('afterbegin','<a class="sticky-link" rel="noopener noreferrer" target="_blank" href="'+E(n.link)+'" title="'+E(n.link)+'">↗</a>');
 });
 drawBoardLines();
}
filter.addEventListener('change',()=>{selectedGroup=filter.value;onBoardRenderedFilter()});
function onBoardRenderedFilter(){
 $$('#notes-layer .sticky').forEach(el=>{const n=S().notes.find(n=>n.id===el.dataset.note);el.hidden=selectedGroup!=='all'&&n?.group!==selectedGroup});
 drawBoardLines();
}
layer.addEventListener('pointerdown',ev=>{if(connecting&&ev.target.closest('.sticky')){ev.stopImmediatePropagation();ev.preventDefault()}},true);
layer.addEventListener('click',ev=>{
 if(connecting){
  const to=ev.target.closest('[data-note]');ev.stopImmediatePropagation();ev.preventDefault();
  const source=S().notes.find(n=>n.id===connecting);
  if(to&&source&&to.dataset.note!==connecting){
   if(!source.links)source.links=[];
   if(source.links.includes(to.dataset.note))source.links=source.links.filter(x=>x!==to.dataset.note);
   else source.links.push(to.dataset.note);
   save();drawBoardLines();
   toast(msg('Зв’язок оновлено','Connection updated'));
  }
  connecting='';layer.classList.remove('connecting');return;
 }
 const trigger=ev.target.closest('[data-note-menu]');
 if(trigger){
  ev.stopImmediatePropagation();
  const menu=[...layer.querySelectorAll('[data-menu-for]')].find(el=>el.dataset.menuFor===trigger.dataset.noteMenu);
  const wasOpen=!menu.hidden;
  $$('.note-menu').forEach(m=>m.hidden=true);
  menu.hidden=wasOpen;return;
 }
 const act=ev.target.closest('[data-note-action]');
 if(!act)return;ev.stopImmediatePropagation();
 const n=S().notes.find(n=>n.id===act.dataset.actionId);if(!n)return;
 $$('.note-menu').forEach(m=>m.hidden=true);
 switch(act.dataset.noteAction){
  case 'details':
   editingNoteDetail=n.id;
   $('#note-details-group').value=n.group||'';
   $('#note-details-link').value=n.link||'';
   $('#note-details-dialog').showModal();
   $('#note-details-group').focus();
   break;
  case 'image':pendingImage=n.id;$('#note-image-input').click();break;
  case 'remove-image':n.image='';save();c.renderBoard();break;
  case 'connect':connecting=n.id;layer.classList.add('connecting');toast(msg('Натисни інший стікер для з’єднання','Click another sticky note to connect'));break;
 }
},true);
const noteDialog=$('#note-details-dialog');
$('#note-details-close').addEventListener('click',()=>noteDialog.close());
$('#note-details-cancel').addEventListener('click',()=>noteDialog.close());
noteDialog.addEventListener('close',()=>{editingNoteDetail=''});
$('#note-details-form').addEventListener('submit',ev=>{
 ev.preventDefault();
 const n=S().notes.find(n=>n.id===editingNoteDetail);if(!n)return;
 const group=$('#note-details-group').value.trim().slice(0,36);
 const link=$('#note-details-link').value.trim().slice(0,500);
 if(link&&(!/^https:\/\/[^\s]+$/i.test(link))){toast(msg('Вкажи правильне HTTPS-посилання','Enter a valid HTTPS link'));return}
 const previous={group:n.group,link:n.link};
 n.group=group;n.link=link;
 if(!save()){n.group=previous.group;n.link=previous.link;return}
 noteDialog.close();selectedGroup='all';c.renderBoard();
});
document.addEventListener('click',ev=>{if(!ev.target.closest('.note-menu,.sticky-actions'))$$('.note-menu').forEach(m=>m.hidden=true)});
$('#note-image-input').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0],n=S().notes.find(n=>n.id===pendingImage);ev.target.value='';pendingImage='';
 if(!file||!n)return;
 if(!file.type.startsWith('image/')||file.size>4*1024*1024){toast(msg('Потрібне зображення до 4 МБ','Choose an image under 4 MB'));return}
 try{
  const bmp=await createImageBitmap(file),ratio=Math.min(1,480/Math.max(bmp.width,bmp.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*ratio));canvas.height=Math.max(1,Math.round(bmp.height*ratio));
  canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close?.();
  const data=canvas.toDataURL('image/jpeg',.65);
  if(data.length>250000)throw Error(msg('Зображення надто велике','Image too large'));
  const prev=n.image;n.image=data;if(!save()){n.image=prev;return}c.renderBoard();
 }catch(err){toast(err.message||msg('Не вдалося додати зображення','Could not add image'))}
});
function parseCSV(text){
 const records=[];let row=[],value='',quotes=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quotes&&text[i+1]==='"'){value+='"';i++}else quotes=!quotes}
  else if(ch===','&&!quotes){row.push(value);value=''}
  else if((ch==='\n'||ch==='\r')&&!quotes){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   row.push(value);if(row.some(x=>x.trim()))records.push(row);row=[];value='';
  }else value+=ch;
 }
 if(quotes)throw Error(msg('Незакриті лапки в CSV','Unclosed quotes in CSV'));
 row.push(value);if(row.some(x=>x.trim()))records.push(row);
 if(records.length<2)return [];
 const headers=records.shift().map(x=>x.trim().toLowerCase());
 return records.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]||'').trim()])));
}
function cleanReport(r){
 const plat=String(r.platform||r.service||'').trim().toLowerCase().replace('twitter','x');
 const platform={youtube:'youtube',yt:'youtube',tiktok:'tiktok',twitch:'twitch',x:'x'}[plat];if(!platform)return null;
 const date=String(r.date||r.day||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const checkDate=new Date(date+'T12:00:00Z');
 if(!Number.isFinite(checkDate.getTime())||checkDate.toISOString().slice(0,10)!==date)return null;
 const metrics={};let hasAny=false;
 for(const key of ['views','followers','likes','comments','shares']){
  const raw=r[key]??'';
  if(raw===null||String(raw).trim()===''){metrics[key]=null;continue}
  const value=Number(String(raw).replace(/[\s,]/g,''));
  if(!Number.isFinite(value)||value<0||value>1e15)return null;
  metrics[key]=value;hasAny=true;
 }
 return hasAny?{platform,date,...metrics}:null;
}
function formatNumber(n){return n===null?'—':new Intl.NumberFormat(L()==='uk'?'uk-UA':'en-US',{maximumFractionDigits:0}).format(n)}
function renderAnalytics(){
 const platform=$('#analytics-provider').value,metric=$('#analytics-metric').value;
 const rows=(S().analytics||[]).filter(r=>r.platform===platform&&r[metric]!==null&&Number.isFinite(r[metric])).sort((a,b)=>a.date.localeCompare(b.date));
 const chart=$('#analytics-chart');
 if(!rows.length){
  chart.innerHTML='<div class="empty-state">'+msg('Даних немає. Завантаж CSV або JSON звіт.','No data. Import a CSV or JSON report.')+'</div>';
  $('#analytics-clear').hidden=!(S().analytics||[]).length;return;
 }
 const last=rows.at(-1),min=Math.min(...rows.map(r=>r[metric])),max=Math.max(...rows.map(r=>r[metric]));
 const dates=[...new Set(rows.map(r=>r.date))];const w=690,h=190,pad=30,plotW=w-pad*2,plotH=h-2*pad,range=Math.max(1,max-min);
 const xy=(r,i)=>({x:pad+(rows.length===1?plotW/2:i/(rows.length-1)*plotW),y:h-pad-(r[metric]-min)/range*plotH});
 const poly=rows.map((r,i)=>{const p=xy(r,i);return p.x.toFixed(1)+','+p.y.toFixed(1)}).join(' ');
 const dots=rows.map((r,i)=>{const p=xy(r,i);return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.4" fill="#b6a1f3"><title>'+E(r.date+' · '+formatNumber(r[metric]))+'</title></circle>'}).join('');
 chart.innerHTML='<div class="analytics-summary"><strong>'+formatNumber(last[metric])+'</strong><span>'+E(last.date)+' · '+rows.length+' '+msg('записів','records')+'</span></div><svg class="metric-chart" viewBox="0 0 690 190" role="img" aria-label="'+E(msg('Графік імпортованих даних','Imported data chart'))+'"><path d="M30 160H660 M30 30H660" stroke="currentColor" opacity=".13" fill="none"/><polyline fill="none" stroke="#ab96e4" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+poly+'"/>'+dots+'</svg><div class="chart-dates"><span>'+E(rows[0].date)+'</span><span>'+E(rows.at(-1).date)+'</span></div>';
 $('#analytics-clear').hidden=false;
}
$('#analytics-provider').addEventListener('change',renderAnalytics);
$('#analytics-metric').addEventListener('change',renderAnalytics);
$('#report-template').addEventListener('click',()=>{
 const csv='date,platform,views,followers,likes,comments,shares\n';
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='viver-stats-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#report-import').addEventListener('change',async ev=>{
 const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
 try{
  if(file.size>2*1024*1024)throw Error(msg('Максимальний файл — 2 МБ','Maximum file size is 2 MB'));
  const text=await file.text();
  const data=file.name.toLowerCase().endsWith('.json')?JSON.parse(text):parseCSV(text);
  if(!Array.isArray(data))throw Error(msg('Очікується масив даних','Expected an array of rows'));
  const clean=data.slice(0,1000).map(cleanReport).filter(Boolean);
  if(!clean.length)throw Error(msg('Немає правильних рядків. Потрібні date, platform і хоча б один показник.','No valid rows. Need date, platform and at least one metric.'));
  const combined=new Map((S().analytics||[]).map(r=>[r.platform+'|'+r.date,r]));
  clean.forEach(r=>combined.set(r.platform+'|'+r.date,r));
  const prior=S().analytics;S().analytics=[...combined.values()].slice(-1000);
  if(!save()){S().analytics=prior;return}
  $('#analytics-provider').value=clean[0].platform;
  renderAnalytics();toast(msg('Імпортовано записів: ','Imported rows: ')+clean.length);
 }catch(err){toast(err.message||msg('Не вдалося прочитати файл','Could not read file'))}
});
$('#analytics-clear').addEventListener('click',()=>{
 if(!confirm(msg('Видалити всі імпортовані показники?','Delete all imported metrics?')))return;
 S().analytics=[];save();renderAnalytics();
});
function translate(){
 const dict={
  uk:{listMode:'Список',calendarMode:'Календар',kanbanMode:'Етапи',dragStages:'Перетягуй картки між етапами',today:'Сьогодні',repeatLabel:'Повторення',noRepeat:'Без повторення',daily:'Щодня',weekly:'Щотижня',monthly:'Щомісяця',selectedDays:'Вибрані дні',chooseDays:'Дні тижня',allGroups:'Усі групи',statistics:'Імпортовані звіти',sampleCsv:'Шаблон CSV',importReport:'Імпорт звіту',metric:'Показник',views:'Перегляди',followers:'Підписники',likes:'Вподобання',comments:'Коментарі',shares:'Поширення',reportNote:'Графік цього розділу показує тільки дані імпортованих CSV/JSON-файлів. Жива статистика YouTube — вище.',clearReports:'Видалити звіти',apiNotice:'Автоматичне підключення ще не налаштоване. Можеш завантажити власний звіт CSV або JSON для перегляду статистики.'},
  en:{listMode:'List',calendarMode:'Calendar',kanbanMode:'Stages',dragStages:'Drag cards between stages',today:'Today',repeatLabel:'Repeat',noRepeat:'No repeat',daily:'Daily',weekly:'Weekly',monthly:'Monthly',selectedDays:'Selected days',chooseDays:'Weekdays',allGroups:'All groups',statistics:'Imported reports',sampleCsv:'CSV template',importReport:'Import report',metric:'Metric',views:'Views',followers:'Followers',likes:'Likes',comments:'Comments',shares:'Shares',reportNote:'This chart only uses imported CSV/JSON files. Live YouTube metrics are shown above.',clearReports:'Clear reports',apiNotice:'Automatic connections are not configured yet. You can import your own CSV or JSON report to see statistics.'}
 };
 $$('[data-t]').forEach(el=>{const value=dict[L()]?.[el.dataset.t];if(value)el.textContent=value});
 renderVisual();renderCalendar();renderAnalytics();onBoardRenderedFilter();
}
function onNavigate(page){if(page==='planner')renderVisual();if(page==='calendar')renderCalendar();if(page==='platforms')renderAnalytics();if(page==='board')drawBoardLines()}
window.VIVERExtras={onNavigate,onPlansRendered,onRemindersRendered,onBoardRendered,drawBoardLines,setReminderRepeat,advanceReminder,translate,renderAnalytics,getActiveGroup:()=>selectedGroup==='all'?'':selectedGroup};
translate();onPlansRendered();onRemindersRendered();onBoardRendered();renderAnalytics();
})();