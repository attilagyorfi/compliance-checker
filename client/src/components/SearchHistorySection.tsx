/**
 * SearchHistorySection — V11.15
 *
 * A keresési előzmények listája, beágyazható szekcióként (Header és
 * oldal-keret nélkül). Az Admin oldalon jelenik meg; a korábbi önálló
 * /search-history oldalt váltja ki. A standardsSearch.listHistory endpointot
 * használja (a hívó saját előzményei).
 */

import { useState } from "react";
import {
  History, Search, Trash2, ChevronDown, ChevronUp,
  Clock, BookOpen, CheckCircle2, AlertTriangle, XCircle, Info,
  Loader2, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import type { SearchSource } from "../../../drizzle/schema";

type Confidence = "low" | "medium" | "high";

function ConfidenceBadge({ confidence }: { confidence: Confidence | null | undefined }) {
  if (!confidence) return null;
  const config = {
    high: { label: "Magas", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: <CheckCircle2 size={10} /> },
    medium: { label: "Közepes", color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: <Info size={10} /> },
    low: { label: "Alacsony", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: <AlertTriangle size={10} /> },
  }[confidence];

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: config.color, backgroundColor: config.bg, borderColor: config.border }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function SearchModeBadge({ mode }: { mode: string }) {
  // V11.15: 3 aktív mód + legacy értékek.
  const labels: Record<string, string> = {
    internal: "Jogszabályok",
    web: "Internet",
    combined_with_web: "Jogszabály + internet",
    mszt: "MSZT (régi)",
    combined: "Kombinált (régi)",
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-hover text-text-default border border-line">
      {labels[mode] ?? mode}
    </span>
  );
}

function HistoryItem({ item, onDelete }: {
  item: {
    id: number;
    question: string;
    rewrittenQuestion: string | null;
    searchMode: string;
    answerLength: string;
    operationMode: string;
    answer: string | null;
    confidence: string | null;
    sources: unknown;
    hasSufficientSources: boolean;
    selfCheckPassed: boolean;
    selfCheckNotes: string | null;
    projectName: string | null;
    createdAt: Date;
  };
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sources = (item.sources as SearchSource[]) ?? [];

  return (
    <div className="rounded-xl border bg-surface overflow-hidden transition-shadow hover:shadow-sm" style={{ borderColor: "var(--line)" }}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-page-bg-subtle transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: "#EBF3FA" }}
        >
          <Search size={14} style={{ color: "#7CA9D3" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-strong leading-snug">{item.question}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-text-faint">
              <Clock size={10} />
              {new Date(item.createdAt).toLocaleString("hu-HU", {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            <SearchModeBadge mode={item.searchMode} />
            <ConfidenceBadge confidence={item.confidence as Confidence} />
            {!item.hasSufficientSources && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <XCircle size={10} />
                Nincs forrás
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            title="Törlés"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-text-faint" /> : <ChevronDown size={14} className="text-text-faint" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t" style={{ borderColor: "var(--line)" }}>
          {item.rewrittenQuestion && item.rewrittenQuestion !== item.question && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
              <Info size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>Pontosított kérdés:</strong> {item.rewrittenQuestion}
              </p>
            </div>
          )}

          {!item.selfCheckPassed && item.selfCheckNotes && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Önellenőrzés:</strong> {item.selfCheckNotes}
              </p>
            </div>
          )}

          <div className="p-4">
            {item.answer ? (
              <div className="prose prose-sm max-w-none text-text-strong">
                <Streamdown>{item.answer}</Streamdown>
              </div>
            ) : (
              <p className="text-sm text-text-faint italic">Nincs mentett válasz.</p>
            )}
          </div>

          {sources.length > 0 && (
            <div className="px-4 pb-4">
              <Separator className="mb-3" />
              <p className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                <BookOpen size={11} style={{ color: "#7CA9D3" }} />
                Hivatkozások ({sources.length})
              </p>
              <div className="space-y-1.5">
                {sources.map((src, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-text-default bg-page-bg-subtle rounded-lg p-2 border border-line-subtle">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: "#7CA9D3", fontSize: "9px" }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-text-default">{src.documentName}</span>
                      {src.page && <span className="text-text-faint ml-2">{src.page}. oldal</span>}
                      {src.chapter && <span className="text-text-faint ml-2">{src.chapter}</span>}
                    </div>
                    {src.url && (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-text-faint hover:text-text-default">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchHistorySection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[1](setTimeout(() => setDebouncedSearch(value), 400));
  };

  const { data, isLoading, refetch } = trpc.standardsSearch.listHistory.useQuery({
    limit: 50,
    offset: 0,
    search: debouncedSearch || undefined,
  });

  const deleteMutation = trpc.standardsSearch.deleteQuery.useMutation({
    onSuccess: () => {
      toast.success("Keresés törölve");
      refetch();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const items = data?.items ?? [];

  return (
    <div className="rounded-xl border bg-surface p-5" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-strong flex items-center gap-2">
          <History size={16} style={{ color: "#7CA9D3" }} />
          Keresési előzmények
        </h2>
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <Input
            placeholder="Keresés az előzmények között..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 border-line text-sm h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin" style={{ color: "#7CA9D3" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#EBF3FA" }}>
            <History size={22} style={{ color: "#7CA9D3" }} />
          </div>
          <p className="text-sm text-text-faint max-w-sm">
            {debouncedSearch
              ? "Nincs találat erre a keresési kifejezésre."
              : "Még nincs keresési előzmény. A szabványkeresések itt jelennek meg."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <HistoryItem
              key={item.id}
              item={item as never}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
