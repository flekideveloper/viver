/* Creator Studio DOM coverage — uses synthetic authorized API responses, never real credentials. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://flekideveloper.github.io/viver/#platforms',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
const {window}=dom,doc=window.document,$=q=>doc.querySelector(q),click=q=>{assert($(q),'Missing '+q);$(q).click()};
const plans=[{id:'planned',title:'Exact video title',date:'2026-10-20T16:00',status:'ready',platform:'youtube',notes:'',checks:[]}];
let saves=0,connected=false,channelCalls=0,videoCalls=0,retentionCalls=0,comparisonCalls=0,page='platforms';
const data={
 channelId:'UCabcdefghijklmnopqrstuv',
 videos:[
  {id:'AbCdEfGhIjK',title:'Exact video title',publishedAt:'2026-10-15T12:00:00Z',views:1200,likes:120,comments:12,thumbnail:'https://example.com/thumb.jpg',url:'https://www.youtube.com/watch?v=AbCdEfGhIjK',week:{views:450,likes:33,comments:4,subscribersGained:8,avgViewSeconds:65}},
  {id:'LmNoPqRsTuV',title:'Second video',publishedAt:'2026-10-12T12:00:00Z',views:800,likes:70,comments:5,thumbnail:'',url:'https://www.youtube.com/watch?v=LmNoPqRsTuV',week:{views:300,subscribersGained:4,avgViewSeconds:45}}
 ],
 updatedAt:Date.now()
};
const totals={totals:{subscribers:987,views:15000,videos:12}};
const compare={videos:[{id:data.videos[0].id,title:data.videos[0].title,period:{start:'2026-10-15',end:'2026-10-21',days:7,complete:true},report:{views:500,likes:40,comments:6,subscribersGained:8,watchMinutes:400,avgViewSeconds:60}},
{id:data.videos[1].id,title:data.videos[1].title,period:{start:'2026-10-12',end:'2026-10-18',days:7,complete:true},report:{views:300,likes:20,comments:2,subscribersGained:5,watchMinutes:200,avgViewSeconds:50}}],comparable:true};
const auth={
 getConnections:()=>connected?[{provider:'youtube',connected:true,label:'Creator Test'}]:[],
 getStatus:()=>connected?'ready':'ready',
 request:async url=>{
  if(url==='/youtube/videos'){videoCalls++;return {...data,videos:data.videos.slice(0,1),nextPageToken:'NEXT_PAGE'}}
  if(url==='/youtube/videos?cursor=NEXT_PAGE'){videoCalls++;return {channelId:data.channelId,videos:data.videos.slice(1),nextPageToken:null}}
  if(url==='/youtube/stats'){channelCalls++;return totals}
  if(url.endsWith('/retention')){retentionCalls++;return {id:data.videos[0].id,points:[{position:0,ratio:0.9},{position:0.5,ratio:0.6},{position:1,ratio:0.3}]}}
  if(url.includes('/compare?')){comparisonCalls++;return compare}
  throw Error('Unexpected request '+url);
 }
};
window.VIVERConnections=auth;
window.VIVERCore={
 state:{plans,language:'uk'},
 get page(){return page},
 uid:()=>Math.random().toString(36).slice(2),
 save:()=>{saves++;return true},
 renderHome:()=>{},
 renderPlans:()=>{},
 nav:next=>{page=next;window.location.hash='#'+next},
 toast:()=>{}
};
const ctx=dom.getInternalVMContext();
vm.runInContext(fs.readFileSync(path.join(__dirname,'../creator-studio.js'),'utf8'),ctx,{filename:'creator-studio.js'});
const flush=()=>new Promise(resolve=>setTimeout(resolve,25));
(async()=>{
 assert($('#studio-panel').hidden,'studio stays hidden when not connected');
 assert.equal(videoCalls,0,'unconnected account is never queried');
 connected=true;window.dispatchEvent(new window.Event('viver-connections-updated'));await flush();
 assert.equal(videoCalls,1,'connected channel loads once');
 assert.equal(channelCalls,1,'real channel totals queried for goals');
 assert(!$('#studio-panel').hidden,'real user can open studio');
 assert.equal(plans[0].status,'published','exactly matching uploaded video marks plan published');
 assert(saves>0,'planner update persisted');
 assert($('#studio-body').textContent.includes('Exact video title'),'video title displayed');
 click('[data-studio-video="AbCdEfGhIjK"]');
 assert($('#studio-body').textContent.includes('450'),'video has real weekly data');
 click('[data-studio-retention="AbCdEfGhIjK"]');await flush();
 assert.equal(retentionCalls,1,'retention called for user-selected video only');
 assert($('#studio-body svg[aria-label="Audience retention"]'),'retention chart rendered from real points');
 click('[data-studio-more]');await flush();
 assert.equal(videoCalls,2,'second page of older videos loaded only on demand');
 assert($('#studio-body').textContent.includes('Second video'),'older video visible after pagination');
 click('[data-studio-tab="planner"]');
 assert($('#studio-body').textContent.includes('Пов’язано'),'planner linkage visible');
 click('[data-studio-tab="goals"]');
 assert($('#studio-goal-form'),'goals editor exists');
 $('#studio-goal-form [name="type"]').value='subscribers';
 $('#studio-goal-form [name="target"]').value='900';
 $('#studio-goal-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 assert($('#studio-body').textContent.includes('987'),'goal progress based on authorized channel count');
 click('[data-studio-tab="alerts"]');
 assert($('#studio-body').textContent.includes('Ціль досягнута'),'milestone alert created');
 click('[data-studio-read]');
 assert(!$('#studio-alert-count')||$('#studio-alert-count').hidden,'mark read removes unread indicator');
 click('[data-studio-tab="compare"]');
 const form=$('#studio-compare-form');form.elements.a.value=data.videos[0].id;form.elements.b.value=data.videos[1].id;
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await flush();
 assert.equal(comparisonCalls,1,'comparison goes through authorized analytics endpoint');
 assert($('#studio-body').textContent.includes('500'),'first-week views presented');
 assert($('#studio-body').textContent.includes('повні перші 7'),'clearly indicates complete seven-day comparison');
 connected=false;window.dispatchEvent(new window.Event('viver-connections-updated'));
 assert($('#studio-panel').hidden,'disconnect immediately hides private video analytics');
 assert($('#creator-home-tools').hidden,'disconnect hides goal/alert strip');
 assert.equal(videoCalls,2,'no extra data fetch after disconnect');
 window.close();
 console.log('VIVER Creator Studio tests: PASS — owner video list, retention, planner sync, goals, notices, 7-day comparisons, disconnect');
})().catch(e=>{console.error(e);process.exit(1)});
