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

function HitCard({ hit, onOpenSource }: { hit: any; onOpenSource: () => void }) {
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
        <div className="flex items-center justify-between gap-2 mt-2">
          <button
            onClick={onOpenSource}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors flex-shrink-0"
            style={{ backgroundColor: "#4A7BA8" }}
            title="A szabvány-PDF megnyitása a keresett résznél, kiemelve"
          >
            <Locate size={13} /> Ugrás a forráshoz
          </button>
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
  const [hits, setHits] = useState<any[] | null>(null);
  const [viewerHit, setViewerHit] = useState<any | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const searchMut = trpc.standardsSearch.searchV2.useMutation({
    onSuccess: (d) => setHits(d.hits),
    onError: (e) => toast.error(`Keresési hiba: ${e.message}`),
  });

  const run = (q: string) => {
    if (!q.trim()) return;
    setHits(null);
    searchMut.mutate({ question: q.trim(), topK: 8, rerank: true });
  };
  const runPinned = (q: string) => { setQuestion(q); run(q); };

  // Nyomtatható riport a találatokból — a böngésző nyomtató-dialógusán át PDF-be
  // menthető. Kliens-oldali, nincs szerver-függőség (serverless-barát).
  const handleDownloadReport = () => {
    if (!hits || hits.length === 0) return;
    const esc = (s: unknown) =>
      String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    // A PDF-ből átvett szöveg sortörés-kötőjeleit és többszörös szóközeit
    // rendbe tesszük, hogy a riport ne "csússzon össze".
    const clean = (s: unknown) =>
      String(s ?? "")
        .replace(/\r?\n/g, " ")
        .replace(/([A-Za-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ])-\s+([a-záéíóöőúüű])/g, "$1$2")
        .replace(/\s{2,}/g, " ")
        .trim();
    const now = new Date().toLocaleString("hu-HU");
    const itemsHtml = hits.map((h: any, i: number) =>
      `<li>
        <div class="cite"><span class="sn">${i + 1}.</span> ${esc(h.citation)}</div>
        ${h.breadcrumb ? `<div class="bc">${esc(clean(h.breadcrumb))}</div>` : ""}
        <div class="tx">${esc(clean(h.text))}</div>
      </li>`
    ).join("");
    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<title>Szabvány-keresési riport</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; max-width: 760px; margin: 40px auto; padding: 0 28px; line-height: 1.6; font-size: 14px; }
  .brand { display:flex; align-items:baseline; justify-content:space-between; border-bottom: 3px solid #7CA9D3; padding-bottom: 12px; }
  .brand h1 { font-size: 18px; margin: 0; color:#161718; }
  .brand .sub { color:#7CA9D3; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
  .meta { color:#666; font-size:12px; margin: 10px 0 28px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing:.05em; color:#7CA9D3; margin: 28px 0 10px; }
  .q { font-size: 16px; font-weight: 600; margin: 0; }
  ol { padding: 0; margin: 0; list-style: none; }
  li { padding: 18px 0 22px; border-bottom: 1px solid #ececec; }
  li:last-child { border-bottom: none; }
  .cite { font-size: 14px; font-weight: 700; color:#161718; margin-bottom: 5px; }
  .sn { color:#7CA9D3; margin-right: 4px; }
  .bc { color:#8a8a8a; font-size: 11.5px; margin: 0 0 10px; }
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
  Minden idézet a hivatkozott szabvány-szakaszból származik — kérjük, a végleges felhasználás előtt ellenőrizze a forrás-PDF-eket.</footer>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Engedélyezze a felugró ablakokat a riport letöltéséhez.");
      return;
    }
    w.document.write(html);
    w.document.close();
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-line text-text-default hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors flex-shrink-0"
                    title="A találatok letöltése nyomtatható riportként (PDF)"
                  >
                    <FileDown size={13} /> Riport letöltése
                  </button>
                </div>
                {hits.map((h) => (
                  <HitCard key={h.chunkId} hit={h} onOpenSource={() => setViewerHit(h)} />
                ))}
              </div>
            )
          )}
        </div>
      </main>

      {viewerHit && (
        <PdfViewerModal
          chunkId={viewerHit.chunkId}
          pdfPage={viewerHit.pdfPage ?? 1}
          highlight={viewerHit.text ?? ""}
          citation={viewerHit.citation ?? ""}
          bbox={viewerHit.bbox ?? null}
          onClose={() => setViewerHit(null)}
        />
      )}
    </div>
  );
}
