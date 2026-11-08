# CasaChiara — Finanze domestiche

CasaChiara è un'app web progressiva (PWA) gratuita pensata per iPhone, iPad e computer.

## Funzioni
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
