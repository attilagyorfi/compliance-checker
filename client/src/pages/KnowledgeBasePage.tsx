import { useState, useRef, useCallback } from "react";
import {
  Database, Upload, FileText, Trash2, Search, Loader2,
  FileSpreadsheet, File, X, Tag, Calendar, HardDrive, CheckCircle2,
  Sparkles, CheckSquare, Square, MinusSquare,
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
  return <File size={size} className="text-text-faint" />;
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
        dragging ? "border-[#7CA9D3] bg-blue-50" : "border-line hover:border-[#7CA9D3] hover:bg-page-bg-subtle"
      }`}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: dragging ? "#7CA9D3" : "#F0F7FF" }}
      >
        <Upload size={22} style={{ color: dragging ? "white" : "#7CA9D3" }} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-text-default">Húzza ide a fájlokat, vagy kattintson a feltöltéshez</p>
        <p className="text-sm text-text-faint mt-1">PDF, DOCX, XLSX, DWG, IFC – max. 50 MB/fájl</p>
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
  selected,
  onToggleSelect,
}: {
  doc: { id: number; name: string; originalName: string; fileType: string; fileSize: number; description: string | null; tags: string | null; uploadedAt: Date };
  onDelete: (id: number) => void;
  embeddingCount: number;
  onRegenerateEmbeddings: (id: number) => void;
  isRegenerating: boolean;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const tags = doc.tags ? doc.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <div
      className={`rounded-xl border bg-surface p-4 flex items-start gap-3 hover:shadow-sm transition-all ${selected ? "ring-2" : ""}`}
      style={{ borderColor: selected ? "#7CA9D3" : "#e5e7eb", boxShadow: selected ? "inset 0 0 0 1px #7CA9D3" : undefined }}
    >
      <button
        onClick={() => onToggleSelect(doc.id)}
        className={`flex-shrink-0 mt-1 transition-colors ${selected ? "text-[#7CA9D3]" : "text-gray-300 hover:text-text-muted"}`}
        aria-label={selected ? "Kijelölés megszüntetése" : "Kijelölés"}
        title={selected ? "Kijelölés megszüntetése" : "Kijelölés"}
      >
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-page-bg-subtle border border-line-subtle flex items-center justify-center">
        <FileTypeIcon fileType={doc.fileType} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-strong text-sm truncate">{doc.name || doc.originalName}</p>
        {doc.description && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{doc.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs text-text-faint flex items-center gap-1">
            <HardDrive size={10} />
            {formatBytes(doc.fileSize)}
          </span>
          <span className="text-xs text-text-faint uppercase font-medium">{doc.fileType}</span>
          <span className="text-xs text-text-faint flex items-center gap-1">
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
          className="flex-shrink-0 p-1.5 rounded-lg text-text-faint hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50"
          title={embeddingCount > 0 ? "Embeddings újragenerálása" : "Embeddings generálása szemantikus kereséshez"}
          disabled={isRegenerating}
        >
          {isRegenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
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
    <div className="rounded-xl border bg-page-bg-subtle p-4 space-y-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-3">
        <FileTypeIcon fileType={ext} size={18} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-default truncate">{file.name}</p>
          <p className="text-xs text-text-faint">{formatBytes(file.size)}</p>
        </div>
        <button onClick={onRemove} className="text-text-faint hover:text-red-500 transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input
          placeholder="Dokumentum neve (opcionális)"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          className="text-xs h-8 border-line"
        />
        <Input
          placeholder="Leírás (opcionális)"
          value={description}
          onChange={e => onDescChange(e.target.value)}
          className="text-xs h-8 border-line"
        />
        <Input
          placeholder="Címkék, vesszővel elválasztva"
          value={tags}
          onChange={e => onTagsChange(e.target.value)}
          className="text-xs h-8 border-line"
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkRegenProgress, setBulkRegenProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

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
      utils.knowledgeBase.getEmbeddingCounts.invalidate();
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

  // ── Bulk operations ────────────────────────────────────────────────────────
  // Silent variant for bulk loops — no per-call toast (we summarize at the end).
  const bulkRegenerateMut = trpc.knowledgeBase.regenerateEmbeddings.useMutation();
  const deleteManyMutation = trpc.knowledgeBase.deleteMany.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.deletedCount === data.requestedCount
          ? `${data.deletedCount} dokumentum törölve`
          : `${data.deletedCount} törölve, ${data.requestedCount - data.deletedCount} már nem létezett`
      );
      setSelectedIds(new Set());
      refetch();
      utils.knowledgeBase.getEmbeddingCounts.invalidate();
    },
    onError: (err) => toast.error(`Bulk törlés sikertelen: ${err.message}`),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleDocIds = (documents ?? []).map((d) => d.id);
  const allVisibleSelected = visibleDocIds.length > 0 && visibleDocIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleDocIds.some((id) => selectedIds.has(id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      // unselect only the visible ones (preserves selection on filtered-out docs)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleDocIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleDocIds) next.add(id);
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Biztosan törlöd a kijelölt ${ids.length} dokumentumot? A művelet visszavonhatatlan.`)) return;
    deleteManyMutation.mutate({ ids });
  };

  const bulkRegenerate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Embeddings generálása ${ids.length} dokumentumhoz? Ez eltarthat néhány percig.`)) return;

    setBulkRegenProgress({ done: 0, total: ids.length, failed: 0 });
    let done = 0, failed = 0, apiUnavailable = false;
    for (const id of ids) {
      try {
        const result = await bulkRegenerateMut.mutateAsync({ id });
        if (result.embeddingApiUnavailable) {
          apiUnavailable = true;
          failed++;
        } else if (result.chunkCount > 0) {
          done++;
        } else {
          // chunk count 0 (no content) — count as silent skip, not failure
        }
      } catch {
        failed++;
      }
      setBulkRegenProgress({ done, total: ids.length, failed });
    }
    setBulkRegenProgress(null);
    utils.knowledgeBase.getEmbeddingCounts.invalidate();

    if (apiUnavailable) {
      toast.warning(`Embedding API nem elérhető — ${done} sikeres, ${failed} kihagyva`);
    } else if (failed > 0) {
      toast.warning(`${done} chunk-csoport beágyazva, ${failed} sikertelen`);
    } else {
      toast.success(`${done} dokumentum beágyazva`);
    }
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
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Database size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Tudástár</h1>
          </div>
          <p className="text-text-muted text-sm ml-11">
            Töltse fel a belső dokumentumokat – a Szabványkereső ezekből is keres, ha a „Belső dok." vagy „Kombinált" módot választja.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 space-y-8">
        <ProjectScopeBanner describe={(name) => `A Tudástár jelenleg a(z) ${name} projekt dokumentumait mutatja, és az új feltöltések is ide kerülnek.`} />
        {/* Upload section */}
        <section>
          <h2 className="text-base font-semibold text-text-strong mb-4">Dokumentum feltöltése</h2>
          <UploadZone onFilesSelected={handleFilesSelected} />

          {pendingFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-text-default">
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
                  className="gap-2 border-line"
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
            <h2 className="text-base font-semibold text-text-strong">
              Feltöltött dokumentumok
              {documents && (
                <span className="ml-2 text-sm font-normal text-text-faint">({documents.length} db)</span>
              )}
            </h2>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
              <Input
                placeholder="Keresés a dokumentumokban..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm border-line"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: "#7CA9D3" }} />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-page-bg-subtle flex items-center justify-center">
                <Database size={22} className="text-gray-300" />
              </div>
              <div>
                <p className="font-medium text-text-muted">A Tudástár üres</p>
                <p className="text-sm text-text-faint mt-1">Töltsön fel dokumentumokat a fenti területre</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk action bar */}
              {(selectedIds.size > 0 || bulkRegenProgress != null) && (
                <div
                  className="rounded-xl border bg-surface px-4 py-3 flex items-center gap-3 sticky top-2 z-10"
                  style={{ borderColor: "#7CA9D3", backgroundColor: "#F0F7FB" }}
                >
                  <button
                    onClick={toggleAllVisible}
                    className="flex items-center gap-1.5 text-xs text-text-default hover:text-text-strong"
                    title={allVisibleSelected ? "Kijelölés megszüntetése" : "Mind kijelölése"}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare size={15} style={{ color: "#7CA9D3" }} />
                    ) : someVisibleSelected ? (
                      <MinusSquare size={15} style={{ color: "#7CA9D3" }} />
                    ) : (
                      <Square size={15} className="text-text-faint" />
                    )}
                    <span className="font-medium">
                      {selectedIds.size} kijelölve
                    </span>
                  </button>

                  {bulkRegenProgress ? (
                    <div className="flex items-center gap-2 text-xs text-text-default ml-auto">
                      <Loader2 size={13} className="animate-spin" />
                      Beágyazás: {bulkRegenProgress.done + bulkRegenProgress.failed} / {bulkRegenProgress.total}
                      {bulkRegenProgress.failed > 0 && (
                        <span className="text-amber-700">({bulkRegenProgress.failed} hiba)</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-8 text-xs"
                        onClick={bulkRegenerate}
                        disabled={selectedIds.size === 0}
                      >
                        <Sparkles size={12} />
                        Embeddings ({selectedIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                        onClick={bulkDelete}
                        disabled={selectedIds.size === 0 || deleteManyMutation.isPending}
                      >
                        {deleteManyMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Törlés ({selectedIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={clearSelection}
                      >
                        <X size={12} className="mr-1" />
                        Mégse
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {documents.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onDelete={(id) => {
                    const name = doc.name || doc.originalName;
                    if (confirm(`Biztosan törlöd a(z) "${name}" dokumentumot a Tudástárból? A művelet visszavonhatatlan.`)) {
                      deleteMutation.mutate({ id });
                    }
                  }}
                  embeddingCount={countMap.get(doc.id) ?? 0}
                  onRegenerateEmbeddings={handleRegenerate}
                  isRegenerating={embedRegeneratingId === doc.id}
                  selected={selectedIds.has(doc.id)}
                  onToggleSelect={toggleSelect}
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
