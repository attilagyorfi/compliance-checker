import { Link } from "wouter";
import {
  ClipboardList, FileSearch, CheckCircle2, AlertTriangle, XCircle,
  Loader2, Clock, ArrowRight, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useActiveProject } from "@/contexts/ProjectContext";
import { ProjectScopeBanner } from "@/components/ProjectScopeBanner";
import type { Analysis, ComplianceResult, ComplianceStatus } from "../../../drizzle/schema";

const statusLabels: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed: { label: "Kész", color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  processing: { label: "Folyamatban", color: "#7CA9D3", bg: "#EBF3FA", icon: Loader2 },
  pending: { label: "Várakozik", color: "#9ca3af", bg: "#f9fafb", icon: Clock },
  error: { label: "Hiba", color: "#dc2626", bg: "#fef2f2", icon: XCircle },
};

function getResultCounts(results: ComplianceResult[] | null | undefined) {
  if (!results || results.length === 0) return null;
  const pass = results.filter((r) => r.status === "megfelel").length;
  const uncertain = results.filter((r) => r.status === "bizonytalan").length;
  const fail = results.filter((r) => r.status === "nem_felel_meg").length;
  return { pass, uncertain, fail, total: results.length };
}

function AnalysisCard({ analysis }: { analysis: Analysis }) {
  const cfg = statusLabels[analysis.status] || statusLabels.pending;
  const Icon = cfg.icon;
  const counts = getResultCounts(analysis.results as ComplianceResult[] | null);

  return (
    <Link href={`/result/${analysis.id}`}>
      <div
        className="rounded-lg border bg-white p-5 hover:shadow-md transition-all cursor-pointer group"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                <Icon
                  size={11}
                  className={analysis.status === "processing" ? "animate-spin" : ""}
                />
                {cfg.label}
              </span>
            </div>
            <h3 className="font-semibold text-sm text-gray-900 truncate mb-1 group-hover:text-[#7CA9D3] transition-colors">
              {analysis.title}
            </h3>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              {(analysis.planDocuments as any)?.[0]?.name && (
                <span className="flex items-center gap-1">
                  <ClipboardList size={11} />
                  {(analysis.planDocuments as any)?.[0]?.name}
                </span>
              )}
              <span>
                {new Date(analysis.createdAt).toLocaleDateString("hu-HU", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-300 group-hover:text-[#7CA9D3] transition-colors flex-shrink-0 mt-1" />
        </div>

        {/* Result mini-stats */}
        {counts && (
          <div className="flex gap-3 mt-4 pt-4 border-t" style={{ borderColor: "#f3f4f6" }}>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 size={12} className="text-green-600" />
              <span className="font-semibold text-green-700">{counts.pass}</span>
              <span className="text-gray-400">megfelel</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle size={12} className="text-yellow-600" />
              <span className="font-semibold text-yellow-700">{counts.uncertain}</span>
              <span className="text-gray-400">bizonytalan</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle size={12} className="text-red-600" />
              <span className="font-semibold text-red-700">{counts.fail}</span>
              <span className="text-gray-400">nem felel meg</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ReportsPage() {
  const { activeProjectId } = useActiveProject();
  const { data: analyses, isLoading } = trpc.compliance.listAnalyses.useQuery(
    activeProjectId ? { projectId: activeProjectId } : undefined,
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
                  <ClipboardList size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>
                  Riportok
                </h1>
              </div>
              <p className="text-gray-500 text-sm ml-11">
                Korábbi megfelelőség-ellenőrzések és eredmények
              </p>
            </div>
            <Link href="/search">
              <Button
                size="sm"
                className="gap-2 text-white font-medium"
                style={{ backgroundColor: "#7CA9D3" }}
              >
                <Plus size={15} />
                Új keresés
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-4">
        <ProjectScopeBanner describe={(name) => `Az alábbi riportok csak a(z) ${name} projekt elemzéseihez tartoznak.`} />
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin" style={{ color: "#7CA9D3" }} />
          </div>
        ) : !analyses || analyses.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: "#EBF3FA" }}
            >
              <FileSearch size={28} style={{ color: "#7CA9D3" }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#161718" }}>
              Még nincs elemzés
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Indítsa el az első megfelelőség-ellenőrzést a dokumentumai feltöltésével.
            </p>
            <Link href="/search">
              <Button className="gap-2 text-white" style={{ backgroundColor: "#7CA9D3" }}>
                <Plus size={15} />
                Keresés indítása
              </Button>
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="text-xs text-gray-400 mb-4">
              {analyses.length} elemzés
            </div>
            <div className="space-y-3">
              {analyses.map((a) => (
                <AnalysisCard key={a.id} analysis={a} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
