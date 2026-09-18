/**
 * Hivatkozás-kereső (v2) — Fázis 3.
 *
 * Szabadszavas keresés a v2 bizonyíték-magon: minden találat egy TELJES
 * szerkezeti egység (bekezdés/pont), pontos szakasz- és oldalszámmal, másolható
 * hivatkozással. A `standardsSearch.searchV2` végpontot hívja.
 * A "Ugrás a forráshoz" (PDF-mélylink) a Fázis 4-ben aktiválódik.
 */

import { useState, useRef } from "react";
import {
  Search, Loader2, Copy, Check, Send, ChevronDown, ChevronUp, FileText, BookOpen, Info, Locate, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Header from "@/components/Header";
import PdfViewerModal from "@/components/PdfViewerModal";
import { pdfjsLib } from "@/lib/pdf";
import { trpc } from "@/lib/trpc";

const PINNED = [
  "Acél oszlop kihajlás számítása",
  "Csavaros kapcsolat méretezése acélszerkezetben",
  "Szélteher számítása épületre",
  "Hóteher a tetőn",
  "Vasbeton gerenda hajlítási vasalása",
  "Milyen talajvizsgálatok kellenek alapozáshoz?",
  "Tartószerkezet tervezési alapelvei",
];

function HitCard({ hit, onOpenSource, onOpenFullDoc, fullDocBusy }: {
  hit: any; onOpenSource: () => void; onOpenFullDoc: () => void; fullDocBusy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = (hit.text || "").length > 420;
  const copy = async () => {
    await navigator.clipboard.writeText(hit.citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="rounded-xl border bg-surface overflow-hidden" style={{ borderColor: "var(--line)" }}>
      {/* Hivatkozás + másolás */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-strong">{hit.citation}</div>
          {hit.breadcrumb && (
            <div className="text-xs text-text-faint mt-0.5 truncate">{hit.breadcrumb}</div>
          )}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-line text-text-default hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors flex-shrink-0"
          title="Hivatkozás másolása"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? "Másolva" : "Hivatkozás"}
        </button>
      </div>

      {/* Jelvények */}
      <div className="flex flex-wrap items-center gap-2 px-4 mt-2">
        {hit.sectionNumber && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#EBF3FA] text-[#3E6FA8] font-medium">
            {hit.sectionNumber}. szakasz
          </span>
        )}
        {hit.printedPage != null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-hover text-text-muted flex items-center gap-1">
            <FileText size={10} /> {hit.printedPage}. o.
          </span>
        )}
        <span className="text-xs text-text-faint">PDF-lap {hit.pdfPage}</span>
      </div>

      {/* Teljes egység (bekezdéshatáros, sosem csonkított) */}
      <div className="px-4 pb-3 pt-2">
        <blockquote
          className="text-sm text-text-default leading-relaxed bg-page-bg-subtle rounded p-3 border-l-2"
          style={{ borderColor: "#7CA9D3" }}
        >
          {long && !open ? (hit.text.slice(0, 420) + "…") : hit.text}
        </blockquote>
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenSource}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors flex-shrink-0"
              style={{ backgroundColor: "#4A7BA8" }}
              title="A szabvány-PDF megnyitása a keresett résznél, kiemelve"
            >
              <Locate size={13} /> Ugrás a forráshoz
            </button>
            <button
              onClick={onOpenFullDoc}
              disabled={fullDocBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-text-default hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
              title="A teljes szabvány-PDF megnyitása, benne az összes releváns szakasz kiemelve"
            >
              {fullDocBusy
                ? <><Loader2 size={13} className="animate-spin" /> Megnyitás…</>
                : <><BookOpen size={13} /> Teljes PDF (kiemelésekkel)</>}
            </button>
          </div>
          {long && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-[#7CA9D3] hover:underline flex items-center gap-1 flex-shrink-0"
            >
              {open ? <><ChevronUp size={12} /> Összecsukás</> : <><ChevronDown size={12} /> Teljes bekezdés</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EvidenceSearchPage() {
  const [question, setQuestion] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [hits, setHits] = useState<any[] | null>(null);
  const [viewer, setViewer] = useState<
    | { chunkId: number; citation: string; highlights: { pdfPage: number; bbox: number[] }[]; initialPage: number; sectionCount: number; newTabUrl: string }
    | null
  >(null);

  // "Megnyitás új lapon" cél: a kiemeléses, teljes-képernyős viewer-oldal.
  const buildViewerUrl = (hit: any) =>
    `/viewer?chunk=${hit.chunkId}&slug=${encodeURIComponent(hit.slug || "")}&q=${encodeURIComponent(lastQuery || question)}`;
  const [openingDoc, setOpeningDoc] = useState<number | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const searchMut = trpc.standardsSearch.searchV2.useMutation({
    onSuccess: (d) => { setHits(d.hits); setLastQuery(d.query); },
    onError: (e) => toast.error(`Keresési hiba: ${e.message}`),
  });
  const docHlMut = trpc.standardsSearch.documentHighlights.useMutation();

  // Fókuszált nézet: csak az adott szakasz kiemelve, arra a lapra nyit.
  const openSource = (hit: any) => {
    const hl = Array.isArray(hit.bbox) && hit.bbox.length === 4
      ? [{ pdfPage: hit.pdfPage, bbox: hit.bbox }]
      : [];
    setViewer({ chunkId: hit.chunkId, citation: hit.citation, highlights: hl, initialPage: hit.pdfPage ?? 1, sectionCount: 1, newTabUrl: buildViewerUrl(hit) });
  };

  // Teljes dokumentum: a keresésre illeszkedő ÖSSZES szakasz kiemelve.
  const openFullDoc = async (hit: any) => {
    if (openingDoc) return;
    setOpeningDoc(hit.chunkId);
    const tid = toast.loading("Releváns szakaszok keresése a dokumentumban…");
    try {
      const res = await docHlMut.mutateAsync({ query: lastQuery || question, slug: hit.slug });
      const hl = (res.highlights || [])
        .filter((h) => h.pdfPage && Array.isArray(h.bbox))
        .map((h) => ({ pdfPage: h.pdfPage as number, bbox: h.bbox as number[] }));
      if (!hl.length) { toast.error("Nem található kiemelhető szakasz ebben a dokumentumban."); return; }
      const initialPage = Math.min(...hl.map((h) => h.pdfPage));
      const yr = res.editionYear ? ":" + res.editionYear : "";
      setViewer({
        chunkId: hit.chunkId,
        citation: `${res.officialId}${yr} — teljes dokumentum`,
        highlights: hl,
        initialPage,
        sectionCount: hl.length,
        newTabUrl: buildViewerUrl(hit),
      });
    } catch {
      toast.error("Nem sikerült betölteni a dokumentum kiemeléseit.");
    } finally {
      toast.dismiss(tid);
      setOpeningDoc(null);
    }
  };

  const run = (q: string) => {
    if (!q.trim()) return;
    setHits(null);
    searchMut.mutate({ question: q.trim(), topK: 8, rerank: true });
  };
  const runPinned = (q: string) => { setQuestion(q); run(q); };

  // Nyomtatható riport a találatokból. A szabvány-szakaszt NEM kinyert szövegként,
  // hanem a PDF-oldalból KÉPKÉNT vágjuk ki (bbox alapján) — így a képletek/számítások
  // egy az egyben, hibátlanul jelennek meg (a szöveg-kinyerés a képleteket torzítja).
  // Kliens-oldali (pdf.js), a böngésző nyomtató-dialógusán át PDF-be menthető.
  const handleDownloadReport = async () => {
    if (!hits || hits.length === 0 || reportBusy) return;
    setReportBusy(true);
    const toastId = toast.loading("Riport készítése — a releváns szakaszok kivágása…");
    const esc = (s: unknown) =>
      String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const clean = (s: unknown) =>
      String(s ?? "")
        .replace(/\r?\n/g, " ")
        .replace(/([A-Za-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ])-\s+([a-záéíóöőúüű])/g, "$1$2")
        .replace(/\s{2,}/g, " ")
        .trim();

    // Dokumentumonkénti pdf.js cache (több találat lehet ugyanabból a szabványból).
    const docCache = new Map<string, any>();
    const getDoc = async (hit: any) => {
      const key = hit.slug || `c${hit.chunkId}`;
      if (docCache.has(key)) return docCache.get(key);
      const doc = await pdfjsLib.getDocument({
        url: `/api/v2/pdf/${hit.chunkId}`,
        disableRange: true, disableStream: true, disableAutoFetch: true,
      }).promise;
      docCache.set(key, doc);
      return doc;
    };

    const SCALE = 2;   // élesebb kép a képletekhez
    // Csak a KIEMELT szakaszt vágjuk ki a PDF-oldalból (bbox + kis kontextus),
    // sárgával kiemelve — így a riport tömör, és minden tétel a hozzá tartozó
    // hivatkozással (dokumentum · szakasz · oldal) egyértelműen azonosítható.
    const renderHit = async (hit: any): Promise<string | null> => {
      try {
        if (!hit.pdfPage) return null;
        const doc = await getDoc(hit);
        const page = await doc.getPage(hit.pdfPage);
        const vp = page.getViewport({ scale: SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        const bbox = hit.bbox;
        if (Array.isArray(bbox) && bbox.length === 4 && bbox.every((n: any) => typeof n === "number")) {
          const [x0, y0, x1, y1] = bbox;
          const rx = x0 * SCALE, ry = y0 * SCALE, rw = (x1 - x0) * SCALE, rh = (y1 - y0) * SCALE;
          // sárga kiemelés a szakaszra
          ctx.save();
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = "rgba(255, 214, 0, 0.30)";
          ctx.fillRect(rx, ry, rw, rh);
          ctx.restore();
          ctx.strokeStyle = "rgba(214, 168, 0, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx, ry, rw, rh);
          // kivágás a szakaszra (teljes szélesség, függőlegesen bbox + kontextus)
          const PAD = 26 * SCALE;
          const sy = Math.max(0, Math.round(ry - PAD));
          const sh = Math.min(canvas.height - sy, Math.round(rh + 2 * PAD));
          if (sh > 0) {
            const crop = document.createElement("canvas");
            crop.width = canvas.width;
            crop.height = sh;
            const cctx = crop.getContext("2d");
            if (cctx) {
              cctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
              return crop.toDataURL("image/jpeg", 0.9);
            }
          }
        }
        // bbox nélkül: a teljes oldal (tartalék)
        return canvas.toDataURL("image/jpeg", 0.85);
      } catch {
        return null;
      }
    };

    try {
      const imgs: (string | null)[] = [];
      for (const h of hits) imgs.push(await renderHit(h));
      docCache.forEach((d) => { try { d.destroy?.(); } catch { /* noop */ } });

      const now = new Date().toLocaleString("hu-HU");
      // A nyomtatáskor a böngésző a <title>-t ajánlja fájlnévnek → keresőkifejezés + időbélyeg.
      const p2 = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
      const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}${p2(d.getMinutes())}`;
      const qShort = question.trim().replace(/\s+/g, " ").slice(0, 80);
      const fileTitle = `${qShort} — ${stamp}`;
      const itemsHtml = hits.map((h: any, i: number) => {
        const img = imgs[i];
        const body = img
          ? `<div class="pgwrap"><img class="pg" src="${img}" alt="Kiemelt szabvány-szakasz"></div>`
          : `<div class="tx">${esc(clean(h.text))}</div>`;
        const loc = `${h.breadcrumb ? esc(clean(h.breadcrumb)) + " &middot; " : ""}PDF-oldal ${esc(h.pdfPage)}`;
        return `<li>
          <div class="cite"><span class="sn">${i + 1}.</span> ${esc(h.citation)}</div>
          <div class="bc">${loc}</div>
          ${body}
        </li>`;
      }).join("");

      const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<title>${esc(fileTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; max-width: 820px; margin: 40px auto; padding: 0 28px; line-height: 1.6; font-size: 14px; }
  .brand { display:flex; align-items:baseline; justify-content:space-between; border-bottom: 3px solid #7CA9D3; padding-bottom: 12px; }
  .brand h1 { font-size: 18px; margin: 0; color:#161718; }
  .brand .sub { color:#7CA9D3; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
  .meta { color:#666; font-size:12px; margin: 10px 0 28px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing:.05em; color:#7CA9D3; margin: 28px 0 10px; }
  .q { font-size: 16px; font-weight: 600; margin: 0; }
  ol { padding: 0; margin: 0; list-style: none; }
  li { padding: 20px 0 26px; border-bottom: 1px solid #ececec; }
  li:last-child { border-bottom: none; }
  .cite { font-size: 14px; font-weight: 700; color:#161718; margin-bottom: 4px; }
  .sn { color:#7CA9D3; margin-right: 4px; }
  .bc { color:#8a8a8a; font-size: 11.5px; margin: 0 0 12px; }
  .pgwrap { border: 1px solid #e2e2e2; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .pg { display:block; width: 100%; height: auto; }
  .tx { font-size: 13.5px; line-height: 1.75; color:#2a2a2a; background:#f6f8fa; border-left:3px solid #7CA9D3; padding: 12px 16px; border-radius:4px; }
  footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #ddd; color:#888; font-size: 11px; line-height: 1.6; }
  @media print { body { margin: 0; max-width: none; } li { break-inside: avoid; } }
</style></head><body>
  <div class="brand"><h1>M Mérnöki Iroda Kft.</h1><span class="sub">Szabvány-keresési riport</span></div>
  <div class="meta">Készült: ${now} &middot; Találatok száma: ${hits.length}</div>
  <h2>Keresés</h2><p class="q">${esc(question)}</p>
  <h2>Talált szabvány-szakaszok (${hits.length})</h2>
  <ol>${itemsHtml}</ol>
  <footer>Ezt a riportot a Tervmegfelelőség-ellenőrző állította elő ${now}-kor a betöltött szabványok alapján.
  Minden tétel a keresett, sárgával kiemelt szakaszt mutatja a forrás-PDF-ből, a pontos hivatkozással (dokumentum · szakasz · oldal) — kérjük, a végleges felhasználás előtt ellenőrizze a forrás-dokumentumokat.</footer>
  <script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Engedélyezze a felugró ablakokat a riport letöltéséhez.");
        return;
      }
      w.document.write(html);
      w.document.close();
    } catch (e) {
      toast.error("A riport készítése nem sikerült.");
    } finally {
      toast.dismiss(toastId);
      setReportBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Search size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Szabványkereső</h1>
          </div>
          <p className="text-text-muted text-sm ml-11">
            Szabadszavas keresés — minden találat egy teljes szabvány-szakasz, pontos
            oldalszámmal, másolható hivatkozással és PDF-oda-ugrással.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Kereső */}
          <div className="rounded-xl border bg-surface p-4" style={{ borderColor: "var(--line)" }}>
            <Textarea
              ref={taRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(question); }}
              placeholder={'Írjon be egy fogalmat vagy kérdést — pl. „nyírás", „szélteher számítása", „V_Rd,c"…'}
              className="min-h-[80px] border-line text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-text-faint">Ctrl+Enter a kereséshez</p>
              <Button
                onClick={() => run(question)}
                disabled={!question.trim() || searchMut.isPending}
                className="gap-2 text-white"
                style={{ backgroundColor: "#4A7BA8" }}
              >
                {searchMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Keresés
              </Button>
            </div>

            {/* Beégetett gyorskérdések */}
            {!hits && !searchMut.isPending && (
              <div className="mt-4 pt-4 border-t border-line-subtle">
                <p className="text-xs text-text-faint mb-2 font-medium">Gyakori kérdések:</p>
                <div className="flex flex-wrap gap-2">
                  {PINNED.map((q) => (
                    <button
                      key={q}
                      onClick={() => runPinned(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-line text-text-default hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors bg-surface"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Betöltés */}
          {searchMut.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-faint">
              <Loader2 size={24} className="animate-spin" style={{ color: "#7CA9D3" }} />
              <p className="text-sm">Keresés a szabványokban…</p>
            </div>
          )}

          {/* Eredmények */}
          {hits && !searchMut.isPending && (
            hits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#EBF3FA" }}>
                  <BookOpen size={26} style={{ color: "#7CA9D3" }} />
                </div>
                <p className="font-medium text-text-default">Nincs találat</p>
                <p className="text-sm text-text-faint mt-1 max-w-sm">
                  A betöltött szabványok nem tartalmaznak a kérdéshez illő szakaszt. Próbáljon
                  más megfogalmazást vagy szűkebb fogalmat.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Info size={13} style={{ color: "#7CA9D3" }} />
                    {hits.length} találat — a legrelevánsabb szakaszok, teljes szöveggel és hivatkozással.
                  </div>
                  <button
                    onClick={handleDownloadReport}
                    disabled={reportBusy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-line text-text-default hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
                    title="A találatok letöltése nyomtatható riportként — a szakaszok a PDF-ből, egy az egyben"
                  >
                    {reportBusy
                      ? <><Loader2 size={13} className="animate-spin" /> Riport készítése…</>
                      : <><FileDown size={13} /> Riport letöltése</>}
                  </button>
                </div>
                {hits.map((h) => (
                  <HitCard
                    key={h.chunkId}
                    hit={h}
                    onOpenSource={() => openSource(h)}
                    onOpenFullDoc={() => openFullDoc(h)}
                    fullDocBusy={openingDoc === h.chunkId}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </main>

      {viewer && (
        <PdfViewerModal
          chunkId={viewer.chunkId}
          citation={viewer.citation}
          highlights={viewer.highlights}
          initialPage={viewer.initialPage}
          sectionCount={viewer.sectionCount}
          newTabUrl={viewer.newTabUrl}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
