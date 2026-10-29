/* Verify protected workspace routes, session restoration, guest analytics and data retention. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
(async()=>{
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>{if(!String(e).includes('Not implemented'))errors.push(String(e))});
 const dom=new JSDOM(read('index.html'),{url:'https://flekideveloper.github.io/viver/#calendar',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,$=s=>w.document.querySelector(s);
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 const existing={
  version:1,theme:'dark',language:'uk',
  plans:[{id:'private-plan',title:'PRIVATE SECRET VIDEO',date:'2026-11-11T18:00',platform:'youtube',status:'idea',notes:'Keep private',checks:[]}],
  reminders:[{id:'public-reminder',title:'Remind me',due:'2026-11-10T10:00',priority:'normal',done:false}],
  notes:[{id:'private-note',text:'PRIVATE SECRET IDEA',x:120,y:125,z:1,color:'yellow'}],analytics:[]
 };
 w.localStorage.setItem('viver-workspace-v1',JSON.stringify(existing));
 w.localStorage.setItem('viver-id-session-v1','T'.repeat(43));
 const ctx=dom.getInternalVMContext();
 vm.runInContext(read('app.js'),ctx,{filename:'app.js'});
 vm.runInContext(read('features.js'),ctx,{filename:'features.js'});
 const c=w.VIVERCore;
 assert.equal(c.page,'settings','protected deep link redirects to ID sign-in until session verified');
 assert.equal($('#plan-list').textContent.includes('PRIVATE SECRET VIDEO'),false,'guest planner DOM cleared');
 assert.equal($('#notes-layer').textContent.includes('PRIVATE SECRET IDEA'),false,'guest board DOM cleared');
 assert.equal($('#calendar-content').textContent.includes('PRIVATE SECRET VIDEO'),false,'guest calendar DOM cleared');
 assert.equal($('#home-plans').textContent.includes('PRIVATE SECRET VIDEO'),false,'guest home private content hidden');
 assert.equal($('#stat-notes').textContent,'—','guest note count hidden');
 assert.equal(c.nav('platforms'),true,'connections remain public');
 assert.equal(c.nav('reminders'),true,'reminders remain public');
 // Restore the original protected deep link before attaching the ID session module.
 assert.equal(c.nav('calendar'),false);
 let releaseAuth;
 const reply=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 w.fetch=async(url,opt={})=>{
  const route=new URL(url).pathname;
  if(route==='/v1/auth/me')return new Promise(resolve=>{releaseAuth=resolve});
  if(route==='/v1/teams')return reply({teams:[]});
  if(route==='/v1/auth/logout'&&opt.method==='POST')return reply({ok:true});
  throw Error('Unexpected request '+route);
 };
 vm.runInContext(read('viver-space.js'),ctx,{filename:'viver-space.js'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(typeof releaseAuth,'function','existing session verification sent to backend');
 assert.equal(c.page,'settings','not unlocked until server validates session');
 releaseAuth(reply({user:{id:'verified',username:'creator'}}));
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.equal(c.page,'calendar','verified session restores requested Calendar');
 for(let i=0;i<24&&!$('#calendar-content').textContent.includes('PRIVATE SECRET VIDEO');i++)$('#calendar-next').click();
 assert($('#calendar-content').textContent.includes('PRIVATE SECRET VIDEO'),'Calendar data returned after verification');
 assert.equal(c.nav('board'),true,'verified user opens Idea Board');
 assert($('#notes-layer').textContent.includes('PRIVATE SECRET IDEA'),'Idea Board data visible only after verification');
 assert.equal(c.nav('planner'),true,'verified user opens Planner');
 assert($('#plan-list').textContent.includes('PRIVATE SECRET VIDEO'),'Planner data visible after verification');
 c.nav('settings');
 $('#viver-id-card [data-vs-action="logout"]').click();
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.equal(c.hasViverId(),false,'sign-out clears verified ID');
 assert.equal(c.nav('planner'),false,'guest cannot reopen Planner');
 assert.equal(c.nav('calendar'),false,'guest cannot reopen Calendar');
 assert.equal(c.nav('board'),false,'guest cannot reopen Idea Board');
 assert.equal(c.nav('teams'),false,'guest cannot reopen Teams');
 assert(!$('#plan-list').textContent.includes('PRIVATE SECRET VIDEO'),'private planner DOM removed after sign-out');
 assert(!$('#notes-layer').textContent.includes('PRIVATE SECRET IDEA'),'private board DOM removed after sign-out');
 assert(!$('#home-plans').textContent.includes('PRIVATE SECRET VIDEO'),'home hides private plan after logout');
 $('#search-input').value='PRIVATE SECRET';
 $('#search-input').dispatchEvent(new w.Event('input',{bubbles:true}));
 assert(!$('#search-results').textContent.includes('PRIVATE SECRET'),'guest search hides private content');
 // Global reset remains usable to clear public data, but must preserve locked workspace.
 c.nav('settings');$('#reset').click();
 assert.equal(c.state.plans[0]?.title,'PRIVATE SECRET VIDEO','guest reset retains private plans');
 assert.equal(c.state.notes[0]?.text,'PRIVATE SECRET IDEA','guest reset retains private idea board');
 assert.equal(c.nav('platforms'),true,'social integrations still available without VIVER ID');
 assert.equal(c.nav('reminders'),true,'reminders still available without VIVER ID');
 assert.equal(errors.length,0,'no browser errors: '+errors.join(','));
 dom.window.close();
 console.log('VIVER ID access: PASS — protected deep links, verified session restoration, guest analytics, logout, backup-safe reset');
})().catch(error=>{console.error(error);process.exit(1)});
