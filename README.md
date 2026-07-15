# Guloi PDF — Web App

Versione web di **Guloi PDF**: strumenti gratuiti per lavorare con i tuoi file PDF direttamente dal browser, senza installare nulla.

## Strumenti previsti

- **Comprimi** — riduci il peso dei PDF mantenendo la qualità.
- **Unisci** — combina più PDF in un unico file.
- **Dividi** — estrai un intervallo di pagine o spezza il PDF in più file.
- **Ruota** — ruota le pagine nell'orientamento corretto.
- **Estrai** — estrai testo, immagini o pagine specifiche.
- **Password** — proteggi o rimuovi la password da un PDF.

## Licenza

![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)

Questo progetto è distribuito sotto licenza **GNU Affero General Public License v3.0 (AGPL-3.0)**. Il testo completo della licenza è disponibile nel file [`LICENSE`](./LICENSE).

L'AGPL-3.0 è richiesta perché il progetto utilizza [PyMuPDF](https://github.com/pymupdf/PyMuPDF), libreria distribuita sotto AGPL-3.0. Di conseguenza l'intera applicazione web eredita gli stessi termini: chiunque acceda al servizio via rete ha diritto a ricevere il codice sorgente completo dell'applicazione (art. 13 AGPL, "Remote Network Interaction").

La disponibilità del codice sorgente di questo repository soddisfa tale obbligo (§13 AGPL-3.0): il link al sorgente sarà esposto anche direttamente nell'interfaccia web del servizio.

Vedi anche [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) per l'elenco delle dipendenze di terze parti e le relative licenze.

## Privacy

- I file caricati vengono elaborati **in modo effimero**: esistono solo per la durata della richiesta.
- Al termine dell'elaborazione (o in caso di errore) i file vengono **eliminati immediatamente** dal server.
- **Nessun contenuto dei file viene registrato** nei log del servizio.
- Nessun cookie di profilazione: non viene effettuato tracciamento pubblicitario o analitico invasivo degli utenti.

## Stack tecnico (previsto)

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python) — API REST per l'elaborazione dei PDF, riutilizzando il core esistente di Guloi PDF (pypdf, pikepdf, pymupdf, Pillow).
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) — interfaccia utente moderna e reattiva.

## Esecuzione locale

Richiede Python 3.12+ e Node.js 24+.

**Backend** (FastAPI, con reload):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

L'API risponde su `http://127.0.0.1:8000` (health check: `GET /api/health`).

**Frontend** (Vite dev server):

```bash
cd frontend
npm install
npm run dev
```

L'interfaccia risponde su `http://127.0.0.1:5173` e in dev proxya le chiamate `/api/*` verso il backend.

In produzione (immagine Docker) non serve il dev server: il backend serve direttamente i file statici della build del frontend (vedi sotto).

## Deploy su Render

Il progetto include un `Dockerfile` multi-stage (build del frontend con Node, runtime con Python/FastAPI che serve sia l'API sia i file statici della SPA) e un `render.yaml` pronto per [Render](https://render.com/):

- **Regione**: `frankfurt` (EU), scelta di default privacy-sensibile per un'utenza prevalentemente italiana.
- **Health check**: `/api/health`.
- **Piano**: `free`, con `autoDeploy` attivo sul branch collegato.

Per deployare: connetti il repository su Render, che rileverà automaticamente `render.yaml` (Blueprint), oppure crea manualmente un Web Service con `env: docker` puntato a questo `Dockerfile`.

Il comando di avvio del container usa `uvicorn ... --no-access-log`: è una scelta **obbligata**, non un'ottimizzazione. La sezione "Privacy" qui sopra promette che i log del servizio non registrano il contenuto delle richieste (solo metodo/percorso/stato in caso di errore); il log di accesso di default di uvicorn includerebbe invece l'IP del client e la request-line completa, rendendo falsa quella promessa.

## Stato del progetto

In sviluppo. Questo repository contiene per ora la sola struttura di base e i documenti legali del progetto.
