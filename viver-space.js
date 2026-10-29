'use strict';
/* VIVER ID + Teams. Entirely separate from OAuth provider tokens. */
(()=>{
 const BASE='https://viver-space.flekideveloper.workers.dev',KEY='viver-id-session-v1';
 const c=window.VIVERCore,settings=document.querySelector('#page-settings'),main=document.querySelector('#main'),nav=document.querySelector('#sidebar .navigation');
 if(!c||!settings||!main||!nav)return;
 const ua=()=>document.documentElement.lang!=='en',t=(a,b)=>ua()?a:b;
 const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[k]));
 let token=localStorage.getItem(KEY)||'',user=null,mode='login',recovery='',error='',busy=false,teamList=[],team=null,teamId='',invite='',cloudVersion=null;
 const node=(tag,html)=>{const e=document.createElement(tag);e.innerHTML=html;return e};
 const authBox=node('section','<div class="vs-title"><h2>VIVER ID</h2><small id="vs-auth-status"></small></div><div id="vs-auth-content"></div>');
 authBox.className='vs-card';authBox.id='viver-id-card';
 settings.insertBefore(authBox,settings.querySelector('.settings-stack'));
 const teamsButton=node('button','<span>♧</span><span>VIVER Teams</span>');
 teamsButton.type='button';teamsButton.className='nav-item';teamsButton.dataset.page='teams';
 nav.append(teamsButton);
 const page=node('section','<div class="page-title"><h1>VIVER Teams</h1></div><div class="vs-card" id="vs-teams-content"></div>');
 page.id='page-teams';page.className='page';page.setAttribute('aria-hidden','true');main.append(page);
 teamsButton.addEventListener('click',()=>{c.nav('teams');loadTeams()});
 if(location.hash==='#teams')c.nav('teams',false);
 const form=el=>Object.fromEntries(new FormData(el).entries());
 async function api(path,opt={}){
  const controller=new AbortController(),time=setTimeout(()=>controller.abort(),15000);
  try{
   const res=await fetch(BASE+path,{method:opt.method||'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(opt.data?{'Content-Type':'application/json'}:{})},body:opt.data?JSON.stringify(opt.data):undefined,signal:controller.signal,cache:'no-store'});
   const data=await res.json().catch(()=>({error:'invalid_server_response'}));
   if(!res.ok)throw Error(data.error||'HTTP '+res.status);
   return data;
  }finally{clearTimeout(time)}
 }
 function speak(s){error=s;c.toast(s)}
 function saveSession(v){token=v||'';if(token)localStorage.setItem(KEY,token);else localStorage.removeItem(KEY)}
 function authenticated(userData,tok){user=userData;saveSession(tok);mode='login';recovery='';error='';render();document.dispatchEvent(new Event('viver-id-changed'))}
 function render(){
  const status=authBox.querySelector('#vs-auth-status'),box=authBox.querySelector('#vs-auth-content');
  status.textContent=user?'@'+user.username:t('Не авторизовано','Signed out');
  if(user){
   box.innerHTML='<p class="vs-muted">'+t('Твій VIVER ID зберігається окремо від Google OAuth. Підключення соцмереж залишаються в поточному браузері.','Your VIVER ID is separate from Google OAuth. Social connections remain in this browser.')+'</p>'+
    '<div class="vs-actions"><button type="button" class="primary-button" data-vs-action="save">'+t('Зберегти у хмарі','Save to cloud')+'</button><button type="button" class="secondary-button" data-vs-action="restore">'+t('Відновити з хмари','Restore from cloud')+'</button><button type="button" class="secondary-button" data-vs-action="logout">'+t('Вийти','Sign out')+'</button></div>'+
    '<p class="vs-hint">'+t('Хмарна копія включає планер, нагадування, стікери й локальні налаштування Studio. OAuth-ключі не передаються. Відновлення замінює локальні записи тільки після підтвердження.','Cloud backup includes planner, reminders, notes and local Studio preferences. OAuth keys are not uploaded. Restore replaces local records only after your confirmation.')+'</p>';
  }else{
   const heading=mode==='register'?t('Реєстрація','Create account'):mode==='recover'?t('Відновлення за ключем','Recover with key'):t('Вхід','Sign in');
   const help=mode==='register'?t('Юзернейм 3–24 символи. Пароль від 10 символів: літери й цифри. Після реєстрації обов’язково збережи ключ відновлення.','Username 3–24 characters. Password at least 10 characters with letters and numbers. Save your recovery key after signup.'):mode==='recover'?t('Введи юзернейм, ключ відновлення і новий пароль. Старі сесії буде завершено.','Enter username, recovery key and a new password. Old sessions will be revoked.'):'';
   box.innerHTML='<div class="vs-tabs"><button type="button" data-vs-mode="login" class="'+(mode==='login'?'active':'')+'">'+t('Вхід','Login')+'</button><button type="button" data-vs-mode="register" class="'+(mode==='register'?'active':'')+'">'+t('Реєстрація','Register')+'</button><button type="button" data-vs-mode="recover" class="'+(mode==='recover'?'active':'')+'">'+t('Відновити','Recover')+'</button></div>'+
    '<form id="vs-auth-form" class="vs-form"><h3>'+heading+'</h3><label>'+t("Ім’я користувача","Username")+'<input name="username" required autocomplete="username" minlength="3" maxlength="24" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}" placeholder="creator_name"></label>'+
    (mode==='recover'?'<label>'+t('Ключ відновлення','Recovery key')+'<input name="recovery" required autocomplete="off" maxlength="43" minlength="43"></label>':'')+
    '<label>'+t(mode==='recover'?'Новий пароль':'Пароль',mode==='recover'?'New password':'Password')+'<input name="password" type="password" required autocomplete="'+(mode==='login'?'current-password':'new-password')+'" minlength="'+(mode==='login'?1:10)+'" maxlength="128"></label>'+
    '<button type="submit" class="primary-button" '+(busy?'disabled':'')+'>'+heading+'</button><small>'+help+'</small></form>';
  }
  if(recovery){const p=node('div','<strong>'+t('Збережи цей ключ відновлення!','Save this recovery key!')+'</strong><p class="vs-monospace" id="vs-recovery-value"></p><button type="button" class="secondary-button" data-vs-action="copy-recovery">'+t('Копіювати ключ','Copy key')+'</button>');p.className='vs-recovery';p.querySelector('#vs-recovery-value').textContent=recovery;box.prepend(p)}
  if(error){const p=node('p','');p.className='vs-error';p.textContent=error;box.prepend(p)}
 }
 authBox.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-vs-mode]');if(tab){mode=tab.dataset.vsMode;error='';recovery='';render();return}
  const action=e.target.closest('[data-vs-action]')?.dataset.vsAction;
  if(!action||busy)return;
  if(action==='copy-recovery'){try{await navigator.clipboard.writeText(recovery);speak(t('Ключ скопійовано','Recovery key copied'))}catch{speak(t('Не вдалося скопіювати','Could not copy'))}return}
  if(action==='logout'){try{await api('/v1/auth/logout',{method:'POST'})}catch{}authenticated(null,'');teamList=[];team=null;renderTeams();return}
  if(action==='save')return cloudSave();
  if(action==='restore')return cloudRestore();
 });
 authBox.addEventListener('submit',async e=>{
  if(e.target.id!=='vs-auth-form')return;e.preventDefault();if(busy)return;
  const b=form(e.target);
  busy=true;error='';render();
  try{
   const endpoint=mode==='register'?'register':mode==='recover'?'recover':'login';
   const data=await api('/v1/auth/'+endpoint,{method:'POST',data:b});
   authenticated(data.user,data.token);
   if(data.recovery){recovery=data.recovery;render()}
   loadTeams();
  }catch(ex){error=String(ex.message||ex);render()}
  finally{busy=false}
 });
 async function cloudSave(){
  if(!user)return;busy=true;
  try{
   const remote=await api('/v1/workspace');
   if(remote.exists&&!confirm(t('Замінити хмарну копію поточними локальними даними?','Overwrite the cloud backup with this device data?')))return;
   const payload={workspace:c.state,studio:localStorage.getItem('viver-studio-v2')||'',creator:localStorage.getItem('viver-creator-studio-v1')||'',alerts:localStorage.getItem('viver-smart-alerts-v1')||''};
   const result=await api('/v1/workspace',{method:'PUT',data:{version:remote.version,workspace:payload}});
   cloudVersion=result.version;speak(t('Копію у хмарі збережено','Cloud backup saved'));
  }catch(e){speak(t('Не вдалося зберегти: ','Save failed: ')+e.message)}
  finally{busy=false}
 }
 async function cloudRestore(){
  if(!user)return;busy=true;
  try{
   const remote=await api('/v1/workspace');
   if(!remote.exists){speak(t('Хмарної копії ще немає','No cloud backup yet'));return}
   if(!confirm(t('Замінити локальні плани, нотатки й нагадування хмарною копією? Перед цим можеш експортувати локальну копію в Налаштуваннях.','Replace local plans, notes and reminders with the cloud backup? You can export your local backup in Settings first.')))return;
   const w=remote.workspace;
   if(!w?.workspace||typeof w.workspace!=='object')throw Error('invalid_backup');
   // Never restore OAuth capability tokens, browser sessions or provider credentials.
   localStorage.setItem('viver-workspace-v1',JSON.stringify(c.normalise(w.workspace)));
   for(const [key,value] of [['viver-studio-v2',w.studio],['viver-creator-studio-v1',w.creator],['viver-smart-alerts-v1',w.alerts]])if(typeof value==='string'&&value.length<400000)localStorage.setItem(key,value);
   location.reload();
  }catch(e){speak(t('Не вдалося відновити: ','Restore failed: ')+e.message)}
  finally{busy=false}
 }
 async function restoreSession(){
  if(!token)return;
  try{const me=await api('/v1/auth/me');user=me.user;render();loadTeams()}
  catch(e){if(e.message==='authentication_required'){saveSession('');user=null} else error=t('Сервер VIVER ID наразі недоступний','VIVER ID server unavailable');render()}
 }
 function renderTeams(){
  const root=document.querySelector('#vs-teams-content');if(!root)return;
  if(!user){root.innerHTML='<h2>VIVER Teams</h2><p>'+t('Спочатку увійди у VIVER ID в Налаштуваннях.','Sign into VIVER ID in Settings first.')+'</p><button class="primary-button" type="button" data-vs-team-action="settings">'+t('До налаштувань','Open Settings')+'</button>';return}
  root.innerHTML='<p class="vs-muted">'+t('Окремі командні завдання. Ніхто з учасників не отримує доступу до твоїх Google-токенів чи приватного планера.','Shared team tasks only. Members never receive your Google tokens or private planner.')+'</p>'+
   '<div class="vs-team-head"><form class="vs-inline" id="vs-create-team"><input name="name" required maxlength="65" placeholder="'+t('Назва команди','Team name')+'"><button class="primary-button">'+t('Створити','Create')+'</button></form>'+
   '<form class="vs-inline" id="vs-join-team"><input name="code" required maxlength="43" placeholder="'+t('Код запрошення','Invite code')+'"><button class="secondary-button">'+t('Приєднатись','Join')+'</button></form></div>'+
   '<div class="vs-team-layout"><aside class="vs-team-list">'+(teamList.length?teamList.map(x=>'<button type="button" data-vs-team="'+esc(x.id)+'" class="'+(x.id===teamId?'active':'')+'"><strong>'+esc(x.name)+'</strong><small>'+esc(x.role)+'</small></button>').join(''):'<p>'+t('Команд ще немає','No teams yet')+'</p>')+'</aside>'+
   '<div class="vs-team-detail">'+(team?renderTeamDetail():'<p>'+t('Обери команду','Select a team')+'</p>')+'</div></div>';
 }
 function renderTeamDetail(){
  const m=team.team,members=team.members||[],tasks=team.tasks||[],canEdit=m.role!=='viewer';
  const statuses={todo:t('До роботи','To do'),doing:t('У роботі','In progress'),review:t('Перевірка','Review'),done:t('Готово','Done')};
  return '<div class="vs-title"><h2>'+esc(m.name)+'</h2><small>'+t('Твоя роль: ','Your role: ')+esc(m.role)+'</small></div>'+
   '<div class="vs-team-members">'+members.map(x=>'<span>'+esc(x.username)+' · '+esc(x.role)+'</span>').join('')+'</div>'+
   (m.role==='owner'?'<div class="vs-inline"><button class="secondary-button" data-vs-team-action="invite-editor">'+t('Запросити редактора','Invite editor')+'</button><button class="secondary-button" data-vs-team-action="invite-viewer">'+t('Запросити глядача','Invite viewer')+'</button></div>':'')+
   (invite?'<div class="vs-invite"><p>'+t('Одноразовий код (діє 3 дні):','One-use code (valid for 3 days):')+'</p><code id="vs-invite-code">'+esc(invite)+'</code><button type="button" class="secondary-button" data-vs-team-action="copy-invite">'+t('Копіювати','Copy')+'</button></div>':'')+
   (canEdit?'<form class="vs-inline vs-task-create" id="vs-create-task"><input name="title" required maxlength="140" placeholder="'+t('Нове завдання','New task')+'"><button class="primary-button">'+t('Додати','Add')+'</button></form>':'')+
   '<div class="vs-task-list">'+(tasks.length?tasks.map(x=>'<div class="vs-task"><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.description||'')+'</small></div><select data-vs-task="'+esc(x.id)+'" '+(canEdit?'':'disabled')+'>'+Object.entries(statuses).map(([key,label])=>'<option value="'+key+'" '+(x.status===key?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></div>').join(''):'<p class="vs-muted">'+t('Завдань поки немає','No tasks yet')+'</p>')+'</div>';
 }
 async function loadTeams(){
  if(!user)return renderTeams();
  try{const data=await api('/v1/teams');teamList=data.teams||[];if(!teamList.some(x=>x.id===teamId))teamId=teamList[0]?.id||'';if(teamId)await openTeam(teamId);else{team=null;renderTeams()}}
  catch(e){speak(t('Не вдалося завантажити команди: ','Could not load teams: ')+e.message)}
 }
 async function openTeam(id){teamId=id;invite='';team=await api('/v1/teams/'+encodeURIComponent(id));renderTeams()}
 page.addEventListener('click',async e=>{
  const item=e.target.closest('[data-vs-team]');if(item){try{await openTeam(item.dataset.vsTeam)}catch(ex){speak(ex.message)}return}
  const action=e.target.closest('[data-vs-team-action]')?.dataset.vsTeamAction;
  if(!action)return;
  if(action==='settings'){c.nav('settings');authBox.scrollIntoView({block:'center'});return}
  if(action==='copy-invite'){try{await navigator.clipboard.writeText(invite);speak(t('Код скопійовано','Code copied'))}catch{speak(t('Не вдалося скопіювати','Could not copy'))}return}
  if((action==='invite-editor'||action==='invite-viewer')&&team){
   try{const r=await api('/v1/teams/'+teamId+'/invites',{method:'POST',data:{role:action==='invite-editor'?'editor':'viewer'}});invite=r.code;renderTeams()}
   catch(ex){speak(ex.message)}
  }
 });
 page.addEventListener('submit',async e=>{
  const id=e.target.id;if(!['vs-create-team','vs-join-team','vs-create-task'].includes(id))return;e.preventDefault();
  try{
   if(id==='vs-create-team')await api('/v1/teams',{method:'POST',data:form(e.target)});
   if(id==='vs-join-team')await api('/v1/teams/join',{method:'POST',data:form(e.target)});
   if(id==='vs-create-task')await api('/v1/teams/'+teamId+'/tasks',{method:'POST',data:{...form(e.target),status:'todo'}});
   await loadTeams();
  }catch(ex){speak(ex.message)}
 });
 page.addEventListener('change',async e=>{
  const id=e.target.dataset.vsTask;if(!id||!team)return;
  const task=team.tasks.find(x=>x.id===id);if(!task)return;
  try{await api('/v1/teams/'+teamId+'/tasks/'+id,{method:'PATCH',data:{title:task.title,description:task.description,due:task.due,status:e.target.value}});await openTeam(teamId)}
  catch(ex){speak(ex.message);renderTeams()}
 });
 document.querySelector('#language')?.addEventListener('change',()=>{render();renderTeams()});
 window.VIVERId={getUser:()=>user,cloudSave,cloudRestore,refreshTeams:loadTeams};
 render();renderTeams();restoreSession();
})();
