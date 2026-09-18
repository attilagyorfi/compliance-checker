/**
 * PDF-viewer modal — folyamatos görgetésű, több-oldalas nézet kiemelésekkel.
 *
 * Az azonos-origin proxyból (`/api/v2/pdf/:chunkId`) tölti a szabvány-PDF-et, és
 * a TELJES dokumentumot végiggörgethetően jeleníti meg. A `highlights` lista
 * alapján a megfelelő oldalakon SÁRGÁVAL kiemeli a releváns szakaszokat (PyMuPDF-
 * bbox alapján, a szöveg-réteg kódolásától függetlenül). Az oldalakat lustán
 * rendereli (csak a látótér közelében), hogy nagy dokumentumnál is gyors legyen.
 *
 *  - Fókuszált („Ugrás a forráshoz"): 1 szakasz kiemelve, arra a lapra görget.
 *  - Teljes dokumentum: a keresésre illeszkedő ÖSSZES szakasz kiemelve, a teljes
 *    PDF végiggörgethető; a ⟪ ⟫ gombokkal ugrálhat a kiemelések között.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, ExternalLink, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { pdfjsLib } from "@/lib/pdf";

export interface ViewerHighlight { pdfPage: number; bbox: number[]; }

interface Props {
  chunkId: number;
  citation: string;
  highlights: ViewerHighlight[];
  initialPage: number;
  /** Hány releváns szakasz (a lábléchez); alapból a highlights hossza. */
  sectionCount?: number;
  onClose: () => void;
  /** Ha igaz, teljes képernyős oldalként renderel (nem lebegő modalként). */
  asPage?: boolean;
  /** "Megnyitás új lapon" cél — a kiemeléses viewer-oldal URL-je. */
  newTabUrl?: string;
}

