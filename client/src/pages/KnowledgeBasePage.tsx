import { useState, useRef, useCallback } from "react";
import {
  Database, Upload, FileText, Trash2, Search, Loader2,
  FileSpreadsheet, File, X, Tag, Calendar, HardDrive, CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useActiveProject } from "@/contexts/ProjectContext";
import { ProjectScopeBanner } from "@/components/ProjectScopeBanner";

// ── File type icon ─────────────────────────────────────────────────────────────

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

// ── Upload zone ────────────────────────────────────────────────────────────────

function UploadZone({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesSelected(files);
  }, [onFilesSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFilesSelected(files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
        dragging ? "border-[#7CA9D3] bg-blue-50" : "border-gray-200 hover:border-[#7CA9D3] hover:bg-gray-50"
      }`}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: dragging ? "#7CA9D3" : "#F0F7FF" }}
      >
        <Upload size={22} style={{ color: dragging ? "white" : "#7CA9D3" }} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-700">Húzza ide a fájlokat, vagy kattintson a feltöltéshez</p>
        <p className="text-sm text-gray-400 mt-1">PDF, DOCX, XLSX, DWG, IFC – max. 50 MB/fájl</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.dwg,.dxf,.ifc,.rtf"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ── Document card ──────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDelete,
  embeddingCount,
  onRegenerateEmbeddings,
  isRegenerating,
}: {
  doc: { id: number; name: string; originalName: string; fileType: string; fileSize: number; description: string | null; tags: string | null; uploadedAt: Date };
  onDelete: (id: number) => void;
  embeddingCount: number;
  onRegenerateEmbeddings: (id: number) => void;
  isRegenerating: boolean;
}) {
  const tags = doc.tags ? doc.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className="rounded-xl border bg-white p-4 flex items-start gap-4 hover:shadow-sm transition-shadow" style={{ borderColor: "#e5e7eb" }}>
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
        <FileTypeIcon fileType={doc.fileType} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{doc.name || doc.originalName}</p>
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
          {embeddingCount > 0 && (
            <span className="text-xs text-purple-700 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-50">
              <Sparkles size={9} /> {embeddingCount} chunk
            </span>
          )}
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 h-5">
              <Tag size={9} className="mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onRegenerateEmbeddings(doc.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50"
          title={embeddingCount > 0 ? "Embeddings újragenerálása" : "Embeddings generálása szemantikus kereséshez"}
          disabled={isRegenerating}
        >
          {isRegenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Törlés"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Pending upload item ────────────────────────────────────────────────────────

function PendingItem({
  file,
  onRemove,
  onNameChange,
  onDescChange,
  onTagsChange,
  name,
  description,
  tags,
}: {
  file: File;
  onRemove: () => void;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  name: string;
  description: string;
  tags: string;
}) {
  const ext = file.name.split(".").pop() ?? "file";
  return (
    <div className="rounded-xl border bg-gray-50 p-4 space-y-3" style={{ borderColor: "#e5e7eb" }}>
      <div className="flex items-center gap-3">
        <FileTypeIcon fileType={ext} size={18} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
          <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input
          placeholder="Dokumentum neve (opcionális)"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          className="text-xs h-8 border-gray-200"
        />
        <Input
          placeholder="Leírás (opcionális)"
          value={description}
          onChange={e => onDescChange(e.target.value)}
          className="text-xs h-8 border-gray-200"
        />
        <Input
          placeholder="Címkék, vesszővel elválasztva"
          value={tags}
          onChange={e => onTagsChange(e.target.value)}
          className="text-xs h-8 border-gray-200"
        />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PendingFile = {
  file: File;
  name: string;
  description: string;
  tags: string;
};

export default function KnowledgeBasePage() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const { activeProjectId } = useActiveProject();
  const { data: documents, isLoading, refetch } = trpc.knowledgeBase.list.useQuery({
    search: searchQuery,
    projectId: activeProjectId ?? undefined,
  });
  const countsQuery = trpc.knowledgeBase.getEmbeddingCounts.useQuery();
  const utils = trpc.useUtils();
  const countMap = new Map((countsQuery.data ?? []).map((c) => [c.sourceId, c.chunkCount]));

  const uploadMutation = trpc.knowledgeBase.upload.useMutation({
    onSuccess: () => {
      toast.success("Dokumentumok sikeresen feltöltve a Tudástárba");
      setPendingFiles([]);
      refetch();
    },
    onError: (err) => toast.error(`Feltöltési hiba: ${err.message}`),
    onSettled: () => setUploading(false),
  });

  const deleteMutation = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => {
      toast.success("Dokumentum törölve");
      refetch();
      utils.knowledgeBase.getEmbeddingCounts.invalidate();
    },
    onError: (err) => toast.error(`Törlési hiba: ${err.message}`),
  });

  const [embedRegeneratingId, setEmbedRegeneratingId] = useState<number | null>(null);
  const regenerateMutation = trpc.knowledgeBase.regenerateEmbeddings.useMutation({
    onSuccess: (data) => {
      if (data.embeddingApiUnavailable) toast.warning(data.message ?? "Embedding API nem elérhető");
      else if (data.chunkCount === 0) toast.info(data.message ?? "Nincs tartalom a beágyazáshoz");
      else toast.success(`${data.chunkCount} chunk beágyazva`);
      utils.knowledgeBase.getEmbeddingCounts.invalidate();
    },
    onError: (err) => toast.error(`Embeddings sikertelen: ${err.message}`),
    onSettled: () => setEmbedRegeneratingId(null),
  });
  const handleRegenerate = (id: number) => {
    setEmbedRegeneratingId(id);
    regenerateMutation.mutate({ id });
  };

  const handleFilesSelected = (files: File[]) => {
    const newPending: PendingFile[] = files.map(f => ({
      file: f,
      name: f.name.replace(/\.[^/.]+$/, ""),
      description: "",
      tags: "",
    }));
    setPendingFiles(prev => [...prev, ...newPending]);
  };

  const handleUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);

    const uploadedItems: { base64: string; originalName: string; fileType: string; fileSize: number; name: string; description: string; tags: string }[] = [];

    for (const pf of pendingFiles) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pf.file);
      });
      uploadedItems.push({
        base64,
        originalName: pf.file.name,
        fileType: pf.file.name.split(".").pop()?.toLowerCase() ?? "pdf",
        fileSize: pf.file.size,
        name: pf.name || pf.file.name.replace(/\.[^/.]+$/, ""),
        description: pf.description,
        tags: pf.tags,
      });
    }

    uploadMutation.mutate({
      documents: uploadedItems,
      projectId: activeProjectId ?? undefined,
    });
  };

  const updatePending = (index: number, field: keyof Omit<PendingFile, "file">, value: string) => {
    setPendingFiles(prev => prev.map((pf, i) => i === index ? { ...pf, [field]: value } : pf));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Database size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Tudástár</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Töltse fel a belső dokumentumokat – a Szabványkereső ezekből is keres, ha a „Belső dok." vagy „Kombinált" módot választja.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-8">
        <ProjectScopeBanner describe={(name) => `A Tudástár jelenleg a(z) ${name} projekt dokumentumait mutatja, és az új feltöltések is ide kerülnek.`} />
        {/* Upload section */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Dokumentum feltöltése</h2>
          <UploadZone onFilesSelected={handleFilesSelected} />

          {pendingFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-gray-600">
                {pendingFiles.length} fájl feltöltésre vár
              </p>
              {pendingFiles.map((pf, i) => (
                <PendingItem
                  key={i}
                  file={pf.file}
                  name={pf.name}
                  description={pf.description}
                  tags={pf.tags}
                  onRemove={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                  onNameChange={v => updatePending(i, "name", v)}
                  onDescChange={v => updatePending(i, "description", v)}
                  onTagsChange={v => updatePending(i, "tags", v)}
                />
              ))}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="gap-2 text-white"
                  style={{ backgroundColor: "#7CA9D3" }}
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {uploading ? "Feltöltés folyamatban..." : `${pendingFiles.length} fájl feltöltése`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPendingFiles([])}
                  disabled={uploading}
                  className="gap-2 border-gray-200"
                >
                  <X size={14} />
                  Mégse
                </Button>
              </div>
            </div>
          )}
        </section>

        <Separator />

        {/* Document list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Feltöltött dokumentumok
              {documents && (
                <span className="ml-2 text-sm font-normal text-gray-400">({documents.length} db)</span>
              )}
            </h2>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Keresés a dokumentumokban..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm border-gray-200"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: "#7CA9D3" }} />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <Database size={22} className="text-gray-300" />
              </div>
              <div>
                <p className="font-medium text-gray-500">A Tudástár üres</p>
                <p className="text-sm text-gray-400 mt-1">Töltsön fel dokumentumokat a fenti területre</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                  embeddingCount={countMap.get(doc.id) ?? 0}
                  onRegenerateEmbeddings={handleRegenerate}
                  isRegenerating={embedRegeneratingId === doc.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Info box */}
        <div className="rounded-xl border bg-blue-50 border-blue-100 p-4 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Hogyan működik a Tudástár?</p>
            <p className="text-sm text-blue-700 mt-1">
              A feltöltött dokumentumokból a rendszer automatikusan kinyeri a szöveget. A Szabványkereső „Belső dok." és „Kombinált" módjaiban ezek a dokumentumok is forrásként szerepelnek a válasz generálásakor.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
