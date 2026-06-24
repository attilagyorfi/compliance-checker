import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useActiveProject } from "@/contexts/ProjectContext";
import { ProjectScopeBanner } from "@/components/ProjectScopeBanner";
import {
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  BarChart3,
  Loader2,
  RefreshCw,
  ChevronRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Status helpers ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: "Kész", color: "bg-green-100 text-green-800", icon: CheckCircle },
  processing: { label: "Feldolgozás alatt", color: "bg-blue-100 text-blue-800", icon: Loader2 },
  pending: { label: "Várakozik", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  error: { label: "Hiba", color: "bg-red-100 text-red-800", icon: XCircle },
};

const workflowConfig: Record<string, { label: string; color: string }> = {
  uj: { label: "Új", color: "bg-hover text-text-default" },
  elemzes_alatt: { label: "Elemzés alatt", color: "bg-blue-100 text-blue-700" },
  ai_eloelenorizve: { label: "AI előellenőrzött", color: "bg-purple-100 text-purple-700" },
  ember_felulvizsgalva: { label: "Ember felülvizsgálta", color: "bg-teal-100 text-teal-700" },
  javitasra_visszakuldve: { label: "Javításra visszaküldve", color: "bg-orange-100 text-orange-700" },
  lezart: { label: "Lezárt", color: "bg-green-100 text-green-700" },
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-line p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-text-strong">{value}</div>
        <div className="text-xs text-text-muted font-medium">{label}</div>
      </div>
    </div>
  );
}

// ── Analysis row ──────────────────────────────────────────────────────────────

