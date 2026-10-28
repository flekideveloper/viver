/* Connected-only social tabs and real-provider data, DOM-only test with fake HTTP. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://flekideveloper.github.io/viver/#platforms',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
const w=dom.window,doc=w.document,$=q=>doc.querySelector(q);
let providers=[],requests=[],saves=0,page='platforms';
const plans=[{id:'plan-tiktok',title:'New TikTok',platform:'tiktok',status:'ready',date:'2026-10-27T18:00',notes:''}];
const fixture=p=>({
 provider:p,account:{id:'id-'+p,label:p+' Creator',avatar:'',url:p==='twitch'?'https://www.twitch.tv/creator':p==='tiktok'?'https://www.tiktok.com/@creator':'https://x.com/creator'},
 metrics:p==='twitch'?{followers:126,liveViewers:19}:p==='tiktok'?{followers:404,likes:1900,videoCount:10}:{followers:83,posts:21},
 live:p==='twitch'?{online:true,title:'Gaming stream',viewers:19,game:'Fortnite'}:undefined,
 content:[
 {id:'one-'+p,title:p==='tiktok'?'New TikTok':'First post',publishedAt:'2026-10-27T18:00:00Z',views:123,likes:5,comments:2,url:p==='twitch'?'https://www.twitch.tv/videos/123':p==='tiktok'?'https://www.tiktok.com/@creator/video/123':'https://x.com/creator/status/123'},
 {id:'two-'+p,title:'Second post',publishedAt:'2026-10-26T18:00:00Z',views:90,likes:3,comments:1}],
 history:[{date:'2026-10-21',metrics:{followers:90}},{date:'2026-10-28',metrics:{followers:p==='twitch'?126:p==='tiktok'?404:83}}],
 updatedAt:Date.now()
});
w.VIVERConnections={
 getConnections:()=>providers.map(provider=>({provider,label:provider+' Creator',connected:true})),
 getStatus:()=> 'ready',request:async route=>{requests.push(route);const p=route.match(/^\/social\/(twitch|tiktok|x)\/overview$/)?.[1];if(!p)throw Error(route);return fixture(p)},
 start:()=>{},refresh:()=>{}
};
w.VIVERCore={
 get page(){return page},state:{plans},uid:()=>Math.random().toString(36).slice(2),
 save:()=>{saves++;return true},renderHome:()=>{},renderPlans:()=>{},
 nav:x=>{page=x},toast:()=>{}
};
const ctx=dom.getInternalVMContext(),code=fs.readFileSync(path.join(__dirname,'../platform-hub.js'),'utf8');
vm.runInContext(code,ctx,{filename:'platform-hub.js'});
const flush=()=>new Promise(r=>setTimeout(r,40));
const update=()=>w.dispatchEvent(new w.Event('viver-connections-updated'));
const click=selector=>{assert($(selector),selector);$(selector).click()};
(async()=>{
 assert($('#connected-platform-hub').hidden,'tabs not present when nobody connected');
 assert.equal($('[data-platform-select="youtube"]'),null);
 assert($('#social-studio-panel').hidden,'private social view hidden when disconnected');
 assert.equal(requests.length,0,'no API calls without connection');
 providers=['youtube'];update();await flush();
 assert(!$('[data-platform-select="twitch"]'),'not-yet-linked Twitch is absent');
 assert($('[data-platform-select="youtube"]'),'linked YouTube appears');
 assert($('#social-studio-panel').hidden,'YouTube shows its dedicated existing studio');
 providers=['youtube','twitch'];update();await flush();
 assert($('[data-platform-select="twitch"]'),'Twitch tab appears only after linking');
 assert(!$('[data-platform-select="tiktok"]'),'TikTok hidden until connected');
 click('[data-platform-select="twitch"]');await flush();
 assert.equal(requests.at(-1),'/social/twitch/overview');
 assert($('#social-studio-content').textContent.includes('126'),'real Twitch follower count shown');
 assert($('#social-studio-content').textContent.includes('LIVE'),'Twitch live badge shown');
 click('[data-social-inner="content"]');
 assert($('#social-studio-content').textContent.includes('First post'),'Twitch VOD or clip displayed');
 click('[data-social-inner="goals"]');
 assert($('#social-goal-form'),'goal editor available');
 $('#social-goal-form [name="metric"]').value='followers';
 $('#social-goal-form [name="target"]').value='120';
 $('#social-goal-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert($('#social-studio-content').textContent.includes('126'),'goal progress uses API follower count');
 click('[data-social-inner="alerts"]');
 assert($('#social-studio-content').textContent.includes('Ціль виконано'),'milestone notification is real');
 click('[data-social-inner="compare"]');
 const form=$('#social-compare-form');
 form.elements.a.value='one-twitch';form.elements.b.value='two-twitch';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert($('#social-studio-content').textContent.includes('123'),'compares real public counters without inventing weekly views');
 providers=['youtube','twitch','tiktok'];update();await flush();
 assert($('[data-platform-select="tiktok"]'),'TikTok appears after connection');
 click('[data-platform-select="tiktok"]');await flush();
 assert($('#social-studio-content').textContent.includes('404'),'TikTok real follower metric shown');
 assert.equal(plans[0].status,'published','exact match TikTok published video synchronizes planner');
 assert(saves>0,'planner sync saved locally');
 providers=['youtube','twitch','tiktok','x'];update();await flush();
 click('[data-platform-select="x"]');await flush();
 assert($('#social-studio-content').textContent.includes('83'),'X real public profile metrics shown');
 providers=['youtube'];update();await flush();
 assert.equal($('[data-platform-select="x"]'),null,'X tab disappears on disconnect');
 assert.equal($('[data-platform-select="tiktok"]'),null,'TikTok tab disappears on disconnect');
 assert($('#social-studio-panel').hidden,'private social panel hidden after disconnect');
 assert(!$('#connected-platform-tabs').textContent.includes('Twitch'),'Twitch tab gone');
 providers=[];update();await flush();
 assert($('#connected-platform-hub').hidden,'all platform tabs hidden when none connected');
 w.close();
 console.log('VIVER platform-hub tests: PASS — connected-only tabs, Twitch live, TikTok planner, X metrics, goals, alerts, compare and disconnect');
})().catch(e=>{console.error(e);process.exit(1)});
