import { useState } from "react";
import {
  History, Search, Trash2, ChevronDown, ChevronUp,
  Clock, BookOpen, CheckCircle2, AlertTriangle, XCircle, Info,
  Loader2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useActiveProject } from "@/contexts/ProjectContext";
import { ProjectScopeBanner } from "@/components/ProjectScopeBanner";
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
  const labels: Record<string, string> = {
    mszt: "MSZT",
    internal: "Belső",
    combined: "Kombinált",
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
                hour: "2-digit", minute: "2-digit"
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
            {item.projectName && (
              <span className="text-xs text-text-faint italic">{item.projectName}</span>
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
          {/* Rewritten question */}
          {item.rewrittenQuestion && item.rewrittenQuestion !== item.question && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
              <Info size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>Pontosított kérdés:</strong> {item.rewrittenQuestion}
              </p>
            </div>
          )}

          {/* Self-check warning */}
          {!item.selfCheckPassed && item.selfCheckNotes && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Önellenőrzés:</strong> {item.selfCheckNotes}
              </p>
            </div>
          )}

          {/* Answer */}
          <div className="p-4">
            {item.answer ? (
              <div className="prose prose-sm max-w-none text-text-strong">
                <Streamdown>{item.answer}</Streamdown>
              </div>
            ) : (
              <p className="text-sm text-text-faint italic">Nincs mentett válasz.</p>
            )}
          </div>

          {/* Sources */}
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

export default function SearchHistoryPage() {
  const { activeProjectId } = useActiveProject();
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
    projectId: activeProjectId ?? undefined,
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
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
                  <History size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Keresési előzmények</h1>
              </div>
              <p className="text-text-muted text-sm ml-11">
                Korábbi szabványkeresések és generált válaszok visszakereshetőek.
              </p>
            </div>
            <Link href="/search">
              <Button className="gap-2 text-white text-sm" style={{ backgroundColor: "#7CA9D3" }}>
                <Search size={14} />
                Új keresés
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-4">
        <ProjectScopeBanner describe={(name) => `Az alábbi keresési előzmények csak a(z) ${name} projektben végzettek.`} />
        {/* Search bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input
              placeholder="Keresés az előzmények között..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 border-line text-sm h-9"
            />
          </div>
          {items.length > 0 && (
            <span className="text-sm text-text-faint">{items.length} találat</span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "#7CA9D3" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#EBF3FA" }}>
              <History size={28} style={{ color: "#7CA9D3" }} />
            </div>
            <h3 className="text-lg font-semibold text-text-default mb-2">
              {debouncedSearch ? "Nincs találat" : "Még nincs keresési előzmény"}
            </h3>
            <p className="text-sm text-text-faint max-w-sm mb-6">
              {debouncedSearch
                ? "Próbáljon más keresési kifejezést."
                : "Indítson el egy szabványkeresést, és az itt fog megjelenni."}
            </p>
            {!debouncedSearch && (
              <Link href="/search">
                <Button className="gap-2 text-white text-sm" style={{ backgroundColor: "#7CA9D3" }}>
                  <Search size={14} />
                  Első keresés indítása
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <HistoryItem
                key={item.id}
                item={item as any}
                onDelete={(id) => deleteMutation.mutate({ id })}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
