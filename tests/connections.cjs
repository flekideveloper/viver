/* VIVER connection outage and out-of-order response regression tests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const A='UC'+'A'.repeat(22),B='UC'+'B'.repeat(22);
const payload=(channel,label)=>({
 providers:{youtube:true,tiktok:false,twitch:false,x:false},
 connections:channel?[{provider:'youtube',connected:true,label}]:[],
 youtubeChannels:channel?[{id:channel,label,avatar:'',canRefresh:true,expired:false}]:[],
 activeYoutubeChannel:channel||null,maxYoutubeChannels:3
});
const answer=data=>({ok:true,json:async()=>data});
(async()=>{
 const dom=new JSDOM(`<!doctype html><html lang="uk"><body>
 <div id="viver-accounts"></div><div id="account-status-info"></div>
 <section id="youtube-accounts-switcher" hidden>
 <span id="youtube-accounts-title"></span><span id="youtube-accounts-limit"></span>
 <button id="youtube-add-channel"><span id="youtube-add-channel-label"></span></button>
 <div id="youtube-channel-options"></div></section><div id="toast"></div>
 </body></html>`,{url:'https://flekideveloper.github.io/viver/',runScripts:'outside-only'});
 const w=dom.window,changes=[];
 w.addEventListener('viver-youtube-channel-switched',e=>changes.push(e.detail.channelId));
 w.fetch=async()=>answer(payload(A,'Channel A'));
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../connections.js'),'utf8'),dom.getInternalVMContext(),{filename:'connections.js'});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(w.VIVERConnections.getStatus(),'ready');
 assert.equal(w.VIVERConnections.getActiveYoutubeChannel(),A);
 assert.equal(w.VIVERConnections.getYouTubeChannels().length,1);
 const count=changes.length;
 w.fetch=async()=>{throw Error('simulated network outage')};
 await w.VIVERConnections.refresh();
 assert.equal(w.VIVERConnections.getStatus(),'offline');
 assert.equal(w.VIVERConnections.getActiveYoutubeChannel(),A,'last active channel retained');
 assert.equal(w.VIVERConnections.getConnections().length,1,'account retained during outage');
 assert.equal(w.VIVERConnections.getYouTubeChannels().length,1,'channels retained during outage');
 assert.equal(w.document.querySelector('#youtube-accounts-switcher').hidden,false);
 assert.equal(w.document.querySelector('[data-youtube-select]').disabled,true,'switching disabled offline');
 assert.equal(w.document.querySelector('#youtube-add-channel').disabled,true,'adding disabled offline');
 assert.equal(w.document.querySelector('[data-auth-provider="youtube"]').disabled,true,'unlink disabled offline');
 assert(w.document.querySelector('#account-status-info').textContent.includes('недоступний'));
 assert.equal(changes.length,count,'outage does not emit disconnect event');
 w.fetch=async()=>answer(payload(null,''));
 await w.VIVERConnections.refresh();
 assert.equal(w.VIVERConnections.getStatus(),'ready');
 assert.equal(w.VIVERConnections.getConnections().length,0,'real unlink clears local state');
 assert.equal(w.VIVERConnections.getActiveYoutubeChannel(),null);
 assert.equal(w.document.querySelector('#youtube-accounts-switcher').hidden,true);
 let resolveOld;
 w.fetch=()=>new Promise(resolve=>{resolveOld=resolve});
 const old=w.VIVERConnections.refresh();
 w.fetch=async()=>answer(payload(B,'Channel B'));
 await w.VIVERConnections.refresh();
 resolveOld(answer(payload(A,'Channel A')));
 await old;
 assert.equal(w.VIVERConnections.getStatus(),'ready');
 assert.equal(w.VIVERConnections.getActiveYoutubeChannel(),B,'stale success ignored');
 let rejectOld;
 w.fetch=()=>new Promise((resolve,reject)=>{rejectOld=reject});
 const oldFailure=w.VIVERConnections.refresh();
 w.fetch=async()=>answer(payload(B,'Channel B'));
 await w.VIVERConnections.refresh();
 rejectOld(Error('old request failed late'));
 await oldFailure;
 assert.equal(w.VIVERConnections.getStatus(),'ready','stale failure ignored');
 assert.equal(w.VIVERConnections.getActiveYoutubeChannel(),B);
 dom.window.close();
 console.log('VIVER connections: PASS — outage, recovery, real disconnect, stale replies');
})().catch(e=>{console.error(e);process.exit(1)});
