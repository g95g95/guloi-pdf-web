# Guida al deploy — Guloi PDF Web

Questa guida copre due parti:

1. **Evidenza dello smoke test locale** eseguito prima del deploy (Parte 1).
2. **Runbook passo-passo per il deploy su Render** (Parte 2), da seguire manualmente perché richiede l'account GitHub/Render dell'utente.

---

## Parte 1 — Smoke test locale (2026-07-14): tutti i controlli superati

Ambiente: Windows, Python 3.12.7, Node v24.11.1. Build frontend pulita (`npm run build`), backend avviato con `GULOI_STATIC_DIR` puntato alla `dist/` reale, `uvicorn app.main:app --no-access-log`, porta 8000.

### Test automatici

| Suite | Risultato |
|---|---|
| Backend `pytest` | **59 passed** |
| Frontend `vitest run` | **57 passed** |

### Rotte statiche / SPA

| Richiesta | Status | Note |
|---|---|---|
| `GET /` | 200 | HTML, 1652 byte |
| `GET /comprimi` | 200 | HTML servito dal fallback SPA (routing client-side) |
| `GET /privacy` | 200 | HTML servito dal fallback SPA |
| `GET /assets/index-BKlapirH.js` (hash reale della build) | 200 | header `Cache-Control: public, max-age=31536000, immutable` presente |
| `GET /api/health` | 200 | `{"status":"ok"}` |

### Endpoint API — happy path (PDF reali generati con reportlab: `big5.pdf` 5 pagine, `small2.pdf` 2 pagine)

| Endpoint | Parametri | Status | Size risposta |
|---|---|---|---|
| `POST /api/compress` | `compress_images=false` | 200 | 1705 B |
| `POST /api/compress` | `compress_images=true` | 200 | 1690 B |
| `POST /api/merge` | 2 file (`big5.pdf` + `small2.pdf`) | 200 | 3992 B |
| `POST /api/split` | `mode=every, value=2` | 200 | zip, 4149 B |
| `POST /api/rotate` | `angle=90` | 200 | 2863 B |
| `POST /api/extract` | `pages=1-2` | 200 | 1433 B |
| `POST /api/password/set` | `password=test1234` | 200 | 3968 B |
| `POST /api/password/remove` | password corretta (`test1234`) sull'output protetto | 200 | 2970 B |
| `POST /api/password/remove` | password **errata** | **422** | `{"detail":"Password errata"}` |

Verifica contenuto zip di `/api/split`: estratto con `zipfile`, 3 file (`parte_01.pdf`, `parte_02.pdf`, `parte_03.pdf`), tutti PDF validi apribili con `pypdf.PdfReader`, pagine 2+2+1 = 5 (coerente con `mode=every value=2` su un sorgente da 5 pagine).

### Controlli di errore

| Caso | Status |
|---|---|
| Upload non-PDF (`.txt` rinominato con `type=application/pdf`) su `/api/compress` | **415** `{"detail":"Il file non è un PDF"}` |
| 25 richieste rapide consecutive a `/api/extract` | prime 10 → 200, dalle successive → **429** `{"detail":"Troppe richieste, riprova tra poco"}` (limite `RATE_LIMIT_MAX=20` nella finestra scorrevole, raggiunto includendo le chiamate precedenti dello stesso smoke test) |

Il server è stato riavviato dopo il test di rate limit per non "inquinare" eventuali controlli successivi (comportamento atteso e documentato nel task).

### Log del server

Ispezionato il log stdout/stderr del processo uvicorn dopo l'intera sessione di test (inclusi errori 415/422/429): contiene **solo** le 4 righe di startup (`Started server process`, `Waiting for application startup`, `Application startup complete`, `Uvicorn running on ...`). **Nessuna riga di access log**, **nessun nome di file**, nessun IP client — coerente con `--no-access-log` e con l'unico log applicativo (`app/main.py`, che logga solo `<method> <path> -> 500` sugli errori non gestiti, mai raggiunto in questo test).

### Esito

Nessun bug riscontrato nel backend durante lo smoke test. Nessuna modifica al codice è stata necessaria.

---

## Parte 2 — Runbook di deploy su Render

### 1. Creare la repo pubblica GitHub (obbligo AGPL §13 + vincolo privacy)

**Importante**: NON pushare la repo `Guloi_PDF` così com'è. La sua storia git contiene riferimenti aziendali interni non destinati alla pubblicazione. Bisogna creare una **repo nuova e pulita** il cui contenuto alla root sia quello della cartella `guloi-pdf-web/` (senza la history di `Guloi_PDF`).

Passi concreti (da **PowerShell** su Windows, sostituendo `TUO-USERNAME` con il tuo username GitHub):

```powershell
# 1. Copia pulita della sola cartella guloi-pdf-web in una nuova directory
Copy-Item -Recurse "C:\Users\pisel\Desktop\Guloi\Guloi_PDF\guloi-pdf-web" "C:\Users\pisel\Desktop\guloi-pdf-web-public"
cd "C:\Users\pisel\Desktop\guloi-pdf-web-public"

# 2. Rimuovi eventuali cartelle generate (non vanno versionate)
Remove-Item -Recurse -Force frontend\node_modules, frontend\dist -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Filter __pycache__ -Directory | Remove-Item -Recurse -Force

# 3. Inizializza una history git nuova e pulita
git init
git add .
git commit -m "Initial public release of Guloi PDF Web"

# 4. Crea la repo su GitHub (via web UI: github.com/new)
#    - Nome: guloi-pdf-web
#    - Visibilità: PUBBLICA (obbligatorio per l'obbligo AGPL §13)
#    - NON aggiungere README/gitignore/license da GitHub (li abbiamo già)

# 5. Collega il remote e fai il push
git remote add origin https://github.com/TUO-USERNAME/guloi-pdf-web.git
git branch -M main
git push -u origin main
```

