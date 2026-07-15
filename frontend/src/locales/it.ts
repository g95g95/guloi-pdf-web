/**
 * Italian dictionary. This object's shape (`as const`) is the source of truth
 * for the key type; every other locale must be assignable to `typeof it`.
 * Values may contain `{name}` placeholders interpolated by `t(key, params)`.
 */
export const it = {
  // App shell
  "app.name": "Guloi PDF",
  "app.tagline": "Strumenti PDF, tutto in un'unica app",
  "lang.switch": "Lingua",
  "lang.it": "IT",
  "lang.en": "EN",
  "theme.toLight": "Passa al tema chiaro",
  "theme.toDark": "Passa al tema scuro",
  "theme.light": "Tema chiaro",
  "theme.dark": "Tema scuro",
  "toast.close": "Chiudi notifica",
  "skip.toContent": "Vai al contenuto",

  // FileDrop
  "filedrop.aria": "Trascina qui i file PDF o premi per selezionarli",
  "filedrop.promptOne": "Trascina qui un PDF o ",
  "filedrop.promptMany": "Trascina qui i PDF o ",
  "filedrop.browse": "sfoglia",
  "filedrop.hint": "Solo PDF · max {max} MB",
  "filedrop.hintCap": "Solo PDF · max {max} MB · fino a {cap} file",
  "filedrop.notPdf": 'Il file "{name}" non è un PDF',
  "filedrop.tooBig": 'Il file "{name}" supera {max} MB',
  "filedrop.overflowOne": "Un file è stato ignorato: numero massimo raggiunto",
  "filedrop.overflowMany": "{n} file ignorati: numero massimo di {cap} raggiunto",
  "filedrop.moveUp": "Sposta {name} su",
  "filedrop.moveDown": "Sposta {name} giù",
  "filedrop.remove": "Rimuovi {name}",

  // Home
  "home.hero.title": "Ogni strumento PDF di cui hai bisogno, nel browser",
  "home.hero.subtitle":
    "Comprimi, unisci, dividi, ruota, estrai e proteggi i tuoi PDF. Veloce e gratis.",
  "home.privacy":
    "I file vengono elaborati e subito eliminati. Niente archiviazione, niente tracciamento.",

  // Tool names + descriptions (also used on home cards)
  "tool.compress.name": "Comprimi PDF",
  "tool.compress.desc": "Riduci il peso del file mantenendo la leggibilità",
  "tool.merge.name": "Unisci PDF",
  "tool.merge.desc": "Combina più PDF in un unico file",
  "tool.split.name": "Dividi PDF",
  "tool.split.desc": "Separa un PDF in più file",
  "tool.rotate.name": "Ruota PDF",
  "tool.rotate.desc": "Ruota le pagine di 90, 180 o 270 gradi",
  "tool.extract.name": "Estrai pagine",
  "tool.extract.desc": "Crea un nuovo PDF con le pagine scelte",
  "tool.protect.name": "Proteggi PDF",
  "tool.protect.desc": "Aggiungi una password di apertura al PDF",
  "tool.unlock.name": "Sblocca PDF",
  "tool.unlock.desc": "Rimuovi la password da un PDF protetto",

  // Shared tool page
  "tool.processing": "Elaborazione in corso…",
  "tool.uploading": "Caricamento…",
  "tool.download": "Scarica il file",
  "tool.done": "Fatto! Il tuo file è pronto.",
  "tool.reset": "Elabora un altro file",
  "tool.selectFile": "Seleziona un PDF per continuare",
  "tool.progress": "Avanzamento",

  // Compress
  "compress.action": "COMPRIMI",
  "compress.images": "Comprimi anche le immagini (riduce la qualità)",
  "compress.result": "Prima: {before} KB · Dopo: {after} KB · Risparmio: {saved}%",

  // Merge
  "merge.action": "UNISCI",
  "merge.hint":
    "Aggiungi almeno 2 PDF. Trascina o usa le frecce per riordinarli: l'ordine è quello del file unito.",
  "merge.needTwo": "Aggiungi almeno 2 PDF",

  // Split
  "split.action": "DIVIDI",
  "split.mode": "Modalità",
  "split.mode.every": "Ogni N pagine",
  "split.mode.ranges": "Per intervalli",
  "split.every.label": "Numero di pagine per file",
  "split.ranges.label": "Intervalli di pagine",
  "split.ranges.placeholder": "1-3,5-7",
  "split.every.invalid": "Inserisci un numero di pagine maggiore di 0",
  "split.ranges.invalid": "Usa il formato 1-3,5-7",

  // Rotate
  "rotate.action": "RUOTA",
  "rotate.angle": "Angolo",
  "rotate.pages": "Pagine (vuoto = tutte)",
  "rotate.pages.placeholder": "1,3,5",

  // Extract
  "extract.action": "ESTRAI",
  "extract.pages": "Pagine da estrarre",
  "extract.pages.placeholder": "1-3,5",
  "extract.pages.invalid": "Indica le pagine, es: 1-3,5",

  // Protect / Unlock
  "protect.action": "PROTEGGI",
  "protect.password": "Password",
  "protect.password.placeholder": "Almeno 4 caratteri",
  "protect.password.short": "La password deve avere almeno 4 caratteri",
  "protect.owner.section": "Avanzate",
  "protect.owner.label": "Password proprietario (opzionale)",
  "protect.owner.hint":
    "Limita permessi come stampa e modifica. Se vuota, usa la password di apertura.",
  "protect.show": "Mostra password",
  "protect.hide": "Nascondi password",
  "unlock.action": "SBLOCCA",
  "unlock.password": "Password attuale del PDF",
  "unlock.password.required": "Inserisci la password",

  // Editor
  "tool.editor.name": "Editor PDF",
  "tool.editor.desc": "Evidenzia, disegna, firma e modifica il testo del PDF",
  "editor.loading": "Caricamento del PDF…",
  "editor.loadError": "Impossibile aprire il PDF.",
  "editor.manyPages":
    "Documento con {n} pagine: oltre 50 le prestazioni potrebbero ridursi.",
  "editor.page": "Pagina {n} di {total}",
  "editor.toolbar": "Strumenti editor",
  "editor.tool.select": "Seleziona",
  "editor.tool.highlight": "Evidenzia",
  "editor.tool.draw": "Disegna",
  "editor.tool.text": "Testo",
  "editor.tool.signature": "Firma",
  "editor.tool.erase": "Cancella",
  "editor.tool.textEdit": "Modifica testo",
  "editor.undo": "Annulla modifica",
  "editor.redo": "Ripeti modifica",
  "editor.zoomIn": "Aumenta zoom",
  "editor.zoomOut": "Riduci zoom",
  "editor.zoomLevel": "Zoom {pct}%",
  "editor.deleteSelected": "Elimina annotazione selezionata",
  "editor.close": "Chiudi il documento",
  "editor.hardErase": "Redazione definitiva",
  "editor.hardBadge": "DEFINITIVA",
  "editor.tooMany": "Troppe annotazioni: massimo {max}.",
  "editor.text.label": "Testo da inserire",
  "editor.text.placeholder": "Scrivi il testo…",
  "editor.text.fontSize": "Dimensione carattere",
  "editor.text.confirm": "Aggiungi",
  "editor.text.cancel": "Annulla",
  "editor.signature.upload": "Carica immagine firma (PNG o JPG)",
  "editor.signature.add": "Aggiungi firma",
  "editor.signature.dialog.title": "Aggiungi firma",
  "editor.signature.tab.draw": "A mano",
  "editor.signature.tab.type": "Digita",
  "editor.signature.tab.upload": "Immagine",
  "editor.signature.canvas": "Area firma",
  "editor.signature.draw.hint": "Firma nel riquadro con il mouse o il dito",
  "editor.signature.type.hint": "Anteprima della firma in corsivo",
  "editor.signature.type.placeholder": "Il tuo nome",
  "editor.signature.upload.hint": "Usa un'immagine PNG o JPG della tua firma (max 5 MB)",
  "editor.signature.clear": "Pulisci",
  "editor.signature.confirm": "Usa firma",
  "editor.signature.cancel": "Annulla",
  "editor.signature.invalid": "L'immagine della firma deve essere PNG o JPEG, max 5 MB.",
  "editor.signature.limit": "Puoi caricare al massimo 10 firme.",
  "editor.signature.hint": "Clicca sulla pagina per posizionare la firma",
  "editor.form.title": "Campi modulo",
  "editor.form.hint":
    "Scrivi qui oppure clicca direttamente sul campo nella pagina: i valori compaiono subito e vengono scritti nel PDF al salvataggio.",
  "editor.save": "SALVA PDF",
  "editor.saved": "PDF salvato: download avviato.",
  "editor.confirm.title": "Redazione definitiva",
  "editor.confirm.body":
    "La redazione definitiva rimuove davvero il contenuto dal PDF (testo non più estraibile, immagini ritagliate). L'operazione è irreversibile sul file salvato. Procedere?",
  "editor.confirm.ok": "Salva comunque",
  "editor.confirm.cancel": "Annulla",

  // Errors → toast
  "error.tooLarge": "Il file è troppo grande.",
  "error.notPdf": "Il file non è un PDF valido.",
  "error.invalid": "Richiesta non valida. Controlla i dati inseriti.",
  "error.tooMany": "Troppe richieste. Riprova tra poco.",
  "error.timeout": "Elaborazione troppo lunga: riprova con un file più piccolo.",
  "error.generic": "Qualcosa è andato storto. Riprova.",

  // Footer
  "footer.license": "Guloi PDF — software libero rilasciato sotto licenza AGPL-3.0",
  "footer.sourceCode": "Codice sorgente",
  "footer.privacy": "Privacy",

  // Privacy page
  "privacy.title": "Privacy",
  "privacy.intro":
    "Questa pagina spiega, in modo semplice e diretto, cosa succede ai tuoi file e ai tuoi dati quando usi Guloi PDF.",
  "privacy.files.title": "I tuoi file",
  "privacy.files.body":
    "I PDF che carichi vengono elaborati sul server in file temporanei e cancellati automaticamente al termine di ogni richiesta. Non vengono mai salvati, mai letti da persone, e mai usati per scopi diversi dall'elaborazione richiesta.",
  "privacy.logs.title": "Log tecnici",
  "privacy.logs.body":
    "I log del server registrano solo metodo HTTP, percorso della richiesta e codice di risposta, per motivi di diagnostica. Non registrano mai nomi dei file né il loro contenuto.",
  "privacy.cookies.title": "Cookie",
  "privacy.cookies.body":
    "Guloi PDF non usa cookie di profilazione né di tracciamento. Le uniche preferenze salvate — tema chiaro/scuro e lingua — restano nel tuo browser (localStorage) e non vengono mai inviate al server.",
  "privacy.limits.title": "Limiti tecnici",
  "privacy.limits.body":
    "Per proteggere il servizio, ogni file caricato può arrivare al massimo a 50 MB ed è attivo un limite al numero di richieste per evitare abusi.",
  "privacy.license.title": "Licenza",
  "privacy.license.body":
    "Guloi PDF è software libero, rilasciato sotto licenza AGPL-3.0: chiunque può ispezionare, modificare e ridistribuire il codice.",
  "privacy.license.link": "Vedi il codice sorgente",
} as const;
