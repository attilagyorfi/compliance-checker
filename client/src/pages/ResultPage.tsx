import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  FileText, Download, ArrowLeft, ChevronDown, ChevronUp,
  BarChart3, ClipboardList, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import type { ComplianceResult, ComplianceStatus, FindingWorkflowStatus } from "../../../drizzle/schema";

const FINDING_WORKFLOW_LABELS: Record<FindingWorkflowStatus, { label: string; color: string; bg: string }> = {
  nyitott:           { label: "Nyitott",            color: "#6b7280", bg: "#f3f4f6" },
  ellenorzes_alatt:  { label: "Ellenőrzés alatt",   color: "#1d4ed8", bg: "#eff6ff" },
  elfogadva:         { label: "Elfogadva",          color: "#059669", bg: "#f0fdf4" },
  elutasitva:        { label: "Elutasítva",         color: "#dc2626", bg: "#fef2f2" },
  javitva:           { label: "Javítva",            color: "#d97706", bg: "#fffbeb" },
  lezarva:           { label: "Lezárva",            color: "#0f766e", bg: "#ecfdf5" },
};

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
  reszben_megfelel: {
    label: "Részben megfelel",
    icon: AlertTriangle,
    colorClass: "text-orange-700",
    borderClass: "border-orange-200",
    bgClass: "bg-orange-50",
  },
};

const borderLeft: Record<ComplianceStatus, string> = {
  megfelel: "4px solid #16a34a",
  bizonytalan: "4px solid #ca8a04",
  nem_felel_meg: "4px solid #dc2626",
  reszben_megfelel: "4px solid #ea580c",
};

// ── Severity badge ────────────────────────────────────────────────────────────

const severityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: "Kritikus", color: "bg-red-100 text-red-700" },
  major: { label: "Jelentős", color: "bg-orange-100 text-orange-700" },
  minor: { label: "Kisebb", color: "bg-yellow-100 text-yellow-700" },
  info: { label: "Tájékoztató", color: "bg-blue-100 text-blue-700" },
};

