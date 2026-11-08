# CasaChiara — Finanze domestiche

CasaChiara è un'app web progressiva (PWA) gratuita pensata per iPhone, iPad e computer.

## Funzioni
- Conti correnti, contanti, carte prepagate, risparmi e saldi per conto.
- Trasferimenti interni neutri: non alterano entrate, uscite e patrimonio complessivo.
- Dashboard con entrate, uscite e saldo mensile e progressivo.
- Movimenti effettivi: entrate ricorrenti, entrate extra, spese fisse, spese extra.
- Ricorrenze previste (non contabilizzate fino alla conferma).
- Modifica/eliminazione dei movimenti, categorie, ricerca e grafici.
- Saldo iniziale, esportazione CSV e backup/importazione JSON.
- Uso offline dopo che l'app ha completato la prima installazione della cache.
- Pianificazione per categoria: budget mensili e scadenze tratte dalle ricorrenze.

## Pubblicazione con GitHub Pages
1. Apri **Settings → Pages** in questo repository.
2. In **Build and deployment** scegli **Deploy from a branch**.
3. Imposta **Branch: main** e **Folder: /(root)** e premi **Save**.
4. Dopo il completamento della pubblicazione, apri l'URL indicato da GitHub Pages.
5. In Safari (iPhone/iPad): **Condividi → Aggiungi alla schermata Home**.

## Privacy e conservazione dei dati
Il repository GitHub contiene **solo il codice** dell'app, mai il registro dei movimenti. CasaChiara salva i dati nel `localStorage` del browser che la esegue, quindi **non li sincronizza** tra dispositivi. Non esiste un account utente o un database remoto.

**Importante:** i dati possono andare persi se vengono eliminati quelli del sito, si cancella l'app o il sistema rimuove l'archiviazione locale. Esporta regolarmente un backup JSON dall'app e salvalo in un posto sicuro, anche fuori dal dispositivo. Una PWA non garantisce automaticamente un archivio durevole o sincronizzato.

Per proteggere le finanze, evita di aprire la stessa origine GitHub Pages con codice non affidabile: `localStorage` è associato all'origine web, non al percorso della singola app.

## Note
Nessun hosting a pagamento o dominio personale richiesto. GitHub Pages serve il codice gratuitamente; il primo accesso richiede Internet. Le notifiche di scadenza in background e la sincronizzazione multi-dispositivo non sono implementate in questa versione.

## Versione 2.1 — protezione dei dati
- Chiave di archiviazione e modello v2 invariati; non serve migrare i dati.
- Backup JSON con impronta SHA-256 e verifica senza importare.
- Compatibilità con backup JSON della versione precedente.
- Copia locale di recupero prima dell'importazione e possibilità di annullarla.
- Migliore gestione dei salvataggi falliti: la memoria interna non finge un successo.
- Cache offline aggiornata alla v2.1 con strategia network-first.
- Backup non cifrati: l'avvio di un download non garantisce che il file sia stato salvato.

## Versione 2.2 — Conti e trasferimenti

- Sezione **Conti** nel menu laterale e nella navigazione mobile.
- Crea e modifica conti (corrente, contanti, prepagata, risparmi, altro), con un saldo iniziale per ciascuno.
- Il saldo progressivo complessivo è la somma dei conti. Entrate e spese sono attribuite a un conto.
- Ogni ricorrenza può essere collegata a un conto.
- I trasferimenti tra conti sono registrazioni autonome, **non** entrate/uscite: ad esempio un prelievo da conto corrente a contanti non aumenta le spese.
- I conti con movimenti collegati non possono essere eliminati: possono essere archiviati.
- Migrazione automatica dei dati **v2 → v3** al primo avvio: vecchi movimenti e ricorrenze vengono assegnati al **Conto principale**, con saldo iniziale uguale a quello precedente.
- La vecchia chiave di archiviazione `casachiara.pwa.v2` non viene cancellata. La versione 2.2 usa `casachiara.pwa.v3`.
- Backup JSON 2.0 e 2.1 ancora importabili; i nuovi backup 2.2 includono conti e trasferimenti e non possono essere importati in versioni precedenti.
- Prima di aggiornare l'app, salva un backup JSON esterno. Se la migrazione non riesce, l'app segnala l'errore e non modifica l'archivio di origine.
- Per trasferire denaro che è già stato contato nel saldo iniziale di un conto, crea il conto di destinazione con **saldo iniziale 0,00 €** e registra un trasferimento: altrimenti il patrimonio sarebbe duplicato.
- I saldi iniziali sono riferiti allo stesso mese di partenza per tutti i conti; non sono un modo per rappresentare depositi avvenuti in un secondo momento.
- Sono disponibili test automatici (`node --test tests/*.test.cjs`) e una verifica CI tramite GitHub Actions.

L'archivio resta locale, offline e indipendente per ciascun dispositivo. Non è prevista sincronizzazione automatica. Le esportazioni JSON **non sono cifrate**, anche quando includono un controllo SHA-256.

## Versione 2.3 — Pianifica: budget e scadenziario

- La voce **Ricorrenze** è rinominata **Pianifica**. Le ricorrenze precedenti restano presenti e modificabili.
- **Budget mensile per categoria:** configura una soglia distinta per ciascuna categoria di spesa e per ogni mese.
- Mostra limite, spesa effettiva, residuo e superamento; evidenzia le spese in categorie prive di budget separatamente, per non falsare il residuo.
- I budget possono essere modificati/eliminati; è possibile copiare le categorie e i limiti dal mese precedente senza modificare quelli già impostati.
- **Scadenziario** basato sulle ricorrenze attive e ancora da confermare. La scadenza può risultare superata, odierna, imminente entro 7 giorni, oppure programmata.
- Gli avvisi sono **solo visivi all'interno dell'app**; non sono notifiche push e non si aggiornano mentre l'app è chiusa.
- Una ricorrenza non confermata con data superata non prova che il pagamento sia mancato: verifica prima di premere Pagata/Incassata.
- I budget e gli importi previsti **non modificano il saldo**: contano solo le transazioni effettivamente confermate; i trasferimenti tra conti restano neutri.
- La dashboard mostra un riepilogo dei budget del mese selezionato.

### Compatibilità e protezione dei dati

- Archivio **versione 4** sotto la chiave locale `casachiara.pwa.v4`. La prima apertura della 2.3 migra l'archivio dalla versione 3 (o 2) e conserva la chiave precedente senza eliminarla.
- Vecchi backup delle versioni 2.0, 2.1 e 2.2 sono importabili nella 2.3. I nuovi backup della 2.3 contengono budget e **non devono essere importati in versioni precedenti**.
- Esporta e verifica un nuovo backup JSON dopo l'aggiornamento. Non cancellare i dati del sito né disinstallare l'app per forzare l'aggiornamento.
- Il backup SHA-256 rileva errori o modifiche accidentali, ma non cifra i dati e non autentica il creatore del file.
- I test di regressione dei conti e della pianificazione si eseguono con `node --test tests/*.test.cjs` e tramite GitHub Actions.

## Versione 2.3.1 — Attribution SEGNOTA Studio
- In Dashboard compare la dicitura **Developed by SEGNOTA Studio**, discreta ma immediatamente riconoscibile.
- La stessa attribuzione compare nel footer e in **Impostazioni → Informazioni sull'app**.
- I metadati HTML e la descrizione del manifest indicano SEGNOTA Studio come autore/sviluppatore, mantenendo **CasaChiara** come nome dell'app.
- Aggiornamento esclusivamente di presentazione: chiave locale `casachiara.pwa.v4` e schema finanziario invariati.
