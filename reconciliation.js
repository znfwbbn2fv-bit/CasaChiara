'use strict';
/* CasaChiara 2.4.0 - riconciliazioni e registro locale delle modifiche.
   Non modifica mai saldi o movimenti quando salva una verifica. */
(function(global){
  const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
  const eur=c=>money.format(c/100);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const kinds={transactions:'Movimento',transfers:'Trasferimento',accounts:'Conto',recurring:'Ricorrenza',budgets:'Budget',settings:'Impostazioni'};
  const reasons=['Da determinare','Movimento mancante','Movimento duplicato','Importo errato','Conto errato','Data errata','Saldo iniziale errato','Trasferimento non registrato','Altro'];
  const status=c=>c.differenceCents===0?'Allineato':'Da verificare';
  function balanceAtDate(state,date,id){
    if(date.slice(0,7)<state.settings.openingMonth)return null;
    const a=state.accounts.find(x=>x.id===id);
    if(!a)return null;
    let n=a.openingCents;
    for(const t of state.transactions)if(t.accountId===id&&t.date.slice(0,7)>=state.settings.openingMonth&&t.date<=date)n+=t.type==='income'?t.amountCents:-t.amountCents;
    for(const t of state.transfers)if(t.date.slice(0,7)>=state.settings.openingMonth&&t.date<=date){
      if(t.fromId===id)n-=t.amountCents;
      if(t.toId===id)n+=t.amountCents;
    }
    return n;
  }
  function accountName(state,id){return state.accounts.find(a=>a.id===id)?.name||'Conto non presente';}
  function snapshot(kind,item){
    if(!item)return '—';
    if(kind==='transactions')return item.date+' · '+item.description+' · '+(item.type==='income'?'+':'−')+eur(item.amountCents)+' · '+item.category+' · conto '+item.accountId+(item.recurringId?' · '+(item.recurringFinal===false?'Acconto':'Saldo finale')+(item.plannedCents!==undefined?' · previsto '+eur(item.plannedCents):''):'');
    if(kind==='transfers')return item.date+' · '+eur(item.amountCents)+' · da '+item.fromId+' a '+item.toId+(item.note?' · '+item.note:'');
    if(kind==='accounts')return item.name+' · saldo iniziale '+eur(item.openingCents)+' · '+item.type+' · '+(item.active?'attivo':'archiviato');
    if(kind==='recurring')return item.description+' · '+eur(item.amountCents)+' · giorno '+item.day+' · conto '+item.accountId+' · '+(item.active?'attiva':'sospesa');
    if(kind==='budgets')return item.month+' · '+item.category+' · '+eur(item.limitCents);
    if(kind==='settings')return 'Mese iniziale '+item.openingMonth;
    return JSON.stringify(item);
  }
  function explain(kind,oldItem,newItem){
    if(!oldItem)return 'Registrazione aggiunta; verificare se era mancante.';
    if(!newItem)return 'Registrazione eliminata; verificare se era duplicata o errata.';
    if(kind==='transactions'){
      const changes=[];
      if(oldItem.amountCents!==newItem.amountCents)changes.push('importo');
      if(oldItem.accountId!==newItem.accountId)changes.push('conto');
      if(oldItem.date!==newItem.date)changes.push('data');
      if(oldItem.type!==newItem.type)changes.push('tipo');
      if(oldItem.description!==newItem.description)changes.push('descrizione');
      if(oldItem.category!==newItem.category)changes.push('categoria');
      if(oldItem.recurringFinal!==newItem.recurringFinal)changes.push('stato acconto/saldo finale');
      if(oldItem.plannedCents!==newItem.plannedCents)changes.push('importo ricorrente previsto');
      return changes.length?'Campi modificati: '+changes.join(', '):'Modifica di altri dettagli';
    }
    return 'Dati modificati';
  }
  function makeAudit(before,after,newId,now){
    const entries=[],at=now||new Date().toISOString();
    for(const kind of ['transactions','transfers','accounts','recurring','budgets']){
      const key=x=>kind==='budgets'?x.month+'|'+x.category:x.id;
      const prev=new Map((before[kind]||[]).map(x=>[key(x),x]));
      const next=new Map((after[kind]||[]).map(x=>[key(x),x]));
      const keys=new Set([...prev.keys(),...next.keys()]);
      for(const id of keys){
        const a=prev.get(id),b=next.get(id);
        if(JSON.stringify(a)===JSON.stringify(b))continue;
        const action=!a?'added':!b?'removed':'edited';
        const ids=[a?.accountId,b?.accountId,a?.id&&kind==='accounts'?a.id:null,b?.id&&kind==='accounts'?b.id:null,a?.fromId,a?.toId,b?.fromId,b?.toId].filter(Boolean);
        entries.push({id:newId(),at,kind,action,targetId:id,accountIds:[...new Set(ids)],title:(a?.description||b?.description||a?.name||b?.name||kinds[kind]),before:snapshot(kind,a),after:snapshot(kind,b),detail:explain(kind,a,b)});
      }
    }
    if(before.settings.openingMonth!==after.settings.openingMonth){
      entries.push({id:newId(),at,kind:'settings',action:'edited',targetId:'openingMonth',accountIds:[],title:'Mese di partenza',before:snapshot('settings',before.settings),after:snapshot('settings',after.settings),detail:'Mese iniziale modificato'});
    }
    return entries;
  }
  function csvSafe(value){
    let s=String(value??'');
    if(/^[\s\t\r\n]*[=+@-]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function csv(state){
    const rows=[['REGISTRO RICONCILIAZIONI'],['Registrata il','Data saldo','Conto','Saldo calcolato','Saldo reale','Differenza (reale - calcolato)','Esito','Causa indicata','Note']];
    for(const c of state.reconciliations||[])rows.push([c.createdAt,c.date,accountName(state,c.accountId),(c.calculatedCents/100).toFixed(2),(c.actualCents/100).toFixed(2),(c.differenceCents/100).toFixed(2),status(c),c.reason,c.note]);
    rows.push([],['REGISTRO MODIFICHE'],['Registrata il','Elemento','Operazione','Conti interessati','Descrizione','Prima','Dopo','Dettagli']);
    for(const a of state.auditLog||[])rows.push([a.at,kinds[a.kind],a.action,a.accountIds.map(id=>accountName(state,id)).join(' / '),a.title,a.before,a.after,a.detail]);
    rows.push([],['CASI DI RICONCILIAZIONE'],['ID caso','Conto','Verifica originale','Aperto il','Ultima modifica','Stato','Risolto il','Causa','Note','Correzioni collegate','Storico stati']);
    for(const c of state.reconciliationCases||[])rows.push([c.id,accountName(state,c.accountId),c.checkId,c.createdAt,c.updatedAt,c.status,c.resolvedAt||'',c.reason,c.note,c.auditIds.join(' / '),c.history.map(h=>h.at+': '+h.status+' '+h.note).join(' | ')]);
    return '\ufeff'+rows.map(a=>a.map(csvSafe).join(';')).join('\r\n');
  }
  function render(state,today,filter){
    const acc=state.accounts;
    const options=acc.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
    const first=acc[0];
    const initial=first?balanceAtDate(state,today,first.id):null;
    const checks=[...(state.reconciliations||[])].filter(c=>filter==='all'||c.accountId===filter).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const changes=[...(state.auditLog||[])].filter(a=>filter==='all'||!a.accountIds.length||a.accountIds.includes(filter)).sort((a,b)=>b.at.localeCompare(a.at));
    const filterHtml='<select class="field" id="recon-filter" aria-label="Filtra per conto"><option value="all">Tutti i conti</option>'+acc.map(a=>'<option value="'+esc(a.id)+'" '+(filter===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>';
    const checkHtml=checks.length?checks.slice(0,40).map(c=>{
      const cls=c.differenceCents===0?'recon-ok':'recon-alert';
      const diff=(c.differenceCents>0?'+':'')+eur(c.differenceCents);
      const next=checks.filter(x=>x.accountId===c.accountId&&x.createdAt>c.createdAt).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0];
      const relatedChanges=changes.filter(a=>a.at>c.createdAt&&(!next||a.at<=next.createdAt)&&a.accountIds.includes(c.accountId));
      const related=relatedChanges.length;
      const relatedHtml=related?'<details class="recon-log"><summary><strong>Correzioni tra questa verifica e la successiva ('+related+')</strong></summary><div class="recon-log-detail">'+relatedChanges.map(a=>'<div><small>'+esc(a.kind)+' · '+esc(new Date(a.at).toLocaleString('it-IT'))+'</small><p>'+esc(a.detail)+'</p><p>Prima: '+esc(a.before)+'</p><p>Dopo: '+esc(a.after)+'</p></div>').join('')+'</div></details>':'';
      return '<article class="recon-history-item '+cls+'"><div class="recon-history-head"><strong>'+esc(accountName(state,c.accountId))+'</strong><span>'+esc(c.date)+' · '+esc(status(c))+'</span></div><div class="recon-pairs"><span>Calcolato <strong>'+eur(c.calculatedCents)+'</strong></span><span>Reale <strong>'+eur(c.actualCents)+'</strong></span><span>Scostamento <strong>'+diff+'</strong></span></div><p class="recon-minor">Verificato: '+esc(new Date(c.createdAt).toLocaleString('it-IT'))+' · Motivo: '+esc(c.reason)+' · Modifiche successive registrate: '+related+'</p>'+(c.note?'<p>'+esc(c.note)+'</p>':'')+relatedHtml+'</article>';
    }).join(''):'<div class="empty"><strong>Nessuna riconciliazione salvata</strong>La prima verifica creerà una fotografia del saldo reale e di quello calcolato.</div>';
    const actionLabel={added:'Aggiunto',removed:'Eliminato',edited:'Modificato'};
    const logHtml=changes.length?changes.slice(0,60).map(a=>'<details class="recon-log"><summary><strong>'+esc(actionLabel[a.action]||a.action)+' · '+esc(kinds[a.kind]||a.kind)+'</strong><span>'+esc(a.title)+' · '+esc(new Date(a.at).toLocaleString('it-IT'))+'</span></summary><div class="recon-log-detail"><div><small>PRIMA</small><p>'+esc(a.before)+'</p></div><div><small>DOPO</small><p>'+esc(a.after)+'</p></div><p class="recon-minor">'+esc(a.detail)+'</p></div></details>').join(''):'<div class="empty"><strong>Registro modifiche vuoto</strong>Le modifiche saranno tracciate da questa versione in avanti. Le correzioni storiche precedenti non possono essere ricostruite automaticamente.</div>';
    return '<section class="card recon-intro"><h2 class="section-title">Verifica un conto</h2><p class="section-sub">Inserisci il saldo realmente disponibile. CasaChiara lo confronterà con il saldo ricostruito dai movimenti fino alla data indicata. Salvare una verifica non cambia il conto.</p>'+
      '<form id="reconciliation-form"><div class="two-columns"><div class="form-field"><label for="recon-account">Conto</label><select id="recon-account" class="field" required>'+options+'</select></div>'+
      '<div class="form-field"><label for="recon-date">Data del saldo reale</label><input type="date" id="recon-date" class="field" value="'+esc(today)+'" max="'+esc(today)+'" min="'+esc(state.settings.openingMonth)+'-01" required></div>'+
      '<div class="form-field"><label for="recon-actual">Saldo reale (€)</label><input id="recon-actual" class="field" type="text" inputmode="decimal" placeholder="Es. 375,41" required></div>'+
      '<div class="form-field"><label for="recon-reason">Possibile causa dello scostamento</label><select id="recon-reason" class="field">'+reasons.map(v=>'<option>'+esc(v)+'</option>').join('')+'</select></div>'+
      '<div class="form-field full"><label for="recon-note">Note (facoltative)</label><textarea id="recon-note" class="field" maxlength="500" rows="2" placeholder="Es. addebito non registrato; estratto conto verificato"></textarea></div></div>'+
      '<div class="recon-comparison"><div><small>Saldo calcolato</small><strong id="recon-calculated">'+(initial===null?'—':eur(initial))+'</strong></div><div><small>Saldo reale inserito</small><strong id="recon-real-preview">—</strong></div><div><small>Differenza: reale − calcolato</small><strong id="recon-difference">—</strong></div></div>'+
      '<div id="recon-diagnostics" aria-live="polite"></div><p class="recon-minor">Uno scostamento non viene corretto automaticamente: individua la registrazione errata in Movimenti o Conti, correggila e salva una nuova verifica per documentare il risultato.</p><button class="button primary" type="submit">Salva verifica nel registro</button></form></section>'+
      '<section class="card"><div class="section-header"><div><h2 class="section-title">Registro delle riconciliazioni</h2><p class="section-sub">Confronto storico tra saldo dell’app e saldo reale, con eventuale causa annotata.</p></div><button type="button" id="recon-export" class="button soft small">Esporta registro CSV</button></div><div class="recon-filter">'+filterHtml+'</div>'+checkHtml+(checks.length>40?'<p class="recon-minor">Visualizzate le ultime 40 verifiche: il CSV contiene la cronologia completa.</p>':'')+'</section>'+
      '<section class="card"><h2 class="section-title">Registro delle modifiche</h2><p class="section-sub">Prima e dopo di movimenti, trasferimenti, conti, ricorrenze e budget modificati dopo l’aggiornamento. Il registro non modifica gli importi.</p>'+logHtml+(changes.length>60?'<p class="recon-minor">Visualizzate le ultime 60 modifiche: esporta il CSV per lo storico completo.</p>':'')+'</section>';
  }
  global.CasaChiaraRecon=Object.freeze({balanceAtDate,makeAudit,render,csv});
})(globalThis);
