import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, X, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";

const BG_URL = "https://d2xsxph8kpxj0f.cloudfront.net/109169450/Lkoz8HcKNEz8RQmUhyV4qZ/upload_bg-bW9H5LfMfX6iMC82Jiotnt.webp";

type FileItem = { file: File; name: string; base64?: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DropZone({
  label,
  file,
  onFile,
  onRemove,
  multiple = false,
}: {
  label: string;
  file?: FileItem | null;
  onFile: (f: File) => void;
  onRemove?: () => void;
  multiple?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type === "application/pdf") onFile(f);
      else toast.error("Csak PDF fájl tölthető fel.");
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={`relative rounded-lg border-2 border-dashed transition-all duration-200 ${
        file ? "border-transparent cursor-default" : "cursor-pointer hover:border-[#7CA9D3]"
      } ${dragging ? "border-[#7CA9D3] bg-blue-50" : "border-gray-200 bg-gray-50"}`}
      style={{ minHeight: 130 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {file ? (
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EBF3FA" }}>
            <FileText size={20} style={{ color: "#7CA9D3" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-800 truncate">{file.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {(file.file.size / 1024).toFixed(0)} KB · PDF
            </div>
          </div>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Upload size={28} className="mb-3" style={{ color: "#7CA9D3" }} />
          <div className="font-medium text-sm text-gray-700 mb-1">{label}</div>
          <div className="text-xs text-gray-400">Húzza ide a fájlt, vagy kattintson a tallózáshoz</div>
          <div className="text-xs text-gray-300 mt-1">PDF formátum</div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [planFile, setPlanFile] = useState<FileItem | null>(null);
  const [regulationFiles, setRegulationFiles] = useState<FileItem[]>([]);
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

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Adjon meg egy elemzési nevet."); return; }
    if (!planFile) { toast.error("Töltse fel a tervdokumentumot."); return; }
    if (regulationFiles.length === 0) { toast.error("Töltsön fel legalább egy jogszabályt."); return; }

    setIsSubmitting(true);
    try {
      const planBase64 = await fileToBase64(planFile.file);
      const regBase64s = await Promise.all(regulationFiles.map((f) => fileToBase64(f.file)));

      await startAnalysis.mutateAsync({
        title: title.trim(),
        planDocument: { key: "", name: planFile.name, base64: planBase64 },
        regulationDocuments: regulationFiles.map((f, i) => ({
          name: f.name,
          base64: regBase64s[i],
        })),
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  const addRegulationFile = (file: File) => {
    if (regulationFiles.length >= 5) { toast.error("Maximum 5 jogszabály tölthető fel."); return; }
    setRegulationFiles((prev) => [...prev, { file, name: file.name }]);
  };

  const removeRegulation = (idx: number) => {
    setRegulationFiles((prev) => prev.filter((_, i) => i !== idx));
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
            Töltse fel a tervdokumentumot és a vonatkozó jogszabályokat az AI alapú megfelelőség-ellenőrzéshez.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-10">
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "#7CA9D3" }}
              >1</span>
              <h2 className="font-semibold text-base" style={{ color: "#161718" }}>
                Elemzés neve
              </h2>
            </div>
            <Input
              placeholder="pl. Ipari csarnok – tűzvédelmi megfelelőség 2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-gray-200 focus-visible:ring-[#7CA9D3]"
            />
          </div>

          {/* Step 2: Plan document */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "#7CA9D3" }}
              >2</span>
              <h2 className="font-semibold text-base" style={{ color: "#161718" }}>
                Tervdokumentum
              </h2>
            </div>
            <DropZone
              label="Tervdokumentum feltöltése"
              file={planFile}
              onFile={(f) => setPlanFile({ file: f, name: f.name })}
              onRemove={() => setPlanFile(null)}
            />
          </div>

          {/* Step 3: Regulation documents */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "#7CA9D3" }}
              >3</span>
              <h2 className="font-semibold text-base" style={{ color: "#161718" }}>
                Jogszabályok / Szabványok
              </h2>
            </div>

            <div className="space-y-3">
              {regulationFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EBF3FA" }}>
                    <FileText size={15} style={{ color: "#7CA9D3" }} />
                  </div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
                  <button
                    onClick={() => removeRegulation(i)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {regulationFiles.length < 5 && (
                <DropZone
                  label="Jogszabály / Szabvány hozzáadása"
                  file={null}
                  onFile={addRegulationFile}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Maximum 5 dokumentum · PDF formátum</p>
          </div>

          {/* Submit */}
          <div className="border-t pt-8" style={{ borderColor: "#e5e7eb" }}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title || !planFile || regulationFiles.length === 0}
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
              Az elemzés általában 30–90 másodpercet vesz igénybe.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
