# Guloi PDF Web — Third-Party Software Notices

Questa applicazione integra software open source di terze parti.
Di seguito l'elenco delle dipendenze principali con le rispettive licenze.

---

## Dipendenze Python (backend)

### pypdf
- **Licenza**: BSD-3-Clause
- **Upstream**: https://github.com/py-pdf/pypdf
- **Utilizzo**: manipolazione PDF (merge, split, rotate, extract).

### pikepdf
- **Licenza**: MPL-2.0
- **Upstream**: https://github.com/pikepdf/pikepdf
- **Utilizzo**: rewrite e compressione PDF.

### Pillow
- **Licenza**: MIT-CMU (HPND)
- **Upstream**: https://github.com/python-pillow/Pillow
- **Utilizzo**: gestione immagini.

### PyMuPDF (pymupdf)
- **Licenza**: GNU AGPL v3.0 (Affero General Public License)
- **Upstream**: https://github.com/pymupdf/PyMuPDF
- **Utilizzo**: elaborazione avanzata dei PDF (rendering, redazione reale, manipolazione content stream).

> **IMPORTANTE — perché l'intero progetto è AGPL-3.0**
>
> PyMuPDF è distribuito sotto licenza AGPL-3.0. Poiché questa applicazione è un servizio web che espone le funzionalità di PyMuPDF agli utenti tramite rete, l'art. 13 dell'AGPL-3.0 ("Remote Network Interaction") impone di rendere disponibile agli utenti il codice sorgente completo dell'applicazione, inclusa ogni modifica.
>
> Di conseguenza **l'intero progetto Guloi PDF Web è distribuito sotto licenza AGPL-3.0** (vedi [`LICENSE`](./LICENSE)). L'alternativa per una distribuzione sotto licenza diversa sarebbe acquistare una licenza commerciale da Artifex Software (https://artifex.com/licensing/commercial/) oppure sostituire PyMuPDF con una soluzione equivalente a licenza permissiva.

### FastAPI
- **Licenza**: MIT
- **Upstream**: https://github.com/fastapi/fastapi
- **Utilizzo**: framework per le API REST del backend.

### uvicorn
- **Licenza**: BSD-3-Clause
- **Upstream**: https://github.com/encode/uvicorn
- **Utilizzo**: server ASGI per l'esecuzione del backend FastAPI.

---

## Dipendenze JavaScript/TypeScript (frontend)

### React
- **Licenza**: MIT
- **Upstream**: https://github.com/facebook/react
- **Utilizzo**: libreria per la costruzione dell'interfaccia utente.

### Vite
- **Licenza**: MIT
- **Upstream**: https://github.com/vitejs/vite
- **Utilizzo**: build tool e dev server per il frontend.

### Tailwind CSS
- **Licenza**: MIT
- **Upstream**: https://github.com/tailwindlabs/tailwindcss
- **Utilizzo**: framework CSS utility-first per lo stile dell'interfaccia.

---

Per il testo completo di ciascuna licenza, fare riferimento ai pacchetti upstream linkati. Questo file è fornito a scopo informativo e di trasparenza per l'utilizzatore finale.

Documento aggiornato: 2026-07-14
