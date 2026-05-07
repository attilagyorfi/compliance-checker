/**
 * Project detail oldal — V10.A2
 * Egy adott projekt részletei + tabok (elemzések, Tudástár, keresések, tagok).
 * A2 állapotban a tabok placeholder-tartalmat mutatnak; A3-ban kerülnek bekötésre
 * a tényleges per-projekt adatok, A4-ben pedig a Tagok-tab kap RBAC funkciót.
 */

import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  FolderOpen, ArrowLeft, Loader2, AlertTriangle,
  ClipboardList, Database, Search, Users, Settings,
  FileText, Calendar, Inbox, UserPlus, Trash2, Crown, ShieldCheck, Eye,
  Download, ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type MemberRole = "owner" | "member" | "reviewer";

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; color: string; bg: string }> = {
  owner:    { label: "Tulajdonos", icon: Crown,        color: "#a16207", bg: "#fef9c3" },
  member:   { label: "Tag",         icon: ShieldCheck, color: "#1d4ed8", bg: "#eff6ff" },
  reviewer: { label: "Lektor",      icon: Eye,         color: "#6b7280", bg: "#f3f4f6" },
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ANALYSIS_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Várakozik",   color: "#6b7280", bg: "#f3f4f6" },
  processing: { label: "Folyamatban", color: "#1d4ed8", bg: "#eff6ff" },
  completed:  { label: "Kész",        color: "#059669", bg: "#f0fdf4" },
  error:      { label: "Hiba",        color: "#dc2626", bg: "#fef2f2" },
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: "Magas",      color: "#059669", bg: "#f0fdf4" },
  medium: { label: "Közepes",    color: "#d97706", bg: "#fffbeb" },
  low:    { label: "Alacsony",   color: "#dc2626", bg: "#fef2f2" },
};

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

function PlaceholderTab({ icon: Icon, title, message }: {
  icon: typeof ClipboardList;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-12 flex flex-col items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
      <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
        <Icon size={26} className="text-gray-300" />
      </div>
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 text-center max-w-md">{message}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: {
  icon: typeof Inbox;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-12 flex flex-col items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
      <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
        <Icon size={26} className="text-gray-300" />
      </div>
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 text-center max-w-md">{message}</p>
    </div>
  );
}

function LoadingTab() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 className="animate-spin mr-2" size={18} />
      Betöltés…
    </div>
  );
}

