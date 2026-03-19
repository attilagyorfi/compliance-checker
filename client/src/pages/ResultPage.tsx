import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  FileText, Download, ArrowLeft, ChevronDown, ChevronUp,
  BarChart3, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import type { ComplianceResult, ComplianceStatus } from "../../../drizzle/schema";

// ── Status helpers ────────────────────────────────────────────────────────────

const statusConfig: Record<ComplianceStatus, {
  label: string;
  icon: typeof CheckCircle2;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}> = {
  megfelel: {
    label: "Megfelel",
    icon: CheckCircle2,
    colorClass: "text-green-700",
    borderClass: "border-green-200",
    bgClass: "bg-green-50",
  },
  bizonytalan: {
    label: "Bizonytalan",
    icon: AlertTriangle,
    colorClass: "text-yellow-700",
    borderClass: "border-yellow-200",
    bgClass: "bg-yellow-50",
  },
  nem_felel_meg: {
    label: "Nem felel meg",
    icon: XCircle,
    colorClass: "text-red-700",
    borderClass: "border-red-200",
    bgClass: "bg-red-50",
  },
};

const borderLeft: Record<ComplianceStatus, string> = {
  megfelel: "4px solid #16a34a",
  bizonytalan: "4px solid #ca8a04",
  nem_felel_meg: "4px solid #dc2626",
};

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: ComplianceResult }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[result.status];
  const Icon = cfg.icon;

  return (
    <div
      className="rounded-lg border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderLeft: borderLeft[result.status], borderColor: "#e5e7eb" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5"
      >
        <div className="flex items-start gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bgClass}`}>
            <Icon size={16} className={cfg.colorClass} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border mb-2 ${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`}
                >
                  {cfg.label}
                </span>
                <h3 className="font-semibold text-sm text-gray-900 leading-snug">
                  {result.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{result.description}</p>
              </div>
              <div className="flex-shrink-0 mt-1">
                {expanded ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "#f3f4f6" }}>
          <div className="pt-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                Indoklás
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{result.justification}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Szabályhivatkozás
                </div>
                <code className="text-xs px-2 py-1 rounded font-mono" style={{ backgroundColor: "#EBF3FA", color: "#5a8ab8" }}>
                  {result.reference}
                </code>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Kategória
                </div>
                <Badge variant="secondary" className="text-xs">
                  {result.category}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function SummaryStats({ results }: { results: ComplianceResult[] }) {
  const pass = results.filter((r) => r.status === "megfelel").length;
  const uncertain = results.filter((r) => r.status === "bizonytalan").length;
  const fail = results.filter((r) => r.status === "nem_felel_meg").length;
  const total = results.length;

  const stats = [
    { label: "Megfelel", value: pass, color: "#16a34a", bg: "#f0fdf4" },
    { label: "Bizonytalan", value: uncertain, color: "#ca8a04", bg: "#fefce8" },
    { label: "Nem felel meg", value: fail, color: "#dc2626", bg: "#fef2f2" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {stats.map(({ label, value, color, bg }) => (
        <div
          key={label}
          className="rounded-lg p-5 text-center border"
          style={{ backgroundColor: bg, borderColor: color + "33" }}
        >
          <div className="text-3xl font-bold mb-1" style={{ color }}>
            {value}
          </div>
          <div className="text-xs font-medium" style={{ color }}>
            {label}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {total > 0 ? Math.round((value / total) * 100) : 0}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const analysisId = parseInt(params.id || "0", 10);
  const [filter, setFilter] = useState<ComplianceStatus | "all">("all");

  const exportPdf = trpc.pdf.exportPdf.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data.base64}`;
      link.download = data.filename;
      link.click();
    },
  });

  const { data: analysis, refetch } = trpc.compliance.getAnalysis.useQuery(
    { id: analysisId },
    { enabled: !!analysisId, refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === "processing" || status === "pending" ? 3000 : false;
    }}
  );

  const results: ComplianceResult[] = (analysis?.results as ComplianceResult[]) || [];
  const filtered = filter === "all" ? results : results.filter((r) => r.status === filter);

  const filterButtons: Array<{ key: ComplianceStatus | "all"; label: string }> = [
    { key: "all", label: `Összes (${results.length})` },
    { key: "megfelel", label: `Megfelel (${results.filter(r => r.status === "megfelel").length})` },
    { key: "bizonytalan", label: `Bizonytalan (${results.filter(r => r.status === "bizonytalan").length})` },
    { key: "nem_felel_meg", label: `Nem felel meg (${results.filter(r => r.status === "nem_felel_meg").length})` },
  ];

  if (!analysis) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "#7CA9D3" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-6">
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
            <ArrowLeft size={14} />
            Vissza a riportokhoz
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
                  <BarChart3 size={16} className="text-white" />
                </div>
                <h1 className="text-xl font-bold" style={{ color: "#161718" }}>
                  {analysis.title}
                </h1>
              </div>
              <div className="ml-11 flex flex-wrap gap-3 text-xs text-gray-500">
                {(analysis.planDocuments as any)?.[0]?.name && (
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    {(analysis.planDocuments as any)?.[0]?.name}
                  </span>
                )}
                <span>{new Date(analysis.createdAt).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <div>
              {analysis.status === "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-gray-200"
                  disabled={exportPdf.isPending}
                  onClick={() => exportPdf.mutate({ id: analysisId })}
                >
                  {exportPdf.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  PDF letöltés
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8">
        {/* Processing state */}
        {(analysis.status === "pending" || analysis.status === "processing") && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#EBF3FA" }}>
              <Loader2 size={28} className="animate-spin" style={{ color: "#7CA9D3" }} />
            </div>
            <h2 className="text-xl font-semibold mb-3" style={{ color: "#161718" }}>
              Elemzés folyamatban...
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Az AI feldolgozza a dokumentumokat és elvégzi a megfelelőség-ellenőrzést. Ez általában 30–90 másodpercet vesz igénybe.
            </p>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e7eb" }}>
              <div
                className="h-full rounded-full animate-pulse"
                style={{ width: "60%", backgroundColor: "#7CA9D3" }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {analysis.status === "error" && (
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-red-50">
              <XCircle size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-3 text-red-700">Elemzési hiba</h2>
            <p className="text-gray-500 text-sm mb-6">{analysis.errorMessage || "Ismeretlen hiba történt."}</p>
            <Link href="/analysis">
              <Button style={{ backgroundColor: "#7CA9D3" }} className="text-white gap-2">
                <ArrowLeft size={14} />
                Új elemzés indítása
              </Button>
            </Link>
          </div>
        )}

        {/* Completed state */}
        {analysis.status === "completed" && results.length > 0 && (
          <>
            {/* Summary stats */}
            <SummaryStats results={results} />

            {/* Summary text */}
            {analysis.summary && (
              <div
                className="rounded-lg p-5 mb-8 border"
                style={{ backgroundColor: "#F8FAFC", borderColor: "#e5e7eb" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList size={15} style={{ color: "#7CA9D3" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Összefoglaló értékelés
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {filterButtons.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    filter === key
                      ? "text-white border-transparent"
                      : "text-gray-500 border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  style={filter === key ? { backgroundColor: "#7CA9D3", borderColor: "#7CA9D3" } : {}}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Result cards */}
            <div className="space-y-3">
              {filtered.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                Nincs találat a kiválasztott szűrőre.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
