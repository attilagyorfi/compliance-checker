/**
 * Projects oldal — V10.A1
 * Lista a projektekről + új projekt létrehozása + soft-delete.
 * A projekt-szintű erőforrás-csoportosítás (analyses / KB / keresések) az
 * A2-A3 körök feladata.
 */

import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { FolderOpen, Plus, Trash2, Loader2, Calendar, Inbox, Upload, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

const DISCIPLINE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  altalanos:    { label: "Általános",     color: "#6b7280", bg: "#f3f4f6" },
  epiteszet:    { label: "Építészet",     color: "#7c3aed", bg: "#f5f3ff" },
  statika:      { label: "Tartószerkezet",color: "#1d4ed8", bg: "#eff6ff" },
  tuzvedelmi:   { label: "Tűzvédelem",    color: "#dc2626", bg: "#fef2f2" },
  energetika:   { label: "Energetika",    color: "#d97706", bg: "#fffbeb" },
  gepeszet:     { label: "Gépészet",      color: "#059669", bg: "#f0fdf4" },
  villamos:     { label: "Villamos",      color: "#0891b2", bg: "#ecfeff" },
  geotechnika:  { label: "Geotechnika",   color: "#92400e", bg: "#fef3c7" },
  kozlekedes:   { label: "Közlekedés",    color: "#7c3aed", bg: "#faf5ff" },
  tajepiteszet: { label: "Tájépítészet",  color: "#16a34a", bg: "#f0fdf4" },
  egyeb:        { label: "Egyéb",         color: "#6b7280", bg: "#f3f4f6" },
};

const WORKFLOW_LABELS: Record<string, string> = {
  uj: "Új",
  elemzes_alatt: "Elemzés alatt",
  ai_eloelenorizve: "AI-előellenőrizve",
  ember_felulvizsgalva: "Felülvizsgálva",
  javitasra_visszakuldve: "Javításra visszaküldve",
  lezart: "Lezárt",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "Aktív",     color: "#059669", bg: "#f0fdf4" },
  archived: { label: "Archivált", color: "#6b7280", bg: "#f3f4f6" },
  deleted:  { label: "Törölt",    color: "#dc2626", bg: "#fef2f2" },
};

// ── Create project dialog ─────────────────────────────────────────────────────

// ── Import project dialog ─────────────────────────────────────────────────────

interface ImportPreview {
  format: string;
  project?: { name?: string; description?: string | null };
  analyses?: unknown[];
  knowledgeBaseDocuments?: unknown[];
  searchQueries?: unknown[];
}