export default function PdfViewerModal({ chunkId, citation, highlights, initialPage, sectionCount, onClose, asPage = false, newTabUrl }: Props) {
  const docRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scaleRef = useRef<number>(1);
  const visibleRef = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageDim, setPageDim] = useState<{ w: number; h: number } | null>(null); // skálázott alap-oldalméret (placeholder)
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const byPage = useMemo(() => {
    const m = new Map<number, number[][]>();
    for (const h of highlights) {
      if (!h || !h.pdfPage || !Array.isArray(h.bbox)) continue;
      if (!m.has(h.pdfPage)) m.set(h.pdfPage, []);
      m.get(h.pdfPage)!.push(h.bbox);
    }
    return m;
  }, [highlights]);
  // A kiemelések LAPOSÍTOTT, rendezett listája (oldal, majd függőleges pozíció) —
  // a ⟪ ⟫ ezen ugrál végig, a tényleges kiemelés-pozícióra görgetve.
  const sortedHls = useMemo(
    () => highlights
      .filter((h) => h && h.pdfPage && Array.isArray(h.bbox) && h.bbox.length === 4)
      .slice()
      .sort((a, b) => a.pdfPage - b.pdfPage || a.bbox[1] - b.bbox[1]),
    [highlights]
  );
  const totalSections = sectionCount ?? highlights.length;
  const multi = totalSections > 1;

  // Egy oldal renderelése a saját wrapperébe (canvas + kiemelés-overlay), lustán.
  const renderPageInto = useCallback(async (pageNum: number) => {
    const doc = docRef.current;
    const wrap = wrapRefs.current[pageNum - 1];
    if (!doc || !wrap) return;
    if (wrap.dataset.rendered === "1" || wrap.dataset.rendering === "1") return;
    wrap.dataset.rendering = "1";
    try {
      const page = await doc.getPage(pageNum);
      const scale = scaleRef.current;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = wrap.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;

      const overlay = wrap.querySelector(".hl-overlay") as HTMLDivElement | null;
      if (overlay) {
        overlay.innerHTML = "";
        for (const [x0, y0, x1, y1] of byPage.get(pageNum) || []) {
          const d = document.createElement("div");
          d.style.cssText =
            `position:absolute;left:${x0 * scale}px;top:${y0 * scale}px;` +
            `width:${(x1 - x0) * scale}px;height:${(y1 - y0) * scale}px;` +
            `background:rgba(255,214,0,0.38);box-shadow:0 0 0 1px rgba(230,180,0,0.5);` +
            `mix-blend-mode:multiply;pointer-events:none;border-radius:1px;`;
          overlay.appendChild(d);
        }
      }
      wrap.dataset.rendered = "1";
    } catch { /* egy oldal hibája ne dőljön be az egész */ }
    finally { wrap.dataset.rendering = "0"; }
  }, [byPage]);

  const clearPage = useCallback((pageNum: number) => {
    const wrap = wrapRefs.current[pageNum - 1];
    if (!wrap || wrap.dataset.rendered !== "1") return;
    const canvas = wrap.querySelector("canvas") as HTMLCanvasElement | null;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    const overlay = wrap.querySelector(".hl-overlay") as HTMLDivElement | null;
    if (overlay) overlay.innerHTML = "";
    wrap.dataset.rendered = "0";
  }, []);

  // Dokumentum betöltése + alap-oldalméret/skála
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const task = pdfjsLib.getDocument({
      url: `/api/v2/pdf/${chunkId}`,
      disableRange: true, disableStream: true, disableAutoFetch: true,
    });
    task.promise.then(
      async (doc: any) => {
        if (cancelled) { doc.destroy?.(); return; }
        docRef.current = doc;
        const page1 = await doc.getPage(1);
        const base = page1.getViewport({ scale: 1 });
        const avail = Math.max(320, (scrollRef.current?.clientWidth || 800) - 32);
        const scale = Math.min(2, Math.max(0.4, avail / base.width));
        scaleRef.current = scale;
        if (cancelled) return;
        wrapRefs.current = new Array(doc.numPages).fill(null);
        setPageDim({ w: Math.floor(base.width * scale), h: Math.floor(base.height * scale) });
        setNumPages(doc.numPages);
        setCurrentPage(Math.min(Math.max(initialPage, 1), doc.numPages));
        setLoading(false);
      },
      (e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes("401") || msg.toLowerCase().includes("unexpected")
          ? "A PDF megnyitásához belépés szükséges."
          : "A PDF nem tölthető be.");
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      try { docRef.current?.destroy?.(); } catch { /* noop */ }
      docRef.current = null;
    };
  }, [chunkId, initialPage]);

  // IntersectionObserver: a látótér közelébe kerülő oldalakat rendereli, a
  // távoliakat felszabadítja; a láthatóból számolja az aktuális oldalszámot.
  useEffect(() => {
    if (!numPages || !pageDim) return;
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const pn = Number((e.target as HTMLElement).dataset.page);
        if (!pn) continue;
        if (e.isIntersecting) { visibleRef.current.add(pn); renderPageInto(pn); }
        else { visibleRef.current.delete(pn); clearPage(pn); }
      }
      if (visibleRef.current.size) setCurrentPage(Math.min(...Array.from(visibleRef.current)));
    }, { root, rootMargin: "700px 0px" });
    observerRef.current = io;
    wrapRefs.current.forEach((w) => { if (w) io.observe(w); });
    // Kezdő görgetés az ELSŐ kiemelés pozíciójára (nem csak az oldal tetejére),
    // + a környező oldalak azonnali renderelése (nem várunk az observerre).
    const start = Math.min(Math.max(initialPage, 1), numPages);
    requestAnimationFrame(() => {
      const cont = scrollRef.current;
      const first = sortedHls.find((h) => h.pdfPage === start) || sortedHls[0];
      if (cont && first) {
        const w = wrapRefs.current[first.pdfPage - 1];
        if (w) cont.scrollTo({ top: Math.max(0, w.offsetTop + (first.bbox[1] || 0) * scaleRef.current - 70) });
      } else {
        wrapRefs.current[start - 1]?.scrollIntoView({ block: "start" });
      }
    });
    for (let p = Math.max(1, start - 1); p <= Math.min(numPages, start + 2); p++) {
      visibleRef.current.add(p);
      renderPageInto(p);
    }
    return () => io.disconnect();
  }, [numPages, pageDim, initialPage, renderPageInto, clearPage, sortedHls]);

  const scrollToPage = useCallback((pageNum: number) => {
    const p = Math.min(Math.max(pageNum, 1), numPages || pageNum);
    const w = wrapRefs.current[p - 1];
    if (w) w.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [numPages]);

  // A kiemelés abszolút függőleges pozíciója a görgető-konténerben:
  // a lap-wrapper offsetTop-ja + a bbox teteje × az aktuális skála.
  const highlightTop = useCallback((h: ViewerHighlight) => {
    const w = wrapRefs.current[h.pdfPage - 1];
    if (!w) return Infinity;
    return w.offsetTop + (h.bbox[1] || 0) * scaleRef.current;
  }, []);

  const gotoAdjacentHighlight = useCallback((dir: 1 | -1) => {
    const cont = scrollRef.current;
    if (!cont || !sortedHls.length) return;
    // A kiemelést a viewport tetejétől ~70px-re jelenítjük meg, ezért a "jelenlegi"
    // kiemelés a scrollTop+70 körül van. A ±15 tolerancia kihagyja a jelenlegit,
    // így a "következő/előző" a valóban szomszédos kiemelésre ugrik (akkor is, ha
    // épp nem kiemelt oldalon áll a felhasználó).
    const cur = cont.scrollTop + 70;
    let target: ViewerHighlight | undefined;
    if (dir === 1) {
      target = sortedHls.find((h) => highlightTop(h) > cur + 15) ?? sortedHls[0];
    } else {
      const prevs = sortedHls.filter((h) => highlightTop(h) < cur - 15);
      target = prevs.length ? prevs[prevs.length - 1] : sortedHls[sortedHls.length - 1];
    }
    if (!target) return;
    renderPageInto(target.pdfPage); // előrenderelés, hogy a kiemelés látszódjon
    cont.scrollTo({ top: Math.max(0, highlightTop(target) - 70), behavior: "smooth" });
  }, [sortedHls, highlightTop, renderPageInto]);

  // Kiemelésekkel teli PDF mentése: az eredeti PDF-be vektoros sárga téglalapokat
  // égetünk a bbox-ok alapján (kicsi fájl, a szöveg kereshető marad). A pdf-lib-et
  // dinamikusan töltjük, hogy ne hízlalja a fő bundle-t.
  const savePdf = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const tid = toast.loading("Kiemeléses PDF készítése…");
    try {
      const resp = await fetch(`/api/v2/pdf/${chunkId}`);
      if (!resp.ok) throw new Error(String(resp.status));
      const bytes = await resp.arrayBuffer();
      const { PDFDocument, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const n = pdf.getPageCount();
      for (const h of highlights) {
        const idx = (h.pdfPage || 0) - 1;
        if (idx < 0 || idx >= n || !Array.isArray(h.bbox) || h.bbox.length !== 4) continue;
        const [x0, y0, x1, y1] = h.bbox;
        const page = pdf.getPage(idx);
        const H = page.getHeight();
        page.drawRectangle({ x: x0, y: H - y1, width: x1 - x0, height: y1 - y0, color: rgb(1, 0.84, 0), opacity: 0.35 });
      }
      const out = await pdf.save();
      const blob = new Blob([out.slice().buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = (citation || "szabvany").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+—\s+teljes dokumentum/, "").trim();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name} — kiemelt.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch {
      toast.error("A kiemeléses PDF mentése nem sikerült.");
    } finally {
      toast.dismiss(tid);
      setSaving(false);
    }
  }, [saving, chunkId, highlights, citation]);

  // Billentyűk + háttér-scroll zár
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") scrollToPage(currentPage + 1);
      if (e.key === "ArrowLeft") scrollToPage(currentPage - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, currentPage, scrollToPage]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className={asPage ? "fixed inset-0 z-[100] flex flex-col" : "fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6"}
      style={asPage ? { backgroundColor: "var(--surface)" } : { backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={asPage ? undefined : onClose}
    >
      <div
        className={asPage ? "bg-surface flex flex-col w-full flex-1 overflow-hidden" : "bg-surface rounded-xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden"}
        style={asPage ? { borderColor: "var(--line)" } : { height: "92vh", borderColor: "var(--line)" }}
        onClick={asPage ? undefined : (e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-strong truncate">{citation}</div>
            <div className="text-xs text-text-faint">
              {multi ? "Teljes dokumentum — görgethető, a sárga kiemelések a releváns szakaszok" : "Forrás-PDF — a kiemelt rész a keresett szakasz"}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {multi && (
              <button onClick={() => gotoAdjacentHighlight(-1)} className="p-1.5 rounded hover:bg-hover text-text-default" title="Előző kiemelés"><ChevronsLeft size={16} /></button>
            )}
            <button onClick={() => scrollToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded hover:bg-hover disabled:opacity-40 text-text-default" title="Előző oldal"><ChevronLeft size={16} /></button>
            <span className="text-xs text-text-muted tabular-nums min-w-[64px] text-center">{currentPage} / {numPages || "…"}</span>
            <button onClick={() => scrollToPage(currentPage + 1)} disabled={numPages > 0 && currentPage >= numPages} className="p-1.5 rounded hover:bg-hover disabled:opacity-40 text-text-default" title="Következő oldal"><ChevronRight size={16} /></button>
            {multi && (
              <button onClick={() => gotoAdjacentHighlight(1)} className="p-1.5 rounded hover:bg-hover text-text-default" title="Következő kiemelés"><ChevronsRight size={16} /></button>
            )}
            <button
              onClick={savePdf}
              disabled={saving}
              className="p-1.5 rounded hover:bg-hover disabled:opacity-50 text-text-default ml-1"
              title="Kiemeléses PDF mentése (letöltés)"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
            {!asPage && newTabUrl && (
              <a
                href={newTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-hover text-text-default ml-1"
                title="Megnyitás új lapon (a kiemelésekkel)"
              ><ExternalLink size={15} /></a>
            )}
            {!asPage && (
              <button onClick={onClose} className="p-1.5 rounded hover:bg-hover text-text-default ml-0.5" title="Bezárás (Esc)"><X size={17} /></button>
            )}
          </div>
        </div>

        {/* Törzs — folyamatos görgetésű oldallista */}
        <div ref={scrollRef} className="relative flex-1 overflow-auto bg-page-bg-subtle">
          {error ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 h-full">
              <AlertTriangle size={28} className="text-amber-500" />
              <p className="text-sm text-text-default font-medium">{error}</p>
              <button onClick={onClose} className="text-xs text-[#7CA9D3] hover:underline mt-1">Bezárás</button>
            </div>
          ) : loading || !pageDim ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={26} className="animate-spin" style={{ color: "#7CA9D3" }} />
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center gap-4">
              {Array.from({ length: numPages }).map((_, i) => (
                <div
                  key={i}
                  data-page={i + 1}
                  ref={(el) => { wrapRefs.current[i] = el; }}
                  className="relative bg-white shadow-sm rounded-sm"
                  style={{ width: pageDim.w, height: pageDim.h }}
                >
                  <canvas className="block" />
                  <div className="hl-overlay absolute inset-0" style={{ pointerEvents: "none" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lábléc */}
        {!error && (
          <div className="px-4 py-1.5 border-t text-xs text-text-faint flex items-center gap-2" style={{ borderColor: "var(--line)" }}>
            <span className="inline-block w-3 h-3 rounded-[2px] flex-shrink-0" style={{ backgroundColor: "rgba(255,214,0,0.6)", boxShadow: "0 0 0 1px rgba(230,180,0,0.6)" }} />
            {multi
              ? <>{totalSections} releváns szakasz kiemelve — görgessen a teljes dokumentumban, vagy a ⟪ ⟫ gombokkal ugorjon a kiemelések között.</>
              : <>A sárga kiemelés a keresett szakasz.</>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