function ConfidenceBar({ value }: { value?: number }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-hover rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result, analysisId, onUpdate }: {
  result: ComplianceResult;
  analysisId: number;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<FindingWorkflowStatus>(
    (result.workflowStatus as FindingWorkflowStatus) ?? "nyitott"
  );
  const [reviewNote, setReviewNote] = useState(result.reviewNote ?? "");
  const [assignedTo, setAssignedTo] = useState(result.assignedTo ?? "");

  const cfg = statusConfig[result.status];
  const Icon = cfg.icon;
  const r = result as any; // extended fields from V6
  const sevCfg = r.severity ? severityConfig[r.severity] : null;
  const wfCfg = FINDING_WORKFLOW_LABELS[workflowStatus] ?? FINDING_WORKFLOW_LABELS.nyitott;

  const updateMut = trpc.compliance.updateFindingStatus.useMutation({
    onSuccess: () => {
      toast.success("Felülvizsgálat mentve");
      onUpdate();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const saveReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Always send the actual values (incl. empty string) — the previous
    // `|| undefined` made it impossible to clear an existing reviewNote /
    // assignedTo, because the backend's `?? r.reviewNote` preserves the
    // old value on undefined input.
    updateMut.mutate({
      analysisId,
      findingId: result.id,
      workflowStatus,
      reviewNote,
      assignedTo,
    });
  };

  return (
    <div
      className="rounded-lg border bg-surface shadow-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderLeft: borderLeft[result.status], borderColor: "var(--line)" }}
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
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`}
                  >
                    {cfg.label}
                  </span>
                  {sevCfg && (
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${sevCfg.color}`}>
                      {sevCfg.label}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: wfCfg.bg, color: wfCfg.color }}
                  >
                    <ClipboardCheck size={10} />
                    {wfCfg.label}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-text-strong leading-snug">
                  {result.title}
                </h3>
                <p className="text-xs text-text-muted mt-1">{result.description}</p>
                {r.confidence != null && (
                  <div className="mt-2 max-w-[160px]">
                    <div className="text-xs text-text-faint mb-1">AI bizonyosság</div>
                    <ConfidenceBar value={r.confidence} />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 mt-1">
                {expanded ? (
                  <ChevronUp size={16} className="text-text-faint" />
                ) : (
                  <ChevronDown size={16} className="text-text-faint" />
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--line-subtle)" }}>
          <div className="pt-4 space-y-4">
            {/* Justification */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-1.5">
                Indoklás
              </div>
              <p className="text-sm text-text-default leading-relaxed">{result.justification}</p>
            </div>

            {/* Reference + Category */}
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-1.5">
                  Szabályhivatkozás
                </div>
                <code className="text-xs px-2 py-1 rounded font-mono" style={{ backgroundColor: "#EBF3FA", color: "#5a8ab8" }}>
                  {result.reference}
                </code>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-1.5">
                  Kategória
                </div>
                <Badge variant="secondary" className="text-xs">
                  {result.category}
                </Badge>
              </div>
            </div>

            {/* Next step */}
            {r.nextStep && (
              <div className="rounded-lg p-3" style={{ backgroundColor: "#EBF3FA" }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#5a8ab8" }}>
                  Javasolt következő lépés
                </div>
                <p className="text-sm text-text-default">{r.nextStep}</p>
              </div>
            )}

            {/* Evidence panel – "Miért ezt állítja?" */}
            {(r.regulationExcerpt || r.planExcerpt) && (
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEvidence(!showEvidence); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-default transition-colors"
                >
                  {showEvidence ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  Miért ezt állítja? (bizonyítékok)
                </button>
                {showEvidence && (
                  <div className="mt-3 space-y-3">
                    {r.regulationExcerpt && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">
                          Jogszabály / szabvány szövegrészlet
                        </div>
                        <blockquote className="text-xs text-blue-900 italic leading-relaxed border-l-2 border-blue-300 pl-3">
                          {r.regulationExcerpt}
                        </blockquote>
                      </div>
                    )}
                    {r.planExcerpt && (
                      <div className="rounded-lg border border-line bg-page-bg-subtle p-3">
                        <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                          Tervdokumentum szövegrészlet
                        </div>
                        <blockquote className="text-xs text-text-default italic leading-relaxed border-l-2 border-gray-300 pl-3">
                          {r.planExcerpt}
                        </blockquote>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Review panel — V11 finding-level workflow */}
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowReview(!showReview); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-default transition-colors"
              >
                {showReview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Felülvizsgálat
              </button>
              {showReview && (
                <div className="mt-3 rounded-lg border bg-page-bg-subtle p-4 space-y-3" style={{ borderColor: "var(--line)" }} onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`wf-${result.id}`} className="text-xs">Munkafolyamat-státusz</Label>
                      <Select value={workflowStatus} onValueChange={(v) => setWorkflowStatus(v as FindingWorkflowStatus)}>
                        <SelectTrigger id={`wf-${result.id}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(FINDING_WORKFLOW_LABELS) as Array<[FindingWorkflowStatus, typeof FINDING_WORKFLOW_LABELS[FindingWorkflowStatus]]>).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`as-${result.id}`} className="text-xs">Felelős (név vagy e-mail)</Label>
                      <Input
                        id={`as-${result.id}`}
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        placeholder="pl. Kovács J."
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`note-${result.id}`} className="text-xs">Megjegyzés / döntés indoklása</Label>
                    <Textarea
                      id={`note-${result.id}`}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Pl. A javaslat elfogadva, kiviteli tervben pontosítani."
                      rows={3}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={saveReview}
                      disabled={updateMut.isPending}
                      style={{ backgroundColor: "#7CA9D3" }}
                    >
                      {updateMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                      Mentés
                    </Button>
                  </div>
                </div>
              )}
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
          <div className="text-xs text-text-faint mt-0.5">
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
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "#7CA9D3" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-6">
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-default mb-4 transition-colors">
            <ArrowLeft size={14} />
            Vissza a riportokhoz
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
                  <BarChart3 size={16} className="text-white" />
                </div>
                <h1 className="text-xl font-bold" style={{ color: "var(--text-strong)" }}>
                  {analysis.title}
                </h1>
              </div>
              <div className="ml-11 flex flex-wrap gap-3 text-xs text-text-muted">
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
                  className="gap-2 border-line"
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
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--text-strong)" }}>
              Elemzés folyamatban...
            </h2>
            <p className="text-text-muted text-sm mb-6">
              Az AI feldolgozza a dokumentumokat és elvégzi a megfelelőség-ellenőrzést. Ez általában 30–90 másodpercet vesz igénybe.
            </p>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--line)" }}>
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
            <p className="text-text-muted text-sm mb-6">{analysis.errorMessage || "Ismeretlen hiba történt."}</p>
            <Link href="/search">
              <Button style={{ backgroundColor: "#7CA9D3" }} className="text-white gap-2">
                <ArrowLeft size={14} />
                Vissza a keresőhöz
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
                style={{ backgroundColor: "var(--page-bg-subtle)", borderColor: "var(--line)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList size={15} style={{ color: "#7CA9D3" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Összefoglaló értékelés
                  </span>
                </div>
                <p className="text-sm text-text-default leading-relaxed">{analysis.summary}</p>
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
                      : "text-text-muted border-line hover:border-gray-300 bg-surface"
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
                <ResultCard
                  key={result.id}
                  result={result}
                  analysisId={analysisId}
                  onUpdate={() => refetch()}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-text-faint">
                Nincs találat a kiválasztott szűrőre.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
