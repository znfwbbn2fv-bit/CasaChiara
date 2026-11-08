'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../core.js');
const c=globalThis.CasaChiaraCore;
const older=()=>({
 version:3,settings:{openingMonth:'2026-11',openingCents:100000},
 accounts:[{id:'main',name:'Conto principale',type:'bank',openingCents:100000,active:true},
 {id:'cash',name:'Contanti',type:'cash',openingCents:0,active:true}],
 transactions:[
 {id:'t1',date:'2026-11-02',type:'expense',description:'Spesa alimentare',category:'Alimentari',amountCents:2500,accountId:'main',recurringId:null,occMonth:null},
 {id:'t2',date:'2026-11-03',type:'income',description:'Entrata',category:'Stipendio',amountCents:150000,accountId:'main',recurringId:null,occMonth:null},
 {id:'t3',date:'2026-11-04',type:'expense',description:'Bus',category:'Trasporti',amountCents:1200,accountId:'cash',recurringId:null,occMonth:null}],
 recurring:[{id:'r1',type:'expense',description:'Bolletta',category:'Utenze',amountCents:9000,startMonth:'2026-11',endMonth:null,day:15,active:true,accountId:'main'}],
 transfers:[{id:'tr1',date:'2026-11-03',amountCents:12000,fromId:'main',toId:'cash',note:'Prelievo'}]
});
test('v3 -> v4 non cambia saldo, conti, trasferimenti o movimenti',()=>{
 const old=older(),v4=c.normalize(old,'2026-11');
 assert.equal(v4.version,4);
 assert.deepEqual(v4.budgets,[]);
 assert.equal(v4.transactions.length,old.transactions.length);
 assert.equal(v4.recurring.length,old.recurring.length);
 assert.equal(v4.transfers.length,old.transfers.length);
 assert.equal(c.totalBalance(v4,'2026-11'),246300);
 assert.equal(c.accountBalance(v4,'2026-11','main'),233500);
 assert.equal(c.accountBalance(v4,'2026-11','cash'),12800);
});
test('Budget per categoria includono solo spese effettive, da qualsiasi conto',()=>{
 const s=c.normalize(older(),'2026-11');
 s.budgets.push({month:'2026-11',category:'Alimentari',limitCents:2000},
 {month:'2026-11',category:'Casa',limitCents:30000});
 const v=c.normalize(s,'2026-11'),sum=c.budgetSummary(v,'2026-11');
 assert.equal(sum.limitCents,32000);
 assert.equal(sum.spentBudgetedCents,2500);
 assert.equal(sum.spentUnbudgetedCents,1200);
 assert.equal(sum.overspentCount,1);
 assert.equal(sum.categories.find(x=>x.category==='Alimentari').remainingCents,-500);
 assert.equal(sum.categories.find(x=>x.category==='Casa').spentCents,0);
 assert.equal(c.totalBalance(v,'2026-11'),246300);
});
test('Non conteggiare ricorrenze previste e trasferimenti nel budget',()=>{
 const s=c.normalize(older(),'2026-11');
 s.budgets.push({month:'2026-11',category:'Utenze',limitCents:10000});
 const sum=c.budgetSummary(c.normalize(s,'2026-11'),'2026-11');
 assert.equal(sum.spentBudgetedCents,0);
 assert.equal(sum.limitCents,10000);
 assert.equal(sum.spentUnbudgetedCents,3700);
});
test('Budget di dicembre indipendenti da novembre',()=>{
 const s=c.normalize(older(),'2026-11');
 s.budgets.push({month:'2026-12',category:'Alimentari',limitCents:5000});
 const sum=c.budgetSummary(c.normalize(s,'2026-11'),'2026-12');
 assert.equal(sum.categories.length,1);assert.equal(sum.spentBudgetedCents,0);
 assert.equal(c.budgetSummary(s,'2026-11').categories.length,0);
});
test('Normalizzazione v4 e export/reimport preservano tutti i dati',()=>{
 const s=c.normalize(older(),'2026-11');
 s.budgets.push({month:'2026-11',category:'Trasporti',limitCents:12000});
 const verified=c.normalize(JSON.parse(JSON.stringify(s)),'2026-11');
 assert.deepEqual(verified,s);
});
test('Rifiuta limiti invalidi, duplicati e versioni v4 senza budget',()=>{
 const s=c.normalize(older(),'2026-11');
 assert.throws(()=>c.normalize({...s,budgets:undefined},'2026-11'));
 assert.throws(()=>c.normalize({...s,budgets:[{month:'2026-11',category:'Casa',limitCents:-1}]},'2026-11'));
 assert.throws(()=>c.normalize({...s,budgets:[{month:'2026-11',category:'Casa',limitCents:15000},{month:'2026-11',category:'Casa',limitCents:8000}]},'2026-11'));
 assert.throws(()=>c.normalize({...s,budgets:[{month:'2026-13',category:'Casa',limitCents:15000}]},'2026-11'));
});
test('Compatibilità importazione v2',()=>{
 const s=c.normalize({version:2,settings:{openingMonth:'2026-11',openingCents:10000},transactions:[],recurring:[]},'2026-11');
 assert.equal(s.version,4);assert.equal(s.accounts[0].id,'main');assert.deepEqual(s.budgets,[]);
});
