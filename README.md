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
