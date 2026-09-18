/**
 * PDF-viewer modal (Fázis 4/c + „teljes PDF, kiemelésekkel").
 *
 * Az azonos-origin proxyból (`/api/v2/pdf/:chunkId`) tölti a szabvány-PDF-et, és a
 * `highlights` lista alapján a megfelelő oldalakon SÁRGÁVAL kiemeli a releváns
 * szakaszokat (a PyMuPDF-bbox alapján, a szöveg-réteg kódolásától függetlenül).
 *
 * Két használat:
 *  - Fókuszált („Ugrás a forráshoz"): egyetlen szakasz kiemelve, arra a lapra nyit.
 *  - Teljes dokumentum: a keresésre illeszkedő ÖSSZES szakasz kiemelve, oldalak
 *    közti ugrással (előző/következő kiemelés).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
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
}

interface Rect { x: number; y: number; w: number; h: number; }

export default function PdfViewerModal({ chunkId, citation, highlights, initialPage, sectionCount, onClose }: Props) {
  const docRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderSeq = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Kiemelések oldalak szerint csoportosítva + a kiemelt oldalak rendezett listája.
  const byPage = useMemo(() => {
    const m = new Map<number, number[][]>();
    for (const h of highlights) {
      if (!h || !h.pdfPage || !Array.isArray(h.bbox)) continue;
      if (!m.has(h.pdfPage)) m.set(h.pdfPage, []);
      m.get(h.pdfPage)!.push(h.bbox);
    }
    return m;
  }, [highlights]);
  const hlPages = useMemo(() => Array.from(byPage.keys()).sort((a, b) => a - b), [byPage]);
  const totalSections = sectionCount ?? highlights.length;

  // Dokumentum betöltése
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const task = pdfjsLib.getDocument({
      url: `/api/v2/pdf/${chunkId}`,
      disableRange: true, disableStream: true, disableAutoFetch: true,
    });
    task.promise.then(
      (doc: any) => {
        if (cancelled) { doc.destroy?.(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(Math.min(Math.max(initialPage, 1), doc.numPages));
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
      try { docRef.current?.destroy?.(); } catch { /* noop */ }
      docRef.current = null;
    };
  }, [chunkId, initialPage]);

  // Aktuális oldal renderelése + az oldalon lévő összes kiemelés
  const renderPage = useCallback(async (pageNum: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const container = scrollRef.current;
    if (!doc || !canvas || !container) return;
    const seq = ++renderSeq.current;
    setLoading(true);
    try {
      const pdfPageObj = await doc.getPage(pageNum);
      if (seq !== renderSeq.current) return;
      const unscaled = pdfPageObj.getViewport({ scale: 1 });
      const avail = Math.max(320, container.clientWidth - 32);
      const scale = Math.min(2.5, Math.max(0.5, avail / unscaled.width));
      const viewport = pdfPageObj.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setCanvasSize({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPageObj.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      if (seq !== renderSeq.current) return;

      const boxes = byPage.get(pageNum) || [];
      const hl: Rect[] = boxes.map(([x0, y0, x1, y1]) => ({
        x: x0 * scale, y: y0 * scale, w: (x1 - x0) * scale, h: (y1 - y0) * scale,
      }));
      setRects(hl);
      if (hl.length) {
        const top = Math.max(0, Math.min(...hl.map((r) => r.y)) - 80);
        requestAnimationFrame(() => container.scrollTo({ top, behavior: "smooth" }));
      }
    } catch {
      setError("Az oldal renderelése nem sikerült.");
    } finally {
      if (seq === renderSeq.current) setLoading(false);
    }
  }, [byPage]);

  useEffect(() => {
    if (docRef.current && page >= 1) renderPage(page);
  }, [page, numPages, renderPage]);

  const gotoAdjacentHighlight = useCallback((dir: 1 | -1) => {
    if (!hlPages.length) return;
    if (dir === 1) {
      const nxt = hlPages.find((p) => p > page);
      setPage(nxt ?? hlPages[0]);
    } else {
      const prevs = hlPages.filter((p) => p < page);
      setPage(prevs.length ? prevs[prevs.length - 1] : hlPages[hlPages.length - 1]);
    }
  }, [hlPages, page]);

  // Billentyűk
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, numPages || p));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, numPages]);

  // A háttér görgetésének zárolása, amíg a modal nyitva van
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const multi = totalSections > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden"
        style={{ height: "92vh", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-strong truncate">{citation}</div>
            <div className="text-xs text-text-faint">
              {multi ? "Teljes dokumentum — a sárga kiemelések a releváns szakaszok" : "Forrás-PDF — a kiemelt rész a keresett szakasz"}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {multi && (
              <button
                onClick={() => gotoAdjacentHighlight(-1)}
                className="p-1.5 rounded hover:bg-hover text-text-default"
                title="Előző kiemelés"
              ><ChevronsLeft size={16} /></button>
            )}
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded hover:bg-hover disabled:opacity-40 text-text-default"
              title="Előző oldal"
            ><ChevronLeft size={16} /></button>
            <span className="text-xs text-text-muted tabular-nums min-w-[64px] text-center">
              {page} / {numPages || "…"}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, numPages || p))}
              disabled={numPages > 0 && page >= numPages}
              className="p-1.5 rounded hover:bg-hover disabled:opacity-40 text-text-default"
              title="Következő oldal"
            ><ChevronRight size={16} /></button>
            {multi && (
              <button
                onClick={() => gotoAdjacentHighlight(1)}
                className="p-1.5 rounded hover:bg-hover text-text-default"
                title="Következő kiemelés"
              ><ChevronsRight size={16} /></button>
            )}
            <a
              href={`/api/v2/pdf/${chunkId}#page=${page}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-hover text-text-default ml-1"
              title="Megnyitás új lapon"
            ><ExternalLink size={15} /></a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-hover text-text-default ml-0.5"
              title="Bezárás (Esc)"
            ><X size={17} /></button>
          </div>
        </div>

        {/* Törzs */}
        <div ref={scrollRef} className="relative flex-1 overflow-auto bg-page-bg-subtle flex justify-center p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 m-auto">
              <AlertTriangle size={28} className="text-amber-500" />
              <p className="text-sm text-text-default font-medium">{error}</p>
              <button onClick={onClose} className="text-xs text-[#7CA9D3] hover:underline mt-1">Bezárás</button>
            </div>
          ) : (
            <div className="relative" style={{ width: canvasSize.w || undefined, height: canvasSize.h || undefined }}>
              <canvas ref={canvasRef} className="block shadow-sm rounded-sm bg-white" />
              {rects.map((r, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none rounded-[1px]"
                  style={{
                    left: r.x, top: r.y, width: r.w, height: r.h,
                    backgroundColor: "rgba(255, 214, 0, 0.38)",
                    boxShadow: "0 0 0 1px rgba(230,180,0,0.5)",
                    mixBlendMode: "multiply",
                  }}
                />
              ))}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <Loader2 size={26} className="animate-spin" style={{ color: "#7CA9D3" }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lábléc */}
        {!error && (
          <div className="px-4 py-1.5 border-t text-xs text-text-faint flex items-center gap-2" style={{ borderColor: "var(--line)" }}>
            <span className="inline-block w-3 h-3 rounded-[2px] flex-shrink-0" style={{ backgroundColor: "rgba(255,214,0,0.6)", boxShadow: "0 0 0 1px rgba(230,180,0,0.6)" }} />
            {multi
              ? <>{totalSections} releváns szakasz kiemelve ebben a dokumentumban{rects.length ? ` — ${rects.length} ezen az oldalon` : ""}. A ⟪ ⟫ gombokkal ugorhat a kiemelések között.</>
              : <>A sárga kiemelés a keresett szakasz.</>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