Variante per **Linux/macOS o Git Bash** (passi 1-2; i comandi `git` sono identici):

```bash
cp -r "/c/Users/pisel/Desktop/Guloi/Guloi_PDF/guloi-pdf-web" "/c/Users/pisel/Desktop/guloi-pdf-web-public"
cd "/c/Users/pisel/Desktop/guloi-pdf-web-public"
rm -rf frontend/node_modules frontend/dist
find . -type d -name __pycache__ -exec rm -rf {} +
```

**Licenza su GitHub**: il file `LICENSE` (AGPL-3.0) è già presente nella cartella, quindi GitHub lo rileverà automaticamente e mostrerà "AGPL-3.0" come licenza del repo. Non serve creare la licenza da zero nell'interfaccia GitHub.

### 2. Aggiornare `SOURCE_REPO_URL` con l'URL reale

Il file `frontend/src/lib/constants.ts` contiene attualmente un placeholder:

```ts
export const SOURCE_REPO_URL = "https://github.com/OWNER/guloi-pdf-web";
```

Questo URL viene mostrato nel footer del sito e nella pagina `/privacy`: è il link "Codice sorgente" che permette a chiunque usi il servizio di scaricare il sorgente completo, come richiesto dall'**AGPL-3.0 §13 (Remote Network Interaction)** — chi interagisce con l'app via rete ha diritto di ricevere il codice sorgente corrispondente.

Passi:

1. Modifica `constants.ts` (nella repo pubblica appena creata, non in `Guloi_PDF`) sostituendo `OWNER` con il tuo username/organizzazione GitHub reale:
   ```ts
   export const SOURCE_REPO_URL = "https://github.com/TUO-USERNAME/guloi-pdf-web";
   ```
2. Rebuild del frontend per rigenerare gli asset con l'URL corretto (PowerShell; identico su Linux/macOS o Git Bash):
   ```powershell
   cd frontend
   npm run build
   cd ..
   ```
3. Commit e push (identico in tutte le shell):
   ```powershell
   git add frontend/src/lib/constants.ts
   git commit -m "chore: set real source repo URL for AGPL compliance"
   git push
   ```

**Nota**: la `dist/` non va committata (Render la rigenera in fase di build via Docker), quindi basta committare il file sorgente modificato.

### 3. Deploy su Render

1. Vai su [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Collega l'account GitHub (se non già collegato) e seleziona la repo pubblica appena creata (`guloi-pdf-web`).
3. Render rileva automaticamente `render.yaml` alla root della repo e propone il servizio `guloi-pdf-web`:
   - `env: docker`, `dockerfilePath: ./Dockerfile` — build multi-stage (frontend + backend) già configurata.
   - `region: frankfurt` — già impostata.
   - `plan: free` — già impostato.
   - `healthCheckPath: /api/health` — già impostato.
4. Conferma e avvia il deploy. Render farà il build dell'immagine Docker (build frontend con `npm ci && npm run build`, poi immagine Python runtime) e avvierà il container.
5. Attendi il completamento del build (qualche minuto la prima volta).

**Nota piano free**: il piano free di Render va in *sleep* dopo un periodo di inattività (circa 15 minuti senza richieste). La prima richiesta dopo lo sleep sarà lenta (~30-60 secondi di *cold start*) mentre il container si riavvia. È un comportamento atteso del piano gratuito, non un malfunzionamento.

### 4. Verifiche post-deploy (gate obbligatorio prima di considerare il deploy completo)

Da eseguire sull'URL pubblico assegnato da Render (es. `https://guloi-pdf-web.onrender.com`):

- [ ] Il link "Codice sorgente" nel footer punta alla repo GitHub corretta e pubblica (non a `OWNER/guloi-pdf-web`).
- [ ] `/privacy` è raggiungibile e mostra il testo corretto.
- [ ] Upload + compressione di un PDF reale funziona end-to-end (prova con un PDF vero, non solo la home page).
- [ ] Il rate limit è attivo (facendo molte richieste rapide si ottiene 429 a un certo punto).
- [ ] Gli asset statici (`/assets/...`) hanno l'header `Cache-Control: public, max-age=31536000, immutable`.
- [ ] Nel dashboard Render → **Logs** del servizio: **nessuna riga di access log**, nessun nome di file, nessun dettaglio della richiesta oltre a eventuali righe di errore `<method> <path> -> 500`.

### 5. Cosa NON fare

- **Non annunciare pubblicamente** il servizio (social, forum, ecc.) prima di aver completato tutte le verifiche del punto 4.
- **Non attivare pubblicità/ads**: questa fase è bloccata — serve prima il coinvolgimento di un commercialista per gli aspetti fiscali/legali legati a eventuali entrate pubblicitarie.
