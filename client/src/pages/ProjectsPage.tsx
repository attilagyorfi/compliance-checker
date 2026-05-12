/**
 * Projects oldal — V10.A1
 * Lista a projektekről + új projekt létrehozása + soft-delete.
 * A projekt-szintű erőforrás-csoportosítás (analyses / KB / keresések) az
 * A2-A3 körök feladata.
 */

import { useState } from "react";
import { Link } from "wouter";
import { FolderOpen, Plus, Trash2, Loader2, Calendar, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
          <CreateProjectDialog onCreated={() => utils.projects.list.invalidate()} />
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
