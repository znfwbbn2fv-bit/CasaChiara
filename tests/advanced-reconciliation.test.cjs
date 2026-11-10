'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto}=require('node:crypto');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
require('../core.js');require('../reconciliation.js');require('../reconciliation25.js');
const core=globalThis.CasaChiaraCore,cc=globalThis.CasaChiara25;
const TODAY='2026-11-10';
function make(){
 const s=core.makeState('2026-11');s.settings.openingCents=100000;s.accounts[0].openingCents=100000;s.accounts[0].name='Postepay Evolution';
 s.accounts.push({id:'cash',name:'Contanti',type:'cash',active:true,openingCents:0});
 s.transactions.push({id:'exp-1',date:'2026-11-06',type:'expense',description:'Farmacia',category:'Salute',accountId:'main',amountCents:20000,recurringId:null,occMonth:null});
 s.transfers.push({id:'tr-1',date:'2026-11-09',fromId:'main',toId:'cash',amountCents:40000,note:'Prelievo'});
 return core.normalize(s,'2026-11');
}
function addCheck(s,difference=10000,at='2026-11-10T07:00:00Z'){
 const c={id:'check-'+s.reconciliations.length,createdAt:at,date:TODAY,accountId:'main',calculatedCents:40000,actualCents:40000+difference,differenceCents:difference,reason:'Importo errato',note:'Errore in verifica'};
 s.reconciliations.push(c);return c;
}
test('Case persist in same schema as v2.4 and never affect financial balances',()=>{
 const s=make(),expected=core.accountBalance(s,'2026-11','main');
 const check=addCheck(s);
 s.reconciliationCases.push({id:'case1',accountId:'main',checkId:check.id,createdAt:'2026-11-10T07:01:00Z',updatedAt:'2026-11-10T07:01:00Z',resolvedAt:null,status:'open',reason:'Importo errato',note:'In corso',auditIds:[],history:[{at:'2026-11-10T07:01:00Z',status:'open',note:'Creato'}]});
 const normalized=core.normalize(JSON.parse(JSON.stringify(s)),'2026-11');
 assert.equal(normalized.reconciliationCases.length,1);
 assert.equal(core.accountBalance(normalized,'2026-11','main'),expected);
 assert.deepEqual(normalized.reconciliationCases,s.reconciliationCases);
 assert.equal(normalized.settings.openingCents,100000);
});
test('Case validation disallows forged links, invalid statuses, invalid audits',()=>{
 const s=make(),c=addCheck(s),v={id:'case1',accountId:'main',checkId:c.id,createdAt:'2026-11-10T07:01:00Z',updatedAt:'2026-11-10T07:01:00Z',resolvedAt:null,status:'open',reason:'Altro',note:'',auditIds:[],history:[]};
 assert.throws(()=>core.normalize({...s,reconciliationCases:[{...v,checkId:'missing'}]},'2026-11'));
 assert.throws(()=>core.normalize({...s,reconciliationCases:[{...v,status:'resolved',resolvedAt:null}]},'2026-11'));
 assert.throws(()=>core.normalize({...s,reconciliationCases:[{...v,auditIds:['not-exists']}]},'2026-11'));
 assert.throws(()=>core.normalize({...s,reconciliationCases:[v,v]},'2026-11'));
});
test('Discrepancy heuristics indicate uncertainty and never alter transactions',()=>{
 const s=make(),old=JSON.stringify(s);
 const hints=cc.findings(s,'main',TODAY,-20000);
 assert.ok(hints.some(x=>x.message.includes('inferiore')));
 assert.ok(hints.some(x=>x.message.includes('Farmacia')));
 assert.deepEqual(JSON.stringify(s),old);
 const h=cc.health(s,TODAY);
 assert.equal(h.length,2);assert.equal(h[0].status,'unchecked');
 assert.match(cc.findingsHTML(s,'main',TODAY,-20000),/Controlli suggeriti/);
});
test('Dashboard status changes when ledger changes after allineamento',()=>{
 const s=make();
 addCheck(s,0,'2026-11-10T09:00:00Z');
 assert.equal(cc.health(s,TODAY)[0].status,'ok');
 s.auditLog.push({id:'a1',at:'2026-11-10T10:00:00Z',kind:'transactions',action:'edited',targetId:'exp-1',accountIds:['main'],title:'Farmacia',before:'prima',after:'dopo',detail:'Importo'});
 assert.equal(cc.health(s,TODAY)[0].status,'stale');
 assert.match(cc.healthHTML(s,TODAY),/Da ricontrollare/);
});
test('AES-GCM backup encrypts and recovers byte-exact JSON with correct password',async()=>{
 const sandbox=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Uint8Array,Date,JSON,Error,Number,String});
 vm.runInContext(read('secure-backup.js'),sandbox);
 const sec=sandbox.CasaChiaraSecureBackup;
 const input=JSON.stringify({format:'casachiara.backup',data:make()});
 const envelope=await sec.encrypt(input,'password-difficile-2026','2.5.0');
 assert.equal(envelope.format,'casachiara.backup.encrypted');
 assert.doesNotMatch(JSON.stringify(envelope),/Postepay Evolution/);
 const restored=await sec.decrypt(envelope,'password-difficile-2026');
 assert.equal(restored,input);
 await assert.rejects(sec.decrypt(envelope,'password-SBAGLIATA-2026'),/Password errata/);
 await assert.rejects(sec.decrypt({...envelope,ciphertext:'AAA='},'password-difficile-2026'),/non validi|errata|alterato/);
 await assert.rejects(sec.encrypt(input,'short','2.5.0'),/12 caratteri/);
});