function ImportProjectDialog({ onImported }: { onImported: (newProjectId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [includeAnalyses, setIncludeAnalyses] = useState(true);
  const [includeKnowledgeBase, setIncludeKnowledgeBase] = useState(true);
  const [includeSearchQueries, setIncludeSearchQueries] = useState(false);
  const [nameOverride, setNameOverride] = useState("");

  const reset = () => {
    setParsedData(null);
    setParseError(null);
    setIncludeAnalyses(true);
    setIncludeKnowledgeBase(true);
    setIncludeSearchQueries(false);
    setNameOverride("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importMut = trpc.projects.import.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Projekt importálva — ${data.analysesImported} elemzés, ${data.kbImported} Tudástár-dok, ${data.searchesImported} keresés`,
      );
      reset();
      setOpen(false);
      if (data.projectId) onImported(data.projectId);
      if (data.projectId) navigate(`/projects/${data.projectId}`);
    },
    onError: (err) => toast.error(`Import sikertelen: ${err.message}`),
  });

  const handleFile = async (file: File) => {
    setParsedData(null);
    setParseError(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setParseError("Csak .json fájl fogadható el.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setParseError("A fájl túl nagy (max 50 MB).");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed?.format !== "compliance-checker-project-export-v1") {
        setParseError(`Ismeretlen vagy elavult formátum. Várt: "compliance-checker-project-export-v1", kapott: ${parsed?.format ?? "nincs"}`);
        return;
      }
      if (!parsed?.project?.name) {
        setParseError("A JSON-ban nincs project.name mező.");
        return;
      }
      setParsedData(parsed);
      setNameOverride(parsed.project.name);
    } catch (err) {
      setParseError(`A fájl nem érvényes JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const submit = () => {
    if (!parsedData) return;
    importMut.mutate({
      data: parsedData as never,
      includeAnalyses,
      includeKnowledgeBase,
      includeSearchQueries,
      nameOverride: nameOverride.trim() && nameOverride.trim() !== parsedData.project?.name
        ? nameOverride.trim()
        : undefined,
    });
  };

  const counts = {
    analyses: parsedData?.analyses?.length ?? 0,
    kb: parsedData?.knowledgeBaseDocuments?.length ?? 0,
    searches: parsedData?.searchQueries?.length ?? 0,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload size={16} />
          JSON importálása
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Projekt importálása JSON-ból</DialogTitle>
          <DialogDescription>
            Egy korábbi <code className="text-xs">projects.export</code> JSON-snapshot betöltése új projektként.
            A jelenlegi felhasználó lesz az új tulajdonos. A tagság, a fájl-binárisok és az eredeti azonosítók nem kerülnek vissza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="import-file">JSON fájl</Label>
            <input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#7CA9D3] file:text-white hover:file:bg-[#5a8ab8] file:cursor-pointer"
            />
          </div>

          {parseError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <strong>Hiba:</strong> {parseError}
            </div>
          )}

          {parsedData && (
            <>
              <div className="rounded-lg border bg-page-bg-subtle p-3 space-y-2" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center gap-2 text-xs text-text-default">
                  <FileJson size={13} style={{ color: "#7CA9D3" }} />
                  <span className="font-medium">{parsedData.project?.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <span className="text-text-muted">{counts.analyses} elemzés</span>
                  <span className="text-text-muted">{counts.kb} Tudástár-dok</span>
                  <span className="text-text-muted">{counts.searches} keresés</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="import-name" className="text-xs">Új projekt neve</Label>
                <Input
                  id="import-name"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mit importáljunk?</Label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-text-default cursor-pointer">
                    <Checkbox
                      checked={includeAnalyses}
                      onCheckedChange={(v) => setIncludeAnalyses(v === true)}
                    />
                    Elemzések ({counts.analyses})
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-default cursor-pointer">
                    <Checkbox
                      checked={includeKnowledgeBase}
                      onCheckedChange={(v) => setIncludeKnowledgeBase(v === true)}
                    />
                    Tudástár-dokumentumok ({counts.kb})
                    <span className="text-text-faint">(csak metaadat + kinyert szöveg; S3-fájlok nem)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-default cursor-pointer">
                    <Checkbox
                      checked={includeSearchQueries}
                      onCheckedChange={(v) => setIncludeSearchQueries(v === true)}
                    />
                    Keresési előzmények ({counts.searches})
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Mégse</Button>
          <Button
            onClick={submit}
            disabled={!parsedData || importMut.isPending}
            style={{ backgroundColor: "#7CA9D3" }}
          >
            {importMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
            Import indítása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discipline, setDiscipline] = useState("altalanos");

  const createMut = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Projekt létrehozva");
      setName("");
      setDescription("");
      setDiscipline("altalanos");
      setOpen(false);
      onCreated();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const submit = () => {
    if (!name.trim()) {
      toast.error("A projekt neve kötelező.");
      return;
    }
    createMut.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      discipline: discipline as
        | "altalanos" | "epiteszet" | "tuzvedelmi" | "energetika"
        | "statika" | "gepeszet" | "villamos" | "geotechnika"
        | "kozlekedes" | "tajepiteszet" | "egyeb",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" style={{ backgroundColor: "#7CA9D3" }}>
          <Plus size={16} />
          Új projekt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Új projekt létrehozása</DialogTitle>
          <DialogDescription>
            A projektek alá később elemzések, Tudástár-dokumentumok és keresések rendelhetők.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Projekt neve *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Belváros 12. – Társasház átépítés"
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-discipline">Szakterület</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger id="project-discipline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISCIPLINE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Leírás (opcionális)</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rövid összefoglaló a projektről…"
              rows={3}
              maxLength={10_000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Mégse</Button>
          <Button
            onClick={submit}
            disabled={createMut.isPending}
            style={{ backgroundColor: "#7CA9D3" }}
          >
            {createMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "archived" | "deleted";
  workflowStatus: "uj" | "elemzes_alatt" | "ai_eloelenorizve" | "ember_felulvizsgalva" | "javitasra_visszakuldve" | "lezart";
  discipline: string;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
}

function ProjectCard({ project, onDelete }: { project: ProjectRow; onDelete: (id: number) => void }) {
  const dCfg = DISCIPLINE_CONFIG[project.discipline] ?? DISCIPLINE_CONFIG.altalanos;
  const sCfg = STATUS_LABELS[project.status] ?? STATUS_LABELS.active;

  return (
    <div className="rounded-xl border bg-surface overflow-hidden hover:shadow-sm transition-shadow group relative" style={{ borderColor: "var(--line)" }}>
      <Link href={`/projects/${project.id}`} className="block p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-page-bg-subtle border border-line-subtle flex items-center justify-center">
            <FolderOpen size={20} style={{ color: "#7CA9D3" }} />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <p className="font-semibold text-text-strong text-sm truncate">{project.name}</p>
            {project.description && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: dCfg.bg, color: dCfg.color }}>
            {dCfg.label}
          </Badge>
          <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: sCfg.bg, color: sCfg.color }}>
            {sCfg.label}
          </Badge>
          <span className="text-xs text-text-muted">
            {WORKFLOW_LABELS[project.workflowStatus] ?? project.workflowStatus}
          </span>
          <span className="text-xs text-text-faint flex items-center gap-1 ml-auto">
            <Calendar size={10} />
            {formatDate(new Date(project.createdAt))}
          </span>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-text-faint hover:text-red-600"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm(`Biztosan törli a "${project.name}" projektet?`)) {
            onDelete(project.id);
          }
        }}
        aria-label="Projekt törlése"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const list = trpc.projects.list.useQuery({ includeDeleted: false });
  const utils = trpc.useUtils();

  const deleteMut = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Projekt törölve");
      utils.projects.list.invalidate();
    },
    onError: (err) => toast.error(`Törlés sikertelen: ${err.message}`),
  });

  const projects = (list.data ?? []) as ProjectRow[];

  return (
    <div className="min-h-screen bg-page-bg-subtle">
      <Header />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-strong flex items-center gap-2">
              <FolderOpen style={{ color: "#7CA9D3" }} />
              Projektek
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {list.isLoading
                ? "Betöltés…"
                : `${projects.length} projekt`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportProjectDialog onImported={() => utils.projects.list.invalidate()} />
            <CreateProjectDialog onCreated={() => utils.projects.list.invalidate()} />
          </div>
        </div>

        {list.isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint">
            <Loader2 className="animate-spin mr-2" size={20} />
            Projektek betöltése…
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border bg-surface p-12 flex flex-col items-center gap-3" style={{ borderColor: "var(--line)" }}>
            <div className="w-14 h-14 rounded-full bg-page-bg-subtle border border-line-subtle flex items-center justify-center">
              <Inbox size={26} className="text-gray-300" />
            </div>
            <p className="font-medium text-text-default">Nincs még projekt</p>
            <p className="text-sm text-text-muted text-center max-w-md">
              Hozzon létre egy projektet, hogy alá szervezhesse az elemzéseket, a Tudástár dokumentumokat és a kereséseket.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={(id) => deleteMut.mutate({ id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
