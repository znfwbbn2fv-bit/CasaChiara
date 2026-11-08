'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('2.3.1 author attribution in app, footer and metadata without changing storage format',()=>{
 const index=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest')),sw=read('sw.js'),app=read('app.js');
 assert.match(index,/<meta name="author" content="SEGNOTA Studio">/);
 assert.match(index,/Developed by <strong>SEGNOTA Studio<\/strong>/);
 assert.match(index,/CasaChiara 2\.3\.1/);
 assert.equal(manifest.name,'CasaChiara · Finanze domestiche');
 assert.match(manifest.description,/SEGNOTA Studio/);
 assert.match(sw,/casachiara-static-v2\.3\.1/);
 assert.match(app,/const APP_VERSION='2\.3\.1'/);
 assert.match(app,/const STORAGE_KEY='casachiara\.pwa\.v4'/);
});
test('SEGNOTA Studio is visibly present in Dashboard and Settings; existing data remain unchanged',()=>{
 const content=new Map(),handlers={},nodes=new Map();
 const el=id=>{
   if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'',textContent:'',innerHTML:'',style:{},
    classList:{toggle(){}},setAttribute(){},querySelector(){return null},replaceChildren(){}});
   return nodes.get(id);
 };
 const document={getElementById:el,querySelectorAll(){return []},addEventListener(name,fn){handlers[name]=fn}};
 const localStorage={
  getItem:key=>content.get(key)??null,
  setItem:(key,v)=>content.set(key,String(v)),
  removeItem:key=>content.delete(key)
 };
 const sandbox=vm.createContext({document,localStorage,window:{addEventListener(){},scrollTo(){}},navigator:{},location:{protocol:'https:'},
  alert(){},confirm(){return false},setTimeout(){return 0},clearTimeout(){},console,Intl,Date,Math,JSON,Number,Map,Set,Error});
 vm.runInContext(read('core.js'),sandbox);
 const state=JSON.parse(JSON.stringify(sandbox.CasaChiaraCore.makeState('2026-11')));
 state.transactions.push({id:'test-credit',date:'2026-11-04',type:'expense',amountCents:1234,description:'Spesa precedente',category:'Alimentari',recurringId:null,occMonth:null,accountId:'main'});
 const before=JSON.stringify(state);
 localStorage.setItem('casachiara.pwa.v4',before);
 vm.runInContext(read('app.js'),sandbox);
 assert.match(el('app-content').innerHTML,/class="developer-credit"/);
 assert.match(el('app-content').innerHTML,/Developed by <strong>SEGNOTA Studio<\/strong>/);
 assert.equal(localStorage.getItem('casachiara.pwa.v4'),before,'Startup must not rewrite the financial archive');
 assert.ok(handlers.click,'Click handler missing');
 handlers.click({target:{closest(){return {dataset:{view:'settings'},hasAttribute(){return false}}}}});
 assert.match(el('app-content').innerHTML,/Informazioni sull'app/);
 assert.match(el('app-content').innerHTML,/Developed by <strong>SEGNOTA Studio<\/strong>/);
 assert.match(el('app-content').innerHTML,/Versione <strong>2.3.1<\/strong>/);
 assert.equal(localStorage.getItem('casachiara.pwa.v4'),before);
});
