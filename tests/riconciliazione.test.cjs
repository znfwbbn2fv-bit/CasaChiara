'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../core.js');
require('../reconciliation.js');
const core=globalThis.CasaChiaraCore,recon=globalThis.CasaChiaraRecon;
function sample(){
 const s=core.makeState('2026-11');
 s.accounts[0].openingCents=100000;
 s.accounts.push({id:'cash',name:'Contanti',type:'cash',openingCents:0,active:true});
 s.settings.openingCents=100000;
 s.transactions.push({id:'x1',type:'expense',date:'2026-11-04',description:'Pagamento test',category:'Casa',amountCents:12500,accountId:'main',recurringId:null,occMonth:null});
 s.transactions.push({id:'x2',type:'income',date:'2026-11-09',description:'Rimborso test',category:'Altro',amountCents:5000,accountId:'main',recurringId:null,occMonth:null});
 s.transfers.push({id:'tr1',date:'2026-11-06',amountCents:40000,fromId:'main',toId:'cash',note:'Prelievo'});
 s.transactions.push({id:'x3',type:'expense',date:'2026-11-09',description:'Pagamento contanti',category:'Casa',amountCents:30000,accountId:'cash',recurringId:null,occMonth:null});
 return core.normalize(s,'2026-11');
}
test('Calcola saldi storici per conto prima/dopo prelievo senza impattare gli altri',()=>{
 const s=sample();
 assert.equal(recon.balanceAtDate(s,'2026-11-03','main'),100000);
 assert.equal(recon.balanceAtDate(s,'2026-11-05','main'),87500);
 assert.equal(recon.balanceAtDate(s,'2026-11-06','main'),47500);
 assert.equal(recon.balanceAtDate(s,'2026-11-09','main'),52500);
 assert.equal(recon.balanceAtDate(s,'2026-11-09','cash'),10000);
 assert.equal(core.totalBalance(s,'2026-11'),62500);
 assert.equal(recon.balanceAtDate(s,'2026-10-31','main'),null);
});
test('Riconciliazione salva fotografia dello scostamento e non altera saldi',()=>{
 const s=sample(),before=core.totalBalance(s,'2026-11');
 s.reconciliations.push({id:'check-1',createdAt:'2026-11-10T12:00:00.000Z',date:'2026-11-09',accountId:'main',calculatedCents:52500,actualCents:52000,differenceCents:-500,reason:'Movimento mancante',note:'verifica conto'});
 const roundtrip=core.normalize(JSON.parse(JSON.stringify(s)),'2026-11');
 assert.equal(core.totalBalance(roundtrip,'2026-11'),before);
 assert.deepEqual(roundtrip.reconciliations,s.reconciliations);
 assert.equal(roundtrip.auditLog.length,0);
 assert.match(recon.render(roundtrip,'2026-11-10','all'),/Da verificare/);
});
test('Registro delle correzioni conserva prima/dopo in conto e non modifica storico precedente',()=>{
 const before=sample(),after=JSON.parse(JSON.stringify(before));
 after.transactions[0].amountCents=12000;
 after.accounts[1].name='Portafoglio';
 const entries=recon.makeAudit(before,after,(()=>{let id=0;return ()=>'audit-'+(++id);})(),'2026-11-10T12:30:00Z');
 assert.equal(entries.length,2);
 assert.match(entries.find(x=>x.kind==='transactions').before,/125,00/);
 assert.match(entries.find(x=>x.kind==='transactions').after,/120,00/);
 after.auditLog.push(...entries);
 const saved=core.normalize(after,'2026-11');
 assert.equal(saved.auditLog.length,2);
 assert.equal(saved.reconciliations.length,0);
 assert.equal(core.accountBalance(saved,'2026-11','main'),53000);
});
test('Compatibilità backup vecchio senza registri',()=>{
 const s=sample();
 delete s.reconciliations;delete s.auditLog;
 const normalized=core.normalize(s,'2026-11');
 assert.deepEqual(normalized.reconciliations,[]);
 assert.deepEqual(normalized.auditLog,[]);
});
test('Rifiuta scostamenti incongruenti, registri corrotti e duplicati',()=>{
 const s=sample();
 const record={id:'verify-1',createdAt:'2026-11-10T12:00:00Z',date:'2026-11-09',accountId:'main',calculatedCents:52500,actualCents:53000,differenceCents:500,reason:'Da determinare',note:''};
 assert.throws(()=>core.normalize({...s,reconciliations:[{...record,differenceCents:0}]},'2026-11'));
 assert.throws(()=>core.normalize({...s,reconciliations:[{...record,accountId:'unknown'}]},'2026-11'));
 assert.throws(()=>core.normalize({...s,reconciliations:[record,record]},'2026-11'));
 assert.throws(()=>core.normalize({...s,auditLog:[{id:'x1'}]},'2026-11'));
});
test('CSV contiene verifiche e modifiche, sterilizza formule inserite in note',()=>{
 const s=sample();
 s.reconciliations.push({id:'cc-r1',createdAt:'2026-11-10T12:00:00Z',date:'2026-11-09',accountId:'main',calculatedCents:52500,actualCents:52500,differenceCents:0,reason:'Altro',note:'=SUM(1,1)'});
 const out=recon.csv(s);
 assert.match(out,/REGISTRO RICONCILIAZIONI/);
 assert.match(out,/REGISTRO MODIFICHE/);
 assert.match(out,/'=SUM\(1,1\)/);
});
test('Rendering delle note non permette markup HTML inserito dall’utente',()=>{
 const s=sample();
 s.reconciliations.push({id:'cc-r1',createdAt:'2026-11-10T12:00:00Z',date:'2026-11-09',accountId:'main',calculatedCents:52500,actualCents:52500,differenceCents:0,reason:'Altro',note:'<img src=x onerror=alert(1)>'});
 const html=recon.render(s,'2026-11-10','all');
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
});
