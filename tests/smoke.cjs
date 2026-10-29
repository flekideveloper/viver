/* VIVER local-first integration smoke tests. Run with node tests/smoke.cjs. */
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const vm=require('node:vm');
(async()=>{
 const read=name=>readFileSync(resolve(__dirname,'..',name),'utf8');
 const html=read('index.html');
 const errors=[];
 const virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',e=>{if(!String(e).includes('Not implemented'))errors.push(String(e))});
 const dom=new JSDOM(html,{url:'https://flekideveloper.github.io/viver/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const {window}=dom;
 const $=s=>window.document.querySelector(s),$$=s=>[...window.document.querySelectorAll(s)];
 window.scrollTo=()=>{};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 window.HTMLElement.prototype.setPointerCapture=function(){};
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','')};
 window.HTMLDialogElement.prototype.close=function(){this.open=false;this.removeAttribute('open');this.dispatchEvent(new window.Event('close'))};
 window.confirm=()=>true;window.prompt=()=> 'Tests';
 window.URL.createObjectURL=()=> 'blob:mock';window.URL.revokeObjectURL=()=>{};
 window.addEventListener('error',e=>errors.push(e.message));
 const previous={
  version:1,theme:'dark',language:'uk',
  plans:[{id:'old-plan',title:'Existing video',date:'2026-11-02T18:00',platform:'youtube',status:'draft',notes:'Do not lose this'}],
  reminders:[{id:'old-reminder',title:'Existing reminder',due:'2026-11-03T12:00',priority:'normal',done:false,notified:false}],
  notes:[{id:'old-note',text:'My original sticky',color:'yellow',x:100,y:125,z:1}]
 };
 window.localStorage.setItem('viver-workspace-v1',JSON.stringify(previous));
 const context=dom.getInternalVMContext();
 vm.runInContext(read('app.js'),context,{filename:'app.js'});
 vm.runInContext(read('features.js'),context,{filename:'features.js'});
 window.fetch=async()=>({ok:true,json:async()=>({providers:{youtube:false,tiktok:false,twitch:false,x:false},connections:[]})});
 vm.runInContext(read('connections.js'),context,{filename:'connections.js'});
 await new Promise(r=>setTimeout(r,0));
 assert.equal(window.document.querySelectorAll('.account-link-row').length,4,'four honest OAuth service rows');
 assert(Array.from(window.document.querySelectorAll('[data-auth-provider]')).every(x=>x.disabled),'all connect buttons disabled until real credentials exist');
 const C=window.VIVERCore;
 assert(C&&window.VIVERExtras,'Both modules load');
 assert.equal(C.state.plans[0].title,'Existing video','old content preserved');
 assert.equal($('#account-icon'),null,'no fake sign-in button');
 assert.equal(C.state.plans[0].status,'draft','old status preserved');
 assert.equal(C.state.notes[0].text,'My original sticky','old notes preserved');
 assert.equal(C.state.reminders[0].title,'Existing reminder','old reminders preserved');
 assert.deepEqual(Array.from(C.state.plans[0].checks),[],'checklists default safely');
 assert.deepEqual(Array.from(C.state.analytics),[],'metrics default safely');
 const click=selector=>{const el=$(selector);assert(el,selector);el.click();return el};
 const change=(selector,value)=>{const el=$(selector);assert(el,selector);el.value=value;el.dispatchEvent(new window.Event('change',{bubbles:true}));return el};
 click('[data-page="settings"]');
 click('[data-theme-option="gray"]');
 assert.equal(C.state.theme,'gray','gray theme selected');
 assert.equal(window.document.documentElement.dataset.theme,'gray','gray theme applied instantly');
 assert.equal($('[data-theme-option="gray"]').getAttribute('aria-pressed'),'true','gray theme accessibility state');
 click('[data-theme-option="cosmic"]');
 assert.equal(C.state.theme,'cosmic','cosmic theme selected');
 assert.equal(JSON.parse(window.localStorage.getItem('viver-workspace-v1')).theme,'cosmic','cosmic preference saved');
 click('[data-page="calendar"]');
 assert.equal($('#page-calendar').classList.contains('active'),true,'calendar is its own page');
 assert($$('.calendar-cell').length>=28,'full month grid');
 click('#calendar-prev');click('#calendar-today');
 assert($('#calendar-selected-date').textContent.length>0,'calendar day agenda visible');
 const firstDay=$('.calendar-cell [data-calendar-select]').dataset.calendarSelect;
 click('[data-calendar-select="'+firstDay+'"]');
 assert($('#calendar-selected-date').textContent.length>0,'day selection works');
 click('#calendar-add-plan');
 assert.equal($('#plan-editor').hidden,false,'calendar opens editor');
 assert.equal($('#page-planner').classList.contains('active'),true,'calendar creates content via planner');
 assert($('#plan-date').value.startsWith(firstDay),'calendar prefills scheduled date');
 click('[data-page="calendar"]');
 // Navigate to the month of the old content plan.
 for(let i=0;i<24&&!$('[data-calendar-plan="old-plan"]');i++)click('#calendar-next');
 assert($('[data-calendar-plan="old-plan"]'),'existing scheduled content visible in separate calendar');
 const dragEvent=$('[data-calendar-plan="old-plan"]');
 const calendarTransfer={value:'',setData(k,v){this.value=v},getData(){return this.value},effectAllowed:'',dropEffect:''};
 const calendarStart=new window.Event('dragstart',{bubbles:true,cancelable:true});calendarStart.dataTransfer=calendarTransfer;dragEvent.dispatchEvent(calendarStart);
 const calendarDrop=new window.Event('drop',{bubbles:true,cancelable:true});calendarDrop.dataTransfer=calendarTransfer;
 const newDay=$('[data-calendar-day="2026-11-06"]');assert(newDay,'new date exists in calendar');newDay.dispatchEvent(calendarDrop);
 assert.equal(C.state.plans[0].date.slice(0,10),'2026-11-06','drag to change scheduled date');
 click('[data-page="planner"]');
 click('#plan-cancel');assert.equal($('#plan-editor').hidden,true,'form closes after cancel');
 click('[data-plan-mode="board"]');
 assert.equal($$('.kanban-column').length,6,'6-stage workflow');
 assert($$('.kanban-card').some(el=>el.textContent.includes('Existing video')),'legacy draft visible in workflow');
 // drag old draft into Recording
 const card=$('[data-kanban-plan="old-plan"]'),column=$('[data-kanban-column="record"]');
 const transfer={value:'',setData(k,v){this.value=v},getData(){return this.value},effectAllowed:'',dropEffect:''};
 const dragStart=new window.Event('dragstart',{bubbles:true,cancelable:true});dragStart.dataTransfer=transfer;card.dispatchEvent(dragStart);
 const drop=new window.Event('drop',{bubbles:true,cancelable:true});drop.dataTransfer=transfer;column.dispatchEvent(drop);
 assert.equal(C.state.plans[0].status,'record','kanban drop changes stage');
 click('[data-plan-mode="list"]');
 click('[data-check-open="old-plan"]');
 const taskForm=$('[data-check-form="old-plan"]');assert(taskForm,'checklist editor open');
 taskForm.elements.task.value='Make thumbnail';taskForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(C.state.plans[0].checks.length,1,'checklist task added');
 const check=$('[data-check-toggle="old-plan"]');check.checked=true;check.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(C.state.plans[0].checks[0].done,true,'checklist task completed');
 click('[data-page="reminders"]');
 assert.equal($('#reminder-editor').hidden,true,'reminder editor starts closed');
 click('#reminder-new-top');assert.equal($('#reminder-editor').hidden,false,'reminder editor opens');
 $('#reminder-title').value='Weekly check';$('#reminder-due').value='2026-11-04T12:00';
 change('#reminder-repeat','weekly');
 $('#reminder-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 const recurring=C.state.reminders.find(x=>x.title==='Weekly check');assert(recurring,'recurring reminder created');
 assert.equal(recurring.repeat,'weekly');assert.equal(recurring.anchorDay,4);
 const oldDue=recurring.due;
 click('[data-reminder-toggle="'+recurring.id+'"]');
 assert(recurring.due!==oldDue,'repeating reminder advances due date');
 assert.equal(recurring.done,false,'recurring reminder stays active');
 click('[data-page="calendar"]');
 for(let i=0;i<24&&!$('[data-calendar-day="2026-12-16"]');i++)click('#calendar-next');
 assert($('[data-calendar-day="2026-12-16"] [data-calendar-reminder="'+recurring.id+'"]'),'weekly reminders appear on future calendar dates');
 click('[data-calendar-select="2026-12-16"]');
 assert($('#calendar-day-items').textContent.includes('Weekly check'),'future occurrence appears in day agenda');

 click('[data-page="board"]');
 assert.equal(C.state.notes.length,1);
 click('#add-note');assert.equal(C.state.notes.length,2,'new note created');
 const note=C.state.notes[0];
 click('[data-note="'+note.id+'"] [data-note-menu]');
 assert.equal($('[data-menu-for="'+note.id+'"]').hidden,false,'sticky context menu opened');
 click('[data-action-id="'+note.id+'"][data-note-action="details"]');
 assert.equal($('#note-details-dialog').open,true,'note details dialog opened');
 $('#note-details-group').value='Tests';$('#note-details-link').value='https://example.com';
 $('#note-details-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(note.group,'Tests','sticky groups saved');
 change('#board-group-filter','Tests');
 click('#add-note');
 assert.equal(C.state.notes.at(-1).group,'Tests','new notes inherit current group');
 change('#board-group-filter','all');
 assert.equal(note.link,'https://example.com','sticky note HTTPS link saved');
 assert.equal($('#note-details-dialog').open,false,'details dialog closed');
 // Search and overview shortcuts must find specific records even when they are filtered out.
 click('[data-page="planner"]');
 change('#plan-filter','published');
 assert.equal($('[data-plan-edit="old-plan"]'),null,'filter hides existing draft');
 click('#search-open');
 $('#search-input').value='Existing video';
 $('#search-input').dispatchEvent(new window.Event('input',{bubbles:true}));
 click('[data-search-target="planner"]');
 assert.equal($('#plan-editor').hidden,false,'search opened plan editor');
 assert.equal($('#plan-title').value,'Existing video','search selected matching record');
 click('#plan-cancel');
 change('#plan-filter','published');
 click('[data-page="home"]');click('[data-home-plan="old-plan"]');
 assert.equal($('#plan-title').value,'Existing video','overview shortcut edits exact item');
 click('#plan-cancel');
 click('[data-page="reminders"]');
 click('#reminder-tabs [data-filter="done"]');
 click('#search-open');
 $('#search-input').value='Existing reminder';
 $('#search-input').dispatchEvent(new window.Event('input',{bubbles:true}));
 click('[data-search-target="reminders"]');
 assert.equal($('#reminder-editor').hidden,false,'search opens reminder even if filtered out');
 assert.equal($('#reminder-title').value,'Existing reminder','search targets exact reminder');
 click('#reminder-cancel');
 const csv='date,platform,views,followers,likes,comments,shares\n2026-10-20,youtube,100,10,4,1,0\n2026-10-21,youtube,200,12,8,2,1\n';
 const file=new window.File([csv],'report.csv',{type:'text/csv'});
 Object.defineProperty(file,'text',{value:async()=>csv});
 Object.defineProperty($('#report-import'),'files',{configurable:true,value:[file]});
 $('#report-import').dispatchEvent(new window.Event('change',{bubbles:true}));
 await new Promise(r=>setTimeout(r,50));
 assert.equal(C.state.analytics.length,2,'actual CSV metrics imported');
 assert.equal($$('.platform-row').length,0,'inactive social account rows removed');
 assert.equal($('.account-icon'),null,'fake account badge removed');
 assert($('#analytics-chart').textContent.includes('200'),'latest imported metric shown');
 // Real YouTube stats UI is shown only for linked account; never leaks token in page source.
 let connectedYouTube=false,youtubeApiCalls=0,overviewApiCalls=0,overviewFail=false;
 const youtubeFixture={
  channel:{id:'UCabcdefghijklmnopqrstuv',title:'My Creator Channel',description:'Test description',avatar:'https://example.com/pic.jpg',hiddenSubscribers:false},
  totals:{views:12345,subscribers:987,videos:12},
  recent:[{id:'AbCdEfGhIjK',title:'Latest upload',publishedAt:'2026-10-23T12:00:00Z',views:456,likes:23,url:'https://www.youtube.com/watch?v=AbCdEfGhIjK'}],
  history:[{date:'2026-10-27',views:12000,subscribers:980,videos:11},{date:'2026-10-28',views:12345,subscribers:987,videos:12}],
  updatedAt:Date.now()
 };
 const overviewFixture={
  channel:{id:'UCabcdefghijklmnopqrstuv',label:'My Creator Channel'},
  period:{start:'2026-10-21',end:'2026-10-27',comparisonStart:'2026-10-14',comparisonEnd:'2026-10-20',comparisonAvailable:true},
  current:{views:1400,subscribersGained:21,subscribersLost:7,netSubscribers:14,likes:77,comments:21,shares:7,estimatedMinutesWatched:4200},
  previous:{views:700,subscribersGained:14,subscribersLost:7,netSubscribers:7},
  growth:{views:100,subscribersGained:50},
  daily:[{date:'2026-10-21',views:100},{date:'2026-10-22',views:200},{date:'2026-10-23',views:100},{date:'2026-10-24',views:250},{date:'2026-10-25',views:250},{date:'2026-10-26',views:250},{date:'2026-10-27',views:250}],
  traffic:[{type:'YT_SEARCH',views:450},{type:'SHORTS',views:350}],searchTerms:[{term:'editing tutorial',views:200}],
  devices:[{type:'MOBILE',views:900}],countries:[{code:'UA',views:800}],updatedAt:Date.now()
 };
 window.fetch=async url=>{
  if(String(url).endsWith('/connections'))return {ok:true,json:async()=>({providers:{youtube:true,tiktok:false,twitch:false,x:false},connections:connectedYouTube?[{provider:'youtube',connected:true,label:'My Creator Channel'}]:[]})};
  if(String(url).endsWith('/youtube/stats')){youtubeApiCalls++;return {ok:true,json:async()=>youtubeFixture}}
  if(String(url).endsWith('/youtube/analytics')){overviewApiCalls++;return overviewFail?{ok:false,status:403,json:async()=>({error:'youtube_analytics_permission'})}:{ok:true,json:async()=>overviewFixture}}
  throw Error('Unexpected API path '+url);
 };
 vm.runInContext(read('youtube.js'),context,{filename:'youtube.js'});
 vm.runInContext(read('overview-analytics.js'),context,{filename:'overview-analytics.js'});
 click('[data-page="platforms"]');
 await window.VIVERConnections.refresh();
 await new Promise(r=>setTimeout(r,15));
 assert.equal($('#youtube-live-panel').hidden,true,'YouTube panels remain hidden without an authorized account');
 assert.equal(youtubeApiCalls,0,'never fetch YouTube statistics without connection');
 assert.equal(overviewApiCalls,0,'never fetch YouTube Analytics without connection');
 assert($('#page-youtube'),'YouTube has its own independent page');
 assert(!$('#page-home').contains($('#creator-overview')),'full YouTube charts are not cluttering homepage');
 assert(!$('#page-platforms').contains($('#youtube-live-panel')),'Connections page is for account linking only');
 connectedYouTube=true;
 await window.VIVERConnections.refresh();
 window.VIVERCore.nav('youtube');window.VIVERYoutube.update();window.VIVEROverviewAnalytics.sync();
 await new Promise(r=>setTimeout(r,65));
 assert($('#page-youtube').classList.contains('active'),'authorized YouTube full page opens');
 assert.equal($('#youtube-live-panel').hidden,false,'connected YouTube stats visible on its own page');
 assert($('#youtube-live-metrics').textContent.includes('12'),'real channel video count displayed');
 assert($('#youtube-live-metrics').textContent.includes('987'),'real channel subscribers displayed');
 assert($('#youtube-channel-profile').textContent.includes('My Creator Channel'),'YouTube channel identity displayed');
 assert($('#youtube-latest').textContent.includes('Latest upload'),'latest public uploads displayed');
 assert.equal($('#youtube-history').hidden,false,'genuine snapshot history shown');
 assert.equal(youtubeApiCalls,1,'channel totals fetched on entry');
 assert($('#creator-overview-content').textContent.replace(/[\s\u00a0\u202f,]/g,'').includes('1400'),'weekly YouTube views belong to its page');
 assert($('#creator-overview-content').textContent.includes('+100%'),'view growth shown on YouTube page');
 assert($('#creator-overview-content').textContent.includes('+50%'),'subscriber gains growth shown on YouTube page');
 assert($('#creator-overview-content').textContent.includes('editing tutorial'),'traffic source discovery moved with YouTube');
 assert.equal(overviewApiCalls,1,'YouTube Analytics called once on page entry');
 click('#youtube-refresh');await new Promise(r=>setTimeout(r,15));
 assert.equal(youtubeApiCalls,2,'refresh reuses server cache');
 connectedYouTube=false;
 await window.VIVERConnections.refresh();
 window.VIVERCore.nav('platforms');window.VIVERYoutube.update();window.VIVEROverviewAnalytics.sync();
 assert.equal($('#youtube-live-panel').hidden,true,'disconnect hides private YouTube statistics');
 assert(!$('#creator-overview-content').textContent.includes('editing tutorial'),'disconnect clears private growth data');
 connectedYouTube=true;overviewFail=true;
 await window.VIVERConnections.refresh();
 window.VIVERCore.nav('youtube');window.VIVEROverviewAnalytics.sync();
 await new Promise(r=>setTimeout(r,65));
 assert($('#creator-overview-content').textContent.includes('дозвіл Google'),'missing analytics permission is explained');
 assert($('#creator-overview-content').querySelector('[data-creator-reauthorize]'),'scope reauthorization button remains available');
 const saved=JSON.parse(window.localStorage.getItem('viver-workspace-v1'));
 assert.equal(saved.plans[0].checks[0].text,'Make thumbnail','checklist persisted');
 assert.equal(saved.reminders.find(x=>x.id===recurring.id).repeat,'weekly','recurrence persisted');
 assert.equal(saved.notes[0].group,'Tests','group persisted');
 assert.equal(saved.analytics.length,2,'reports persisted');
 assert.equal(errors.length,0,'No uncaught app errors: '+errors.join('; '));
 window.close();
 console.log('VIVER smoke tests: PASS — preserved data, gray/cosmic themes, standalone calendar with scheduling, workflow, checklists, recurrence, whiteboard, CSV analytics and persistence');
})().catch(err=>{console.error(err);process.exit(1)});
