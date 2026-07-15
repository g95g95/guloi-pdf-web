import type { Messages } from "../lib/i18n";

/** English dictionary. Typed as `Messages` so a missing/extra key won't compile. */
export const en: Messages = {
  // App shell
  "app.name": "Guloi PDF",
  "app.tagline": "All your PDF tools in one app",
  "lang.switch": "Language",
  "lang.it": "IT",
  "lang.en": "EN",
  "theme.toLight": "Switch to light theme",
  "theme.toDark": "Switch to dark theme",
  "theme.light": "Light theme",
  "theme.dark": "Dark theme",
  "toast.close": "Dismiss notification",
  "skip.toContent": "Skip to content",

  // FileDrop
  "filedrop.aria": "Drag PDF files here or press to browse",
  "filedrop.promptOne": "Drag a PDF here or ",
  "filedrop.promptMany": "Drag PDFs here or ",
  "filedrop.browse": "browse",
  "filedrop.hint": "PDF only · max {max} MB",
  "filedrop.hintCap": "PDF only · max {max} MB · up to {cap} files",
  "filedrop.notPdf": 'The file "{name}" is not a PDF',
  "filedrop.tooBig": 'The file "{name}" exceeds {max} MB',
  "filedrop.overflowOne": "One file was ignored: maximum reached",
  "filedrop.overflowMany": "{n} files ignored: maximum of {cap} reached",
  "filedrop.moveUp": "Move {name} up",
  "filedrop.moveDown": "Move {name} down",
  "filedrop.remove": "Remove {name}",

  // Home
  "home.hero.title": "Every PDF tool you need, right in your browser",
  "home.hero.subtitle":
    "Compress, merge, split, rotate, extract and protect your PDFs. Fast and free.",
  "home.privacy":
    "Files are processed and deleted immediately. No storage, no tracking.",

  // Tool names + descriptions
  "tool.compress.name": "Compress PDF",
  "tool.compress.desc": "Shrink the file while keeping it readable",
  "tool.merge.name": "Merge PDF",
  "tool.merge.desc": "Combine several PDFs into one file",
  "tool.split.name": "Split PDF",
  "tool.split.desc": "Separate one PDF into multiple files",
  "tool.rotate.name": "Rotate PDF",
  "tool.rotate.desc": "Rotate pages by 90, 180 or 270 degrees",
  "tool.extract.name": "Extract pages",
  "tool.extract.desc": "Build a new PDF from the pages you pick",
  "tool.protect.name": "Protect PDF",
  "tool.protect.desc": "Add an open password to your PDF",
  "tool.unlock.name": "Unlock PDF",
  "tool.unlock.desc": "Remove the password from a protected PDF",

  // Shared tool page
  "tool.processing": "Processing…",
  "tool.uploading": "Uploading…",
  "tool.download": "Download file",
  "tool.done": "Done! Your file is ready.",
  "tool.reset": "Process another file",
  "tool.selectFile": "Select a PDF to continue",
  "tool.progress": "Progress",

  // Compress
  "compress.action": "COMPRESS",
  "compress.images": "Compress images too (reduces quality)",
  "compress.result": "Before: {before} KB · After: {after} KB · Saved: {saved}%",
  "compress.mode": "Compression mode",
  "compress.mode.simple": "Simple mode",
  "compress.mode.target": "Target size",
  "compress.target.label": "Maximum size",
  "compress.target.notMet":
    "Could not get below {target} MB. Size achieved: {after} KB.",
  "compress.target.notMetMulti":
    "At least one file did not get below {target} MB: it's marked \"_TARGET_NON_RAGGIUNTO\" in the ZIP.",
  "compress.hint": "You can upload multiple PDFs: they'll be compressed separately and returned as a ZIP.",

  // Merge
  "merge.action": "MERGE",
  "merge.hint":
    "Add at least 2 PDFs. Reorder them with the arrows: the order is the order of the merged file.",
  "merge.needTwo": "Add at least 2 PDFs",

  // Split
  "split.action": "SPLIT",
  "split.mode": "Mode",
  "split.mode.every": "Every N pages",
  "split.mode.ranges": "By ranges",
  "split.every.label": "Pages per file",
  "split.ranges.label": "Page ranges",
  "split.ranges.placeholder": "1-3,5-7",
  "split.every.invalid": "Enter a page count greater than 0",
  "split.ranges.invalid": "Use the format 1-3,5-7",

  // Rotate
  "rotate.action": "ROTATE",
  "rotate.angle": "Angle",
  "rotate.pages": "Pages (empty = all)",
  "rotate.pages.placeholder": "1,3,5",

  // Extract
  "extract.action": "EXTRACT",
  "extract.pages": "Pages to extract",
  "extract.pages.placeholder": "1-3,5",
  "extract.pages.invalid": "List the pages, e.g. 1-3,5",

  // Protect / Unlock
  "protect.action": "PROTECT",
  "protect.password": "Password",
  "protect.password.placeholder": "At least 4 characters",
  "protect.password.short": "Password must be at least 4 characters",
  "protect.owner.section": "Advanced",
  "protect.owner.label": "Owner password (optional)",
  "protect.owner.hint":
    "Restricts permissions like printing and editing. If empty, uses the open password.",
  "protect.show": "Show password",
  "protect.hide": "Hide password",
  "unlock.action": "UNLOCK",
  "unlock.password": "Current PDF password",
  "unlock.password.required": "Enter the password",

  // Editor
  "tool.editor.name": "PDF Editor",
  "tool.editor.desc": "Highlight, draw, sign and edit the text of your PDF",
  "editor.loading": "Loading the PDF…",
  "editor.loadError": "Could not open the PDF.",
  "editor.manyPages":
    "Document has {n} pages: above 50 performance may degrade.",
  "editor.page": "Page {n} of {total}",
  "editor.toolbar": "Editor tools",
  "editor.tool.select": "Select",
  "editor.tool.highlight": "Highlight",
  "editor.tool.draw": "Draw",
  "editor.tool.text": "Text",
  "editor.tool.signature": "Signature",
  "editor.tool.erase": "Erase",
  "editor.tool.textEdit": "Edit text",
  "editor.undo": "Undo change",
  "editor.redo": "Redo change",
  "editor.zoomIn": "Zoom in",
  "editor.zoomOut": "Zoom out",
  "editor.zoomLevel": "Zoom {pct}%",
  "editor.deleteSelected": "Delete selected annotation",
  "editor.close": "Close the document",
  "editor.hardErase": "Permanent redaction",
  "editor.hardBadge": "PERMANENT",
  "editor.tooMany": "Too many annotations: maximum {max}.",
  "editor.text.label": "Text to insert",
  "editor.text.placeholder": "Type the text…",
  "editor.text.fontSize": "Font size",
  "editor.text.confirm": "Add",
  "editor.text.cancel": "Cancel",
  "editor.signature.upload": "Upload signature image (PNG or JPG)",
  "editor.signature.add": "Add signature",
  "editor.signature.dialog.title": "Add signature",
  "editor.signature.tab.draw": "Draw",
  "editor.signature.tab.type": "Type",
  "editor.signature.tab.upload": "Image",
  "editor.signature.canvas": "Signature area",
  "editor.signature.draw.hint": "Sign inside the box with your mouse or finger",
  "editor.signature.type.hint": "Cursive signature preview",
  "editor.signature.type.placeholder": "Your name",
  "editor.signature.upload.hint": "Use a PNG or JPG image of your signature (max 5 MB)",
  "editor.signature.clear": "Clear",
  "editor.signature.confirm": "Use signature",
  "editor.signature.cancel": "Cancel",
  "editor.signature.invalid": "The signature image must be PNG or JPEG, max 5 MB.",
  "editor.signature.limit": "You can upload at most 10 signatures.",
  "editor.signature.hint": "Click on the page to place the signature",
  "editor.form.title": "Form fields",
  "editor.form.hint":
    "Type here or click the field on the page: values show up immediately and are written into the PDF on save.",
  "editor.save": "SAVE PDF",
  "editor.saved": "PDF saved: download started.",
  "editor.confirm.title": "Permanent redaction",
  "editor.confirm.body":
    "Permanent redaction really removes content from the PDF (text no longer extractable, images cropped). The operation is irreversible in the saved file. Proceed?",
  "editor.confirm.ok": "Save anyway",
  "editor.confirm.cancel": "Cancel",

  // Errors → toast
  "error.tooLarge": "The file is too large.",
  "error.notPdf": "The file is not a valid PDF.",
  "error.invalid": "Invalid request. Check the values you entered.",
  "error.tooMany": "Too many requests. Try again shortly.",
  "error.timeout": "Processing took too long: try a smaller file.",
  "error.generic": "Something went wrong. Please try again.",

  // Footer
  "footer.license": "Guloi PDF — free software released under the AGPL-3.0 license",
  "footer.sourceCode": "Source code",
  "footer.privacy": "Privacy",

  // Privacy page
  "privacy.title": "Privacy",
  "privacy.intro":
    "This page explains, plainly and directly, what happens to your files and data when you use Guloi PDF.",
  "privacy.files.title": "Your files",
  "privacy.files.body":
    "The PDFs you upload are processed on the server in temporary files and automatically deleted at the end of every request. They are never saved, never read by a person, and never used for anything other than the requested processing.",
  "privacy.logs.title": "Technical logs",
  "privacy.logs.body":
    "Server logs record only the HTTP method, request path and response status code, for diagnostic purposes. They never record file names or file contents.",
  "privacy.cookies.title": "Cookies",
  "privacy.cookies.body":
    "Guloi PDF uses no profiling or tracking cookies. The only saved preferences — light/dark theme and language — stay in your browser (localStorage) and are never sent to the server.",
  "privacy.limits.title": "Technical limits",
  "privacy.limits.body":
    "To protect the service, each uploaded file can be at most 50 MB, and a request-rate limit is in place to prevent abuse.",
  "privacy.license.title": "License",
  "privacy.license.body":
    "Guloi PDF is free software, released under the AGPL-3.0 license: anyone can inspect, modify and redistribute the code.",
  "privacy.license.link": "View the source code",
};
