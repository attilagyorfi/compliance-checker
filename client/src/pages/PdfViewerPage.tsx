/**
 * Önálló, teljes-képernyős PDF-nézegető oldal (/viewer).
 *
 * A "Megnyitás új lapon" ide navigál: a teljes szabvány-PDF végiggörgethetően, a
 * keresésre illeszkedő ÖSSZES szakasz SÁRGÁVAL kiemelve (ugyanaz a nézet, mint a
 * modalban, csak külön böngészőfülön — így nyomtatható/menthető is a kiemelésekkel).
 *
 * URL-paraméterek: ?chunk=<chunkId>&slug=<doc-slug>&q=<keresőkifejezés>
 */

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import PdfViewerModal from "@/components/PdfViewerModal";
import { trpc } from "@/lib/trpc";

export default function PdfViewerPage() {
  const params = new URLSearchParams(window.location.search);
  const chunkId = Number(params.get("chunk") || 0);
  const slug = params.get("slug") || "";
  const query = params.get("q") || "";

  const [state, setState] = useState<
    | { chunkId: number; citation: string; highlights: { pdfPage: number; bbox: number[] }[]; initialPage: number; sectionCount: number }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const docHlMut = trpc.standardsSearch.documentHighlights.useMutation();

  useEffect(() => {
    let cancelled = false;
    if (!chunkId || !slug || !query) { setError("Hiányos hivatkozás — a nézet nem nyitható meg."); return; }
    (async () => {
      try {
        const res = await docHlMut.mutateAsync({ query, slug });
        if (cancelled) return;
        const hl = (res.highlights || [])
          .filter((h) => h.pdfPage && Array.isArray(h.bbox))
          .map((h) => ({ pdfPage: h.pdfPage as number, bbox: h.bbox as number[] }));
        const initialPage = hl.length ? Math.min(...hl.map((h) => h.pdfPage)) : 1;
        const yr = res.editionYear ? ":" + res.editionYear : "";
        const cite = `${res.officialId}${yr} — teljes dokumentum`;
        document.title = `${res.officialId || "Szabvány"} — kiemelt (${query})`;
        setState({ chunkId, citation: cite, highlights: hl, initialPage, sectionCount: hl.length });
      } catch {
        if (!cancelled) setError("Nem sikerült betölteni a dokumentum kiemeléseit.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkId, slug, query]);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 text-center bg-surface px-6">
        <AlertTriangle size={30} className="text-amber-500" />
        <p className="text-sm font-medium text-text-default">{error}</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-surface">
        <Loader2 size={28} className="animate-spin" style={{ color: "#7CA9D3" }} />
        <p className="text-sm text-text-faint">Dokumentum és kiemelések betöltése…</p>
      </div>
    );
  }
  return (
    <PdfViewerModal
      asPage
      chunkId={state.chunkId}
      citation={state.citation}
      highlights={state.highlights}
      initialPage={state.initialPage}
      sectionCount={state.sectionCount}
      onClose={() => window.close()}
    />
  );
}
