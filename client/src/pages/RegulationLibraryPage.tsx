import { useState } from "react";
import {
  BookOpen, Plus, Trash2, RefreshCw, ExternalLink, CheckCircle2,
  AlertCircle, Clock, Search, Filter, ChevronDown, X, Loader2,
  FileText, Globe, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";

// ── Constants ──────────────────────────────────────────────────────────────────

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

const SOURCE_TYPE_LABELS: Record<string, { label: string; isFree: boolean; icon: React.ReactNode }> = {
  njt: { label: "NJT (njt.hu)", isFree: true, icon: <Globe size={12} /> },
  netjogtar: { label: "net.jogtar.hu", isFree: true, icon: <Globe size={12} /> },
  eurlex: { label: "EUR-Lex", isFree: true, icon: <Globe size={12} /> },
  url: { label: "Egyéb URL", isFree: true, icon: <Globe size={12} /> },
  mszt: { label: "MSZT Szabványtár", isFree: false, icon: <Lock size={12} /> },
  jogtar: { label: "Jogtár Premium", isFree: false, icon: <Lock size={12} /> },
  epitesijog: { label: "Építésijog.hu", isFree: false, icon: <Lock size={12} /> },
  pdf: { label: "PDF (manuális)", isFree: true, icon: <FileText size={12} /> },
};

// ── Add source dialog ──────────────────────────────────────────────────────────

function AddSourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [discipline, setDiscipline] = useState("altalanos");
  const [sourceType, setSourceType] = useState("njt");
  const [sourceUrl, setSourceUrl] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.regulationSources.create.useMutation({
    onSuccess: () => {
      toast.success("Jogszabály forrás hozzáadva.");
      utils.regulationSources.list.invalidate();
      onClose();
      setName(""); setShortCode(""); setDiscipline("altalanos"); setSourceType("njt"); setSourceUrl("");
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen size={18} style={{ color: "#7CA9D3" }} />
            Új jogszabály forrás hozzáadása
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Jogszabály neve *</Label>
            <Input
              placeholder="pl. OTSZ – 54/2014. (XII. 5.) BM rendelet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-gray-200 focus-visible:ring-[#7CA9D3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Rövid kód</Label>
              <Input
                placeholder="pl. OTSZ_2014"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                className="border-gray-200 focus-visible:ring-[#7CA9D3]"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Szakterület *</Label>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Forrástípus *</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      {v.icon}
                      {v.label}
                      {!v.isFree && <span className="text-xs text-amber-500">(fizetős)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceType !== "pdf" && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Forrás URL</Label>
              <Input
                placeholder="https://njt.hu/jogszabaly/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="border-gray-200 focus-visible:ring-[#7CA9D3]"
              />
              {["mszt", "jogtar", "epitesijog"].includes(sourceType) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Lock size={10} />
                  Ehhez a forráshoz bejelentkezési adatok szükségesek. Állítsa be a Platform-kapcsolatok menüpontban.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button
            onClick={() => createMutation.mutate({ name, shortCode, discipline: discipline as any, sourceType: sourceType as any, sourceUrl })}
            disabled={!name || createMutation.isPending}
            className="text-white gap-2"
            style={{ backgroundColor: "#7CA9D3" }}
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Hozzáadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RegulationLibraryPage() {
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.regulationSources.list.useQuery();

  const fetchContent = trpc.regulationSources.fetchContent.useMutation({
    onSuccess: (data, vars) => {
      setFetchingId(null);
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Tartalom letöltve: ${(data.characterCount / 1000).toFixed(0)}K karakter`);
      }
      utils.regulationSources.list.invalidate();
    },
    onError: (err) => {
      setFetchingId(null);
      toast.error(`Hiba: ${err.message}`);
    },
  });

  const deleteMutation = trpc.regulationSources.delete.useMutation({
    onSuccess: () => {
      setDeletingId(null);
      toast.success("Forrás törölve.");
      utils.regulationSources.list.invalidate();
    },
    onError: (err) => {
      setDeletingId(null);
      toast.error(`Hiba: ${err.message}`);
    },
  });

  const filtered = sources?.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.shortCode?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchDisc = filterDiscipline === "all" || s.discipline === filterDiscipline;
    return matchSearch && matchDisc;
  }) ?? [];

  const disciplines = ["all", ...Array.from(new Set(sources?.map((s) => s.discipline) ?? []))];

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
                  <BookOpen size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Jogszabály könyvtár</h1>
              </div>
              <p className="text-gray-500 text-sm ml-11">
                Kezelje a jogszabályi forrásokat, töltse le azok tartalmát, és kösse össze a fizetős platformokat.
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="gap-2 text-white"
              style={{ backgroundColor: "#7CA9D3" }}
            >
              <Plus size={16} />
              Új forrás
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Keresés a jogszabályok között..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-gray-200 focus-visible:ring-[#7CA9D3]"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {disciplines.map((d) => {
              const color = DISCIPLINE_COLORS[d] ?? "#6b7280";
              const isActive = filterDiscipline === d;
              return (
                <button
                  key={d}
                  onClick={() => setFilterDiscipline(d)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                    isActive ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                  style={isActive ? { backgroundColor: d === "all" ? "#7CA9D3" : color } : {}}
                >
                  {d === "all" ? "Összes" : DISCIPLINE_LABELS[d] ?? d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        {sources && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold" style={{ color: "#161718" }}>{sources.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Összes forrás</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold text-green-600">{sources.filter((s) => s.content).length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Letöltött tartalom</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold text-amber-500">{sources.filter((s) => !s.content).length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Letöltésre vár</div>
            </div>
          </div>
        )}

        {/* Source list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nincs találat</p>
            <p className="text-sm mt-1">Módosítsa a szűrőket, vagy adjon hozzá új forrást.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((source) => {
              const discColor = DISCIPLINE_COLORS[source.discipline] ?? "#6b7280";
              const srcInfo = SOURCE_TYPE_LABELS[source.sourceType];
              const isFetching = fetchingId === source.id;
              const isDeleting = deletingId === source.id;

              return (
                <div
                  key={source.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  {/* Discipline indicator */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: discColor, minHeight: 48 }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900 leading-tight flex-1">{source.name}</h3>
                      {source.shortCode && (
                        <span className="text-xs font-mono text-gray-400 flex-shrink-0">{source.shortCode}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${discColor}15`, color: discColor }}
                      >
                        {DISCIPLINE_LABELS[source.discipline] ?? source.discipline}
                      </span>

                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {srcInfo?.icon}
                        {srcInfo?.label ?? source.sourceType}
                        {srcInfo && !srcInfo.isFree && (
                          <span className="text-amber-500 font-medium">(fizetős)</span>
                        )}
                      </span>

                      {source.content ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 size={11} />
                          Letöltve · {source.contentFetchedAt
                            ? new Date(source.contentFetchedAt).toLocaleDateString("hu-HU")
                            : ""}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <Clock size={11} />
                          Tartalom nem letöltve
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {source.sourceUrl && (
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Megnyitás"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}

                    {source.sourceType !== "pdf" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 border-gray-200"
                        disabled={isFetching}
                        onClick={() => {
                          setFetchingId(source.id);
                          fetchContent.mutate({ id: source.id });
                        }}
                      >
                        {isFetching ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {source.content ? "Frissítés" : "Letöltés"}
                      </Button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Biztosan törli: ${source.name}?`)) {
                          setDeletingId(source.id);
                          deleteMutation.mutate({ id: source.id });
                        }
                      }}
                      disabled={isDeleting}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                      title="Törlés"
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AddSourceDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
