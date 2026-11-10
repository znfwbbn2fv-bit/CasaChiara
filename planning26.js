'use strict';
/* CasaChiara 2.6: calcoli di pianificazione separati dai saldi effettivi. */
(function(g){
  const C=g.CasaChiaraCore;
  const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
  const euro=n=>money.format(n/100);
  const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const monthOf=d=>d.slice(0,7);
  const ending=m=>{const [y,mo]=m.split('-').map(Number);return m+'-'+String(new Date(y,mo,0).getDate()).padStart(2,'0')};
  const dateOf=(month,day)=>{const [y,mo]=month.split('-').map(Number);return month+'-'+String(Math.min(day,new Date(y,mo,0).getDate())).padStart(2,'0')};
  function occurrence(state,rule,month){
    const tx=state.transactions.filter(x=>x.recurringId===rule.id&&x.occMonth===month);
    const expected=tx.find(x=>Number.isInteger(x.plannedCents)&&x.plannedCents>0)?.plannedCents||rule.amountCents;
    const paid=tx.reduce((sum,x)=>sum+x.amountCents,0);
    // In older backups a linked recurring transaction always confirmed the month.
    const final=tx.some(x=>x.recurringFinal!==false);
    const stateName=final?'completed':paid>0?'partial':'pending';
    return {expected,paid,remaining:final?0:Math.max(0,expected-paid),variance:paid-expected,state:stateName,transactions:tx};
  }
  function isScheduled(rule,month){return rule.active&&rule.startMonth<=month&&(!rule.endMonth||rule.endMonth>=month)}
  function monthRows(state,month,now){
    return state.recurring.filter(r=>isScheduled(r,month)).map(r=>{
      const current=occurrence(state,r,month),date=dateOf(month,r.day);
      const expired=date<now&&current.state!=='completed';
      const status=current.state==='completed'?'Confermata':current.state==='partial'?(expired?'Parziale · da verificare':'Parziale'):expired?'Scadenza da verificare':date===now?'Scade oggi':'Programmata';
      return {rule:r,date,occurrence:current,status,expired};
    }).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function pendingNet(state,month){
    let income=0,expense=0;
    for(const x of monthRows(state,month,ending(month))){
      if(x.occurrence.state==='completed')continue;
      const rest=x.occurrence.remaining;
      if(x.rule.type==='income')income+=rest;else expense+=rest;
    }
    return {income,expense,net:income-expense};
  }
  function projection(state,month,now){
    if(month!==monthOf(now)||month<state.settings.openingMonth)return null;
    const actual=C.totalBalance(state,month);
    const pending=pendingNet(state,month);
    const monthly=state.transactions.filter(x=>x.date.startsWith(month));
    const income=monthly.filter(x=>x.type==='income').reduce((s,t)=>s+t.amountCents,0);
    const expense=monthly.filter(x=>x.type==='expense').reduce((s,t)=>s+t.amountCents,0);
    const budget=C.budgetSummary(state,month);
    return {actual,income,expense,pending,projected:actual+pending.net,budget};
  }
  function trend(state,month){
    const data=[];
    for(let i=5;i>=0;i--){
      const [y,m]=month.split('-').map(Number);
      const d=new Date(y,m-1-i,1);
      const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      data.push({month:key,balance:C.totalBalance(state,key)});
    }
    return data;
  }
  function forecastHTML(state,month,now){
    const p=projection(state,month,now);
    if(!p)return '';
    const budget=p.budget,available=budget.limitCents-budget.spentBudgetedCents;
    return '<section class="card plan-forecast"><div class="section-header"><div><h2 class="section-title">Previsione di fine mese</h2><p class="section-sub">Scenario basato sulle ricorrenze ancora da confermare</p></div></div>'+
      '<div class="plan-forecast-grid"><div><small>Saldo registrato (mese selezionato)</small><strong>'+euro(p.actual)+'</strong></div><div><small>Entrate ricorrenti residue</small><strong class="green">+'+euro(p.pending.income)+'</strong></div><div><small>Uscite ricorrenti residue</small><strong class="red">−'+euro(p.pending.expense)+'</strong></div><div class="plan-forecast-result"><small>Saldo teorico finale</small><strong>'+euro(p.projected)+'</strong></div></div>'+
      '<div class="plan-forecast-budget"><strong>Budget impostati: '+euro(budget.limitCents)+'</strong><span>Spese effettive nelle categorie coperte: '+euro(budget.spentBudgetedCents)+'</span><span>Residuo budget: '+euro(available)+' · Spese non coperte: '+euro(budget.spentUnbudgetedCents)+'</span></div>'+
      '<p class="recon-minor">Previsione orientativa, non disponibilità bancaria: include i movimenti registrati nel mese e i residui delle ricorrenze, non le spese future impreviste. I budget sono obiettivi e non vengono sottratti una seconda volta.</p></section>';
  }
  function trendHTML(state,month){
    const values=trend(state,month),valid=values.filter(x=>x.balance!==null);
    const max=Math.max(1,...valid.map(x=>Math.abs(x.balance)));
    const rows=values.map(x=>{
      const label=x.month.split('-').reverse().join('/');
      const signed=x.balance===null?'Prima dell’avvio':euro(x.balance);
      const width=x.balance===null?0:Math.max(2,Math.round(Math.abs(x.balance)/max*100));
      return '<div class="plan-trend-row"><span>'+esc(label)+'</span><div class="plan-trend-track"><div class="plan-trend-bar '+(x.balance<0?'negative':'')+'" style="width:'+width+'%"></div></div><strong>'+esc(signed)+'</strong></div>';
    }).join('');
    return '<section class="card plan-trend"><h2 class="section-title">Andamento del patrimonio</h2><p class="section-sub">Saldi progressivi di fine mese, trasferimenti interni esclusi dal risultato</p><div class="plan-trend-list">'+rows+'</div><p class="recon-minor">Le barre rappresentano il valore assoluto; i saldi negativi sono evidenziati separatamente. I mesi futuri mostrano esclusivamente ciò che è già stato registrato, senza proiezioni.</p></section>';
  }
  g.CasaChiaraPlanning26=Object.freeze({occurrence,monthRows,pendingNet,projection,trend,forecastHTML,trendHTML,ending,dateOf});
})(globalThis);
