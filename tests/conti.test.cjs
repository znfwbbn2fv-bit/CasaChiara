'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../core.js');
const c=globalThis.CasaChiaraCore;
function v2(){
 return {version:2,settings:{openingMonth:'2026-11',openingCents:100000},transactions:[
  {id:'old-exp',date:'2026-11-01',type:'expense',description:'Spesa vecchia',amountCents:1000,category:'Alimentari',recurringId:null,occMonth:null},
  {id:'old-inc',date:'2026-11-03',type:'income',description:'Entrata vecchia',amountCents:5000,category:'Stipendio',recurringId:null,occMonth:null}
 ],recurring:[{id:'old-rec',type:'expense',description:'Bolletta',category:'Utenze',amountCents:4000,startMonth:'2026-11',endMonth:null,day:15,active:true}]};
}
test('Migrazione v2 -> v3 senza modificare entrate, uscite e saldo',()=>{
 const s=c.normalize(v2(),'2026-11');
 assert.equal(s.version,3);
 assert.equal(s.accounts.length,1);
 assert.equal(s.accounts[0].id,'main');
 assert.equal(s.accounts[0].openingCents,100000);
 assert.equal(s.transactions.length,2);
 assert.ok(s.transactions.every(t=>t.accountId==='main'));
 assert.equal(s.recurring[0].accountId,'main');
 assert.equal(c.totalBalance(s,'2026-11'),104000);
});
test('Nuovo conto e trasferimento conservano il patrimonio complessivo',()=>{
 const s=c.normalize(v2(),'2026-11'),before=c.totalBalance(s,'2026-11');
 s.accounts.push({id:'cash',name:'Contanti',type:'cash',openingCents:0,active:true});
 s.transfers.push({id:'transfer-1',date:'2026-11-05',amountCents:25000,fromId:'main',toId:'cash',note:'Prelievo'});
 const v=c.normalize(s,'2026-11');
 assert.equal(c.accountBalance(v,'2026-11','main'),before-25000);
 assert.equal(c.accountBalance(v,'2026-11','cash'),25000);
 assert.equal(c.totalBalance(v,'2026-11'),before);
});
test('Spesa dal nuovo conto influenza solo il saldo relativo e il totale',()=>{
 const s=c.normalize(v2(),'2026-11');
 s.accounts.push({id:'cash',name:'Contanti',type:'cash',openingCents:10000,active:true});
 s.settings.openingCents+=10000;
 s.transactions.push({id:'cash-exp',date:'2026-11-06',type:'expense',description:'Spesa in contanti',amountCents:7000,category:'Alimentari',accountId:'cash',recurringId:null,occMonth:null});
 const v=c.normalize(s,'2026-11');
 assert.equal(c.accountBalance(v,'2026-11','cash'),3000);
 assert.equal(c.accountBalance(v,'2026-11','main'),104000);
 assert.equal(c.totalBalance(v,'2026-11'),107000);
});
test('Controlli: stesso conto, conto inesistente, duplicazione IDs',()=>{
 const base=c.normalize(v2(),'2026-11');
 const badTransfer={id:'t1',date:'2026-11-02',amountCents:1000,fromId:'main',toId:'main',note:''};
 assert.throws(()=>c.normalize({...base,transfers:[badTransfer]},'2026-11'));
 assert.throws(()=>c.normalize({...base,transactions:[{...base.transactions[0],accountId:'missing'}]},'2026-11'));
 assert.throws(()=>c.normalize({...base,transfers:[{...badTransfer,toId:'missing'}]},'2026-11'));
 assert.throws(()=>c.normalize({...base,transactions:[base.transactions[0],base.transactions[0]]},'2026-11'));
});
test('Rifiuta archivi v3 con saldi iniziali incoerenti o senza conti attivi',()=>{
 const s=c.normalize(v2(),'2026-11');
 assert.throws(()=>c.normalize({...s,settings:{...s.settings,openingCents:99999}},'2026-11'));
 const bad=JSON.parse(JSON.stringify(s));
 bad.accounts[0].active=false;
 assert.throws(()=>c.normalize(bad,'2026-11'));
});
test('Roundtrip JSON mantiene movimenti, saldi, trasferimenti e ricorrenze',()=>{
 const s=c.normalize(v2(),'2026-11');
 s.accounts.push({id:'card',name:'Prepagata',type:'prepaid',openingCents:0,active:true});
 s.transfers.push({id:'tr-2',date:'2026-11-07',amountCents:3000,fromId:'main',toId:'card',note:'Ricarica'});
 const v=c.normalize(s,'2026-11');
 assert.deepEqual(c.normalize(JSON.parse(JSON.stringify(v)),'2026-11'),v);
 assert.equal(c.totalBalance(v,'2026-11'),c.totalBalance(s,'2026-11'));
});
test('Date inesistenti e formati non compatibili rifiutati',()=>{
 assert.equal(c.validDate('2026-02-29'),false);
 assert.equal(c.validDate('2028-02-29'),true);
 assert.throws(()=>c.normalize({...v2(),version:4},'2026-11'));
});
