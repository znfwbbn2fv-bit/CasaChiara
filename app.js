'use strict';
(() => {
const LEGACY_STORAGE_KEY='casachiara.pwa.v3';
const LEGACY_OLDER_KEY='casachiara.pwa.v2';
const STORAGE_KEY='casachiara.pwa.v4';
const CORE=globalThis.CasaChiaraCore;
const RECON=globalThis.CasaChiaraRecon;
const CC25=globalThis.CasaChiara25;
const SECURE=globalThis.CasaChiaraSecureBackup;
const PLAN=globalThis.CasaChiaraPlanning26;
if(!CORE||!RECON||!CC25||!SECURE||!PLAN)throw Error('Moduli CasaChiara 2.5 non disponibili.');
const ROLLBACK_KEY='casachiara.pwa.v4.before-import';
const LAST_EXPORT_KEY='casachiara.pwa.v4.last-export-started';
const APP_VERSION='2.6.0';
let backupFileMode='import';
const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
const expenseCats=['Casa','Utenze','Alimentari','Trasporti','Salute','Tempo libero','Finanziamenti','Abbonamenti','Animali','Istruzione','Altro'];
const incomeCats=['Stipendio','Pensione','Affitti','Rimborsi','Vendite','Lavori extra','Regali','Altro'];
const hues=['#ab9aeb','#91d7c5','#f1abba','#f2c78c','#9ebaf4','#d1a6d9','#88cbd5','#f3bda1','#a6ce99','#b5b9d7'];
const today=new Date();
const toMonth = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const toDate = d => `${toMonth(d)}-${String(d.getDate()).padStart(2,'0')}`;
const nowMonth=toMonth(today);
const newState=()=>CORE.makeState(nowMonth);
let state=newState(),view='dashboard',selectedMonth=nowMonth,storageOK=true,search='',kindFilter='all',recurringFilter='all',reconFilter='all',toastTimer;
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=c=>money.format(c/100);
const positive=c=>`${c>=0?'+':'−'} ${euro(Math.abs(c))}`;
const categoryList=type=>type==='income'?incomeCats:expenseCats;
const showToast=txt=>{const node=el('toast');node.textContent=txt;node.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.style.display='none'},4200)};
function uid(){return 'cc_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)}
function validMonth(s){return typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s)}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1,d);return t.getFullYear()===y&&t.getMonth()+1===m&&t.getDate()===d}
function addMonth(m,n){let [y,k]=m.split('-').map(Number);return toMonth(new Date(y,k-1+n,1))}
function monthName(m,short=false){const [y,k]=m.split('-').map(Number);return new Date(y,k-1,1).toLocaleDateString('it-IT',short?{month:'short'}:{month:'long',year:'numeric'}).replace('.','')}
function dueDate(m,day){const [y,k]=m.split('-').map(Number);const last=new Date(y,k,0).getDate();return `${m}-${String(Math.min(Math.max(day,1),last)).padStart(2,'0')}`}
function amountFromInput(x,allowNegative=false){let t=String(x??'').replace(/[\s€]/g,'').trim();if(!t)return null; if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(t))return null;const n=Number(t);if(!Number.isFinite(n)||Math.abs(n)>100000000)return null;const cents=Math.round(n*100);return ((!allowNegative&&cents<=0)||!Number.isSafeInteger(cents))?null:cents}
function amountForInput(c){return (c/100).toFixed(2).replace('.',',')}
function checkData(raw){return CORE.normalize(raw,nowMonth)}
function displayStorageWarning(){el('alert-storage').hidden=storageOK}
try{
 localStorage.setItem('__cc_test','1');localStorage.removeItem('__cc_test');
 const stored=localStorage.getItem(STORAGE_KEY);
 const legacy=!stored?(localStorage.getItem(LEGACY_STORAGE_KEY)||localStorage.getItem(LEGACY_OLDER_KEY)):null;
 if(stored)state=checkData(JSON.parse(stored));
 else if(legacy){state=checkData(JSON.parse(legacy));localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
}catch(err){storageOK=false;console.warn('Impossibile leggere o migrare la memoria locale:',err)}
function applyChange(mutator){const previous=state;try{const draft=JSON.parse(JSON.stringify(state));mutator(draft);const candidate=checkData(draft);const audit=RECON.makeAudit(previous,candidate,uid);candidate.auditLog.push(...audit);state=checkData(candidate);if(save())return true;state=previous;return false}catch(err){state=previous;alert('Operazione annullata: '+err.message);return false}}
function save(){if(!storageOK){displayStorageWarning();showToast('Archivio non disponibile: dati non salvati');return false}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true}catch(err){showToast('Salvataggio non riuscito: liberare spazio e riprovare');return false}}
function allForMonth(m){return state.transactions.filter(t=>t.date.startsWith(m)).sort((a,b)=>b.date.localeCompare(a.date))}
function totalForMonth(m){const ts=allForMonth(m);let income=0,expense=0;for(const t of ts){if(t.type==='income')income+=t.amountCents;else expense+=t.amountCents}return {income,expense,net:income-expense,transactions:ts}}
function sumBalance(m){return CORE.totalBalance(state,m)}
function activeAccounts(){return state.accounts.filter(a=>a.active)}
function defaultAccount(){return activeAccounts()[0]?.id||state.accounts[0].id}
function accountName(id){return state.accounts.find(a=>a.id===id)?.name||'Conto mancante'}
function accountOptions(selected){return state.accounts.filter(a=>a.active||a.id===selected).map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('')}
function accountTypeName(t){return ({bank:'Conto corrente',cash:'Contanti',prepaid:'Prepagata',savings:'Risparmi',other:'Altro'})[t]||'Altro'}
function activeRule(r,m){return r.active&&r.startMonth<=m&&(!r.endMonth||r.endMonth>=m)}
function completedRule(r,m){return PLAN.occurrence(state,r,m).state==='completed'}
function pendingRules(m){return state.recurring.filter(r=>activeRule(r,m)&&!completedRule(r,m)).sort((a,b)=>a.day-b.day)}
function planStats(m){return PLAN.pendingNet(state,m)}

