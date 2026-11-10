'use strict';
/* CasaChiara 2.3 — archivio versione 4, migrazione conservativa dei dati precedenti. */
(function(global){
  const MAX_CENTS=10000000000;
  const TYPES=['bank','cash','prepaid','savings','other'];
  const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
  function validDate(x){
    if(typeof x!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x))return false;
    const [y,m,d]=x.split('-').map(Number),t=new Date(y,m-1,d);
    return t.getFullYear()===y&&t.getMonth()+1===m&&t.getDate()===d;
  }
  const cents=x=>Number.isSafeInteger(x)&&Math.abs(x)<=MAX_CENTS;
  const nonzero=x=>cents(x)&&x>0;
  const name=x=>typeof x==='string'&&x.trim().length>0&&x.length<=160;
  const identifier=x=>typeof x==='string'&&x.length>0&&x.length<=80;
  const kind=x=>['income','expense'].includes(x);
  const basicAccount=(openingCents=0)=>({id:'main',name:'Conto principale',type:'bank',openingCents,active:true});
  const makeState=(m)=>({version:4,settings:{openingMonth:m,openingCents:0},accounts:[basicAccount()],transactions:[],recurring:[],transfers:[],budgets:[],reconciliations:[],auditLog:[],reconciliationCases:[]});

  function normalize(raw, currentMonth){
    if(!raw||![2,3,4].includes(raw.version)||!raw.settings||!Array.isArray(raw.transactions)||!Array.isArray(raw.recurring))
      throw Error('Formato di archivio non compatibile.');
    if(!validMonth(raw.settings.openingMonth))throw Error('Mese iniziale non valido.');
    if(raw.transactions.length>100000||raw.recurring.length>5000)throw Error('Archivio troppo grande.');
    if(raw.version===4&&!Array.isArray(raw.budgets))throw Error('Budget mancanti.');
    if(raw.budgets!==undefined&&!Array.isArray(raw.budgets))throw Error('Budget non validi.');
    if((raw.budgets||[]).length>5000)throw Error('Troppi budget.');
    if(!cents(raw.settings.openingCents))throw Error('Saldo iniziale non valido.');
    const legacy=raw.version===2;
    if(!legacy&&(!Array.isArray(raw.accounts)||!Array.isArray(raw.transfers)))throw Error('Conti o trasferimenti mancanti.');
    const state=makeState(currentMonth);
    state.settings.openingMonth=raw.settings.openingMonth;
    const ids=new Set();
    const uniq=id=>{if(!identifier(id)||ids.has(id))throw Error('Identificativo duplicato o non valido.');ids.add(id)};
    state.accounts=[];
    if(legacy){
      state.accounts=[basicAccount(raw.settings.openingCents)];
      ids.add('main');
    }else{
      if(raw.accounts.length<1||raw.accounts.length>100||raw.transfers.length>100000)throw Error('Numero di conti o trasferimenti non consentito.');
      for(const a of raw.accounts){
        if(!a||!name(a.name)||!TYPES.includes(a.type)||!cents(a.openingCents)||typeof a.active!=='boolean')throw Error('Conto non valido.');
        uniq(a.id);
        state.accounts.push({id:a.id,name:a.name.trim().slice(0,80),type:a.type,openingCents:a.openingCents,active:a.active});
      }
    }
    if(!state.accounts.some(a=>a.active))throw Error('È necessario almeno un conto attivo.');
    const accountIds=new Set(state.accounts.map(a=>a.id));
    const belongs=id=>typeof id==='string'&&accountIds.has(id);
    for(const t of raw.transactions){
      if(!t||!validDate(t.date)||!kind(t.type)||!nonzero(t.amountCents)||!name(t.description))throw Error('Movimento non valido.');
      uniq(t.id);
      const accountId=legacy?'main':t.accountId;
      if(!belongs(accountId))throw Error('Movimento riferito a un conto inesistente.');
      if(t.recurringFinal!==undefined&&typeof t.recurringFinal!=='boolean')throw Error('Stato della rata ricorrente non valido.');
      if(t.plannedCents!==undefined&&!nonzero(t.plannedCents))throw Error('Importo previsto della ricorrenza non valido.');
      if((t.recurringFinal!==undefined||t.plannedCents!==undefined)&&!(typeof t.recurringId==='string'&&validMonth(t.occMonth)))throw Error('Metadati della ricorrenza non associati a un periodo.');
      const entry={id:t.id,date:t.date,type:t.type,description:t.description.slice(0,160),category:String(t.category||'Altro').slice(0,80),amountCents:t.amountCents,recurringId:typeof t.recurringId==='string'?t.recurringId.slice(0,80):null,occMonth:validMonth(t.occMonth)?t.occMonth:null,accountId};
      if(t.recurringFinal!==undefined)entry.recurringFinal=t.recurringFinal;
      if(t.plannedCents!==undefined)entry.plannedCents=t.plannedCents;
      state.transactions.push(entry);
    }
    // Existing linked transactions without recurringFinal remain final by default.
    // New installments may have several lines per month, but at most one final line.
    const perPeriod=new Map();
    for(const t of state.transactions){
      if(!t.recurringId||!t.occMonth)continue;
      const k=t.recurringId+'|'+t.occMonth;
      const lines=perPeriod.get(k)||[];
      lines.push(t);perPeriod.set(k,lines);
    }
    for(const lines of perPeriod.values()){
      if(lines.filter(t=>t.recurringFinal!==false).length>1&&lines.some(t=>t.recurringFinal!==undefined||t.plannedCents!==undefined))throw Error('Due pagamenti conclusivi per la stessa ricorrenza.');
      const planned=lines.filter(t=>t.plannedCents!==undefined).map(t=>t.plannedCents);
      if(planned.length&&planned.some(x=>x!==planned[0]))throw Error('Importi previsti incoerenti nella stessa ricorrenza.');
      const sumPartial=lines.filter(t=>t.recurringFinal===false).reduce((sum,t)=>sum+t.amountCents,0);
      if(planned.length&&sumPartial>=planned[0])throw Error('Una rata parziale non può coprire o superare tutto il previsto: usa Conferma saldo finale.');
    }
    for(const r of raw.recurring){
      if(!r||!kind(r.type)||!validMonth(r.startMonth)||(r.endMonth!=null&&(!validMonth(r.endMonth)||r.endMonth<r.startMonth))||!Number.isInteger(r.day)||r.day<1||r.day>31||!nonzero(r.amountCents)||!name(r.description))throw Error('Ricorrenza non valida.');
      uniq(r.id);
      const accountId=legacy?'main':r.accountId;
      if(!belongs(accountId))throw Error('Ricorrenza riferita a un conto inesistente.');
      state.recurring.push({id:r.id,type:r.type,description:r.description.slice(0,160),category:String(r.category||'Altro').slice(0,80),amountCents:r.amountCents,startMonth:r.startMonth,endMonth:r.endMonth||null,day:r.day,active:r.active!==false,accountId});
    }
    if(!legacy){
      for(const t of raw.transfers){
        if(!t||!validDate(t.date)||!nonzero(t.amountCents)||!belongs(t.fromId)||!belongs(t.toId)||t.fromId===t.toId||typeof t.note!=='string'||t.note.length>160)throw Error('Trasferimento non valido.');
        uniq(t.id);
        state.transfers.push({id:t.id,date:t.date,amountCents:t.amountCents,fromId:t.fromId,toId:t.toId,note:t.note.slice(0,160)});
      }
    }
    const monthCategories=new Set();
    for(const b of (raw.budgets||[])){
      if(!b||!validMonth(b.month)||typeof b.category!=='string'||!name(b.category)||b.category.length>80||!nonzero(b.limitCents))throw Error('Budget non valido.');
      const key=b.month+'|'+b.category;
      if(monthCategories.has(key))throw Error('Categoria budget duplicata nello stesso mese.');
      monthCategories.add(key);
      state.budgets.push({month:b.month,category:b.category,limitCents:b.limitCents});
    }
    // New optional fields: all previous v2/v3/v4 backups remain importable.
    // Entries are snapshots and are never treated as account transactions.
    const checks=raw.reconciliations===undefined?[]:raw.reconciliations;
    const audits=raw.auditLog===undefined?[]:raw.auditLog;
    if(!Array.isArray(checks)||checks.length>30000||!Array.isArray(audits)||audits.length>50000)throw Error('Registri di riconciliazione non validi.');
    const timestamp=s=>typeof s==='string'&&s.length<=35&&Number.isFinite(Date.parse(s));
    const short=(v,n)=>typeof v==='string'&&v.length<=n;
    for(const c of checks){
      if(!c||!identifier(c.id)||!timestamp(c.createdAt)||!validDate(c.date)||!belongs(c.accountId)||!cents(c.calculatedCents)||!cents(c.actualCents)||!cents(c.differenceCents)||c.differenceCents!==c.actualCents-c.calculatedCents||!short(c.reason,90)||!short(c.note,500))throw Error('Verifica saldo non valida.');
      uniq(c.id);
      state.reconciliations.push({id:c.id,createdAt:c.createdAt,date:c.date,accountId:c.accountId,calculatedCents:c.calculatedCents,actualCents:c.actualCents,differenceCents:c.differenceCents,reason:c.reason,note:c.note});
    }
    for(const a of audits){
      if(!a||!identifier(a.id)||!timestamp(a.at)||!['transactions','transfers','accounts','recurring','budgets','settings'].includes(a.kind)||!['added','removed','edited'].includes(a.action)||!short(a.targetId,160)||!Array.isArray(a.accountIds)||a.accountIds.length>8||!a.accountIds.every(id=>short(id,80))||!short(a.title,160)||!short(a.before,600)||!short(a.after,600)||!short(a.detail,220))throw Error('Registro modifiche non valido.');
      uniq(a.id);
      state.auditLog.push({id:a.id,at:a.at,kind:a.kind,action:a.action,targetId:a.targetId,accountIds:[...a.accountIds],title:a.title,before:a.before,after:a.after,detail:a.detail});
    }
    const cases=raw.reconciliationCases===undefined?[]:raw.reconciliationCases;
    if(!Array.isArray(cases)||cases.length>10000)throw Error('Registro casi di riconciliazione non valido.');
    const checkIds=new Set(state.reconciliations.map(c=>c.id));
    const auditIds=new Set(state.auditLog.map(a=>a.id));
    for(const c of cases){
      if(!c||!identifier(c.id)||!belongs(c.accountId)||!identifier(c.checkId)||!checkIds.has(c.checkId)||
      !timestamp(c.createdAt)||!timestamp(c.updatedAt)||!['open','review','resolved'].includes(c.status)||
      !(c.resolvedAt===null||timestamp(c.resolvedAt))||c.status==='resolved'&&!c.resolvedAt||
      c.status!=='resolved'&&c.resolvedAt!==null||!short(c.reason,90)||!short(c.note,500)||
      !Array.isArray(c.auditIds)||c.auditIds.length>100||!c.auditIds.every(id=>identifier(id)&&auditIds.has(id))||
      !Array.isArray(c.history)||c.history.length>1000)throw Error('Caso di riconciliazione non valido.');
      const check=state.reconciliations.find(v=>v.id===c.checkId);
      if(check.accountId!==c.accountId||check.differenceCents===0)throw Error('Caso collegato a una verifica non valida.');
      const seen=new Set();
      for(const h of c.history){
        if(!h||!timestamp(h.at)||!['open','review','resolved'].includes(h.status)||!short(h.note,500))throw Error('Storico del caso non valido.');
      }
      if(c.auditIds.some(id=>{if(seen.has(id))return true;seen.add(id);return false}))throw Error('Correzione collegata due volte.');
      uniq(c.id);
      state.reconciliationCases.push({id:c.id,accountId:c.accountId,checkId:c.checkId,createdAt:c.createdAt,updatedAt:c.updatedAt,status:c.status,resolvedAt:c.resolvedAt,reason:c.reason,note:c.note,auditIds:[...c.auditIds],history:c.history.map(h=>({at:h.at,status:h.status,note:h.note}))});
    }
    const sum=state.accounts.reduce((n,a)=>n+a.openingCents,0);
    if(!Number.isSafeInteger(sum)||Math.abs(sum)>MAX_CENTS)throw Error('Totale saldi iniziali fuori limite.');
    if(!legacy&&sum!==raw.settings.openingCents)throw Error('I saldi iniziali dei conti non corrispondono al saldo complessivo.');
    state.settings.openingCents=sum;
    return state;
  }
  function accountBalance(state,month,id){
    if(month<state.settings.openingMonth)return null;
    const a=state.accounts.find(x=>x.id===id);
    if(!a)return null;
    let balance=a.openingCents;
    for(const t of state.transactions)if(t.accountId===id&&t.date.slice(0,7)>=state.settings.openingMonth&&t.date.slice(0,7)<=month)balance+=t.type==='income'?t.amountCents:-t.amountCents;
    for(const t of state.transfers)if(t.date.slice(0,7)>=state.settings.openingMonth&&t.date.slice(0,7)<=month){
      if(t.fromId===id)balance-=t.amountCents;
      if(t.toId===id)balance+=t.amountCents;
    }
    return balance;
  }
  function totalBalance(state,month){
    if(month<state.settings.openingMonth)return null;
    return state.accounts.reduce((s,a)=>s+accountBalance(state,month,a.id),0);
  }
  function budgetSummary(state,month){
    const monthSpending=new Map();
    for(const t of state.transactions){
      if(t.type!=='expense'||t.date.slice(0,7)!==month)continue;
      monthSpending.set(t.category,(monthSpending.get(t.category)||0)+t.amountCents);
    }
    const categories=state.budgets.filter(b=>b.month===month).map(b=>({
      category:b.category,limitCents:b.limitCents,spentCents:monthSpending.get(b.category)||0,
      remainingCents:b.limitCents-(monthSpending.get(b.category)||0)
    }));
    const covered=new Set(categories.map(b=>b.category));
    return {
      categories,
      limitCents:categories.reduce((sum,b)=>sum+b.limitCents,0),
      spentBudgetedCents:categories.reduce((sum,b)=>sum+b.spentCents,0),
      spentUnbudgetedCents:[...monthSpending].filter(([c])=>!covered.has(c)).reduce((sum,[,v])=>sum+v,0),
      overspentCount:categories.filter(b=>b.remainingCents<0).length
    };
  }
  global.CasaChiaraCore=Object.freeze({makeState,normalize,accountBalance,totalBalance,budgetSummary,validDate,validMonth,TYPES});
})(globalThis);
