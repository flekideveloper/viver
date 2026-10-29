/* VIVER 3-channel browser controls: simulated API; no real user secrets. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://flekideveloper.github.io/viver/#youtube',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,$=q=>w.document.querySelector(q);
const ids=['UC'+'A'.repeat(22),'UC'+'B'.repeat(22),'UC'+'C'.repeat(22)];
let channels=[{id:ids[0],label:'Channel A',avatar:'',expired:false}],active=ids[0],selected=0,deleted=0,started=0;
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
w.fetch=async(url,options={})=>{
 const route=String(url).split('workers.dev')[1]||'';
 if(route==='/connections')return response({providers:{youtube:true,tiktok:false,twitch:false,x:false},
  connections:channels.length?[{provider:'youtube',label:channels.find(x=>x.id===active)?.label,connected:true}]:[],
  youtubeChannels:channels,activeYoutubeChannel:active,maxYoutubeChannels:3});
 if(route==='/youtube/channels/select'){
  selected++;const body=JSON.parse(options.body);
  if(!channels.some(x=>x.id===body.channelId))return response({error:'youtube_channel_not_connected'},404);
  active=body.channelId;return response({ok:true,activeChannelId:active});
 }
 if(route.startsWith('/youtube/channels/')&&options.method==='DELETE'){
  deleted++;channels=channels.filter(c=>c.id!==route.split('/').at(-1));
  if(!channels.some(c=>c.id===active))active=channels[0]?.id||null;
  return response({ok:true,activeChannelId:active});
 }
 if(route==='/auth/start/youtube')return response({url:'https://accounts.google.com/o/oauth2/v2/auth?client_id=test'});
 return response({error:'unmocked'},404);
};
w.confirm=()=>true;
w.localStorage.setItem('viver-connect-key-v1','V'.repeat(43));
w.crypto=w.crypto||require('node:crypto').webcrypto;
w.open=()=>{started++;return {closed:true}};
w.setInterval=()=>0;
const context=dom.getInternalVMContext();
vm.runInContext(fs.readFileSync(path.join(__dirname,'../connections.js'),'utf8'),context,{filename:'connections.js'});
const flush=()=>new Promise(r=>setTimeout(r,55));
(async()=>{
 await flush();
 assert.equal($('#youtube-accounts-switcher').hidden,false);
 assert.equal($('[data-youtube-select]').dataset.youtubeSelect,ids[0]);
 assert.equal($('#youtube-add-channel').hidden,false);
 assert($('#viver-accounts').textContent.includes('1/3'));
 channels=[...channels,{id:ids[1],label:'Channel B',avatar:'',expired:false},{id:ids[2],label:'Channel C',avatar:'',expired:false}];
 await w.VIVERConnections.refresh();
 assert.equal($('#youtube-add-channel').hidden,true,'hide Add after 3');
 assert.equal($('#youtube-channel-options').querySelectorAll('[data-youtube-select]').length,3,'3 channels displayed');
 let changeCount=0;w.addEventListener('viver-youtube-channel-switched',()=>changeCount++);
 $('[data-youtube-select="'+ids[1]+'"]').click();await flush();
 assert.equal(active,ids[1],'switch chooses specific connected channel');
 assert.equal(changeCount,1,'switch emits one change event after server confirms');
 assert($('#youtube-channel-options').textContent.includes('Активний канал'));
 $('[data-youtube-remove="'+ids[1]+'"]').click();await flush();
 assert.equal(deleted,1,'unlink exactly one channel');
 assert.equal(channels.length,2,'other channels retained');
 assert.equal(active,ids[0],'another channel becomes active after removal');
 assert.equal($('#youtube-add-channel').hidden,false,'Add returns after slot is freed');
 $('#youtube-add-channel').click();await flush();
 assert.equal(started,1,'add button opens real Google OAuth');
 w.close();
 console.log('VIVER YouTube 3-channel UI: PASS — display, select, add, limit, remove individual channel, notifications');
})().catch(e=>{console.error(e);process.exit(1)});