function budgetPanel(m,compact=false){
 const summary=CORE.budgetSummary(state,m);
 const {categories,limitCents,spentBudgetedCents,spentUnbudgetedCents,overspentCount}=summary;
 const remaining=limitCents-spentBudgetedCents;
 const hint=spentUnbudgetedCents?'<p class="planning-hint">Spese in categorie senza budget: <strong>'+euro(spentUnbudgetedCents)+'</strong>. Non sono comprese nel residuo dei budget impostati.</p>':'';
 if(compact)return `<section class="card planning-summary"><div class="section-header"><div><h2 class="section-title">Budget del mese</h2><p class="section-sub">Limiti impostati per categoria · ${esc(monthName(m))}</p></div><button class="button soft small" type="button" data-view="recurring">Pianifica</button></div>${categories.length?`<div class="plan-metrics"><div><small>Budget assegnato</small><strong>${euro(limitCents)}</strong></div><div><small>Spese sulle categorie</small><strong>${euro(spentBudgetedCents)}</strong></div><div><small>Disponibile sui budget</small><strong class="${remaining<0?'bad':''}">${euro(remaining)}</strong></div></div><p class="planning-hint">${overspentCount?'Attenzione: '+overspentCount+' categorie hanno superato il limite.':'Nessun budget superato.'}</p>${hint}`:'<div class="empty"><strong>Nessun budget per il mese</strong>Apri Pianifica per impostare un limite alle categorie di spesa.</div>'}</section>`;
 const rows=categories.map(b=>{
   const ratio=Math.round(100*b.spentCents/b.limitCents),progress=Math.min(100,ratio),over=b.remainingCents<0;
   return `<div class="budget-row"><div class="budget-row-top"><strong>${esc(b.category)}</strong><button type="button" class="icon-button" data-edit-budget="${esc(b.category)}">Modifica</button></div><div class="budget-numbers"><span>${euro(b.spentCents)} di ${euro(b.limitCents)}</span><strong class="${over?'bad':''}">${over?'Superato di '+euro(-b.remainingCents):'Residuo '+euro(b.remainingCents)}</strong></div><div class="budget-track" role="progressbar" aria-label="${esc(b.category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="budget-fill ${over?'over':''}" style="width:${progress}%"></div></div></div>`;
 }).join('');
 const prev=addMonth(m,-1),canCopy=state.budgets.some(b=>b.month===prev);
 return `<section class="card planning-budget"><div class="section-header"><div><h2 class="section-title">Budget per categoria</h2><p class="section-sub">Limiti mensili · ${esc(monthName(m))}</p></div><button class="button primary small" type="button" id="add-budget">＋ Budget</button></div>
 ${categories.length?`<div class="plan-metrics"><div><small>Limiti totali</small><strong>${euro(limitCents)}</strong></div><div><small>Speso nelle categorie</small><strong>${euro(spentBudgetedCents)}</strong></div><div><small>Residuo dei budget</small><strong class="${remaining<0?'bad':''}">${euro(remaining)}</strong></div></div>${rows}`:'<div class="empty"><strong>Non hai ancora impostato budget</strong>Per cominciare, stabilisci una soglia mensile per una categoria di spesa.</div>'}
 ${hint}<div class="planning-tools"><button class="button soft small" type="button" id="copy-budget" ${canCopy?'':'disabled'}>Copia budget da ${esc(monthName(prev))}</button></div><p class="planning-hint">I budget sono obiettivi di spesa, non uscite. Il saldo cambia soltanto registrando movimenti effettivi. Ogni mese ha budget indipendenti.</p></section>`;
}
function deadlinePanel(m){return PLAN.deadlineHTML(state,m,toDate(today),accountName)}
function metric(title,amount,note,color,icon){return `<article class="card metric"><div class="metric-top"><h2>${esc(title)}</h2><span class="metric-icon ${color}">${icon}</span></div><div class="metric-value ${color}">${amount}</div><p>${esc(note)}</p></article>`}
function entryList(ts,limit=null){let list=limit?ts.slice(0,limit):ts;return list.length?list.map(t=>`<div class="entry"><span class="entry-mark ${t.type}">${t.type==='income'?'↑':'↓'}</span><div class="entry-body"><strong>${esc(t.description)}</strong><small>${esc(t.category)} · ${esc(accountName(t.accountId))} · ${new Date(t.date+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}${t.recurringId?' · Da ricorrenza':''}</small></div><span class="entry-amount ${t.type}">${t.type==='income'?'+':'−'} ${euro(t.amountCents)}</span><button class="icon-button" type="button" data-edit-transaction="${esc(t.id)}">Modifica</button></div>`).join(''):'<div class="empty"><strong>Nessun movimento</strong>Registra un’entrata o una spesa per iniziare.</div>'}
function dashboard(){const t=totalForMonth(selectedMonth),b=sumBalance(selectedMonth),p=planStats(selectedMonth);let bars=[],max=1;for(let i=-5;i<=0;i++){const m=addMonth(selectedMonth,i),z=totalForMonth(m);bars.push({m,...z});max=Math.max(max,z.income,z.expense)}const graph=bars.map(z=>`<div class="bar-month" title="${esc(monthName(z.m))}: ${euro(z.income)} entrate, ${euro(z.expense)} uscite"><span class="bar income" style="height:${Math.max(2,Math.round(z.income/max*100))}%"></span><span class="bar expense" style="height:${Math.max(2,Math.round(z.expense/max*100))}%"></span><label>${esc(monthName(z.m,true))}</label></div>`).join('');
 let catMap={};for(const z of t.transactions.filter(z=>z.type==='expense'))catMap[z.category]=(catMap[z.category]||0)+z.amountCents;let cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);let sum=cats.reduce((n,x)=>n+x[1],0),gradient=cats.length?(()=>{let cursor=0;return `conic-gradient(${cats.map(([_,n],i)=>{const a=cursor;cursor+=n/sum*100;return `${hues[i%hues.length]} ${a}% ${cursor}%`}).join(',')})`})():'conic-gradient(#edf0f6 0% 100%)';
 const donut=`<div class="donut-layout"><div class="donut" style="background:${gradient}"><div class="donut-hole"><strong>${euro(sum)}</strong><small>Spese effettive</small></div></div><div class="categories">${cats.length?cats.slice(0,8).map(([name,n],i)=>`<div class="cat-row"><span class="cat-name"><i class="dot" style="background:${hues[i%hues.length]}"></i>${esc(name)}</span><span class="cat-amount">${euro(n)}</span></div>`).join(''):'<span class="preview">Non ci sono ancora spese registrate.</span>'}</div></div>`;
 let due=pendingRules(selectedMonth).slice(0,5);return `<div class="developer-credit" aria-label="Creatore dell’app: SEGNOTA Studio"><span class="developer-credit-mark" aria-hidden="true">✦</span><span>Developed by <strong>SEGNOTA Studio</strong></span></div><section class="metrics">${metric('Entrate incassate',euro(t.income),'Somma effettivamente ricevuta','green','↗')}${metric('Spese effettuate',euro(t.expense),'Somma effettivamente pagata','red','↘')}${metric('Risultato del mese',positive(t.net),'Solo movimenti effettivi','purple','◈')}${metric('Saldo progressivo',b===null?'—':euro(b),'Dalla data del saldo iniziale','yellow','▣')}</section>
 <section class="account-preview"><div class="section-header"><div><h2 class="section-title">I tuoi conti</h2><p class="section-sub">Disponibilità separate · totale già incluso nel saldo progressivo</p></div><div class="backup-actions"><button class="button soft small" type="button" data-view="reconciliation">Riconcilia</button><button class="button soft small" type="button" data-view="accounts">Gestisci conti</button></div></div><div class="account-preview-grid">${state.accounts.map(a=>`<article class="account-tile"><small>${esc(accountTypeName(a.type))}</small><strong>${esc(a.name)}</strong><span >${CORE.accountBalance(state,selectedMonth,a.id)===null?'—':euro(CORE.accountBalance(state,selectedMonth,a.id))}</span></article>`).join('')}</div></section>
 ${CC25.healthHTML(state,toDate(today))}
 ${PLAN.forecastHTML(state,selectedMonth,toDate(today))}
 ${PLAN.trendHTML(state,selectedMonth)}
 ${budgetPanel(selectedMonth,true)}
 <section class="quick-grid"><button type="button" class="quick-action" data-quick="fixed-expense"><span class="quick-icon">−</span><strong>Spesa fissa</strong><small>Mutuo, bollette, abbonamenti</small></button><button type="button" class="quick-action" data-quick="extra-expense"><span class="quick-icon">−</span><strong>Spesa extra</strong><small>Acquisti, imprevisti, svago</small></button><button type="button" class="quick-action income" data-quick="fixed-income"><span class="quick-icon">+</span><strong>Entrata mensile</strong><small>Stipendio, pensione, affitti</small></button><button type="button" class="quick-action income" data-quick="extra-income"><span class="quick-icon">+</span><strong>Entrata extra</strong><small>Rimborsi e guadagni occasionali</small></button></section>
 <section class="dashboard-grid"><article class="card"><div class="section-header"><div><h2 class="section-title">Andamento finanziario</h2><p class="section-sub">Ultimi sei mesi · dati effettivi</p></div><div class="legend"><span class="legend-item"><i class="dot" style="background:#99ddcb"></i>Entrate</span><span class="legend-item"><i class="dot" style="background:#f4abba"></i>Spese</span></div></div><div class="bar-chart" role="img" aria-label="Grafico a barre delle entrate e spese effettive negli ultimi sei mesi">${graph}</div></article><article class="card"><h2 class="section-title">Dove spendi</h2><p class="section-sub">Distribuzione delle spese per categoria</p>${donut}</article></section>
 <section class="dashboard-grid"><article class="card"><div class="section-header"><div><h2 class="section-title">Ricorrenze ancora previste</h2><p class="section-sub">Non influenzano il saldo fino alla conferma</p></div><button type="button" class="button soft small" data-view="recurring">Vedi tutte</button></div><div class="planned"><div class="planned-item"><span>Entrate attese</span><strong style="color:var(--green)">${euro(p.income)}</strong></div><div class="planned-item"><span>Spese previste</span><strong style="color:var(--red)">${euro(p.expense)}</strong></div><div class="planned-item"><span>Risultato potenziale</span><strong>${positive(t.net+p.net)}</strong></div></div>${due.length?due.map(r=>`<div class="entry"><span class="entry-mark ${r.type}">${r.type==='income'?'↑':'↓'}</span><div class="entry-body"><strong>${esc(r.description)}</strong><small>${esc(r.category)} · Giorno ${r.day}</small></div><span class="entry-amount ${r.type}">${euro(PLAN.occurrence(state,r,selectedMonth).remaining)}</span><button class="button soft small" type="button" data-complete="${esc(r.id)}">${r.type==='income'?'Incassata':'Pagata'}</button></div>`).join(''):'<div class="empty"><strong>Nessuna ricorrenza in attesa</strong>Puoi aggiungere nuove spese o entrate mensili.</div>'}</article>
 <article class="card"><div class="section-header"><div><h2 class="section-title">Ultimi movimenti</h2><p class="section-sub">Registrazioni del mese selezionato</p></div><button class="button soft small" type="button" data-view="transactions">Registro</button></div>${entryList(t.transactions,5)}</article></section><div class="notice">I valori previsti non sono pagamenti o incassi: per registrarli come effettivi, premi “Pagata” o “Incassata”. Un promemoria non sostituisce la verifica del movimento bancario.</div>`;
}
function transactionsView(){const t=totalForMonth(selectedMonth);let list=t.transactions.filter(x=>(kindFilter==='all'||x.type===kindFilter)&&[x.description,x.category].join(' ').toLowerCase().includes(search.toLowerCase()));return `<section class="card"><div class="section-header"><div><h2 class="section-title">Registro movimenti</h2><p class="section-sub">Entrate e spese confermate · ${esc(monthName(selectedMonth))}</p></div><button class="button primary small" type="button" data-add="transaction">＋ Aggiungi</button></div><div class="bar-actions"><input aria-label="Cerca nei movimenti" class="filter" type="search" id="search" placeholder="Cerca descrizione o categoria" value="${esc(search)}"><select aria-label="Filtra per tipo" class="filter" id="kind-filter"><option value="all">Tutti</option><option value="income" ${kindFilter==='income'?'selected':''}>Entrate</option><option value="expense" ${kindFilter==='expense'?'selected':''}>Spese</option></select></div><div id="transaction-rows">${entryList(list)}</div><div class="notice">Saldo effettivo del mese: <strong>${positive(t.net)}</strong>. Le ricorrenze non confermate non rientrano in questo importo.</div></section>`}
function accountsView(){
 const entries=state.accounts.map(a=>`<div class="entry"><span class="entry-mark income">▣</span><div class="entry-body"><strong>${esc(a.name)}</strong><small>${esc(accountTypeName(a.type))} · Saldo di partenza: ${euro(a.openingCents)}${a.active?'':' · Archiviato'}</small></div><span class="entry-amount">${CORE.accountBalance(state,selectedMonth,a.id)===null?'—':euro(CORE.accountBalance(state,selectedMonth,a.id))}</span><button class="icon-button" type="button" data-edit-account="${esc(a.id)}">Modifica</button></div>`).join('');
 const transfers=state.transfers.filter(t=>t.date.startsWith(selectedMonth)).sort((a,b)=>b.date.localeCompare(a.date));
 const rows=transfers.map(t=>`<div class="entry"><span class="entry-mark transfer">⇄</span><div class="entry-body"><strong>${esc(accountName(t.fromId))} → ${esc(accountName(t.toId))}</strong><small>${esc(t.date)}${t.note?' · '+esc(t.note):''}</small></div><span class="entry-amount">${euro(t.amountCents)}</span><button class="icon-button" type="button" data-edit-transfer="${esc(t.id)}">Modifica</button></div>`).join('');
 return `<div class="alert">I trasferimenti spostano denaro tra i tuoi conti, ma <strong>non costituiscono spese o entrate</strong>. Il saldo complessivo rimane invariato. Quando aggiungi un conto già finanziato, evita di duplicare denaro presente in altri conti: per spostarlo utilizza un trasferimento.</div>
 <div class="section-header"><div><h2 class="section-title">Conti e disponibilità</h2><p class="section-sub">Situazione alla fine di ${esc(monthName(selectedMonth))}</p></div><button class="button primary small" type="button" id="add-account">＋ Nuovo conto</button></div>
 <section class="card"><div class="section-header"><h2 class="section-title">Saldo complessivo: ${sumBalance(selectedMonth)===null?'—':euro(sumBalance(selectedMonth))}</h2><button class="button soft small" type="button" id="add-transfer">⇄ Trasferisci</button></div>${entries}</section>
 <section class="card" style="margin-top:16px"><div class="section-header"><div><h2 class="section-title">Trasferimenti · ${esc(monthName(selectedMonth))}</h2><p class="section-sub">Movimenti tra i tuoi conti senza impatto su entrate e spese</p></div><button class="button soft small" id="add-transfer-second" type="button">＋ Trasferimento</button></div>${transfers.length?rows:'<div class="empty"><strong>Nessun trasferimento</strong>Trasferisci denaro fra due conti senza alterare il bilancio domestico.</div>'}</section>`;
}
function recurringView(){
  const rules=state.recurring.filter(r=>recurringFilter==='all'||activeRule(r,selectedMonth)).sort((a,b)=>a.day-b.day);
  const rows=rules.map(r=>{
    const isActive=activeRule(r,selectedMonth);
    const occur=PLAN.occurrence(state,r,selectedMonth),done=occur.state==='completed';
    const period=`Da ${esc(monthName(r.startMonth))}${r.endMonth?' a '+esc(monthName(r.endMonth)):''}`;
    const status=!isActive?'Non prevista':done?'Confermata':occur.state==='partial'?'Parziale':'Da confermare';
    const complete=(isActive&&!done) ? `<button class="button soft small" type="button" data-complete="${esc(r.id)}">${r.type==='income'?'Incassata':'Pagata'}</button>` : '';
    return `<div class="entry"><span class="entry-mark ${r.type}">${r.type==='income'?'↑':'↓'}</span><div class="entry-body"><strong>${esc(r.description)}</strong><small>${esc(r.category)} · Giorno ${r.day} · ${period}</small><small>Previsto ${euro(occur.expected)} · Registrato ${euro(occur.paid)}${done?' · Differenza '+positive(occur.variance):' · Residuo '+euro(occur.remaining)}</small><span class="status ${!isActive?'off':done?'done':''}">${status}</span></div><span class="entry-amount ${r.type}">${r.type==='income'?'+':'−'} ${euro(r.amountCents)}</span><div class="entry-actions">${complete}<button class="icon-button" type="button" data-edit-recurring="${esc(r.id)}">Modifica</button></div></div>`;
  }).join('');
  return `${budgetPanel(selectedMonth)}${deadlinePanel(selectedMonth)}<div class="alert">Le voci mensili indicano importi <strong>previsti</strong>. La dashboard li conteggia tra entrate e spese effettive soltanto quando confermi il pagamento o l'incasso. Per una scadenza al 31, nei mesi più corti si usa l'ultimo giorno del mese.</div><section class="card"><div class="section-header"><div><h2 class="section-title">Entrate e spese ricorrenti</h2><p class="section-sub">Gestisci gli importi che si ripetono ogni mese</p></div><button class="button primary small" type="button" data-add="recurring">＋ Nuova ricorrenza</button></div><div class="bar-actions"><select class="filter" id="recurring-filter" aria-label="Filtra ricorrenze"><option value="all">Tutte le ricorrenze</option><option value="active" ${recurringFilter==='active'?'selected':''}>Attive nel mese</option></select><span class="preview">${rules.length} voci</span></div>${rules.length?rows:'<div class="empty"><strong>Nessuna ricorrenza</strong>Aggiungi un\'entrata o una spesa mensile.</div>'}</section>`;
}
function settingsView(){const s=state.settings;return `<section class="settings-grid"><article class="card"><h2 class="section-title">Mese e saldo iniziale</h2><p class="section-sub">Il saldo complessivo è la somma dei saldi iniziali dei singoli conti. Per gestirli apri la scheda Conti.</p><form id="settings-form" style="margin-top:20px"><div class="form-field"><label for="initial-month">Mese di partenza</label><input class="field" type="month" id="initial-month" value="${esc(s.openingMonth)}" required></div><div class="form-field"><label for="initial-amount">Saldo iniziale (€)</label><input class="field" inputmode="decimal" id="initial-amount" value="${esc(amountForInput(s.openingCents))}" readonly aria-readonly="true"><span class="field-hint">Può essere negativo, es.: -250,00</span></div><button class="button primary" type="submit">Salva mese iniziale</button><button class="button soft" type="button" data-view="accounts">Gestisci saldi dei conti</button></form></article>
 <article class="card"><h2 class="section-title">Backup protetti da controllo d'integrità</h2><p class="section-sub">Esporta regolarmente i dati e verifica il file prima del ripristino.</p><div class="stack" style="margin-top:20px"><button class="button primary" id="export-json" type="button">↓ Esporta backup JSON verificabile</button><button class="button soft" id="export-encrypted" type="button">🔒 Esporta backup cifrato con password</button><button class="button" id="verify-json" type="button">✓ Verifica un backup JSON</button><button class="button" id="export-csv" type="button">↓ Esporta movimenti CSV</button><button class="button soft" id="import-json" type="button">↑ Importa backup JSON</button><button class="button soft" id="restore-previous" type="button" ${hasPreviousImport()?'':'disabled'}>↶ Annulla ultima importazione</button><input id="backup-file" class="file-input" type="file" accept=".json,application/json"><div class="notice">${esc(backupStatus())}</div><div class="notice">Il backup JSON ordinario contiene un'impronta SHA-256 ma NON è cifrato. Il nuovo backup cifrato utilizza AES-GCM e una password personale (minimo 12 caratteri): senza la password non è possibile recuperare i dati. Non conserviamo la password e non possiamo recuperarla. Controlla sempre il download nell'app File. Prima di ogni importazione salviamo una copia recuperabile nell'archivio locale; se cancelli i dati del sito, anche questa copia scompare.</div></div></article>
 <article class="card"><h2 class="section-title">Archivio sul dispositivo</h2><p class="section-sub">I dati sono salvati tramite il browser, non su GitHub.</p><div class="notice">Non è prevista una sincronizzazione automatica tra iPhone e iPad. L'app installata dalla schermata Home può conservare un archivio separato da Safari. Esporta backup frequentemente e non cancellare i dati del sito senza averli salvati.</div><div class="notice">Registrazioni: <strong>${state.transactions.length}</strong> · Ricorrenze: <strong>${state.recurring.length}</strong> · Budget: <strong>${state.budgets.length}</strong> · Conti: <strong>${state.accounts.length}</strong> · Trasferimenti: <strong>${state.transfers.length}</strong> · Verifiche saldo: <strong>${(state.reconciliations||[]).length}</strong> · Modifiche tracciate: <strong>${(state.auditLog||[]).length}</strong> · Casi: <strong>${(state.reconciliationCases||[]).length}</strong>.</div></article>
 <article class="card about-app"><h2 class="section-title">Informazioni sull'app</h2><p class="section-sub">CasaChiara · Gestione delle finanze domestiche</p><p class="about-developer">Developed by <strong>SEGNOTA Studio</strong></p><p class="preview">Versione ${APP_VERSION} · App privata e disponibile offline.</p></article>
 <article class="card"><h2 class="section-title">App e aggiornamenti</h2><p>Versione <strong>${APP_VERSION}</strong>. Apri CasaChiara online per controllare gli aggiornamenti. Un nuovo codice può richiedere la chiusura e la riapertura dell'app.</p><button type="button" class="button" id="check-updates">↻ Controlla aggiornamenti</button><p class="preview">L'app funziona offline dopo il primo caricamento. Il controllo richiede Internet. L'aggiornamento del codice non deve cancellare i dati, ma conserva sempre backup esterni. L'uso di più dispositivi richiede trasferimenti manuali.</p></article></section>`}
