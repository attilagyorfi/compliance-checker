import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Upload, FileText, X, Loader2, CheckCircle2, BookOpen,
  ChevronDown, ChevronUp, Info, FileSpreadsheet, Layers, File,
  RefreshCw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.xlsx,.xls,.dwg,.dxf,.ifc,.rtf";
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/acad",
  "image/vnd.dwg",
  "application/octet-stream", // DWG, DXF, IFC
];

const DISCIPLINE_LABELS: Record<string, string> = {
  altalanos: "Általános",
  epiteszet: "Építészet",
  tuzvedelmi: "Tűzvédelem",
  energetika: "Energetika",
  statika: "Statika",
  gepeszet: "Gépészet",
  villamos: "Villamos",
  geotechnika: "Geotechnika",
  kozlekedes: "Közlekedés",
  tajepiteszet: "Tájépítészet",
  egyeb: "Egyéb",
};

const DISCIPLINE_COLORS: Record<string, string> = {
  altalanos: "#6b7280",
  epiteszet: "#7CA9D3",
  tuzvedelmi: "#ef4444",
  energetika: "#f59e0b",
  statika: "#8b5cf6",
  gepeszet: "#06b6d4",
  villamos: "#f97316",
  geotechnika: "#84cc16",
  kozlekedes: "#14b8a6",
  tajepiteszet: "#22c55e",
  egyeb: "#9ca3af",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFileTypeLabel(filename: string): { label: string; color: string; icon: React.ReactNode } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", color: "#ef4444", icon: <FileText size={14} /> };
  if (["docx", "doc"].includes(ext)) return { label: "DOCX", color: "#2563eb", icon: <FileText size={14} /> };
  if (["xlsx", "xls"].includes(ext)) return { label: "XLSX", color: "#16a34a", icon: <FileSpreadsheet size={14} /> };
  if (["dwg", "dxf"].includes(ext)) return { label: ext.toUpperCase(), color: "#7c3aed", icon: <Layers size={14} /> };
  if (ext === "ifc") return { label: "IFC", color: "#0891b2", icon: <Layers size={14} /> };
  return { label: ext.toUpperCase() || "?", color: "#6b7280", icon: <File size={14} /> };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type UploadedFile = {
  file: File;
  name: string;
  discipline?: string;
};

// ── Multi-file drop zone ───────────────────────────────────────────────────────

function MultiDropZone({
  files,
  onFiles,
  onRemove,
  maxFiles = 20,
  label,
  hint,
}: {
  files: UploadedFile[];
  onFiles: (files: File[]) => void;
  onRemove: (idx: number) => void;
  maxFiles?: number;
  label: string;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      onFiles(dropped);
    },
    [onFiles]
  );

  return (
    <div className="space-y-2">
      {files.map((f, i) => {
        const { label: typeLabel, color, icon } = getFileTypeLabel(f.name);
        return (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border bg-white"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-white"
              style={{ backgroundColor: color }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{f.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">{formatFileSize(f.file.size)}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {typeLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => onRemove(i)}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {files.length < maxFiles && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 ${
            dragging ? "border-[#7CA9D3] bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-[#7CA9D3] hover:bg-blue-50/30"
          }`}
          style={{ minHeight: 100 }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length > 0) onFiles(fs);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Upload size={24} className="mb-2" style={{ color: "#7CA9D3" }} />
            <div className="font-medium text-sm text-gray-700 mb-1">{label}</div>
            <div className="text-xs text-gray-400">{hint ?? "Húzza ide a fájlokat, vagy kattintson a tallózáshoz"}</div>
            <div className="text-xs text-gray-300 mt-1">PDF · DOCX · XLSX · DWG · DXF · IFC · RTF</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Regulation library picker ──────────────────────────────────────────────────

function RegulationLibraryPicker({
  selectedIds,
  onToggle,
}: {
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterDiscipline, setFilterDiscipline] = useState<string>("all");
  const { data: sources, isLoading, refetch } = trpc.regulationSources.list.useQuery();
  const utils = trpc.useUtils();
  const refreshStaleMut = trpc.regulationSources.refreshAllStale.useMutation({
    onSuccess: (data) => {
      const parts = [
        `Frissítve: ${data.refreshed}`,
        data.skipped > 0 ? `kihagyva: ${data.skipped} (hiányzó belépő)` : null,
        data.failed > 0 ? `hiba: ${data.failed}` : null,
      ].filter(Boolean).join(", ");
      toast.success(`Elavult források frissítése kész — ${parts}`);
      utils.regulationSources.list.invalidate();
      refetch();
    },
    onError: (err) => toast.error(`Frissítés sikertelen: ${err.message}`),
  });

  const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  function isStale(s: { lastSyncAt: Date | string | null; contentFetchedAt: Date | string | null; content: string | null }) {
    if (!s.content) return false; // never had content — not "stale", just empty
    const last = s.lastSyncAt ?? s.contentFetchedAt;
    if (!last) return true;
    const lastMs = typeof last === "string" ? new Date(last).getTime() : last.getTime();
    return now - lastMs > STALE_THRESHOLD_MS;
  }
  function daysAgo(d: Date | string | null): number | null {
    if (!d) return null;
    const ms = typeof d === "string" ? new Date(d).getTime() : d.getTime();
    return Math.floor((now - ms) / (24 * 60 * 60 * 1000));
  }
  const staleCount = (sources ?? []).filter(isStale).length;

  const filtered = sources?.filter(
    (s) => filterDiscipline === "all" || s.discipline === filterDiscipline
  ) ?? [];

  const disciplines = ["all", ...Array.from(new Set(sources?.map((s) => s.discipline) ?? []))];

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: "#EBF3FA" }}>
            <BookOpen size={14} style={{ color: "#7CA9D3" }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Jogszabály könyvtárból</div>
            <div className="text-xs text-gray-400">
              {selectedIds.length > 0 ? `${selectedIds.length} jogszabály kiválasztva` : "Válasszon a mentett jogszabályokból"}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: "#e5e7eb" }}>
          {/* Stale warning + bulk refresh */}
          {staleCount > 0 && (
            <div className="px-3 py-2 border-b flex items-center justify-between gap-2 bg-amber-50" style={{ borderColor: "#fde68a" }}>
              <div className="flex items-center gap-2 text-xs text-amber-800">
                <AlertTriangle size={12} />
                {staleCount === 1
                  ? "1 forrás 30+ napja nem volt frissítve."
                  : `${staleCount} forrás 30+ napja nem volt frissítve.`}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-amber-300 text-amber-800"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshStaleMut.mutate({ olderThanDays: 30 });
                }}
                disabled={refreshStaleMut.isPending}
              >
                {refreshStaleMut.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <RefreshCw size={11} />
                )}
                Mind frissítése
              </Button>
            </div>
          )}

          {/* Discipline filter */}
          <div className="p-3 border-b flex gap-2 flex-wrap" style={{ borderColor: "#e5e7eb" }}>
            {disciplines.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDiscipline(d)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filterDiscipline === d
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={filterDiscipline === d ? { backgroundColor: "#7CA9D3" } : {}}
              >
                {d === "all" ? "Összes" : DISCIPLINE_LABELS[d] ?? d}
              </button>
            ))}
          </div>

          {/* Source list */}
          <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: "#f3f4f6" }}>
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">Nincs jogszabály ebben a kategóriában.</div>
            ) : (
              filtered.map((source) => {
                const isSelected = selectedIds.includes(source.id);
                const discColor = DISCIPLINE_COLORS[source.discipline] ?? "#6b7280";
                return (
                  <label
                    key={source.id}
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(source.id)}
                      className="mt-0.5 rounded"
                      style={{ accentColor: "#7CA9D3" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 leading-tight">{source.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: `${discColor}15`, color: discColor }}
                        >
                          {DISCIPLINE_LABELS[source.discipline] ?? source.discipline}
                        </span>
                        <span className="text-xs text-gray-400 uppercase">{source.sourceType}</span>
                        {source.content && !isStale(source) && (
                          <span className="text-xs text-green-600 flex items-center gap-0.5">
                            <CheckCircle2 size={10} />
                            Letöltve
                          </span>
                        )}
                        {source.content && isStale(source) && (
                          <span
                            className="text-xs text-amber-700 flex items-center gap-0.5"
                            title={
                              source.lastSyncAt || source.contentFetchedAt
                                ? `Utolsó frissítés: ${daysAgo(source.lastSyncAt ?? source.contentFetchedAt)} napja`
                                : "Soha nem lett frissítve"
                            }
                          >
                            <AlertTriangle size={10} />
                            {(() => {
                              const d = daysAgo(source.lastSyncAt ?? source.contentFetchedAt);
                              return d != null ? `Elavult (${d} napja)` : "Elavult";
                            })()}
                          </span>
                        )}
                        {!source.content && ["mszt", "jogtar", "epitesijog"].includes(source.sourceType) && (
                          <span className="text-xs text-amber-500 flex items-center gap-0.5">
                            <Info size={10} />
                            Bejelentkezés szükséges
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [planFiles, setPlanFiles] = useState<UploadedFile[]>([]);
  const [regulationFiles, setRegulationFiles] = useState<UploadedFile[]>([]);
  const [selectedRegSourceIds, setSelectedRegSourceIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startAnalysis = trpc.compliance.startAnalysis.useMutation({
    onSuccess: (data) => {
      toast.success("Elemzés elindítva!");
      navigate(`/result/${data.analysisId}`);
    },
    onError: (err) => {
      toast.error(`Hiba: ${err.message}`);
      setIsSubmitting(false);
    },
  });

  const addPlanFiles = (files: File[]) => {
    const remaining = 20 - planFiles.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) toast.warning(`Maximum 20 tervdokumentum tölthető fel. ${files.length - remaining} fájl kihagyva.`);
    setPlanFiles((prev) => [...prev, ...toAdd.map((f) => ({ file: f, name: f.name }))]);
  };

  const addRegulationFiles = (files: File[]) => {
    const remaining = 10 - regulationFiles.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) toast.warning(`Maximum 10 jogszabály tölthető fel. ${files.length - remaining} fájl kihagyva.`);
    setRegulationFiles((prev) => [...prev, ...toAdd.map((f) => ({ file: f, name: f.name }))]);
  };

  const toggleRegSource = (id: number) => {
    setSelectedRegSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const hasRegulations = regulationFiles.length > 0 || selectedRegSourceIds.length > 0;

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Adjon meg egy elemzési nevet."); return; }
    if (planFiles.length === 0) { toast.error("Töltse fel legalább egy tervdokumentumot."); return; }
    if (!hasRegulations) { toast.error("Adjon meg legalább egy jogszabályt (feltöltve vagy könyvtárból)."); return; }

    setIsSubmitting(true);
    try {
      // Use first plan file as primary (legacy API compat), pass all as planDocuments
      const primaryPlan = planFiles[0]!;
      const planBase64 = await fileToBase64(primaryPlan.file);

      // Build regulation documents list
      const regBase64s = await Promise.all(regulationFiles.map((f) => fileToBase64(f.file)));
      const regulationDocuments = regulationFiles.map((f, i) => ({
        name: f.name,
        base64: regBase64s[i] ?? "",
      }));

      // If library sources are selected, add placeholder entries
      // (the backend will fetch their content from the DB)
      // For now, pass them as empty base64 with special names
      const libDocs = selectedRegSourceIds.map((id) => ({
        name: `__lib_source_${id}__`,
        base64: "",
        sourceId: id,
      }));

      await startAnalysis.mutateAsync({
        title: title.trim(),
        planDocument: { key: "", name: primaryPlan.name, base64: planBase64 },
        regulationDocuments: [...regulationDocuments, ...libDocs],
        planDocumentNames: planFiles.map((f) => f.name),
        regulationSourceIds: selectedRegSourceIds,
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Upload size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>
              Új elemzés indítása
            </h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Töltse fel a tervdokumentumokat és adja meg a vonatkozó jogszabályokat az AI alapú megfelelőség-ellenőrzéshez.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-10">
        <div className="max-w-2xl mx-auto">

          {/* Step 1: Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#7CA9D3" }}>1</span>
              <h2 className="font-semibold text-base" style={{ color: "#161718" }}>Elemzés neve</h2>
            </div>
            <Input
              placeholder="pl. Ipari csarnok – tűzvédelmi megfelelőség 2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-gray-200 focus-visible:ring-[#7CA9D3]"
            />
          </div>

          {/* Step 2: Plan documents (multi) */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#7CA9D3" }}>2</span>
              <div>
                <h2 className="font-semibold text-base" style={{ color: "#161718" }}>Tervdokumentumok</h2>
                <p className="text-xs text-gray-400 mt-0.5">Több fájl is feltölthető (max. 20) – PDF, DOCX, XLSX, DWG, DXF, IFC</p>
              </div>
            </div>
            <MultiDropZone
              files={planFiles}
              onFiles={addPlanFiles}
              onRemove={(i) => setPlanFiles((prev) => prev.filter((_, idx) => idx !== i))}
              maxFiles={20}
              label="Tervdokumentumok feltöltése"
              hint="Húzza ide a fájlokat, vagy kattintson a tallózáshoz · Több fájl egyszerre is kiválasztható"
            />
            {planFiles.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">{planFiles.length} fájl kiválasztva</p>
            )}
          </div>

          {/* Step 3: Regulations */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#7CA9D3" }}>3</span>
              <div>
                <h2 className="font-semibold text-base" style={{ color: "#161718" }}>Jogszabályok / Szabványok</h2>
                <p className="text-xs text-gray-400 mt-0.5">Töltse fel manuálisan, vagy válasszon a jogszabály könyvtárból</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Manual upload */}
              <MultiDropZone
                files={regulationFiles}
                onFiles={addRegulationFiles}
                onRemove={(i) => setRegulationFiles((prev) => prev.filter((_, idx) => idx !== i))}
                maxFiles={10}
                label="Jogszabály / Szabvány feltöltése"
                hint="PDF, DOCX, XLSX formátumban"
              />

              {/* Library picker */}
              <RegulationLibraryPicker
                selectedIds={selectedRegSourceIds}
                onToggle={toggleRegSource}
              />
            </div>

            {hasRegulations && (
              <div className="mt-3 flex flex-wrap gap-2">
                {regulationFiles.map((f, i) => (
                  <Badge key={`file-${i}`} variant="secondary" className="text-xs gap-1">
                    <FileText size={10} />
                    {f.name.length > 30 ? f.name.slice(0, 30) + "…" : f.name}
                  </Badge>
                ))}
                {selectedRegSourceIds.length > 0 && (
                  <Badge variant="outline" className="text-xs gap-1" style={{ borderColor: "#7CA9D3", color: "#7CA9D3" }}>
                    <BookOpen size={10} />
                    {selectedRegSourceIds.length} könyvtári forrás
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="border-t pt-8" style={{ borderColor: "#e5e7eb" }}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title || planFiles.length === 0 || !hasRegulations}
              size="lg"
              className="w-full gap-2 font-semibold text-white"
              style={{ backgroundColor: "#7CA9D3" }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Elemzés folyamatban...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Elemzés indítása
                </>
              )}
            </Button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Az elemzés általában 30–90 másodpercet vesz igénybe a dokumentumok számától függően.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
