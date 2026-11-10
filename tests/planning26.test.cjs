'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../core.js');require('../planning26.js');
const C=globalThis.CasaChiaraCore,P=globalThis.CasaChiaraPlanning26;
const date='2026-11-10';
function sample(){
 const s=C.makeState('2026-11');
 s.accounts[0].openingCents=50000;s.settings.openingCents=50000;
 s.accounts.push({id:'cash',name:'Contanti',type:'cash',openingCents:0,active:true});
 s.recurring.push({id:'rent',date:null,type:'expense',description:'Affitto',category:'Casa',amountCents:30000,startMonth:'2026-11',endMonth:null,day:10,active:true,accountId:'cash'});
 s.recurring.push({id:'salary',type:'income',description:'Stipendio',category:'Stipendio',amountCents:100000,startMonth:'2026-11',endMonth:null,day:27,active:true,accountId:'main'});
 return C.normalize(s,'2026-11');
}
function add(s,id,amount,final,date='2026-11-10',month='2026-11'){
 s.transactions.push({id,date,type:'expense',description:'Affitto',category:'Casa',amountCents:amount,accountId:'cash',recurringId:'rent',occMonth:month,plannedCents:30000,recurringFinal:final});
}
test('A new partial recurring payment keeps the period open and counts only actual outgoings',()=>{
 const s=sample();add(s,'part-1',10000,false);
 const a=C.normalize(s,'2026-11'),o=P.occurrence(a,a.recurring[0],'2026-11');
 assert.equal(o.expected,30000);assert.equal(o.paid,10000);assert.equal(o.remaining,20000);
 assert.equal(o.state,'partial');
 assert.equal(C.accountBalance(a,'2026-11','cash'),-10000);
 assert.equal(C.totalBalance(a,'2026-11'),40000);
 assert.equal(P.pendingNet(a,'2026-11').expense,20000);
 assert.equal(P.pendingNet(a,'2026-11').income,100000);
 assert.match(P.deadlineHTML(a,'2026-11',date,id=>id),/Parziale/);
});
test('A closing payment of a different amount finishes the period and preserves variance',()=>{
 const s=sample();add(s,'part-1',10000,false);add(s,'final-1',17000,true);
 const a=C.normalize(s,'2026-11'),o=P.occurrence(a,a.recurring[0],'2026-11');
 assert.equal(o.paid,27000);assert.equal(o.variance,-3000);
 assert.equal(o.remaining,0);assert.equal(o.state,'completed');
 assert.equal(P.pendingNet(a,'2026-11').expense,0);
 assert.equal(C.totalBalance(a,'2026-11'),23000);
 assert.match(P.deadlineHTML(a,'2026-11',date,id=>id),/Confermata/);
});
test('Overpayment in final installment is shown as positive variance without duplicate planned expense',()=>{
 const s=sample();add(s,'p',10000,false);add(s,'f',25000,true);
 const a=C.normalize(s,'2026-11'),o=P.occurrence(a,a.recurring[0],'2026-11');
 assert.equal(o.paid,35000);assert.equal(o.variance,5000);assert.equal(o.state,'completed');
 assert.equal(C.totalBalance(a,'2026-11'),15000);
});
test('Older 2.5 recurring linked transaction is a final settlement and is not migrated destructively',()=>{
 const s=sample();
 s.transactions.push({id:'old-final',date,type:'expense',description:'Affitto',category:'Casa',amountCents:30000,accountId:'cash',recurringId:'rent',occMonth:'2026-11'});
 const out=C.normalize(s,'2026-11'),o=P.occurrence(out,out.recurring[0],'2026-11');
 assert.equal(o.state,'completed');assert.equal(o.paid,30000);assert.equal(o.remaining,0);
 assert.equal(out.transactions[0].recurringFinal,undefined);
 assert.equal(out.transactions[0].plannedCents,undefined);
 assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(out)),'2026-11'),out);
});
test('Invalid double finals, invalid metadata and full partial settlement are rejected',()=>{
 const s=sample();add(s,'f1',10000,true);add(s,'f2',20000,true);
 assert.throws(()=>C.normalize(s,'2026-11'),/Due pagamenti conclusivi/);
 const t=sample();add(t,'p',30000,false);
 assert.throws(()=>C.normalize(t,'2026-11'),/rata parziale/);
 const n=sample();n.transactions.push({id:'bad',date,type:'expense',amountCents:1000,accountId:'cash',description:'X',category:'Casa',recurringId:null,occMonth:null,recurringFinal:false});
 assert.throws(()=>C.normalize(n,'2026-11'),/Metadati/);
});
test('Projection is separated from real balances and transfers do not create income or expense',()=>{
 const s=sample();
 add(s,'p',10000,false);
 s.transfers.push({id:'move',date:'2026-11-09',amountCents:12000,fromId:'main',toId:'cash',note:'Prelievo'});
 s.budgets.push({month:'2026-11',category:'Casa',limitCents:30000});
 const a=C.normalize(s,'2026-11');
 const p=P.projection(a,'2026-11',date);
 assert.equal(p.actual,40000);
 assert.equal(p.pending.income,100000);
 assert.equal(p.pending.expense,20000);
 assert.equal(p.projected,120000);
 assert.equal(p.budget.spentBudgetedCents,10000);
 assert.match(P.forecastHTML(a,'2026-11',date),/Previsione di fine mese/);
 assert.equal(P.projection(a,'2026-12',date),null);
 assert.deepEqual(P.trend(a,'2026-11').at(-1),{month:'2026-11',balance:40000});
});
test('Month-scoped partial payments do not affect next-month recurring due',()=>{
 const s=sample();add(s,'p',12000,false);
 const a=C.normalize(s,'2026-11');
 assert.equal(P.occurrence(a,a.recurring[0],'2026-12').paid,0);
 assert.equal(P.occurrence(a,a.recurring[0],'2026-12').remaining,30000);
});
