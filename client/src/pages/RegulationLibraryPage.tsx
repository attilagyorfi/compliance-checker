/**
 * Jogszabályi könyvtár oldal — V11.1
 *
 * Korábbi implementáció (V9-V11.0) félrevezetően a Tudástár-dokumentumokat
 * mutatta a /regulations route alatt. Az új verzió valódi regulation-source
 * manager: listázás, létrehozás, törlés, tartalom-letöltés, embedding-backfill,
 * elavult-figyelmeztetés és bulk-frissítés egy oldalon.
 */

import { useState } from "react";
import {
  BookOpen, Plus, Trash2, RefreshCw, Sparkles, Loader2, Search,
  Calendar, Link as LinkIcon, AlertTriangle, CheckCircle2, Info,
  FileText, Database, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDate, daysAgo } from "@/lib/format";

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

const SOURCE_TYPE_LABELS: Record<string, string> = {
  njt: "NJT",
  netjogtar: "net.jogtar",
  eurlex: "EUR-Lex",
  mszt: "MSZT",
  jogtar: "Jogtár",
  epitesijog: "Építésijog",
  pdf: "PDF",
  url: "URL",
};

const ALL_DISCIPLINES = ["osszes", ...Object.keys(DISCIPLINE_CONFIG)];
const DISCIPLINE_LABELS: Record<string, string> = {
  osszes: "Összes",
  ...Object.fromEntries(Object.entries(DISCIPLINE_CONFIG).map(([k, v]) => [k, v.label])),
};

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function isStale(s: { lastSyncAt: Date | string | null; contentFetchedAt: Date | string | null; content: string | null }): boolean {
  if (!s.content) return false;
  const last = s.lastSyncAt ?? s.contentFetchedAt;
  if (!last) return true;
  const ms = typeof last === "string" ? new Date(last).getTime() : last.getTime();
  return Date.now() - ms > STALE_THRESHOLD_MS;
}

// ── Create dialog ──────────────────────────────────────────────────────────────

function CreateRegulationDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [discipline, setDiscipline] = useState("altalanos");
  const [sourceType, setSourceType] = useState("njt");
  const [sourceUrl, setSourceUrl] = useState("");

  const createMut = trpc.regulationSources.create.useMutation({
    onSuccess: () => {
      toast.success("Jogszabály-forrás létrehozva");
      setName(""); setShortCode(""); setDiscipline("altalanos"); setSourceType("njt"); setSourceUrl("");
      setOpen(false);
      onCreated();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const submit = () => {
    if (!name.trim()) { toast.error("A név kötelező."); return; }
    createMut.mutate({
      name: name.trim(),
      shortCode: shortCode.trim() || undefined,
      discipline: discipline as "altalanos" | "epiteszet" | "tuzvedelmi" | "energetika" | "statika" | "gepeszet" | "villamos" | "geotechnika" | "kozlekedes" | "tajepiteszet" | "egyeb",
      sourceType: sourceType as "njt" | "netjogtar" | "eurlex" | "mszt" | "jogtar" | "epitesijog" | "pdf" | "url",
      sourceUrl: sourceUrl.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" style={{ backgroundColor: "#7CA9D3" }}>
          <Plus size={16} /> Új jogszabály
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Új jogszabály-forrás</DialogTitle>
          <DialogDescription>
            URL alapú jogszabály felvétele. A tartalmat utána a "Letöltés" gombbal lehet importálni.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Név *</Label>
            <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. OTSZ – 54/2014. BM rendelet" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-shortcode">Rövid kód</Label>
              <Input id="reg-shortcode" value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="OTSZ" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-discipline">Szakterület</Label>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger id="reg-discipline"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCIPLINE_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-sourcetype">Forrástípus</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger id="reg-sourcetype"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-url">URL</Label>
            <Input id="reg-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://njt.hu/jogszabaly/2014-54-20-22" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Mégse</Button>
          <Button onClick={submit} disabled={createMut.isPending} style={{ backgroundColor: "#7CA9D3" }}>
            {createMut.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Source row ────────────────────────────────────────────────────────────────

interface SourceRow {
  id: number;
  name: string;
  shortCode: string | null;
  discipline: string;
  sourceType: "njt" | "netjogtar" | "eurlex" | "mszt" | "jogtar" | "epitesijog" | "pdf" | "url";
  sourceUrl: string | null;
  content: string | null;
  contentFetchedAt: Date | string | null;
  lastSyncAt: Date | string | null;
  syncStatus: "ok" | "error" | "pending" | "never" | null;
  lastSyncError: string | null;
  isActive: boolean;
  createdAt: Date | string;
}

function SourceCard({
  source, embeddingCount, onChanged,
}: {
  source: SourceRow;
  embeddingCount: number;
  onChanged: () => void;
}) {
  const dCfg = DISCIPLINE_CONFIG[source.discipline] ?? DISCIPLINE_CONFIG.altalanos;
  const stale = isStale(source);
  const sinceDays = daysAgo(source.lastSyncAt ?? source.contentFetchedAt);

  const fetchMut = trpc.regulationSources.fetchContent.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success(`Tartalom frissítve (${data.characterCount.toLocaleString("hu-HU")} karakter)`);
      else toast.warning(data.warning ?? "Frissítés sikertelen");
      onChanged();
    },
    onError: (err) => toast.error(`Frissítés sikertelen: ${err.message}`),
  });

  const embedMut = trpc.regulationSources.regenerateEmbeddings.useMutation({
    onSuccess: (data) => {
      if (data.embeddingApiUnavailable) toast.warning(data.message ?? "Embedding API nem elérhető");
      else if (data.chunkCount === 0) toast.info(data.message ?? "Nincs tartalom a beágyazáshoz");
      else toast.success(`${data.chunkCount} chunk beágyazva`);
      onChanged();
    },
    onError: (err) => toast.error(`Embeddings sikertelen: ${err.message}`),
  });

  const deleteMut = trpc.regulationSources.delete.useMutation({
    onSuccess: () => {
      toast.success("Jogszabály-forrás törölve");
      onChanged();
    },
    onError: (err) => toast.error(`Törlés sikertelen: ${err.message}`),
  });

  return (
    <div className="rounded-xl border bg-surface overflow-hidden transition-shadow hover:shadow-sm" style={{ borderColor: "var(--line)" }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-page-bg-subtle border border-line-subtle flex items-center justify-center">
            <FileText size={20} style={{ color: "#7CA9D3" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text-strong text-sm truncate">{source.name}</p>
                {source.shortCode && (
                  <p className="text-xs text-text-faint mt-0.5">{source.shortCode}</p>
                )}
              </div>
              <Badge className="text-xs px-2 py-0.5 rounded-full font-medium border-0 flex-shrink-0" style={{ backgroundColor: dCfg.bg, color: dCfg.color }}>
                {dCfg.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-text-muted uppercase font-medium">{SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType}</span>

              {source.content && !stale && (
                <span className="text-xs text-green-700 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50">
                  <CheckCircle2 size={10} /> Letöltve
                </span>
              )}
              {stale && (
                <span
                  className="text-xs text-amber-800 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50"
                  title={sinceDays != null ? `Utolsó frissítés: ${sinceDays} napja` : "Soha nem lett frissítve"}
                >
                  <AlertTriangle size={10} />
                  {sinceDays != null ? `Elavult (${sinceDays} napja)` : "Elavult"}
                </span>
              )}
              {!source.content && ["mszt", "jogtar", "epitesijog"].includes(source.sourceType) && (
                <span className="text-xs text-amber-700 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50">
                  <Info size={10} /> Bejelentkezés szükséges
                </span>
              )}
              {!source.content && !["mszt", "jogtar", "epitesijog"].includes(source.sourceType) && (
                <span className="text-xs text-text-muted flex items-center gap-1 px-2 py-0.5 rounded-full bg-page-bg-subtle">
                  <Info size={10} /> Tartalom nélkül
                </span>
              )}
              {embeddingCount > 0 && (
                <span className="text-xs text-purple-700 flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50">
                  <Sparkles size={10} /> {embeddingCount} chunk
                </span>
              )}
              {source.lastSyncError && (
                <span className="text-xs text-red-700 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50" title={source.lastSyncError}>
                  <AlertTriangle size={10} /> Sync hiba
                </span>
              )}

              <span className="text-xs text-text-faint flex items-center gap-1 ml-auto">
                <Calendar size={10} />
                {formatDate(source.lastSyncAt ?? source.contentFetchedAt ?? source.createdAt)}
              </span>
            </div>

            {source.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1 truncate max-w-full"
              >
                <LinkIcon size={10} />
                <span className="truncate">{source.sourceUrl}</span>
              </a>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--line-subtle)" }}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => fetchMut.mutate({ id: source.id })}
                disabled={fetchMut.isPending || !source.sourceUrl}
                title={!source.sourceUrl ? "Nincs URL — nem tölthető le tartalom" : "Tartalom letöltése"}
              >
                {fetchMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Letöltés
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => embedMut.mutate({ id: source.id })}
                disabled={embedMut.isPending || !source.content}
                title={!source.content ? "Először töltsd le a tartalmat" : "Chunk embeddings generálása szemantikus kereséshez"}
              >
                {embedMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                Embeddings
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5 text-text-faint hover:text-red-600 ml-auto"
                onClick={() => {
                  if (confirm(`Biztosan törlöd a "${source.name}" forrást?`)) {
                    deleteMut.mutate({ id: source.id });
                  }
                }}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Törlés
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegulationLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDiscipline, setActiveDiscipline] = useState("osszes");

  const listQuery = trpc.regulationSources.list.useQuery();
  const countsQuery = trpc.regulationSources.getEmbeddingCounts.useQuery();
  const utils = trpc.useUtils();

  const refreshAllMut = trpc.regulationSources.refreshAllStale.useMutation({
    onSuccess: (data) => {
      const parts = [
        `Frissítve: ${data.refreshed}`,
        data.skipped > 0 ? `kihagyva: ${data.skipped}` : null,
        data.failed > 0 ? `hiba: ${data.failed}` : null,
      ].filter(Boolean).join(", ");
      toast.success(`Bulk frissítés kész — ${parts}`);
      utils.regulationSources.list.invalidate();
      utils.regulationSources.getEmbeddingCounts.invalidate();
    },
    onError: (err) => toast.error(`Bulk frissítés sikertelen: ${err.message}`),
  });

  const sources = (listQuery.data ?? []) as SourceRow[];
  const countMap = new Map((countsQuery.data ?? []).map((c) => [c.sourceId, c.chunkCount]));

  const filtered = sources.filter((s) => {
    if (activeDiscipline !== "osszes" && s.discipline !== activeDiscipline) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.shortCode?.toLowerCase().includes(q) ?? false) ||
      (s.sourceUrl?.toLowerCase().includes(q) ?? false)
    );
  });

  const counts: Record<string, number> = { osszes: sources.length };
  for (const s of sources) counts[s.discipline] = (counts[s.discipline] ?? 0) + 1;

  const staleCount = sources.filter(isStale).length;
  const totalChunks = (countsQuery.data ?? []).reduce((sum, c) => sum + c.chunkCount, 0);

  const onChanged = () => {
    utils.regulationSources.list.invalidate();
    utils.regulationSources.getEmbeddingCounts.invalidate();
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
                  <BookOpen size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Jogszabályi könyvtár</h1>
              </div>
              <p className="text-text-muted text-sm ml-11">
                {sources.length} forrás &middot; {totalChunks > 0 ? `${totalChunks} chunk embedding` : "nincs még embedding"}
                {staleCount > 0 && (
                  <span className="text-amber-700 ml-2">&middot; {staleCount} elavult</span>
                )}
              </p>
            </div>
            <CreateRegulationDialog onCreated={onChanged} />
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-6">
        {/* Search + bulk-refresh row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input
              placeholder="Keresés név, kód, URL alapján..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm border-line"
            />
          </div>
          {staleCount > 0 && (
            <Button
              variant="outline"
              className="gap-2 text-sm border-amber-300 text-amber-800 h-9"
              onClick={() => refreshAllMut.mutate({ olderThanDays: 30 })}
              disabled={refreshAllMut.isPending}
            >
              {refreshAllMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Mind frissítése (30+ nap)
            </Button>
          )}
        </div>

        {/* Discipline filter */}
        <div className="flex flex-wrap gap-2">
          {ALL_DISCIPLINES.map((d) => {
            const count = counts[d] ?? 0;
            const isActive = activeDiscipline === d;
            const config = DISCIPLINE_CONFIG[d];
            return (
              <button
                key={d}
                onClick={() => setActiveDiscipline(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive ? "text-white border-transparent" : "text-text-default border-line bg-surface hover:border-gray-300"
                }`}
                style={isActive ? { backgroundColor: config?.color ?? "#7CA9D3", borderColor: config?.color ?? "#7CA9D3" } : {}}
              >
                {DISCIPLINE_LABELS[d]} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint">
            <Loader2 size={20} className="animate-spin mr-2" /> Betöltés…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-surface p-12 flex flex-col items-center gap-3" style={{ borderColor: "var(--line)" }}>
            <Database size={26} className="text-gray-300" />
            <p className="font-medium text-text-default">
              {sources.length === 0 ? "Még nincs jogszabály-forrás" : "Nincs ide illő találat"}
            </p>
            <p className="text-sm text-text-muted text-center max-w-md">
              {sources.length === 0
                ? "Az 'Új jogszabály' gombbal vehetsz fel URL alapú forrásokat (NJT, net.jogtar, MSZT stb.)."
                : "Próbáld ki más szakterületre kapcsolva, vagy törölj a kereső szövegéből."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <SourceCard key={s.id} source={s} embeddingCount={countMap.get(s.id) ?? 0} onChanged={onChanged} />
            ))}
          </div>
        )}

        {/* Footer hint about embeddings + semantic search */}
        {sources.length > 0 && totalChunks === 0 && (
          <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 p-4 flex items-start gap-3">
            <Cpu size={18} className="text-purple-700 mt-0.5" />
            <div className="text-sm text-purple-900">
              <p className="font-medium">Szemantikus keresés inaktív</p>
              <p className="text-xs text-purple-700 mt-1">
                Egy forráshoz sincs még chunk-embedding generálva. A szemantikus keresés a Szabványkereső
                <code className="mx-1 px-1 py-0.5 rounded bg-purple-100">internal</code>/
                <code className="mx-1 px-1 py-0.5 rounded bg-purple-100">combined</code>
                módjaiban akkor aktiválódik, ha legalább néhány forrásnak van embeddingje.
                Kattints a kártyán az <strong>Embeddings</strong> gombra a generáláshoz (a forrásnak előbb tartalmat kell letöltened).
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