function render(){const titles={reconciliation:['Riconciliazione dei conti','Confronta saldo reale e saldo calcolato, consulta lo storico delle correzioni.'],dashboard:['Le finanze, più semplici.','Tutto sotto controllo, giorno dopo giorno.'],transactions:['Registro movimenti','Entrate e uscite realmente effettuate.'],accounts:['I tuoi conti','Conti correnti, contanti, carte e trasferimenti.'],recurring:['Pianifica le tue finanze','Budget, scadenze e ricorrenze mensili.'],settings:['Impostazioni e backup','Proteggi i dati delle tue finanze domestiche.']};el('page-title').textContent=titles[view][0];el('page-subtitle').textContent=titles[view][1];el('month-label').textContent=monthName(selectedMonth);document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false')});el('app-content').innerHTML= view==='dashboard'?dashboard():view==='transactions'?transactionsView():view==='accounts'?accountsView():view==='recurring'?recurringView():view==='reconciliation'?RECON.render(state,toDate(today),reconFilter)+CC25.caseHTML(state,reconFilter):settingsView();displayStorageWarning()}
function changeView(next){if(!['dashboard','transactions','accounts','recurring','reconciliation','settings'].includes(next))return;view=next;search='';render();window.scrollTo({top:0,behavior:'instant'})}
function options(type,selected=''){const cats=[...categoryList(type)];if(selected&&!cats.includes(selected))cats.push(selected);return cats.map(c=>`<option value="${esc(c)}" ${selected===c?'selected':''}>${esc(c)}</option>`).join('')}
function modal(html){el('dialog-root').innerHTML=`<div class="dialog-backdrop" id="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${html}</section></div>`;const input=el('dialog-root').querySelector('input:not([type="hidden"]),select');if(input)setTimeout(()=>input.focus(),100)}
function closeModal(){el('dialog-root').replaceChildren()}
function modalHeader(title,sub){return `<header class="dialog-head"><div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(sub)}</p></div><button type="button" class="modal-close" data-close aria-label="Chiudi">×</button></header>`}
function recurringStatusHTML(t,opts,rule){
 const actual=t?.recurringFinal===false||(!t&&opts.recurringFinal===false)?'partial':'final';
 const planned=t?.plannedCents||opts.plannedCents||rule.amountCents;
 return '<div class="form-field"><label for="transaction-recurring-status">Tipo di registrazione</label>'+
 '<select class="field" id="transaction-recurring-status"><option value="final" '+(actual==='final'?'selected':'')+'>Saldo finale — conclude la scadenza</option>'+
 '<option value="partial" '+(actual==='partial'?'selected':'')+'>Acconto — scadenza ancora aperta</option></select></div>'+
 '<div class="notice">Importo programmato: <strong>'+euro(planned)+'</strong>. Inserisci l’importo realmente pagato o incassato. Il saldo finale può differire dalla previsione. Gli acconti restano aperti finché non registri il saldo finale.</div>';
}
function startTransaction(id=null,opts={}){const t=id?state.transactions.find(x=>x.id===id):null;const type=t?.type||opts.type||'expense';const date=t?.date||opts.date||`${selectedMonth}-${String(Math.min(today.getDate(),new Date(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0).getDate())).padStart(2,'0')}`;const recurringId=t?.recurringId||opts.recurringId||null;const occMonth=t?.occMonth||opts.occMonth||null;const recurringRule=recurringId?state.recurring.find(x=>x.id===recurringId):null;
 modal(`${modalHeader(t?'Modifica movimento':recurringRule?'Conferma ricorrenza':'Nuovo movimento','Questo importo influisce sul saldo effettivo.')}
 <div class="dialog-body"><form id="transaction-form"><input type="hidden" id="transaction-id" value="${esc(t?.id||'')}"><input type="hidden" id="transaction-rule-id" value="${esc(recurringId||'')}"><input type="hidden" id="transaction-occ-month" value="${esc(occMonth||'')}"><div class="segmented"><button type="button" class="${type==='expense'?'selected':''}" data-form-type="expense">− Spesa</button><button type="button" class="${type==='income'?'selected':''}" data-form-type="income">+ Entrata</button></div><div class="two-columns"><div class="form-field full"><label for="transaction-description">Descrizione *</label><input class="field" type="text" id="transaction-description" maxlength="160" value="${esc(t?.description||opts.description||'')}" placeholder="Es. Spesa supermercato" required></div><div class="form-field"><label for="transaction-amount">Importo (€) *</label><input class="field" id="transaction-amount" inputmode="decimal" value="${esc(t?amountForInput(t.amountCents):opts.amountCents?amountForInput(opts.amountCents):'')}" placeholder="0,00" required></div><div class="form-field"><label for="transaction-category">Categoria *</label><select class="field" id="transaction-category">${options(type,t?.category||opts.category||'')}</select></div><div class="form-field full"><label for="transaction-account">Conto *</label><select class="field" id="transaction-account">${accountOptions(t?.accountId||opts.accountId||defaultAccount())}</select></div><div class="form-field full"><label for="transaction-date">Data effettiva *</label><input class="field" type="date" id="transaction-date" value="${esc(date)}" required></div></div>${recurringRule?recurringStatusHTML(t,opts,recurringRule):''}</form></div>
 <div class="dialog-foot">${t?`<button type="button" class="button danger small" data-delete-transaction="${esc(t.id)}">Elimina</button>`:'<span></span>'}<div class="backup-actions"><button class="button" type="button" data-close>Annulla</button><button class="button primary" type="submit" form="transaction-form">Salva</button></div></div>`);const form=el('transaction-form');form.dataset.type=type; if(recurringRule){form.dataset.lockedType='yes';form.querySelectorAll('[data-form-type]').forEach(b=>b.disabled=true)}}
function startRecurring(id=null,opts={}){const r=id?state.recurring.find(x=>x.id===id):null;const type=r?.type||opts.type||'expense';modal(`${modalHeader(r?'Modifica ricorrenza':'Nuova ricorrenza','Una voce prevista ogni mese, da confermare quando effettiva.')}
 <div class="dialog-body"><form id="recurring-form" data-type="${esc(type)}"><input id="recurring-id" type="hidden" value="${esc(r?.id||'')}"><div class="segmented"><button type="button" data-rule-type="expense" class="${type==='expense'?'selected':''}">− Spesa fissa</button><button type="button" data-rule-type="income" class="${type==='income'?'selected':''}">+ Entrata mensile</button></div><div class="two-columns"><div class="form-field full"><label for="recurring-description">Descrizione *</label><input class="field" id="recurring-description" maxlength="160" value="${esc(r?.description||'')}" required placeholder="Es. Affitto, stipendio, bolletta"></div><div class="form-field"><label for="recurring-amount">Importo previsto (€) *</label><input class="field" id="recurring-amount" inputmode="decimal" value="${r?esc(amountForInput(r.amountCents)):''}" placeholder="0,00" required></div><div class="form-field"><label for="recurring-category">Categoria *</label><select class="field" id="recurring-category">${options(type,r?.category||'')}</select></div><div class="form-field"><label for="recurring-account">Conto previsto *</label><select class="field" id="recurring-account">${accountOptions(r?.accountId||defaultAccount())}</select></div><div class="form-field"><label for="recurring-day">Giorno del mese *</label><input class="field" type="number" min="1" max="31" id="recurring-day" value="${r?.day||1}" required></div><div class="form-field"><label for="recurring-start">Dal mese *</label><input class="field" type="month" id="recurring-start" value="${esc(r?.startMonth||selectedMonth)}" required></div><div class="form-field"><label for="recurring-end">Fino al mese (facoltativo)</label><input class="field" type="month" id="recurring-end" value="${esc(r?.endMonth||'')}"></div><div class="form-field"><label for="recurring-active">Stato</label><select class="field" id="recurring-active"><option value="yes" ${r?.active===false?'':'selected'}>Attiva</option><option value="no" ${r?.active===false?'selected':''}>Sospesa</option></select></div></div><div class="notice">Un pagamento previsto non viene aggiunto automaticamente alle spese effettive.</div></form></div>
 <div class="dialog-foot">${r?`<button class="button danger small" type="button" data-delete-recurring="${esc(r.id)}">Elimina</button>`:'<span></span>'}<div class="backup-actions"><button class="button" type="button" data-close>Annulla</button><button class="button primary" type="submit" form="recurring-form">Salva</button></div></div>`)}


function startBudget(category=null){
 const original=category?state.budgets.find(x=>x.month===selectedMonth&&x.category===category):null;
 const categories=[...new Set([...expenseCats,...state.transactions.filter(t=>t.type==='expense').map(t=>t.category),...state.budgets.map(b=>b.category)])].filter(Boolean);
 const chosen=original?.category||categories.find(c=>!state.budgets.some(b=>b.month===selectedMonth&&b.category===c))||categories[0];
 modal(`${modalHeader(original?'Modifica budget':'Nuovo budget mensile','Il budget non è una spesa e non modifica il saldo.')}
 <div class="dialog-body"><form id="budget-form">
 <input type="hidden" id="budget-old-month" value="${esc(original?.month||'')}">
 <input type="hidden" id="budget-old-category" value="${esc(original?.category||'')}">
 <div class="form-field"><label for="budget-month">Mese *</label><input class="field" id="budget-month" type="month" value="${esc(original?.month||selectedMonth)}" required></div>
 <div class="form-field"><label for="budget-category">Categoria spesa *</label><select class="field" id="budget-category">${categories.map(c=>`<option value="${esc(c)}" ${chosen===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
 <div class="form-field"><label for="budget-limit">Limite mensile (€) *</label><input class="field" id="budget-limit" inputmode="decimal" placeholder="Es. 250,00" value="${original?esc(amountForInput(original.limitCents)):''}" required></div></form>
 <div class="notice">La soglia confronta soltanto le spese effettive della categoria nel mese indicato, indipendentemente dal conto utilizzato. Le ricorrenze future non sono conteggiate finché non confermate.</div></div>
 <div class="dialog-foot">${original?`<button type="button" class="button danger small" id="delete-budget">Elimina</button>`:'<span></span>'}
 <div class="backup-actions"><button type="button" class="button" data-close>Annulla</button><button type="submit" form="budget-form" class="button primary">Salva budget</button></div></div>`);
}
function budgetSubmit(){
 const oldMonth=el('budget-old-month').value,oldCategory=el('budget-old-category').value;
 const month=el('budget-month').value,category=el('budget-category').value;
 const limitCents=amountFromInput(el('budget-limit').value);
 if(!validMonth(month)||!category||category.length>80||limitCents===null)return alert('Controlla mese, categoria e importo positivo.');
 const replacing=!!oldMonth&&!!oldCategory;
 if(state.budgets.some(b=>b.month===month&&b.category===category&&(!replacing||b.month!==oldMonth||b.category!==oldCategory)))return alert('Per questa categoria esiste già un budget nel mese scelto. Modificalo invece di duplicarlo.');
 if(!replacing&&state.budgets.length>=5000)return alert('Numero massimo di budget raggiunto.');
 if(applyChange(d=>{
   if(replacing)d.budgets=d.budgets.filter(b=>b.month!==oldMonth||b.category!==oldCategory);
   d.budgets.push({month,category,limitCents});
 })){closeModal();render();showToast(replacing?'Budget aggiornato':'Budget aggiunto')}
}
function deleteBudget(){
 const month=el('budget-old-month')?.value,category=el('budget-old-category')?.value;
 if(!month||!category)return;
 if(!confirm('Eliminare il budget di '+category+' per '+month+'? I movimenti non verranno cancellati.'))return;
 if(applyChange(d=>{d.budgets=d.budgets.filter(b=>b.month!==month||b.category!==category)})){closeModal();render();showToast('Budget eliminato')}
}
function copyBudgetsFromPrevious(){
 const previous=addMonth(selectedMonth,-1),source=state.budgets.filter(b=>b.month===previous);
 const added=source.filter(b=>!state.budgets.some(x=>x.month===selectedMonth&&x.category===b.category));
 if(!added.length)return showToast('Nessun nuovo budget da copiare.');
 if(!confirm('Copiare '+added.length+' budget da '+monthName(previous)+' a '+monthName(selectedMonth)+'? I budget già presenti nel mese non cambieranno.'))return;
 if(applyChange(d=>{for(const b of added)d.budgets.push({month:selectedMonth,category:b.category,limitCents:b.limitCents})})){render();showToast(added.length+' budget copiati da '+monthName(previous))}
}
function startAccount(id=null){
 const a=id?state.accounts.find(x=>x.id===id):null;
 modal(`${modalHeader(a?'Modifica conto':'Nuovo conto','I saldi iniziali si riferiscono al mese di partenza dell’archivio.')}
 <div class="dialog-body"><form id="account-form"><input type="hidden" id="account-id" value="${esc(a?.id||'')}">
 <div class="form-field"><label for="account-name">Nome del conto *</label><input class="field" type="text" id="account-name" maxlength="80" placeholder="Es. Conto Banca, Contanti, Carta" value="${esc(a?.name||'')}" required></div>
 <div class="form-field"><label for="account-type">Tipologia *</label><select class="field" id="account-type">${CORE.TYPES.map(t=>`<option value="${t}" ${(a?.type||'bank')===t?'selected':''}>${esc(accountTypeName(t))}</option>`).join('')}</select></div>
 <div class="form-field"><label for="account-opening">Saldo al mese iniziale (€) *</label><input class="field" id="account-opening" inputmode="decimal" value="${esc(amountForInput(a?.openingCents||0))}" required><span class="field-hint">Usa 0,00 se sposti denaro da un conto già registrato tramite trasferimento. Evita di conteggiarlo due volte.</span></div>
 <div class="form-field"><label for="account-active">Stato</label><select class="field" id="account-active"><option value="yes" ${a?.active===false?'':'selected'}>Attivo</option><option value="no" ${a?.active===false?'selected':''}>Archiviato</option></select></div>
 </form><div class="notice">Modificare il saldo iniziale influisce sui saldi progressivi di tutti i mesi, non crea una nuova entrata o spesa.</div></div>
 <div class="dialog-foot">${a? `<button class="button danger small" type="button" data-delete-account="${esc(a.id)}">Elimina</button>`:'<span></span>'}<div class="backup-actions"><button class="button" data-close type="button">Annulla</button><button class="button primary" form="account-form" type="submit">Salva conto</button></div></div>`);
}
function accountSubmit(){
 const id=el('account-id').value,old=id?state.accounts.find(a=>a.id===id):null;
 const name=el('account-name').value.trim(),type=el('account-type').value,openingCents=amountFromInput(el('account-opening').value,true),active=el('account-active').value==='yes';
 if(!name||name.length>80||!CORE.TYPES.includes(type)||openingCents===null)return alert('Controlla nome, tipologia e saldo del conto.');
 if(!active&&state.accounts.filter(a=>a.active&&a.id!==id).length===0)return alert('Mantieni almeno un conto attivo.');
 if(!old&&state.accounts.length>=100)return alert('Numero massimo di conti raggiunto.');
 const a={id:old?.id||uid(),name,type,openingCents,active};
 if(applyChange(d=>{d.accounts=old?d.accounts.map(x=>x.id===id?a:x):[...d.accounts,a];d.settings.openingCents=d.accounts.reduce((sum,x)=>sum+x.openingCents,0)})){closeModal();render();showToast(old?'Conto aggiornato':'Conto aggiunto')}
}
function deleteAccount(id){
 const a=state.accounts.find(x=>x.id===id);
 if(!a)return;
 if(state.accounts.length===1)return alert('Non puoi eliminare l’ultimo conto.');
 if(a.active&&!state.accounts.some(x=>x.id!==id&&x.active))return alert('Deve restare almeno un conto attivo.');
 if(state.transactions.some(t=>t.accountId===id)||state.recurring.some(r=>r.accountId===id)||state.transfers.some(t=>t.fromId===id||t.toId===id)||(state.reconciliations||[]).some(c=>c.accountId===id))return alert('Conto utilizzato o riconciliato: non può essere eliminato. Puoi archiviarlo da Modifica conto.');
 if(!confirm('Eliminare il conto '+a.name+'? Il saldo iniziale complessivo sarà aggiornato.'))return;
 if(applyChange(d=>{d.accounts=d.accounts.filter(x=>x.id!==id);d.settings.openingCents=d.accounts.reduce((n,x)=>n+x.openingCents,0)})){closeModal();render();showToast('Conto eliminato')}
}
function startTransfer(id=null){
 if(activeAccounts().length<2&&!id)return alert('Per trasferire denaro servono almeno due conti attivi. Crea un secondo conto.');
 const t=id?state.transfers.find(x=>x.id===id):null;
 const opts=activeAccounts(),from=t?.fromId||opts[0].id,to=t?.toId||opts.find(a=>a.id!==from)?.id||'';
 const date=t?.date||dueDate(selectedMonth,today.getDate());
 modal(`${modalHeader(t?'Modifica trasferimento':'Nuovo trasferimento','Un trasferimento cambia i saldi dei conti ma non il risultato del mese.')}
 <div class="dialog-body"><form id="transfer-form"><input type="hidden" id="transfer-id" value="${esc(t?.id||'')}">
 <div class="form-field"><label for="transfer-from">Da conto *</label><select class="field" id="transfer-from">${accountOptions(from)}</select></div>
 <div class="form-field"><label for="transfer-to">A conto *</label><select class="field" id="transfer-to">${accountOptions(to)}</select></div>
 <div class="two-columns"><div class="form-field"><label for="transfer-amount">Importo (€) *</label><input class="field" id="transfer-amount" inputmode="decimal" value="${t?esc(amountForInput(t.amountCents)):''}" placeholder="0,00" required></div>
 <div class="form-field"><label for="transfer-date">Data *</label><input class="field" type="date" id="transfer-date" value="${esc(date)}" required></div></div>
 <div class="form-field"><label for="transfer-note">Nota (facoltativa)</label><input class="field" maxlength="160" id="transfer-note" value="${esc(t?.note||'')}" placeholder="Es. Prelievo bancomat"></div>
 </form><div class="notice">Esempio: prelevare 50 € dal conto corrente e inserirli nei contanti riduce il primo saldo di 50 € e aumenta il secondo di 50 €. Il totale non cambia.</div></div>
 <div class="dialog-foot">${t?`<button class="button danger small" data-delete-transfer="${esc(t.id)}" type="button">Elimina</button>`:'<span></span>'}<div class="backup-actions"><button class="button" data-close type="button">Annulla</button><button class="button primary" form="transfer-form" type="submit">Salva trasferimento</button></div></div>`);
}
function transferSubmit(){
 const id=el('transfer-id').value,old=id?state.transfers.find(x=>x.id===id):null,fromId=el('transfer-from').value,toId=el('transfer-to').value,amountCents=amountFromInput(el('transfer-amount').value),date=el('transfer-date').value,note=el('transfer-note').value.trim();
 if(!state.accounts.some(a=>a.id===fromId)||!state.accounts.some(a=>a.id===toId)||fromId===toId||amountCents===null||!CORE.validDate(date)||note.length>160)return alert('Controlla i conti, la data e l’importo positivo.');
 if(date.slice(0,7)<state.settings.openingMonth)return alert('Il trasferimento è precedente al mese iniziale. Modifica i saldi iniziali dei conti.');
 const t={id:old?.id||uid(),fromId,toId,amountCents,date,note};
 if(applyChange(d=>{d.transfers=old?d.transfers.map(x=>x.id===id?t:x):[...d.transfers,t]})){closeModal();render();showToast(old?'Trasferimento aggiornato':'Trasferimento registrato')}
}
function deleteTransfer(id){
 if(!confirm('Eliminare questo trasferimento? I saldi dei conti saranno ricalcolati.'))return;
 if(applyChange(d=>{d.transfers=d.transfers.filter(x=>x.id!==id)})){closeModal();render();showToast('Trasferimento eliminato')}
}
function completeRecurring(id){
 const r=state.recurring.find(x=>x.id===id);
 if(!r||!activeRule(r,selectedMonth)||completedRule(r,selectedMonth))return showToast('Ricorrenza non disponibile o già conclusa');
 const o=PLAN.occurrence(state,r,selectedMonth);
 const date=selectedMonth===nowMonth?toDate(today):PLAN.dateOf(selectedMonth,r.day);
 startTransaction(null,{type:r.type,description:r.description,amountCents:o.remaining||r.amountCents,category:r.category,date,recurringId:r.id,occMonth:selectedMonth,accountId:r.accountId,plannedCents:o.expected,recurringFinal:true});
}
function transactionSubmit(){
 const id=el('transaction-id').value,old=id?state.transactions.find(t=>t.id===id):null,form=el('transaction-form');
 const type=form.dataset.type,description=el('transaction-description').value.trim(),amountCents=amountFromInput(el('transaction-amount').value),category=el('transaction-category').value,date=el('transaction-date').value;
 const recurringId=el('transaction-rule-id').value||null,occMonth=el('transaction-occ-month').value||null;
 if(!description||!category||amountCents===null||!validDate(date)||!['income','expense'].includes(type))return alert('Controlla descrizione, importo positivo e data valida.');
 const accountId=el('transaction-account').value;
 if(!state.accounts.some(a=>a.id===accountId))return alert('Seleziona un conto valido.');
 const t={id:old?.id||uid(),date,type,description,category,amountCents,recurringId,occMonth,accountId};
 if(recurringId){
   const rule=state.recurring.find(r=>r.id===recurringId);
   if(!rule){
     if(!old)return alert('La ricorrenza collegata non esiste.');
     if(old.plannedCents!==undefined)t.plannedCents=old.plannedCents;
     if(old.recurringFinal!==undefined)t.recurringFinal=old.recurringFinal;
   }else{
     if(!validMonth(occMonth)||type!==rule.type)return alert('Ricorrenza o mese di competenza non valido.');
     const others=state.transactions.filter(x=>x.id!==id&&x.recurringId===recurringId&&x.occMonth===occMonth);
     const plannedCents=old?.plannedCents||others.find(x=>x.plannedCents!==undefined)?.plannedCents||rule.amountCents;
     const partial=el('transaction-recurring-status')?.value==='partial';
     if(others.some(x=>x.recurringFinal!==false)&&(!old||old.recurringFinal!==false||!partial))return alert('La scadenza risulta già conclusa. Modifica o elimina il saldo finale esistente prima di registrarne un altro.');
     const partialSum=others.filter(x=>x.recurringFinal===false).reduce((sum,x)=>sum+x.amountCents,0);
     if(partial&&partialSum+amountCents>=plannedCents)return alert('L’acconto non può raggiungere o superare l’importo previsto. Utilizza Saldo finale.');
     t.plannedCents=plannedCents;t.recurringFinal=!partial;
   }
 }
 if(applyChange(d=>{d.transactions=old?d.transactions.map(x=>x.id===id?t:x):[...d.transactions,t]})){
   closeModal();render();showToast(old?'Movimento aggiornato':'Movimento registrato');
 }
}
function recurringSubmit(){const id=el('recurring-id').value,old=id?state.recurring.find(r=>r.id===id):null,type=el('recurring-form').dataset.type,description=el('recurring-description').value.trim(),amountCents=amountFromInput(el('recurring-amount').value),category=el('recurring-category').value,day=Number(el('recurring-day').value),startMonth=el('recurring-start').value,endMonth=el('recurring-end').value||null,active=el('recurring-active').value==='yes';if(!description||!category||amountCents===null||!Number.isInteger(day)||day<1||day>31||!validMonth(startMonth)||endMonth&&(!validMonth(endMonth)||endMonth<startMonth))return alert('Verifica l’importo, il giorno (1-31) e il periodo indicato.');const accountId=el('recurring-account').value;if(!state.accounts.some(a=>a.id===accountId))return alert('Seleziona un conto valido.');const r={id:old?.id||uid(),type,description,amountCents,category,day,startMonth,endMonth,active,accountId};if(applyChange(d=>{d.recurring=old?d.recurring.map(x=>x.id===id?r:x):[...d.recurring,r]})){closeModal();render();showToast(old?'Ricorrenza aggiornata':'Ricorrenza aggiunta')} }
function deleteItem(kind,id){if(!confirm(kind==='transaction'?'Eliminare definitivamente questo movimento?':'Eliminare questa ricorrenza? I movimenti già confermati resteranno nel registro.'))return;if(applyChange(d=>{if(kind==='transaction')d.transactions=d.transactions.filter(x=>x.id!==id);else d.recurring=d.recurring.filter(x=>x.id!==id)})){closeModal();render();showToast('Voce eliminata')}}
function download(text,filename,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function sha256(text){if(!globalThis.crypto?.subtle)throw Error('Verifica crittografica non disponibile in questo browser.');const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function backupStatus(){try{const t=localStorage.getItem(LAST_EXPORT_KEY);if(!t)return 'Nessuna esportazione recente registrata su questo dispositivo. Effettua un backup JSON e controlla che compaia nell’app File.';const elapsed=Date.now()-new Date(t).getTime();const date=new Date(t).toLocaleDateString('it-IT');return elapsed>30*86400000?`Ultima esportazione avviata il ${date}. È consigliabile creare e verificare una nuova copia.`:`Ultima esportazione avviata il ${date}. Controlla che il file sia stato realmente salvato: questo pulsante non può confermare il download.`}catch{return 'Non è possibile leggere la cronologia delle esportazioni.'}}
function hasPreviousImport(){try{return !!checkData(JSON.parse(localStorage.getItem(ROLLBACK_KEY)||'null'))}catch{return false}}
async function exportJSON(){try{const payload=checkData(state);const integrity=await sha256(JSON.stringify(payload));const backup={format:'casachiara.backup',backupVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),integrity:{algorithm:'SHA-256',sha256:integrity},data:payload};const timestamp=new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');download(JSON.stringify(backup,null,2),`CasaChiara_backup_${timestamp}.json`,'application/json');try{localStorage.setItem(LAST_EXPORT_KEY,new Date().toISOString())}catch{}if(view==='settings')render();showToast('Esportazione avviata. Controlla il file in Download.') }catch(err){alert('Esportazione non riuscita: '+err.message)}}
async function parseBackup(file,password=null){if(!file||file.size>24_000_000)throw Error('File mancante o troppo grande (max 24 MB).');let raw=JSON.parse(await file.text());if(raw?.format===SECURE.FORMAT){if(!password)throw Error('Password necessaria per il backup cifrato.');raw=JSON.parse(await SECURE.decrypt(raw,password));}if(raw?.format==='casachiara.backup'){if(raw.backupVersion!==1||raw.integrity?.algorithm!=='SHA-256'||typeof raw.integrity.sha256!=='string'||!/^[0-9a-f]{64}$/.test(raw.integrity.sha256))throw Error('Formato o impronta del backup non valido.');const calculated=await sha256(JSON.stringify(raw.data));if(calculated!==raw.integrity.sha256)throw Error('Controllo d’integrità fallito: il backup è stato modificato o danneggiato. Nessun dato è stato importato.');const cleaned=checkData(raw.data);return {data:cleaned,verified:true,exportedAt:raw.exportedAt}}const cleaned=checkData(raw);return {data:cleaned,verified:false,exportedAt:null}}
function backupSummary(info){const d=info.data;return `${info.verified?'Impronta SHA-256 verificata':'Backup precedente senza impronta di integrità'}\nMovimenti: ${d.transactions.length}\nRicorrenze: ${d.recurring.length}\nConti: ${d.accounts.length}\nTrasferimenti: ${d.transfers.length}\nBudget: ${d.budgets.length}\nRiconciliazioni: ${d.reconciliations.length}\nModifiche tracciate: ${d.auditLog.length}\nCasi riconciliazione: ${d.reconciliationCases.length}\nMese iniziale: ${d.settings.openingMonth}\nSaldo iniziale: ${euro(d.settings.openingCents)}${info.exportedAt?'\nCreato il: '+new Date(info.exportedAt).toLocaleString('it-IT'):''}`}
function replaceArchiveWithRecovery(candidate){if(!storageOK)throw Error('Archivio locale non disponibile.');const old=JSON.stringify(state),oldRecovery=localStorage.getItem(ROLLBACK_KEY);try{localStorage.setItem(ROLLBACK_KEY,old);localStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));state=candidate;return true}catch(err){try{if(oldRecovery===null)localStorage.removeItem(ROLLBACK_KEY);else localStorage.setItem(ROLLBACK_KEY,oldRecovery)}catch{}throw Error('Spazio o accesso all’archivio insufficiente: nessun movimento è stato sostituito.')}}
function undoLastImport(){try{const raw=localStorage.getItem(ROLLBACK_KEY);if(!raw)throw Error('Non è disponibile un archivio precedente.');const candidate=checkData(JSON.parse(raw));if(!confirm(`Ripristinare l’archivio precedente (${candidate.transactions.length} movimenti, ${candidate.recurring.length} ricorrenze)? L’archivio corrente verrà sostituito.`))return;if(!storageOK)throw Error('Archivio locale non disponibile.');localStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));state=candidate;localStorage.removeItem(ROLLBACK_KEY);render();showToast('Archivio precedente ripristinato')}catch(err){alert('Impossibile annullare l’importazione: '+err.message)}}
function updateReconciliationPreview(){
  const account=el('recon-account'),date=el('recon-date'),input=el('recon-actual');
  if(!account||!date||!input)return;
  const n=CORE.validDate(date.value)&&date.value<=toDate(today)?RECON.balanceAtDate(state,date.value,account.value):null;
  const actual=amountFromInput(input.value,true);
  if(el('recon-calculated'))el('recon-calculated').textContent=n===null?'—':euro(n);
  if(el('recon-real-preview'))el('recon-real-preview').textContent=actual===null?'—':euro(actual);
  if(el('recon-difference'))el('recon-difference').textContent=n===null||actual===null?'—':positive(actual-n);
  if(el('recon-diagnostics'))el('recon-diagnostics').innerHTML=n===null||actual===null?'':CC25.findingsHTML(state,account.value,date.value,actual-n);
}
function reconcileSubmit(){
  const accountId=el('recon-account').value,date=el('recon-date').value,actualCents=amountFromInput(el('recon-actual').value,true),reason=el('recon-reason').value,note=el('recon-note').value.trim();
  if(!state.accounts.some(a=>a.id===accountId)||!CORE.validDate(date)||date>toDate(today)||date.slice(0,7)<state.settings.openingMonth||actualCents===null||note.length>500)return alert('Controlla conto, data, saldo reale e note.');
  const calculatedCents=RECON.balanceAtDate(state,date,accountId);
  if(calculatedCents===null)return alert('Il conto o il periodo non sono validi.');
  const differenceCents=actualCents-calculatedCents;
  const record={id:uid(),createdAt:new Date().toISOString(),date,accountId,calculatedCents,actualCents,differenceCents,reason,note};
  const previous=state;
  try{
    const candidate=JSON.parse(JSON.stringify(state));
    candidate.reconciliations.push(record);
    if(differenceCents!==0){
      const openedAt=new Date().toISOString();
      const existing=candidate.reconciliationCases.find(c=>c.accountId===accountId&&c.status!=='resolved');
      if(existing){
        existing.updatedAt=openedAt;
        if(existing.history.length<1000)existing.history.push({at:openedAt,status:existing.status,note:'Nuova verifica, scostamento '+euro(differenceCents)+'.'});
      }else candidate.reconciliationCases.push({id:uid(),accountId,checkId:record.id,createdAt:openedAt,updatedAt:openedAt,status:'open',resolvedAt:null,reason,note,auditIds:[],history:[{at:openedAt,status:'open',note:'Caso creato per verifica con scostamento.'}]});
    }
    state=checkData(candidate);
    if(!save()){state=previous;return;}
    render();showToast(differenceCents===0?'Verifica salvata: saldo allineato':'Scostamento registrato nel caso aperto: '+euro(differenceCents));
  }catch(err){state=previous;alert('Impossibile salvare la verifica: '+err.message)}
}

function createLegacyCase(checkId){
  const c=state.reconciliations.find(x=>x.id===checkId);
  if(!c||c.differenceCents===0||state.reconciliationCases.some(k=>k.checkId===checkId||(k.accountId===c.accountId&&k.status!=='resolved')))return;
  const at=new Date().toISOString(),item={id:uid(),accountId:c.accountId,checkId:c.id,createdAt:at,updatedAt:at,status:'open',resolvedAt:null,reason:c.reason,note:c.note,auditIds:[],history:[{at,status:'open',note:'Caso creato da una verifica precedente.'}]};
  if(applyChange(d=>{d.reconciliationCases.push(item)})){render();showToast('Caso aperto per la verifica precedente.')}
}
function startCase(id){
  if(!state.reconciliationCases.some(c=>c.id===id))return;
  modal(modalHeader('Gestione caso','Collega le correzioni e documenta la risoluzione.')+CC25.caseModal(state,id));
}
function caseSubmit(){
  const id=el('case-id').value,c=state.reconciliationCases.find(x=>x.id===id);
  if(!c)return;
  const status=el('case-status').value,reason=el('case-reason').value.trim(),note=el('case-note').value.trim();
  if(!['open','review','resolved'].includes(status)||!reason||reason.length>90||note.length>500)return alert('Verifica lo stato, la causa e le note.');
  const selected=[...document.querySelectorAll('input[name="case-audit"]:checked')].map(x=>x.value);
  if(selected.length>100||!selected.every(auditId=>state.auditLog.some(a=>a.id===auditId&&a.accountIds.includes(c.accountId))))return alert('Correzioni selezionate non valide.');
  const last=state.reconciliations.filter(x=>x.accountId===c.accountId).at(-1);
  if(status==='resolved'&&c.status!=='resolved'&&(!last||state.reconciliations.indexOf(last)<=state.reconciliations.findIndex(x=>x.id===c.checkId)||last.date<state.reconciliations.find(x=>x.id===c.checkId).date||last.differenceCents!==0))return alert('Per risolvere il caso salva prima una nuova riconciliazione con saldo allineato.');
  if(status==='resolved'&&c.status!=='resolved'&&!note)return alert('Descrivi la causa e le correzioni prima di chiudere il caso.');
  const at=new Date().toISOString();
  if(applyChange(d=>{
    const x=d.reconciliationCases.find(v=>v.id===id);
    x.status=status;x.reason=reason;x.note=note;x.auditIds=[...new Set(selected)];
    x.updatedAt=at;x.resolvedAt=status==='resolved'?(c.status==='resolved'?c.resolvedAt:at):null;
    x.history.push({at,status,note:note||'Aggiornati stato o collegamenti.'});
  })){closeModal();render();showToast('Caso aggiornato nel registro.')}
}
function startEncryptedExport(){
  modal(modalHeader('Backup cifrato','Crea un file protetto con una password che soltanto tu conosci.')+
    '<div class="dialog-body"><form id="encrypted-export-form">'+
    '<div class="form-field"><label for="encrypt-pass">Password (almeno 12 caratteri)</label><input class="field" id="encrypt-pass" type="password" autocomplete="new-password" required minlength="12"></div>'+
    '<div class="form-field"><label for="encrypt-confirm">Ripeti password</label><input class="field" id="encrypt-confirm" type="password" autocomplete="new-password" required minlength="12"></div>'+
    '<p class="recon-minor">La password non viene inviata, memorizzata o recuperata da CasaChiara. Se la perdi, il backup cifrato sarà inutilizzabile.</p></form></div>'+
    '<div class="dialog-foot"><button class="button" type="button" data-close>Annulla</button><button type="submit" form="encrypted-export-form" class="button primary">Cifra ed esporta</button></div>');
}
async function encryptedExportSubmit(){
  const password=el('encrypt-pass').value,confirmPassword=el('encrypt-confirm').value;
  if(password.length<12||password!==confirmPassword)return alert('Le password devono coincidere ed essere lunghe almeno 12 caratteri.');
  const submit=el('encrypted-export-form').querySelector('button[type="submit"]');if(submit)submit.disabled=true;
  try{
    const payload=checkData(state);
    const integrity=await sha256(JSON.stringify(payload));
    const backup={format:'casachiara.backup',backupVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),integrity:{algorithm:'SHA-256',sha256:integrity},data:payload};
    const encrypted=await SECURE.encrypt(JSON.stringify(backup),password,APP_VERSION);
    download(JSON.stringify(encrypted,null,2),'CasaChiara_backup_CIFRATO_'+toDate(today)+'.json','application/json');
    try{localStorage.setItem(LAST_EXPORT_KEY,new Date().toISOString())}catch{}
    closeModal();if(view==='settings')render();showToast('Backup cifrato generato. Controlla il file in Download.');
  }catch(err){alert('Cifratura non riuscita: '+err.message)}
  finally{if(submit)submit.disabled=false}
}
function csvSafe(x){let v=String(x??'');if(/^[\s\t\r\n]*[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
function exportCSV(){const rows=[['Data','Conto','Tipo','Categoria','Descrizione','Importo EUR','Origine ricorrenza','Mese di competenza','Previsto EUR','Tipo registrazione'],...[...state.transactions].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,accountName(t.accountId),t.type==='income'?'Entrata':'Spesa',t.category,t.description,(t.amountCents/100).toFixed(2).replace('.',','),t.recurringId?'Sì':'No',t.occMonth||'',t.plannedCents!==undefined?(t.plannedCents/100).toFixed(2).replace('.',','):'',t.recurringId?(t.recurringFinal===false?'Acconto':'Saldo finale'):''])];download('\ufeff'+rows.map(row=>row.map(csvSafe).join(';')).join('\r\n'),`CasaChiara_movimenti_${toDate(today)}.csv`,'text/csv;charset=utf-8');showToast('Registro CSV pronto')}
async function handleBackupFile(file){if(!file)return;try{let password=null;const raw=JSON.parse(await file.text());if(raw?.format===SECURE.FORMAT){password=window.prompt('Inserisci la password del backup cifrato. Non viene memorizzata.');if(!password)return;}const info=await parseBackup(file,password),summary=backupSummary(info);if(backupFileMode==='verify'){alert('Backup leggibile. Nessun dato modificato.\n\n'+summary);return}if(!confirm(`IMPORTAZIONE BACKUP\n\n${summary}\n\nL’archivio attuale (${state.transactions.length} movimenti, ${state.recurring.length} ricorrenze) verrà sostituito. Una copia locale permetterà di annullare l’ultima importazione. Attenzione: verranno sostituiti anche il registro delle riconciliazioni e lo storico delle modifiche. Continuare?`))return;replaceArchiveWithRecovery(info.data);closeModal();render();showToast('Backup importato: puoi annullare da Impostazioni.')}catch(err){alert('Operazione annullata: '+err.message)}finally{const input=el('backup-file');if(input)input.value=''}}
async function checkUpdates(){if(!navigator.onLine){showToast('Connettiti a Internet per controllare gli aggiornamenti');return}if(!('serviceWorker' in navigator)){showToast('Aggiornamento automatico non supportato in questo browser');return}try{const registration=await navigator.serviceWorker.getRegistration();if(!registration){showToast('App offline non ancora configurata: riaprila online');return}await registration.update();showToast('Controllo completato. Se disponibile, chiudi e riapri CasaChiara.')}catch(err){showToast('Controllo non riuscito: riprova online')}}
function handleClick(event){const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-close'))return closeModal();if(button.dataset.view)return changeView(button.dataset.view);if(button.dataset.quick){let [freq,type]=button.dataset.quick.split('-');return freq==='fixed'?startRecurring(null,{type}):startTransaction(null,{type})}if(button.dataset.add)return button.dataset.add==='recurring'?startRecurring():startTransaction();if(button.dataset.editTransaction)return startTransaction(button.dataset.editTransaction);if(button.dataset.editRecurring)return startRecurring(button.dataset.editRecurring);if(button.dataset.complete)return completeRecurring(button.dataset.complete);if(button.dataset.deleteTransaction)return deleteItem('transaction',button.dataset.deleteTransaction);if(button.dataset.deleteRecurring)return deleteItem('recurring',button.dataset.deleteRecurring);if(button.id==='prev-month'||button.id==='next-month'){selectedMonth=addMonth(selectedMonth,button.id==='prev-month'?-1:1);render();return}if(button.id==='add-general')return startTransaction();if(button.id==='add-budget')return startBudget();if(button.dataset.editBudget!==undefined)return startBudget(button.dataset.editBudget);if(button.id==='delete-budget')return deleteBudget();if(button.id==='copy-budget')return copyBudgetsFromPrevious();if(button.id==='add-account')return startAccount();if(button.dataset.editAccount)return startAccount(button.dataset.editAccount);if(button.dataset.deleteAccount)return deleteAccount(button.dataset.deleteAccount);if(button.id==='add-transfer'||button.id==='add-transfer-second')return startTransfer();if(button.dataset.editTransfer)return startTransfer(button.dataset.editTransfer);if(button.dataset.deleteTransfer)return deleteTransfer(button.dataset.deleteTransfer);if(button.dataset.createCase)return createLegacyCase(button.dataset.createCase);if(button.dataset.manageCase)return startCase(button.dataset.manageCase);if(button.id==='export-encrypted')return startEncryptedExport();if(button.id==='export-json')return exportJSON();if(button.id==='export-csv')return exportCSV();if(button.id==='recon-export')return download(RECON.csv(state),`CasaChiara_riconciliazioni_${toDate(today)}.csv`,'text/csv;charset=utf-8');if(button.id==='import-json'||button.id==='verify-json'){backupFileMode=button.id==='verify-json'?'verify':'import';return el('backup-file').click()}if(button.id==='restore-previous')return undoLastImport();if(button.id==='check-updates')return checkUpdates();if(button.dataset.formType){const form=el('transaction-form');form.dataset.type=button.dataset.formType;form.querySelectorAll('[data-form-type]').forEach(b=>b.classList.toggle('selected',b.dataset.formType===form.dataset.type));el('transaction-category').innerHTML=options(form.dataset.type);return}if(button.dataset.ruleType){const form=el('recurring-form');form.dataset.type=button.dataset.ruleType;form.querySelectorAll('[data-rule-type]').forEach(b=>b.classList.toggle('selected',b.dataset.ruleType===form.dataset.type));el('recurring-category').innerHTML=options(form.dataset.type);return}}
document.addEventListener('click',handleClick);
document.addEventListener('submit',e=>{if(e.target.id==='encrypted-export-form'){e.preventDefault();encryptedExportSubmit()}else if(e.target.id==='case-form'){e.preventDefault();caseSubmit()}else if(e.target.id==='reconciliation-form'){e.preventDefault();reconcileSubmit()}else if(e.target.id==='budget-form'){e.preventDefault();budgetSubmit()}else if(e.target.id==='account-form'){e.preventDefault();accountSubmit()}else if(e.target.id==='transfer-form'){e.preventDefault();transferSubmit()}else if(e.target.id==='transaction-form'){e.preventDefault();transactionSubmit()}else if(e.target.id==='recurring-form'){e.preventDefault();recurringSubmit()}else if(e.target.id==='settings-form'){e.preventDefault();let m=el('initial-month').value,a=amountFromInput(el('initial-amount').value,true);if(!validMonth(m)||a===null)return alert('Mese o saldo iniziale non valido.');if(a!==state.settings.openingCents)return alert('Modifica il saldo iniziale dalla sezione Conti.');if(applyChange(d=>{d.settings.openingMonth=m})){render();showToast('Mese di partenza aggiornato')}}});
document.addEventListener('input',e=>{if(e.target.id==='recon-actual'||e.target.id==='recon-date')updateReconciliationPreview();if(e.target.id==='search'){search=e.target.value;let list=totalForMonth(selectedMonth).transactions.filter(x=>(kindFilter==='all'||x.type===kindFilter)&&[x.description,x.category].join(' ').toLowerCase().includes(search.toLowerCase()));el('transaction-rows').innerHTML=entryList(list)}});
document.addEventListener('change',e=>{if(e.target.id==='recon-account'||e.target.id==='recon-date')updateReconciliationPreview();if(e.target.id==='recon-filter'){reconFilter=e.target.value;render()}if(e.target.id==='kind-filter'){kindFilter=e.target.value;render()}if(e.target.id==='recurring-filter'){recurringFilter=e.target.value;render()}if(e.target.id==='backup-file'){handleBackupFile(e.target.files[0])}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline non disponibile:',err)));
})();