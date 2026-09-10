/**
 * PDF-viewer modal „Ugrás a forráshoz" (Fázis 4/c).
 *
 * A találatból kapott `chunkId` alapján az azonos-origin proxyból (`/api/v2/pdf/:id`)
 * tölti a szabvány-PDF-et, a `pdfPage` oldalra ugrik, és a `highlight` (a teljes
 * bekezdés szövege) alapján a szöveg-rétegen KIEMELI a keresett részt. A megrendelői
 * kérés: „adjon egy linket, és ha rákattintok, oda ugrik a keresett helyre."
 *
 * A kiemelés a PDF saját szöveg-rétegéből számol téglalapokat (nincs OCR): a
 * bekezdés eleji karaktereket illeszti a lap szöveg-elemeire. Ha nem talál (pl.
 * elcsúszó tördelés), az oldal kiemelés nélkül, de a helyes lapon jelenik meg.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { pdfjsLib } from "@/lib/pdf";

interface Props {
  chunkId: number;
  pdfPage: number;
  highlight: string;
  citation: string;
  /** A szakasz befoglaló téglalapja [x0,y0,x1,y1] pont-egységben, bal-felső origó
   * (PyMuPDF). Ha megvan, ebből rajzolunk kiemelést (mojibake-független). */
  bbox?: number[] | null;
  onClose: () => void;
}

interface Rect { x: number; y: number; w: number; h: number; }

const norm = (s: string) =>
  s.toLowerCase().replace(/­/g, "").replace(/\s+/g, " ").trim();

/** A keresett bekezdés kiemelendő téglalapjai a lap szöveg-rétegéből. */
function computeHighlights(
  textContent: { items: Array<{ str?: string; transform?: number[]; width?: number }> },
  viewport: { transform: number[]; scale: number },
  needleRaw: string
): Rect[] {
  const items = textContent.items.filter((it) => typeof it.str === "string" && it.transform);
  let pageStr = "";
  const ranges: Array<{ start: number; end: number; it: { transform?: number[]; width?: number } } | null> = [];
  for (const it of items) {
    const s = norm(it.str as string);
    if (!s) { ranges.push(null); continue; }
    const start = pageStr.length;
    pageStr += s + " ";
    ranges.push({ start, end: start + s.length, it });
  }

  // A gyakori fejléc-vízjelet levágjuk az elejéről, hogy ne azt emelje ki.
  let needle = norm(needleRaw).replace(/^m mérnöki iroda kft\.?\s*/, "");
  if (needle.length < 8) return [];

  // A lehető leghosszabb bekezdés-prefixet keressük a lapon (a bekezdés a
  // következő lapra átfuthat, ezért nem várjuk el a teljes egyezést).
  let idx = -1, matched = needle;
  const maxLen = Math.min(needle.length, 600);
  for (let len = maxLen; len >= 24; len -= 24) {
    const sub = needle.slice(0, len);
    idx = pageStr.indexOf(sub);
    if (idx >= 0) { matched = sub; break; }
  }
  if (idx < 0) return [];

  const mStart = idx, mEnd = idx + matched.length;
  const rects: Rect[] = [];
  for (const r of ranges) {
    if (!r || r.end <= mStart || r.start >= mEnd) continue;
    const t = r.it.transform as number[];
    const tx = pdfjsLib.Util.transform(viewport.transform, t);
    const h = Math.hypot(tx[2], tx[3]) || 10;
    const w = (r.it.width ?? 0) * viewport.scale;
    rects.push({ x: tx[4], y: tx[5] - h, w, h });
  }
  return rects;
}

export default function PdfViewerModal({ chunkId, pdfPage, highlight, citation, bbox, onClose }: Props) {
  const docRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderSeq = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(pdfPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // null = még nincs / nem a cél-oldal; true = kiemelve; false = nem sikerült kiemelni
  const [matched, setMatched] = useState<boolean | null>(null);

  // Dokumentum betöltése
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const task = pdfjsLib.getDocument({
      url: `/api/v2/pdf/${chunkId}`,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
    });
    task.promise.then(
      (doc: any) => {
        if (cancelled) { doc.destroy?.(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(Math.min(Math.max(pdfPage, 1), doc.numPages));
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
  }, [chunkId, pdfPage]);

  // Aktuális oldal renderelése
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

      // Kiemelés csak a cél-oldalon
      const targetPage = Math.min(Math.max(pdfPage, 1), doc.numPages);
      if (pageNum === targetPage) {
        let hl: Rect[] = [];
        if (bbox && bbox.length === 4 && bbox.every((n) => typeof n === "number")) {
          // Elsődleges: az ingestion-kor tárolt PyMuPDF-bbox (pont-egység, bal-felső
          // origó) → eszköz-pixel = pont × scale (0° elforgatásnál pontos).
          const [x0, y0, x1, y1] = bbox;
          hl = [{ x: x0 * scale, y: y0 * scale, w: (x1 - x0) * scale, h: (y1 - y0) * scale }];
        } else {
          // Tartalék: szöveg-réteg illesztés (tiszta kódolású PDF-eknél).
          const tc = await pdfPageObj.getTextContent();
          if (seq !== renderSeq.current) return;
          hl = computeHighlights(tc, viewport, highlight);
        }
        setRects(hl);
        setMatched(hl.length > 0);
        // Görgetés az első kiemeléshez
        if (hl.length) {
          const top = Math.max(0, Math.min(...hl.map((r) => r.y)) - 80);
          requestAnimationFrame(() => container.scrollTo({ top, behavior: "smooth" }));
        }
      } else {
        setRects([]);
        setMatched(null);
      }
    } catch {
      setError("Az oldal renderelése nem sikerült.");
    } finally {
      if (seq === renderSeq.current) setLoading(false);
    }
  }, [pdfPage, highlight, bbox]);

  useEffect(() => {
    if (docRef.current && page >= 1) renderPage(page);
  }, [page, numPages, renderPage]);

  // ESC bezár
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
            <div className="text-xs text-text-faint">Forrás-PDF — a kiemelt rész a keresett szakasz</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
            <a
              href={`/api/v2/pdf/${chunkId}#page=${pdfPage}`}
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
              {/* Kiemelés-réteg */}
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

        {/* Lábléc — highlight-státusz */}
        {!error && matched !== null && (
          <div className="px-4 py-1.5 border-t text-xs text-text-faint flex items-center gap-2" style={{ borderColor: "var(--line)" }}>
            {matched
              ? <><span className="inline-block w-3 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(255,214,0,0.6)", boxShadow: "0 0 0 1px rgba(230,180,0,0.6)" }} /> A sárga kiemelés a keresett szakasz.</>
              : <><AlertTriangle size={12} className="text-amber-500" /> A pontos kiemelés nem sikerült, de ez a keresett oldal.</>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
