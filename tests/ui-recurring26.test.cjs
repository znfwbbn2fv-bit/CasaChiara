'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('UI: acconto e saldo finale divergente mantengono saldi reali, un solo saldo conclusivo e previsione distinta',()=>{
 const memory=new Map(),nodes=new Map(),events={},errors=[];
 const element=id=>{
   if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},style:{},
     classList:{toggle(){}},querySelector(){return null},querySelectorAll(){return []},setAttribute(){},replaceChildren(){}});
   return nodes.get(id);
 };
 const document={getElementById:element,querySelectorAll(){return []},addEventListener(type,callback){events[type]=callback}};
 const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const sandbox=vm.createContext({document,localStorage,window:{addEventListener(){},scrollTo(){}},navigator:{},location:{protocol:'https:'},
   alert(m){errors.push(String(m))},confirm(){return false},TextEncoder,TextDecoder,btoa,atob,setTimeout(){return 0},clearTimeout(){},console,Intl,Date,Math,JSON,Number,Map,Set,Error});
 for(const name of ['core.js','reconciliation.js','reconciliation25.js','secure-backup.js','planning26.js'])vm.runInContext(read(name),sandbox);
 const C=sandbox.CasaChiaraCore,P=sandbox.CasaChiaraPlanning26;
 const now=new Date(),month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const state=C.makeState(month);
 state.accounts[0].openingCents=50000;state.settings.openingCents=50000;
 state.recurring.push({id:'rent',type:'expense',description:'Affitto',category:'Casa',amountCents:30000,startMonth:month,endMonth:null,day:10,active:true,accountId:'main'});
 memory.set('casachiara.pwa.v4',JSON.stringify(state));
 vm.runInContext(read('app.js'),sandbox);
 assert.match(element('app-content').innerHTML,/Previsione di fine mese/);
 assert.match(element('app-content').innerHTML,/Andamento del patrimonio/);
 function submit(amount,final){
   Object.assign(element('transaction-id'),{value:''});
   element('transaction-rule-id').value='rent';
   element('transaction-occ-month').value=month;
   element('transaction-form').dataset.type='expense';
   element('transaction-description').value='Affitto';
   element('transaction-amount').value=amount;
   element('transaction-category').value='Casa';
   element('transaction-date').value=month+'-10';
   element('transaction-account').value='main';
   element('transaction-recurring-status').value=final?'final':'partial';
   events.submit({target:{id:'transaction-form'},preventDefault(){}});
 }
 submit('100,00',false);
 let saved=JSON.parse(localStorage.getItem('casachiara.pwa.v4'));
 assert.equal(saved.transactions.length,1);
 assert.equal(saved.transactions[0].recurringFinal,false);
 assert.equal(saved.transactions[0].plannedCents,30000);
 assert.equal(P.occurrence(saved,saved.recurring[0],month).remaining,20000);
 assert.equal(C.totalBalance(saved,month),40000);
 submit('170,00',true);
 saved=JSON.parse(localStorage.getItem('casachiara.pwa.v4'));
 assert.equal(saved.transactions.length,2);
 assert.equal(P.occurrence(saved,saved.recurring[0],month).variance,-3000);
 assert.equal(P.occurrence(saved,saved.recurring[0],month).state,'completed');
 assert.equal(P.pendingNet(saved,month).expense,0);
 assert.equal(C.totalBalance(saved,month),23000);
 const immutable=JSON.stringify(saved);
 submit('30,00',true);
 assert.ok(errors.some(x=>x.includes('conclusa')));
 assert.equal(localStorage.getItem('casachiara.pwa.v4'),immutable);
});