function AnalysesTab({ projectId }: { projectId: number }) {
  const q = trpc.compliance.listAnalyses.useQuery({ projectId });
  if (q.isLoading) return <LoadingTab />;
  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Még nincs elemzés ebben a projektben"
        message="Új elemzés indításakor a /analysis oldalon válaszd ki ezt a projektet, hogy a kapcsolódó találatok itt jelenjenek meg."
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const sCfg = ANALYSIS_STATUS_LABELS[a.status] ?? ANALYSIS_STATUS_LABELS.pending;
        return (
          <Link
            key={a.id}
            href={`/result/${a.id}`}
            className="block rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate">{a.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: sCfg.bg, color: sCfg.color }}>
                    {sCfg.label}
                  </Badge>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDate(a.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function KnowledgeTab({ projectId }: { projectId: number }) {
  const q = trpc.knowledgeBase.list.useQuery({ projectId });
  if (q.isLoading) return <LoadingTab />;
  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nincs Tudástár-dokumentum a projektben"
        message="A Tudástár oldalon töltsd fel a projekt-specifikus dokumentumokat — jelöld meg a feltöltéskor a projektet, hogy itt jelenjenek meg."
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((d) => (
        <div key={d.id} className="rounded-xl border bg-white p-4" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-start gap-3">
            <FileText size={20} className="text-gray-400 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm truncate">{d.name || d.originalName}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-gray-400 uppercase font-medium">{d.fileType}</span>
                <span className="text-xs text-gray-400">{formatBytes(d.fileSize)}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDate(d.uploadedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddMemberDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const utils = trpc.useUtils();

  const addMut = trpc.projectMembers.add.useMutation({
    onSuccess: () => {
      toast.success("Tag hozzáadva");
      setEmail("");
      setRole("member");
      setOpen(false);
      utils.projectMembers.list.invalidate({ projectId });
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" style={{ backgroundColor: "#7CA9D3" }}>
          <UserPlus size={14} /> Tag hozzáadása
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag hozzáadása a projekthez</DialogTitle>
          <DialogDescription>
            Csak már regisztrált felhasználók adhatók hozzá az e-mail címük alapján.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="member-email">E-mail cím *</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kollega@pelda.hu"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-role">Szerepkör</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger id="member-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ROLE_CONFIG) as Array<[MemberRole, typeof ROLE_CONFIG[MemberRole]]>).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Mégse</Button>
          <Button
            onClick={() => {
              if (!email.trim()) {
                toast.error("Az e-mail cím kötelező.");
                return;
              }
              addMut.mutate({ projectId, email: email.trim(), role });
            }}
            disabled={addMut.isPending}
            style={{ backgroundColor: "#7CA9D3" }}
          >
            {addMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Hozzáadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab({ projectId, projectName }: { projectId: number; projectName: string }) {
  const exportMut = trpc.projects.export.useMutation({
    onSuccess: (data) => {
      try {
        const slug = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40) || `project-${projectId}`;
        const date = new Date().toISOString().slice(0, 10);
        const filename = `${slug}-export-${date}.json`;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Export letöltve (${filename})`);
      } catch (err) {
        toast.error(`Letöltési hiba: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    onError: (err) => toast.error(`Export hiba: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Download size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Adatok exportálása</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              JSON formátumban letölti a projekthez tartozó összes adatot: projekt-metaadat, tagok,
              elemzések (eredményekkel együtt), Tudástár-dokumentumok metaadata-ja és kinyert
              szövegek, keresési előzmények. Az S3-on tárolt fájlok bináris tartalma nem kerül bele.
              Az export minden eseménye audit-logba kerül.
            </p>
            <Button
              size="sm"
              className="gap-2 mt-3"
              style={{ backgroundColor: "#7CA9D3" }}
              onClick={() => exportMut.mutate({ id: projectId })}
              disabled={exportMut.isPending}
            >
              {exportMut.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              JSON letöltése
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
            <ListChecks size={20} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">További beállítások</h3>
            <p className="text-xs text-gray-500 mt-1">
              Átnevezés, archiválás, workflow-státusz módosítás és törlés bekötése későbbi körben
              érkezik. Addig a Projektek listán a kontextusmenüből (kuka ikon) tudod törölni.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersTab({ projectId }: { projectId: number }) {
  const meQuery = trpc.auth.me.useQuery();
  const membersQuery = trpc.projectMembers.list.useQuery({ projectId });
  const utils = trpc.useUtils();

  const changeRoleMut = trpc.projectMembers.changeRole.useMutation({
    onSuccess: () => {
      toast.success("Szerepkör frissítve");
      utils.projectMembers.list.invalidate({ projectId });
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const removeMut = trpc.projectMembers.remove.useMutation({
    onSuccess: () => {
      toast.success("Tag eltávolítva");
      utils.projectMembers.list.invalidate({ projectId });
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  if (membersQuery.isLoading) return <LoadingTab />;
  const members = membersQuery.data ?? [];

  const me = meQuery.data;
  const myMembership = me ? members.find((m) => m.userId === me.id) : undefined;
  const isOwner = myMembership?.role === "owner";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {members.length} {members.length === 1 ? "tag" : "tag"}
        </p>
        {isOwner && <AddMemberDialog projectId={projectId} />}
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Még nincs tag a projektben"
          message="A projekt létrehozója automatikusan tulajdonossá válik. Ha itt üres, valószínűleg régi (V10.A4 előtti) projekt — adj hozzá tagokat manuálisan."
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const role = (m.role ?? "member") as MemberRole;
            const cfg = ROLE_CONFIG[role];
            const Icon = cfg.icon;
            const isMe = me?.id === m.userId;
            return (
              <div key={m.id} className="rounded-xl border bg-white p-4" style={{ borderColor: "#e5e7eb" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                    <Icon size={18} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {m.userName || m.userEmail || `User #${m.userId}`}
                      {isMe && <span className="text-xs text-gray-400 ml-2">(te)</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.userEmail}</p>
                  </div>
                  <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </Badge>

                  {isOwner && !isMe && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={role}
                        onValueChange={(v) => changeRoleMut.mutate({ projectId, userId: m.userId, role: v as MemberRole })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROLE_CONFIG) as Array<[MemberRole, typeof ROLE_CONFIG[MemberRole]]>).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm(`Biztosan eltávolítod ${m.userEmail || `User #${m.userId}`}-t a projektből?`)) {
                            removeMut.mutate({ projectId, userId: m.userId });
                          }
                        }}
                        aria-label="Tag eltávolítása"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchesTab({ projectId }: { projectId: number }) {
  const q = trpc.standardsSearch.listHistory.useQuery({ projectId, limit: 50, offset: 0 });
  if (q.isLoading) return <LoadingTab />;
  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nincs keresés a projektben"
        message="A Szabványkereső oldalon végzett keresések projekthez köthetők — a kereséseknél jelöld meg a projektet."
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const cCfg = s.confidence ? CONFIDENCE_LABELS[s.confidence] : null;
        return (
          <div key={s.id} className="rounded-xl border bg-white p-4" style={{ borderColor: "#e5e7eb" }}>
            <p className="font-medium text-gray-900 text-sm line-clamp-2">{s.question}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {cCfg && (
                <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: cCfg.bg, color: cCfg.color }}>
                  {cCfg.label}
                </Badge>
              )}
              <span className="text-xs text-gray-400">{s.searchMode}</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(s.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const isValidId = Number.isFinite(projectId) && projectId > 0;

  const projectQuery = trpc.projects.getById.useQuery(
    { id: projectId },
    { enabled: isValidId },
  );

  if (!isValidId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container py-8">
          <div className="rounded-xl border bg-white p-12 flex flex-col items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
            <AlertTriangle size={32} className="text-amber-500" />
            <p className="font-medium text-gray-700">Érvénytelen projekt-azonosító</p>
            <Link href="/projects">
              <Button variant="outline" className="mt-2">
                <ArrowLeft size={14} className="mr-1" /> Vissza a projektek listához
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (projectQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container py-8 flex items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mr-2" size={20} />
          Projekt betöltése…
        </div>
      </div>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container py-8">
          <div className="rounded-xl border bg-white p-12 flex flex-col items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
            <AlertTriangle size={32} className="text-red-500" />
            <p className="font-medium text-gray-700">
              {projectQuery.error?.message ?? "A projekt nem található."}
            </p>
            <Link href="/projects">
              <Button variant="outline" className="mt-2">
                <ArrowLeft size={14} className="mr-1" /> Vissza a projektek listához
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;
  const dCfg = DISCIPLINE_CONFIG[project.discipline] ?? DISCIPLINE_CONFIG.altalanos;
  const sCfg = STATUS_LABELS[project.status] ?? STATUS_LABELS.active;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container py-8">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Vissza a projektek listához
        </Link>

        <div className="rounded-xl border bg-white p-6 mb-6" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
              <FolderOpen size={24} style={{ color: "#7CA9D3" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-gray-500 mt-1">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: dCfg.bg, color: dCfg.color }}>
                  {dCfg.label}
                </Badge>
                <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: sCfg.bg, color: sCfg.color }}>
                  {sCfg.label}
                </Badge>
                <span className="text-xs text-gray-500">
                  Workflow: {WORKFLOW_LABELS[project.workflowStatus] ?? project.workflowStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="analyses" className="w-full">
          <TabsList className="bg-white border" style={{ borderColor: "#e5e7eb" }}>
            <TabsTrigger value="analyses" className="gap-2">
              <ClipboardList size={14} /> Elemzések
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-2">
              <Database size={14} /> Tudástár
            </TabsTrigger>
            <TabsTrigger value="searches" className="gap-2">
              <Search size={14} /> Keresések
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users size={14} /> Tagok
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings size={14} /> Beállítások
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyses" className="mt-4">
            <AnalysesTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            <KnowledgeTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="searches" className="mt-4">
            <SearchesTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <MembersTab projectId={projectId} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsTab projectId={projectId} projectName={project.name} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
