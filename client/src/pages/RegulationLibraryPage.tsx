/**
 * Jogszabályok oldal
 * Megjeleníti a Tudástárba feltöltött dokumentumokat szakterület szerint csoportosítva.
 */

import { useState } from "react";
import {
  BookOpen, FileText, FileSpreadsheet, File, Search, Loader2,
  Tag, Calendar, HardDrive, ChevronDown, ChevronUp, Info, Database
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const DISCIPLINE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  altalanos:    { label: "Általános",         color: "#6b7280", bg: "#f3f4f6" },
  epiteszet:    { label: "Építészet",          color: "#7c3aed", bg: "#f5f3ff" },
  statika:      { label: "Tartószerkezet",     color: "#1d4ed8", bg: "#eff6ff" },
  tuzvedelmi:   { label: "Tűzvédelem",         color: "#dc2626", bg: "#fef2f2" },
  energetika:   { label: "Energetika",         color: "#d97706", bg: "#fffbeb" },
  gepeszet:     { label: "Gépészet",           color: "#059669", bg: "#f0fdf4" },
  villamos:     { label: "Villamos",           color: "#0891b2", bg: "#ecfeff" },
  kozlekedes:   { label: "Közlekedés",         color: "#7c3aed", bg: "#faf5ff" },
  tajepiteszet: { label: "Tájépítészet",       color: "#16a34a", bg: "#f0fdf4" },
  geotechnika:  { label: "Geotechnika",        color: "#92400e", bg: "#fef3c7" },
};

const ALL_DISCIPLINES = ["osszes", ...Object.keys(DISCIPLINE_CONFIG)];
const DISCIPLINE_LABELS: Record<string, string> = {
  osszes: "Összes",
  ...Object.fromEntries(Object.entries(DISCIPLINE_CONFIG).map(([k, v]) => [k, v.label])),
};

function FileTypeIcon({ fileType, size = 16 }: { fileType: string; size?: number }) {
  const ext = fileType.toLowerCase();
  if (ext === "pdf") return <FileText size={size} className="text-red-500" />;
  if (ext === "docx" || ext === "doc") return <FileText size={size} className="text-blue-500" />;
  if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet size={size} className="text-green-600" />;
  return <File size={size} className="text-gray-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferDiscipline(doc: { tags: string | null; name: string; originalName: string }): string {
  const combined = `${doc.tags ?? ""} ${doc.name} ${doc.originalName}`.toLowerCase();
  if (/tűz|tüz|otsz|tűzv|tuzv/.test(combined)) return "tuzvedelmi";
  if (/statik|tartó|szerkezet|acél|beton|vasbeton|eurocode|msz en 199/.test(combined)) return "statika";
  if (/energetik|hő|hőszigetel|tnm|7\/2006/.test(combined)) return "energetika";
  if (/gépész|gépes|fűtés|szellőz|klíma|vízvezeték|csatorna/.test(combined)) return "gepeszet";
  if (/villamos|elektro|villany/.test(combined)) return "villamos";
  if (/közlekedés|út|forgalom|parkoló/.test(combined)) return "kozlekedes";
  if (/táj|kert|zöldfelület|növény/.test(combined)) return "tajepiteszet";
  if (/geotechnik|talaj|alapozás|fúrás/.test(combined)) return "geotechnika";
  if (/építész|tervrajz|alaprajz|homlokzat|metszet|szintalap/.test(combined)) return "epiteszet";
  return "altalanos";
}

function DocumentCard({ doc }: {
  doc: { id: number; name: string; originalName: string; fileType: string; fileSize: number; description: string | null; tags: string | null; uploadedAt: Date };
}) {
  const [expanded, setExpanded] = useState(false);
  const discipline = inferDiscipline(doc);
  const config = DISCIPLINE_CONFIG[discipline] ?? DISCIPLINE_CONFIG.altalanos;
  const tags = doc.tags ? doc.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

  return (
    <div className="rounded-xl border bg-white overflow-hidden hover:shadow-sm transition-shadow" style={{ borderColor: "#e5e7eb" }}>
      <div className="p-4 flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
          <FileTypeIcon fileType={doc.fileType} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{doc.name || doc.originalName}</p>
            <Badge
              className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border-0"
              style={{ backgroundColor: config.bg, color: config.color }}
            >
              {config.label}
            </Badge>
          </div>
          {doc.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <HardDrive size={10} />
              {formatBytes(doc.fileSize)}
            </span>
            <span className="text-xs text-gray-400 uppercase font-medium">{doc.fileType}</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={10} />
              {new Date(doc.uploadedAt).toLocaleDateString("hu-HU")}
            </span>
            {tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 h-5">
                <Tag size={9} className="mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        {doc.description && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {expanded && doc.description && (
        <div className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          <p className="text-sm text-gray-600">{doc.description}</p>
        </div>
      )}
    </div>
  );
}

export default function RegulationLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDiscipline, setActiveDiscipline] = useState("osszes");

  const { data: documents, isLoading } = trpc.knowledgeBase.list.useQuery({ search: searchQuery });

  const filtered = (documents ?? []).filter((doc) => {
    if (activeDiscipline === "osszes") return true;
    return inferDiscipline(doc) === activeDiscipline;
  });

  const counts: Record<string, number> = { osszes: documents?.length ?? 0 };
  for (const doc of documents ?? []) {
    const d = inferDiscipline(doc);
    counts[d] = (counts[d] ?? 0) + 1;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <BookOpen size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Jogszabályok</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            A Tudástárba feltöltött dokumentumok szakterület szerint csoportosítva. A rendszer automatikusan azonosítja a kategóriát.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Keresés a dokumentumokban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm border-gray-200"
            />
          </div>
          <Link href="/knowledge-base">
            <Button variant="outline" className="gap-2 text-sm border-gray-200 h-9">
              <Database size={14} />
              Dokumentum feltöltése
            </Button>
          </Link>
        </div>

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
                  isActive
                    ? "text-white border-transparent"
                    : "text-gray-600 border-gray-200 bg-white hover:border-gray-300"
                }`}
                style={
                  isActive
                    ? { backgroundColor: config?.color ?? "#7CA9D3", borderColor: config?.color ?? "#7CA9D3" }
                    : {}
                }
              >
                {DISCIPLINE_LABELS[d]}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? "opacity-80" : "text-gray-400"}`}>({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "#7CA9D3" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <BookOpen size={22} className="text-gray-300" />
            </div>
            <div>
              <p className="font-medium text-gray-500">
                {(documents?.length ?? 0) === 0
                  ? "Még nincs feltöltött dokumentum"
                  : "Nincs találat ebben a kategóriában"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {(documents?.length ?? 0) === 0
                  ? "Töltse fel dokumentumait a Tudástárban"
                  : "Próbáljon más szűrőt vagy keresési kifejezést"}
              </p>
            </div>
            {(documents?.length ?? 0) === 0 && (
              <Link href="/knowledge-base">
                <Button className="mt-2 gap-2 text-white text-sm" style={{ backgroundColor: "#7CA9D3" }}>
                  <Database size={14} />
                  Ugrás a Tudástárba
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}

        <div className="rounded-xl border bg-blue-50 border-blue-100 p-4 flex items-start gap-3">
          <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Hogyan működik a kategória-felismerés?</p>
            <p className="text-sm text-blue-700 mt-1">
              A rendszer a fájlnév, a leírás és a feltöltéskor megadott címkék alapján automatikusan besorolja a dokumentumot (tűzvédelem, statika, energetika stb.). A pontosabb besoroláshoz adjon meg részletes leírást és releváns címkéket a Tudástárban.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
