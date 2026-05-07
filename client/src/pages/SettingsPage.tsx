/**
 * Beállítások oldal — V11.3 (d)
 *
 * Felhasználói preferenciák a Szabványkereső alapértelmezéseihez. A
 * search_settings táblában tárolódik, userId-vel kulcsolva.
 */

import { useState, useEffect } from "react";
import {
  Settings, Save, RotateCcw, Loader2, BookOpen, Database,
  Globe, Search, Zap, Target, Sparkles, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";

type AnswerLength = "short" | "standard" | "detailed";
type OperationMode = "fast" | "accurate";
type SearchMode = "mszt" | "internal" | "combined" | "web" | "combined_with_web";

const ANSWER_LENGTH_OPTIONS: Array<{ value: AnswerLength; label: string; desc: string }> = [
  { value: "short",    label: "Rövid",     desc: "Max 3-4 mondatos összefoglaló" },
  { value: "standard", label: "Standard",  desc: "Max 8-10 mondatos szakmai válasz" },
  { value: "detailed", label: "Részletes", desc: "15-20 mondatos részletes elemzés" },
];

const OPERATION_MODE_OPTIONS: Array<{ value: OperationMode; label: string; desc: string; icon: typeof Zap }> = [
  { value: "fast",     label: "Gyors",  desc: "Általános AI tudást is felhasznál; gyorsabb, de kevésbé megbízható.", icon: Zap },
  { value: "accurate", label: "Pontos", desc: "Csak forrásból dolgozik + self-check ellenőrzés. Lassabb, megbízhatóbb.", icon: Target },
];

const SEARCH_MODE_OPTIONS: Array<{ value: SearchMode; label: string; desc: string; icon: typeof BookOpen }> = [
  { value: "mszt",              label: "MSZT",              desc: "Csak importált MSZT-források",                  icon: BookOpen },
  { value: "internal",          label: "Belső",             desc: "Jogszabály-könyvtár (nem-MSZT) + Tudástár",     icon: Database },
  { value: "combined",          label: "Kombinált",         desc: "Minden belső forrás (jogszabálykönyvtár + KB)", icon: Search },
  { value: "web",               label: "Internet",          desc: "Csak DuckDuckGo + felhasználói URL-ek",          icon: Globe },
  { value: "combined_with_web", label: "Kombinált + Web",   desc: "Belső források + internet, dedupelve",           icon: Globe },
];

export default function SettingsPage() {
  const settingsQuery = trpc.searchSettings.get.useQuery();
  const utils = trpc.useUtils();

  const [answerLength, setAnswerLength] = useState<AnswerLength>("standard");
  const [operationMode, setOperationMode] = useState<OperationMode>("accurate");
  const [searchMode, setSearchMode] = useState<SearchMode>("combined");

  // Sync local state from server when settings load
  useEffect(() => {
    if (settingsQuery.data) {
      setAnswerLength(settingsQuery.data.answerLength as AnswerLength);
      setOperationMode(settingsQuery.data.operationMode as OperationMode);
      setSearchMode(settingsQuery.data.searchMode as SearchMode);
    }
  }, [settingsQuery.data]);

  const upsertMut = trpc.searchSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Beállítások mentve");
      utils.searchSettings.get.invalidate();
    },
    onError: (err) => toast.error(`Mentési hiba: ${err.message}`),
  });

  const resetMut = trpc.searchSettings.reset.useMutation({
    onSuccess: () => {
      toast.success("Alapértelmezésekre visszaállítva");
      utils.searchSettings.get.invalidate();
    },
    onError: (err) => toast.error(`Visszaállítási hiba: ${err.message}`),
  });

  const isAuthError = settingsQuery.error?.data?.code === "UNAUTHORIZED";
  const isCustom = settingsQuery.data?.isCustom ?? false;

  const handleSave = () => upsertMut.mutate({ answerLength, operationMode, searchMode });
  const handleReset = () => {
    if (confirm("Biztos, hogy visszaállítja a beállításokat alapértelmezésre?")) {
      resetMut.mutate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Settings size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Beállítások</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            A Szabványkereső személyes alapértelmezései. Csak a saját kereséseidet befolyásolják.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8 max-w-2xl">
        {isAuthError ? (
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-700 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 text-sm">Bejelentkezés szükséges</p>
              <p className="text-xs text-amber-800 mt-1">
                A beállítások felhasználóhoz kötöttek — kérjük, jelentkezz be a Manus OAuth-fiókoddal.
              </p>
            </div>
          </div>
        ) : settingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={20} /> Betöltés…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center gap-2 text-xs">
              {isCustom ? (
                <Badge className="px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: "#f0fdf4", color: "#059669" }}>
                  <Sparkles size={9} className="mr-1" /> Egyéni beállítások aktívak
                </Badge>
              ) : (
                <Badge className="px-2 py-0.5 rounded-full font-medium border-0" style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}>
                  Alapértelmezések érvényesek
                </Badge>
              )}
            </div>

            {/* Search mode */}
            <div className="space-y-2">
              <Label htmlFor="set-search-mode" className="text-sm font-semibold">Alapértelmezett keresési logika</Label>
              <Select value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
                <SelectTrigger id="set-search-mode" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEARCH_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{o.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {SEARCH_MODE_OPTIONS.find((o) => o.value === searchMode)?.desc}
              </p>
            </div>

            {/* Operation mode */}
            <div className="space-y-2">
              <Label htmlFor="set-op-mode" className="text-sm font-semibold">Működési mód</Label>
              <Select value={operationMode} onValueChange={(v) => setOperationMode(v as OperationMode)}>
                <SelectTrigger id="set-op-mode" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATION_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {OPERATION_MODE_OPTIONS.find((o) => o.value === operationMode)?.desc}
              </p>
            </div>

            {/* Answer length */}
            <div className="space-y-2">
              <Label htmlFor="set-answer-length" className="text-sm font-semibold">Válasz hossza</Label>
              <Select value={answerLength} onValueChange={(v) => setAnswerLength(v as AnswerLength)}>
                <SelectTrigger id="set-answer-length" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANSWER_LENGTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {ANSWER_LENGTH_OPTIONS.find((o) => o.value === answerLength)?.desc}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t" style={{ borderColor: "#e5e7eb" }}>
              <Button
                onClick={handleSave}
                disabled={upsertMut.isPending}
                className="gap-2"
                style={{ backgroundColor: "#7CA9D3" }}
              >
                {upsertMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Mentés
              </Button>
              {isCustom && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={resetMut.isPending}
                  className="gap-2"
                >
                  {resetMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Alapértelmezésre
                </Button>
              )}
            </div>

            <div className="rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-600" style={{ borderColor: "#e5e7eb" }}>
              <p>
                A Szabványkereső oldalon ezek a beállítások betöltődnek alapértelmezésként.
                Egy adott kereséshez ott szabadon felülírhatod őket — az itt mentett értékek a következő keresésnél
                újra érvényesek lesznek.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
