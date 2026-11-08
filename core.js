'use strict';
/* CasaChiara 2.2 — archivio versione 3. Solo dati locali, nessun servizio esterno. */
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
  const makeState=(m)=>({version:3,settings:{openingMonth:m,openingCents:0},accounts:[basicAccount()],transactions:[],recurring:[],transfers:[]});

  function normalize(raw, currentMonth){
    if(!raw||![2,3].includes(raw.version)||!raw.settings||!Array.isArray(raw.transactions)||!Array.isArray(raw.recurring))
      throw Error('Formato di archivio non compatibile.');
    if(!validMonth(raw.settings.openingMonth))throw Error('Mese iniziale non valido.');
    if(raw.transactions.length>100000||raw.recurring.length>5000)throw Error('Archivio troppo grande.');
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
    const accountIds=new Set(state.accounts.map(a=>a.id));
    const belongs=id=>typeof id==='string'&&accountIds.has(id);
    for(const t of raw.transactions){
      if(!t||!validDate(t.date)||!kind(t.type)||!nonzero(t.amountCents)||!name(t.description))throw Error('Movimento non valido.');
      uniq(t.id);
      const accountId=legacy?'main':t.accountId;
      if(!belongs(accountId))throw Error('Movimento riferito a un conto inesistente.');
      state.transactions.push({id:t.id,date:t.date,type:t.type,description:t.description.slice(0,160),category:String(t.category||'Altro').slice(0,80),amountCents:t.amountCents,recurringId:typeof t.recurringId==='string'?t.recurringId.slice(0,80):null,occMonth:validMonth(t.occMonth)?t.occMonth:null,accountId});
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
  global.CasaChiaraCore=Object.freeze({makeState,normalize,accountBalance,totalBalance,validDate,validMonth,TYPES});
})(globalThis);
