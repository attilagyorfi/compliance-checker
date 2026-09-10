/**
 * PDF.js inicializálás (Fázis 4 viewer).
 *
 * A `pdfjs-dist` ESM-buildjét használjuk, a worker fájlt Vite `?url` importtal
 * kötjük be (a build code-splittel külön asseté teszi, Vercel-kompatibilis).
 * Egyetlen helyen állítjuk be a workerSrc-et, így minden import ugyanazt kapja.
 */
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
