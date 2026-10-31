/* TikTok 3-account UI: add, select, per-account unlink, clear, no stale views. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://flekideveloper.github.io/viver/#tiktok',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,$=q=>w.document.querySelector(q);
let accounts=[{id:'tiktok_A',label:'Creator A',avatar:'',expired:false}],active='tiktok_A',swaps=0,removed=0,started=0;
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
w.fetch=async(url,opts={})=>{
 const route=String(url).split('workers.dev')[1]||'';
 if(route==='/connections')return response({providers:{youtube:false,tiktok:true,twitch:false,x:false},
  connections:accounts.length?[{provider:'tiktok',id:active,label:accounts.find(x=>x.id===active)?.label,connected:true}]:[],
  youtubeChannels:[],activeYoutubeChannel:null,maxYoutubeChannels:3,
  tiktokAccounts:accounts,activeTikTokAccount:active,maxTikTokAccounts:3});
 if(route==='/tiktok/accounts/select'){
  swaps++;const id=JSON.parse(opts.body).accountId;
  if(!accounts.some(x=>x.id===id))return response({error:'tiktok_account_not_connected'},404);
  active=id;return response({ok:true,activeTikTokAccount:active});
 }
 if(route.startsWith('/tiktok/accounts/')&&opts.method==='DELETE'){
  removed++;const id=decodeURIComponent(route.split('/').at(-1));
  accounts=accounts.filter(x=>x.id!==id);if(!accounts.some(x=>x.id===active))active=accounts[0]?.id||null;
  return response({ok:true,activeTikTokAccount:active});
 }
 if(route==='/auth/start/tiktok')return response({url:'https://www.tiktok.com/v2/auth/authorize/?client_key=test'});
 if(route==='/connections/tiktok'&&opts.method==='DELETE'){accounts=[];active=null;return response({ok:true})}
 return response({error:'unmocked'},404);
};
w.confirm=()=>true;w.localStorage.setItem('viver-connect-key-v1','V'.repeat(43));
w.open=()=>{started++;return {closed:true}};
w.setInterval=()=>0;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../connections.js'),'utf8'),dom.getInternalVMContext(),{filename:'connections.js'});
const flush=()=>new Promise(r=>setTimeout(r,55));
(async()=>{
 await flush();
 assert.equal($('#tiktok-accounts-switcher').hidden,false);
 assert.equal($('[data-tiktok-select]').dataset.tiktokSelect,'tiktok_A');
 assert.equal($('#tiktok-add-account').hidden,false);
 assert($('#viver-accounts').textContent.includes('1/3'));
 accounts=[...accounts,{id:'tiktok_B',label:'Creator B',avatar:'',expired:false},{id:'tiktok_C',label:'Creator C',avatar:'',expired:false}];
 await w.VIVERConnections.refresh();
 assert.equal($('#tiktok-add-account').hidden,true,'hide add at three');
 assert.equal($('#tiktok-account-options').querySelectorAll('[data-tiktok-select]').length,3);
 let changes=0;w.addEventListener('viver-tiktok-account-switched',()=>changes++);
 $('[data-tiktok-select="tiktok_B"]').click();await flush();
 assert.equal(active,'tiktok_B','switch chooses selected TikTok account');
 assert.equal(swaps,1);assert.equal(changes,1,'switch event issued only after server response');
 assert($('#tiktok-account-options').textContent.includes('Активний акаунт'));
 $('[data-tiktok-remove="tiktok_B"]').click();await flush();
 assert.equal(removed,1);assert.equal(accounts.length,2,'only selected identity removed');
 assert.equal(active,'tiktok_A','other account becomes active');
 assert.equal($('#tiktok-add-account').hidden,false);
 $('#tiktok-add-account').click();await flush();
 assert.equal(started,1,'add account opens TikTok authorization');
 assert.equal(w.VIVERConnections.getTikTokAccounts().length,2);
 assert.equal(w.VIVERConnections.getActiveTikTokAccount(),'tiktok_A');
 $('[data-auth-provider="tiktok"][data-auth-mode="disconnect"]').click();await flush();
 assert.equal(accounts.length,0,'disconnect all TikTok accounts');
 assert.equal($('#tiktok-accounts-switcher').hidden,true);
 w.close();
 console.log('VIVER TikTok 3-account UI: PASS — 3-account limit, switch, remove, add, disconnect');
})().catch(e=>{console.error(e);process.exit(1)});
