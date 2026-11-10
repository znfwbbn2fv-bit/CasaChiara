'use strict';
/* CasaChiara 2.5 — diagnosi euristica locale, casi da risolvere e salute dei conti.
   I suggerimenti NON sono conferme contabili. */
(function(g){
  const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
  const euro=c=>money.format(c/100);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={open:'Aperto',review:'In verifica',resolved:'Risolto'};
  const fmt=x=>new Date(x).toLocaleString('it-IT');
  const latest=checks=>[...checks].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  function findings(state,accountId,date,difference){
    if(difference===0)return [{type:'ok',message:'I saldi coincidono. Questo non esclude errori che si compensano: confronta comunque i movimenti con l’estratto conto.'}];
    const amount=Math.abs(difference);
    const suggestions=[];
    const tx=state.transactions.filter(t=>t.accountId===accountId&&t.date<=date&&t.date.slice(0,7)>=state.settings.openingMonth);
    if(difference<0)suggestions.push({type:'generic',message:'Il saldo reale è inferiore a quello calcolato di '+euro(amount)+'. Controlla pagamenti mancanti, entrate registrate due volte e saldi iniziali troppo alti.'});
    else suggestions.push({type:'generic',message:'Il saldo reale è superiore a quello calcolato di '+euro(amount)+'. Controlla entrate mancanti, spese duplicate e saldi iniziali troppo bassi.'});
    // An existing amount matching the gap is a clue, not proof that it is wrong.
    const same=tx.filter(t=>t.amountCents===amount).slice(-4);
    if(same.length)suggestions.push({type:'amount',message:'Movimenti dello stesso importo da verificare: '+same.map(t=>t.date+' · '+t.description+' ('+(t.type==='expense'?'uscita':'entrata')+')').join('; ')});
    const day=x=>Date.parse(x+'T12:00:00');
    const duplicates=[];
    for(let i=0;i<tx.length;i++)for(let j=i+1;j<tx.length;j++){
      const a=tx[i],b=tx[j];
      if(a.type===b.type&&a.amountCents===b.amountCents&&a.description.trim().toLowerCase()===b.description.trim().toLowerCase()&&Math.abs(day(a.date)-day(b.date))<=3*86400000){
        duplicates.push(a.description+' · '+euro(a.amountCents)+' ('+a.date+' e '+b.date+')');
        if(duplicates.length>=3)break;
      }
      if(duplicates.length>=3)break;
    }
    if(duplicates.length)suggestions.push({type:'duplicate',message:'Possibili duplicati da controllare (potrebbero essere pagamenti realmente distinti): '+duplicates.join('; ')});
    const transfers=state.transfers.filter(t=>t.date<=date&&(t.fromId===accountId||t.toId===accountId));
    const equal=transfers.filter(t=>t.amountCents===amount);
    if(equal.length)suggestions.push({type:'transfer',message:'È presente un trasferimento dello stesso importo: controlla che non sia stato registrato anche come spesa o entrata.'});
    if(!same.length&&!equal.length)suggestions.push({type:'caution',message:'Nessuna corrispondenza esatta individuata. Potrebbero esserci più movimenti errati che si compensano: confronta l’estratto conto voce per voce.'});
    return suggestions.slice(0,5);
  }
  function findingsHTML(state,accountId,date,difference){
    if(!Number.isSafeInteger(difference)||!accountId||!date)return '';
    return '<div class="recon-findings"><strong>Controlli suggeriti (non automatici)</strong><ul>'+findings(state,accountId,date,difference).map(s=>'<li>'+esc(s.message)+'</li>').join('')+'</ul></div>';
  }
  function health(state,date){
    const checks=state.reconciliations||[],audits=state.auditLog||[],cases=state.reconciliationCases||[];
    return state.accounts.filter(a=>a.active).map(a=>{
      const check=latest(checks.filter(c=>c.accountId===a.id&&c.date<=date));
      const unresolved=cases.filter(c=>c.accountId===a.id&&c.status!=='resolved');
      if(!check)return {account:a,status:'unchecked',label:'Non verificato',date:null,open:unresolved.length};
      const changed=audits.some(x=>x.at>check.createdAt&&(x.accountIds.includes(a.id)||x.kind==='settings'));
      const stale=check.date<date||changed;
      const status=unresolved.length?'problem':check.differenceCents!==0?'problem':stale?'stale':'ok';
      return {account:a,status,label:status==='ok'?'Allineato':status==='stale'?'Da ricontrollare':'Scostamento / caso aperto',
        date:check.date,open:unresolved.length,difference:check.differenceCents};
    });
  }
  function healthHTML(state,date){
    const rows=health(state,date);
    return '<section class="card recon-health"><div class="section-header"><div><h2 class="section-title">Salute dei conti</h2><p class="section-sub">Stato delle ultime verifiche · '+esc(date)+'</p></div><button class="button soft small" data-view="reconciliation">Riconcilia</button></div>'+
      (rows.length?rows.map(h=>'<div class="recon-health-row"><div><strong>'+esc(h.account.name)+'</strong><small>'+(h.date?'Ultima verifica del '+esc(h.date):'Nessuna verifica')+(h.open?' · '+h.open+' casi aperti':'')+'</small></div><span class="recon-health-pill '+esc(h.status)+'">'+esc(h.label)+'</span></div>').join(''):'<p>Nessun conto attivo.</p>')+
      '<p class="recon-minor">“Allineato” significa verificato alla data indicata; non equivale a certificazione bancaria né a controllo dei movimenti successivi.</p></section>';
  }
  function caseHTML(state,accountId='all'){
    const cases=[...(state.reconciliationCases||[])].filter(c=>accountId==='all'||c.accountId===accountId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const accountName=id=>state.accounts.find(a=>a.id===id)?.name||'Conto non presente';
    const checks=state.reconciliations||[];
    const orphan=checks.filter(c=>c.differenceCents!==0&&!cases.some(k=>k.checkId===c.id)&&!(state.reconciliationCases||[]).some(k=>k.checkId===c.id)).slice(-12).reverse();
    const statusLabel=c=>labels[c.status]||c.status;
    return '<section class="card"><div class="section-header"><div><h2 class="section-title">Casi di riconciliazione</h2><p class="section-sub">Tieni aperti gli errori finché non sono spiegati e verificati.</p></div></div>'+
      (cases.length?cases.slice(0,60).map(c=>{
        const original=checks.find(x=>x.id===c.checkId),fixes=(c.auditIds||[]).map(id=>state.auditLog.find(a=>a.id===id)).filter(Boolean);
        return '<article class="recon-case"><div class="recon-history-head"><strong>'+esc(accountName(c.accountId))+' · '+esc(statusLabel(c))+'</strong><span>'+esc(original?.date||'')+'</span></div><p class="recon-minor">Scostamento iniziale: '+(original?euro(original.differenceCents):'—')+' · Causa: '+esc(c.reason||'Da determinare')+'</p>'+
          (c.note?'<p>'+esc(c.note)+'</p>':'')+
          (fixes.length?'<details><summary>Correzioni collegate ('+fixes.length+')</summary><ul>'+fixes.map(a=>'<li>'+esc(a.title)+' · '+esc(a.before)+' → '+esc(a.after)+'</li>').join('')+'</ul></details>':'<p class="recon-minor">Nessuna correzione collegata.</p>')+
          '<p class="recon-minor">Ultima attività: '+esc(fmt(c.updatedAt))+'</p><button class="button soft small" type="button" data-manage-case="'+esc(c.id)+'">Gestisci caso</button></article>';
      }).join(''):'<p class="recon-minor">Nessun caso aperto o risolto registrato.</p>')+
      (orphan.length?'<div class="recon-orphans"><strong>Vecchie verifiche non collegate a casi</strong>'+orphan.map(c=>'<div class="recon-orphan"><span>'+esc(accountName(c.accountId))+' · '+esc(c.date)+' · '+euro(c.differenceCents)+'</span><button type="button" class="button soft small" data-create-case="'+esc(c.id)+'">Crea caso</button></div>').join('')+'</div>':'')+
      '</section>';
  }
  function caseModal(state,id){
    const c=state.reconciliationCases.find(x=>x.id===id);
    if(!c)return '';
    const a=state.accounts.find(x=>x.id===c.accountId);
    const linked=new Set(c.auditIds);
    const candidates=state.auditLog.filter(x=>x.accountIds.includes(c.accountId)&&x.at>=c.createdAt).slice(-40).reverse();
    const last=latest(state.reconciliations.filter(x=>x.accountId===c.accountId));
    const canResolve=!!last&&last.differenceCents===0&&last.createdAt>c.createdAt;
    return '<div class="dialog-body"><form id="case-form"><input type="hidden" id="case-id" value="'+esc(id)+'">'+
      '<p class="recon-minor">Conto: '+esc(a?.name||'—')+'. Per contrassegnare un errore come risolto, salva prima una nuova verifica con differenza pari a zero.</p>'+
      '<div class="form-field"><label for="case-status">Stato</label><select class="field" id="case-status">'+Object.entries(labels).map(([v,l])=>'<option value="'+v+'" '+(v===c.status?'selected':'')+(v==='resolved'&&!canResolve&&c.status!=='resolved'?' disabled':'')+'>'+l+'</option>').join('')+'</select></div>'+
      '<div class="form-field"><label for="case-reason">Causa individuata</label><input class="field" maxlength="90" id="case-reason" value="'+esc(c.reason)+'" required></div>'+
      '<div class="form-field"><label for="case-note">Spiegazione e interventi effettuati</label><textarea class="field" id="case-note" maxlength="500" rows="3">'+esc(c.note)+'</textarea></div>'+
      '<div class="form-field"><label>Collega le correzioni del registro</label><div class="recon-audit-choices">'+(candidates.length?candidates.map(x=>'<label class="recon-check"><input type="checkbox" name="case-audit" value="'+esc(x.id)+'" '+(linked.has(x.id)?'checked':'')+'> '+esc(x.title)+' · '+esc(x.detail)+' · '+esc(fmt(x.at))+'</label>').join(''):'<p class="recon-minor">Nessuna modifica successiva all’apertura del caso.</p>')+'</div></div>'+
      '<p class="recon-minor">'+(canResolve?'Esiste una verifica successiva all’apertura con differenza zero.':'Per segnare il caso come risolto serve una verifica successiva con saldo allineato.')+'</p></form></div><div class="dialog-foot"><button type="button" class="button" data-close>Annulla</button><button type="submit" form="case-form" class="button primary">Salva caso</button></div>';
  }
  g.CasaChiara25=Object.freeze({findings,findingsHTML,health,healthHTML,caseHTML,caseModal});
})(globalThis);
