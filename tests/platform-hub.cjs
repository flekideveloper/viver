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
 assert($('#sidebar-social').hidden,'social sidebar group hidden when no accounts connected');
 assert.equal($('[data-page="youtube"]'),null,'YouTube sidebar is not created before OAuth');
 assert($('#social-studio-panel').hidden,'private creator panel stays hidden before OAuth');
 assert.equal(requests.length,0,'never fetch social stats without connection');
 assert(!$('#page-platforms').contains($('#social-studio-panel')),'Connections no longer contains full analytics');
 assert($('#page-youtube').contains($('#studio-panel')),'YouTube has its own complete page');
 providers=['youtube'];update();await flush();
 assert(!$('#sidebar-social').hidden,'sidebar social group appears after first connection');
 assert($('[data-page="youtube"]'),'connected YouTube sidebar button appears');
 assert.equal($('[data-page="twitch"]'),null,'unconnected Twitch is hidden in sidebar');
 assert($('#social-studio-panel').hidden,'YouTube retains its own private studio page');
 click('#social-sidebar-nav [data-page="youtube"]');await flush();
 assert.equal(page,'youtube','YouTube sidebar opens the dedicated full page');
 assert.equal(requests.length,0,'YouTube sidebar does not call other providers');
 providers=['youtube','twitch'];update();await flush();
 assert($('#social-sidebar-nav [data-page="twitch"]'),'Twitch sidebar appears after login');
 assert(!$('#social-sidebar-nav [data-page="tiktok"]'),'TikTok still hidden');
 click('#social-sidebar-nav [data-page="twitch"]');await flush();
 assert.equal(page,'twitch','Twitch sidebar navigates to independent page');
 assert($('#page-twitch').contains($('#social-studio-panel')),'Twitch analytic tools mount only in Twitch page');
 assert.equal(requests.at(-1),'/social/twitch/overview');
 assert($('#social-studio-content').textContent.includes('126'),'Twitch official follower count displayed');
 assert($('#social-studio-content').textContent.includes('LIVE'),'Twitch live stream status displayed');
 click('[data-social-inner="content"]');
 assert($('#social-studio-content').textContent.includes('First post'),'Twitch content loads');
 click('[data-social-inner="goals"]');
 assert($('#social-goal-form'),'Twitch goals retain interactive editor');
 $('#social-goal-form [name="metric"]').value='followers';
 $('#social-goal-form [name="target"]').value='120';
 $('#social-goal-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert($('#social-studio-content').textContent.includes('126'),'Twitch milestone uses official data');
 click('[data-social-inner="alerts"]');
 assert($('#social-studio-content').textContent.includes('Ціль виконано'),'goal notification works');
 click('[data-social-inner="compare"]');
 const form=$('#social-compare-form');
 form.elements.a.value='one-twitch';form.elements.b.value='two-twitch';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert($('#social-studio-content').textContent.includes('123'),'Twitch comparison shows official counters');
 providers=['youtube','twitch','tiktok'];update();await flush();
 assert($('#social-sidebar-nav [data-page="tiktok"]'),'TikTok button added only when connected');
 click('#social-sidebar-nav [data-page="tiktok"]');await flush();
 assert.equal(page,'tiktok','TikTok dedicated page opened from left nav');
 assert($('#page-tiktok').contains($('#social-studio-panel')),'TikTok analytics physically on TikTok page');
 assert($('#social-studio-content').textContent.includes('404'),'TikTok account follower count shown');
 assert.equal(plans[0].status,'published','TikTok posted video linked to matching plan');
 assert(saves>0,'TikTok planning sync persists');
 providers=['youtube','twitch','tiktok','x'];update();await flush();
 click('#social-sidebar-nav [data-page="x"]');await flush();
 assert.equal(page,'x','X dedicated page opened from left nav');
 assert($('#page-x').contains($('#social-studio-panel')),'X analytics mount on X page');
 assert($('#social-studio-content').textContent.includes('83'),'X official public metrics shown');
 providers=['youtube'];update();await flush();
 assert.equal($('#social-sidebar-nav [data-page="x"]'),null,'X sidebar disappears on disconnect');
 assert.equal($('#social-sidebar-nav [data-page="tiktok"]'),null,'TikTok sidebar disappears on disconnect');
 assert.equal($('#social-sidebar-nav [data-page="twitch"]'),null,'Twitch sidebar disappears on disconnect');
 assert($('#social-studio-panel').hidden,'social analytics hidden after disconnect');
 assert.equal(page,'platforms','disconnect on active network returns to Connections manager');
 providers=[];update();await flush();
 assert($('#sidebar-social').hidden,'social sidebar disappears when every account disconnected');
 assert.equal(requests.length,3,'no extra social stats requested after unlinks');
 w.close();
 console.log('VIVER sidebar social pages: PASS — dynamic OAuth-only left nav, distinct YouTube/TikTok/Twitch/X pages, full tools, privacy and disconnect');
})().catch(e=>{console.error(e);process.exit(1)});
