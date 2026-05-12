/**
 * Admin Dashboard — V11.9 (d)
 *
 * Csak role: "admin" user-ek érik el. Workspace-szintű áttekintés és karbantartás:
 * - System stats widget (user / projekt / analízis / KB / search / audit darabszámok + kuka)
 * - User-lista szerepkör-váltási dropdown-nal
 * - Minden projekt listája (függetlenül a tagságtól) + owner-info
 * - "Kuka kiürítése" (admin.emptyTrash)
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  ShieldAlert, Users, FolderOpen, ClipboardList, Database,
  BookOpen, Search, Shield, Trash2, Loader2, AlertCircle,
  Crown, Eye, ShieldCheck, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

type UserRole = "user" | "admin" | "reviewer";

const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof Crown; color: string; bg: string }> = {
  admin:    { label: "Admin",   icon: Crown,        color: "#a16207", bg: "#fef9c3" },
  user:     { label: "Felhasználó", icon: ShieldCheck, color: "#1d4ed8", bg: "#eff6ff" },
  reviewer: { label: "Lektor",  icon: Eye,         color: "#6b7280", bg: "#f3f4f6" },
};

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-surface p-4 flex items-start gap-3" style={{ borderColor: "var(--line)" }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-strong leading-tight">{value.toLocaleString("hu-HU")}</p>
      </div>
    </div>
  );
}

function UsersSection() {
  const [search, setSearch] = useState("");
  const usersQuery = trpc.admin.listUsers.useQuery({ search: search || undefined });
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();

  const changeRoleMut = trpc.admin.changeUserRole.useMutation({
    onSuccess: () => {
      toast.success("Szerepkör frissítve");
      utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const rows = usersQuery.data ?? [];

  return (
    <section className="rounded-xl border bg-surface" style={{ borderColor: "var(--line)" }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-text-faint" />
          <h2 className="font-semibold text-text-strong text-sm">Felhasználók</h2>
          {rows.length > 0 && (
            <Badge className="bg-page-bg-subtle text-text-muted border-0 text-xs px-2 py-0.5">
              {rows.length}
            </Badge>
          )}
        </div>
        <Input
          placeholder="Keresés név / e-mail alapján..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs w-64"
        />
      </div>

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-10 text-text-faint text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Betöltés…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-faint">Nincs felhasználó.</div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--line-subtle)" }}>
          {rows.map((u) => {
            const role = u.role as UserRole;
            const cfg = ROLE_CONFIG[role];
            const Icon = cfg.icon;
            const isMe = meQuery.data?.id === u.id;
            return (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3" style={{ borderColor: "var(--line-subtle)" }}>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <Icon size={15} style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-strong truncate">
                    {u.name || u.email || `User #${u.id}`}
                    {isMe && <span className="text-xs text-text-faint ml-2">(te)</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate">{u.email}</p>
                </div>
                <span className="text-xs text-text-faint hidden sm:inline">
                  Belépett: {formatDate(u.lastSignedIn)}
                </span>
                <Select
                  value={role}
                  onValueChange={(v) => changeRoleMut.mutate({ userId: u.id, role: v as UserRole })}
                  disabled={changeRoleMut.isPending}
                >
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_CONFIG) as Array<[UserRole, typeof ROLE_CONFIG[UserRole]]>).map(([key, c]) => (
                      <SelectItem key={key} value={key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectsSection() {
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const q = trpc.admin.listAllProjects.useQuery({ includeDeleted });
  const rows = q.data ?? [];

  return (
    <section className="rounded-xl border bg-surface" style={{ borderColor: "var(--line)" }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-text-faint" />
          <h2 className="font-semibold text-text-strong text-sm">Minden projekt</h2>
          {rows.length > 0 && (
            <Badge className="bg-page-bg-subtle text-text-muted border-0 text-xs px-2 py-0.5">
              {rows.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setIncludeDeleted((v) => !v)}
        >
          {includeDeleted ? "Csak aktívak" : "Archivált is"}
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-10 text-text-faint text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Betöltés…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-faint">Nincs projekt.</div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--line-subtle)" }}>
          {rows.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <div className="px-5 py-3 flex items-center gap-3 hover:bg-page-bg-subtle transition-colors cursor-pointer">
                <FolderOpen size={16} style={{ color: "#7CA9D3" }} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-strong truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">
                    {p.ownerName ?? p.ownerEmail ?? `User #${p.ownerId}`} &middot; {p.memberCount} tag
                  </p>
                </div>
                <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0 flex-shrink-0" style={{
                  backgroundColor: p.status === "active" ? "#f0fdf4" : p.status === "archived" ? "#f3f4f6" : "#fef2f2",
                  color: p.status === "active" ? "#059669" : p.status === "archived" ? "#6b7280" : "#dc2626",
                }}>
                  {p.status === "active" ? "Aktív" : p.status === "archived" ? "Archivált" : "Törölt"}
                </Badge>
                <span className="text-xs text-text-faint flex items-center gap-1 flex-shrink-0">
                  <Calendar size={9} />
                  {formatDate(p.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TrashSection({ kbTrash, regTrash }: { kbTrash: number; regTrash: number }) {
  const utils = trpc.useUtils();
  const emptyMut = trpc.admin.emptyTrash.useMutation({
    onSuccess: (data) => {
      toast.success(`Kuka kiürítve — ${data.kbDeleted} KB-doc + ${data.regDeleted} forrás véglegesen törölve`);
      utils.admin.stats.invalidate();
      utils.knowledgeBase.list.invalidate();
      utils.regulationSources.list.invalidate();
    },
    onError: (err) => toast.error(`Kuka kiürítése sikertelen: ${err.message}`),
  });

  const total = kbTrash + regTrash;

  return (
    <section className="rounded-xl border bg-surface p-5" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-text-strong text-sm">Kuka kiürítése</h3>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            A soft-delete-elt jogszabályok és Tudástár-dokumentumok végleges törlése. Ez nem visszavonható.
            Jelenleg <strong>{kbTrash}</strong> Tudástár-dokumentum és <strong>{regTrash}</strong> jogszabály-forrás vár véglegesítésre.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 mt-3 border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm(`VÉGLEGESEN törölöd a kukából a ${total} elemet? Ez nem visszavonható.`)) {
                emptyMut.mutate();
              }
            }}
            disabled={emptyMut.isPending || total === 0}
          >
            {emptyMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Kuka kiürítése {total > 0 ? `(${total})` : ""}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const statsQuery = trpc.admin.stats.useQuery();
  const isForbidden = statsQuery.error?.data?.code === "FORBIDDEN";
  const isUnauthed = statsQuery.error?.data?.code === "UNAUTHORIZED";

  if (isForbidden || isUnauthed) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 container py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <ShieldAlert size={26} className="text-red-600" />
          </div>
          <p className="font-semibold text-text-strong">Hozzáférés megtagadva</p>
          <p className="text-sm text-text-muted text-center max-w-md">
            Ez az oldal csak admin szerepkörű felhasználóknak elérhető.
            {isUnauthed && " Jelentkezz be a Manus OAuth-fiókoddal."}
          </p>
        </main>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#a16207" }}>
              <Shield size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Admin dashboard</h1>
          </div>
          <p className="text-text-muted text-sm ml-11">
            Workspace-szintű áttekintés és karbantartási műveletek.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-6">
        {/* Stats */}
        {statsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-text-faint">
            <Loader2 size={20} className="animate-spin mr-2" /> Statisztikák betöltése…
          </div>
        ) : !stats ? (
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-700 mt-0.5" />
            <p className="text-sm text-amber-900">Adatbázis nem elérhető.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Felhasználó" value={stats.users} icon={Users} accent="#7CA9D3" />
              <StatCard label="Aktív projekt" value={stats.activeProjects} icon={FolderOpen} accent="#a16207" />
              <StatCard label="Elemzés" value={stats.analyses} icon={ClipboardList} accent="#059669" />
              <StatCard label="Tudástár" value={stats.knowledgeBaseDocs} icon={Database} accent="#1d4ed8" />
              <StatCard label="Jogszabály" value={stats.regulationSources} icon={BookOpen} accent="#7c3aed" />
              <StatCard label="Keresés" value={stats.searchQueries} icon={Search} accent="#0891b2" />
              <StatCard label="Audit-esemény" value={stats.auditEvents} icon={Shield} accent="#dc2626" />
              <StatCard label="Kukában" value={stats.trash.kb + stats.trash.regulations} icon={Trash2} accent="#92400e" />
            </div>
            <TrashSection kbTrash={stats.trash.kb} regTrash={stats.trash.regulations} />
          </>
        )}

        <UsersSection />
        <ProjectsSection />
      </main>
    </div>
  );
}