function AnalysisRow({ analysis }: { analysis: any }) {
  const st = statusConfig[analysis.status] ?? statusConfig.pending;
  const wf = workflowConfig[analysis.workflowStatus ?? "uj"] ?? workflowConfig.uj;
  const StIcon = st.icon;

  const results: any[] = analysis.results ?? [];
  const megfelel = results.filter((r: any) => r.status === "megfelel").length;
  const bizonytalan = results.filter((r: any) => r.status === "bizonytalan" || r.status === "reszben_megfelel").length;
  const nemFelel = results.filter((r: any) => r.status === "nem_felel_meg").length;

  const planName =
    Array.isArray(analysis.planDocuments) && analysis.planDocuments.length > 0
      ? analysis.planDocuments[0].name
      : analysis.title;

  return (
    <Link href={`/result/${analysis.id}`}>
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-page-bg-subtle transition-colors cursor-pointer border-b border-line-subtle last:border-0">
        {/* Status icon */}
        <div className="shrink-0">
          <StIcon
            size={18}
            className={`${analysis.status === "processing" ? "animate-spin" : ""} ${
              analysis.status === "completed"
                ? "text-green-500"
                : analysis.status === "error"
                ? "text-red-500"
                : "text-blue-500"
            }`}
          />
        </div>

        {/* Name + date */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-strong text-sm truncate">{analysis.title}</div>
          <div className="text-xs text-text-faint mt-0.5 truncate">{planName}</div>
        </div>

        {/* Result counts */}
        {analysis.status === "completed" && results.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs shrink-0">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle size={12} /> {megfelel}
            </span>
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle size={12} /> {bizonytalan}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle size={12} /> {nemFelel}
            </span>
          </div>
        )}

        {/* Workflow badge */}
        <span className={`hidden md:inline-flex text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${wf.color}`}>
          {wf.label}
        </span>

        {/* Date */}
        <div className="text-xs text-text-faint shrink-0 hidden lg:block">{formatDate(analysis.createdAt)}</div>

        <ChevronRight size={14} className="text-gray-300 shrink-0" />
      </div>
    </Link>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [filter, setFilter] = useState<"all" | "processing" | "completed" | "error">("all");
  const { activeProjectId } = useActiveProject();

  const { data: analyses = [], isLoading, refetch, isFetching } = trpc.compliance.listAnalyses.useQuery(
    activeProjectId ? { projectId: activeProjectId } : undefined,
    { refetchInterval: 10_000 },
  );

  const filtered = filter === "all" ? analyses : analyses.filter((a: any) => a.status === filter);

  // Aggregate stats
  const total = analyses.length;
  const processing = analyses.filter((a: any) => a.status === "processing" || a.status === "pending").length;
  const completed = analyses.filter((a: any) => a.status === "completed").length;
  const errors = analyses.filter((a: any) => a.status === "error").length;

  // Finding totals across all completed analyses
  const allResults = analyses.flatMap((a: any) => (a.results ?? []) as any[]);
  const totalMegfelel = allResults.filter((r) => r.status === "megfelel").length;
  const totalNemFelel = allResults.filter((r) => r.status === "nem_felel_meg").length;

  return (
    <div className="min-h-screen bg-page-bg-subtle">
      <div className="container py-8 max-w-6xl mx-auto px-4 space-y-4">

        <ProjectScopeBanner describe={(name) => `Az alábbi elemzések csak a(z) ${name} projekthez tartoznak.`} />

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong">Operációs Dashboard</h1>
            <p className="text-sm text-text-muted mt-1">Összes tervmegfelelőség-elemzés áttekintése</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
              Frissítés
            </Button>
            <Link href="/search">
              <Button size="sm" className="gap-2" style={{ backgroundColor: "#7CA9D3" }}>
                <Search size={14} />
                Új keresés
              </Button>
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Összes elemzés" value={total} icon={FileText} accent="bg-[#7CA9D3]" />
          <StatCard label="Feldolgozás alatt" value={processing} icon={Activity} accent="bg-blue-500" />
          <StatCard label="Megfelel (összesen)" value={totalMegfelel} icon={CheckCircle} accent="bg-green-500" />
          <StatCard label="Nem felel meg" value={totalNemFelel} icon={XCircle} accent="bg-red-500" />
        </div>

        {/* Analyses table */}
        <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
          {/* Table header + filter */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line-subtle">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-text-faint" />
              <span className="font-semibold text-text-strong text-sm">Elemzések</span>
              {total > 0 && (
                <span className="text-xs text-text-faint bg-hover px-2 py-0.5 rounded-full">{total}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(["all", "processing", "completed", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filter === f
                      ? "text-white"
                      : "text-text-muted hover:text-text-default hover:bg-hover"
                  }`}
                  style={filter === f ? { backgroundColor: "#7CA9D3" } : {}}
                >
                  {{ all: "Mind", processing: "Folyamatban", completed: "Kész", error: "Hiba" }[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-text-faint gap-3">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Betöltés...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-faint gap-3">
              <FileText size={36} className="opacity-30" />
              <p className="text-sm">
                {filter === "all"
                  ? "Még nincs elemzés. Indítson egyet a Szabványkeresőből."
                  : "Nincs találat ebben a szűrőben."}
              </p>
              {filter === "all" && (
                <Link href="/search">
                  <Button size="sm" variant="outline" className="gap-2 mt-1">
                    <Search size={14} /> Szabványkereső
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div>
              {filtered.map((a: any) => (
                <AnalysisRow key={a.id} analysis={a} />
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {[
            { href: "/search", label: "Szabványkereső", desc: "Kérdés a feltöltött jogszabályokból", icon: Search },
            { href: "/regulations", label: "Jogszabályok", desc: "Feltöltött szabványok kezelése", icon: BarChart3 },
          ].map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="bg-surface rounded-xl border border-line p-4 flex items-center gap-4 hover:border-[#7CA9D3] hover:shadow-sm transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-[#7CA9D3]/10 flex items-center justify-center shrink-0">
                  <Icon size={16} style={{ color: "#7CA9D3" }} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text-strong">{label}</div>
                  <div className="text-xs text-text-faint truncate">{desc}</div>
                </div>
                <ChevronRight size={14} className="text-gray-300 ml-auto shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
