import { useState, useRef } from "react";
import {
  Search, Loader2, ChevronDown, ChevronUp, BookOpen, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, Info, Zap, Target,
  FileText, Settings2, History, Send, RefreshCw, Copy, Check, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import type { SearchSource } from "../../../drizzle/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

type SearchMode = "mszt" | "internal" | "combined" | "web" | "combined_with_web";
type AnswerLength = "short" | "standard" | "detailed";
type OperationMode = "fast" | "accurate";
type Confidence = "low" | "medium" | "high";

interface SearchResult {
  queryId?: number;
  answer: string;
  confidence: Confidence;
  sources: SearchSource[];
  hasSufficientSources: boolean;
  selfCheckPassed: boolean;
  selfCheckNotes: string;
  rewrittenQuestion: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const config = {
    high: { label: "Magas megbízhatóság", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: <CheckCircle2 size={12} /> },
    medium: { label: "Közepes megbízhatóság", color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: <Info size={12} /> },
    low: { label: "Alacsony megbízhatóság", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: <AlertTriangle size={12} /> },
  }[confidence];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
      style={{ color: config.color, backgroundColor: config.bg, borderColor: config.border }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function SourceCard({ source, index }: { source: SearchSource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isWeb = source.sourceType === "web";

  return (
    <div
      className="rounded-lg border bg-white"
      style={{ borderColor: isWeb ? "#a5d6a7" : "#e5e7eb" }}
    >
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: isWeb ? "#4caf50" : "#7CA9D3" }}
        >
          {isWeb ? <Globe size={11} /> : index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 leading-tight">{source.documentName}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Megnyitás"
                >
                  <ExternalLink size={13} />
                </a>
              )}
              {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {isWeb && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 flex items-center gap-1">
                <Globe size={9} />
                Internetes forrás
              </span>
            )}
            {source.page && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <FileText size={10} />
                {source.page}. oldal
              </span>
            )}
            {source.chapter && (
              <span className="text-xs text-gray-500">{source.chapter}</span>
            )}
            {source.relevanceScore !== undefined && (
              <span className="text-xs text-gray-400">
                Relevancia: {Math.round(source.relevanceScore * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <Separator className="mb-3" />
          <p className="text-xs text-gray-600 leading-relaxed font-mono bg-gray-50 rounded p-2 border border-gray-100">
            {source.excerpt}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────────

function SettingsPanel({
  searchMode, setSearchMode,
  answerLength, setAnswerLength,
  operationMode, setOperationMode,
}: {
  searchMode: SearchMode; setSearchMode: (v: SearchMode) => void;
  answerLength: AnswerLength; setAnswerLength: (v: AnswerLength) => void;
  operationMode: OperationMode; setOperationMode: (v: OperationMode) => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-4" style={{ borderColor: "#e5e7eb" }}>
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Settings2 size={14} style={{ color: "#7CA9D3" }} />
        Keresési beállítások
      </h3>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block uppercase tracking-wide">Keresési logika</label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: "mszt", label: "MSZT szabvány", icon: <BookOpen size={12} />, desc: "Szabványtár" },
            { value: "internal", label: "Belső dok.", icon: <FileText size={12} />, desc: "Feltöltött" },
            { value: "combined", label: "Kombinált", icon: <Search size={12} />, desc: "Könyvtár" },
            { value: "web", label: "Internet", icon: <Globe size={12} />, desc: "Web keresés" },
            { value: "combined_with_web", label: "Kombinált + Web", icon: <Globe size={12} />, desc: "Könyvtár + internet", wide: true },
          ] as Array<{ value: SearchMode; label: string; icon: React.ReactNode; desc: string; wide?: boolean }>).map(({ value, label, icon, desc, wide }) => (
            <button
              key={value}
              onClick={() => setSearchMode(value)}
              className={`${
                wide ? "col-span-2" : ""
              } flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                searchMode === value
                  ? "text-white border-transparent"
                  : "text-gray-600 border-gray-200 bg-white hover:border-gray-300"
              }`}
              style={searchMode === value ? { backgroundColor: value === "web" || value === "combined_with_web" ? "#4caf50" : "#7CA9D3" } : {}}
            >
              {icon}
              <span className="flex flex-col items-start">
                <span>{label}</span>
                <span className={`text-xs ${searchMode === value ? "opacity-80" : "text-gray-400"}`}>{desc}</span>
              </span>
            </button>
          ))}
        </div>
        {(searchMode === "web" || searchMode === "combined_with_web") && (
          <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-100 flex items-start gap-2">
            <Globe size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-700">
              Az internetes keresés valós idejű webes találatokat is bevon a válasz generálásához. A keresési idő hosszabb lehet.
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block uppercase tracking-wide">Válasz hossza</label>
        <Select value={answerLength} onValueChange={(v) => setAnswerLength(v as AnswerLength)}>
          <SelectTrigger className="border-gray-200 text-sm h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Rövid (3-4 mondat)</SelectItem>
            <SelectItem value="standard">Standard (8-10 mondat)</SelectItem>
            <SelectItem value="detailed">Részletes (15-20 mondat)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block uppercase tracking-wide">Működési mód</label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: "fast", label: "Gyors", desc: "Kevesebb ellenőrzés", icon: <Zap size={12} /> },
            { value: "accurate", label: "Pontos", desc: "Teljes ellenőrzés", icon: <Target size={12} /> },
          ] as const).map(({ value, label, desc, icon }) => (
            <button
              key={value}
              onClick={() => setOperationMode(value)}
              className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-xs transition-all ${
                operationMode === value
                  ? "text-white border-transparent"
                  : "text-gray-600 border-gray-200 bg-white hover:border-gray-300"
              }`}
              style={operationMode === value ? { backgroundColor: "#7CA9D3" } : {}}
            >
              <span className="flex items-center gap-1 font-medium">{icon}{label}</span>
              <span className={`text-xs ${operationMode === value ? "text-white/80" : "text-gray-400"}`}>{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StandardsSearchPage() {
  const [question, setQuestion] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("combined");
  const [answerLength, setAnswerLength] = useState<AnswerLength>("standard");
  const [operationMode, setOperationMode] = useState<OperationMode>("accurate");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [showExtended, setShowExtended] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchMutation = trpc.standardsSearch.search.useMutation({
    onSuccess: (data) => {
      setResult(data as SearchResult);
      setShowExtended(false);
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const extendMutation = trpc.standardsSearch.extendAnswer.useMutation({
    onSuccess: () => setShowExtended(true),
    onError: (err) => toast.error(`Hiba a bővítés során: ${err.message}`),
  });

  const handleSearch = () => {
    if (!question.trim()) return;
    setResult(null);
    searchMutation.mutate({ question: question.trim(), searchMode, answerLength, operationMode });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSearch();
    }
  };

  const handleCopy = async () => {
    if (!result?.answer) return;
    await navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleQuestions = [
    "Mekkora minimális belmagasság szükséges ipari épületnél?",
    "Milyen tűzállósági követelmények vonatkoznak a tartószerkezetekre?",
    "Mi az előírt minimális lépcsőszélesség lakóépületben?",
    "Milyen hőátbocsátási tényező szükséges külső falhoz?",
  ];

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
                  <Search size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Szabványkereső</h1>
              </div>
              <p className="text-gray-500 text-sm ml-11">
                Tegyen fel természetes nyelvű kérdést – az AI megkeresi a releváns szabványokat és strukturált választ generál.
              </p>
            </div>
            <Link href="/search-history">
              <Button variant="outline" className="gap-2 text-sm border-gray-200">
                <History size={14} />
                Előzmények
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Main content */}
          <div className="space-y-6">
            {/* Search input */}
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#e5e7eb" }}>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Kérdés természetes nyelven
              </label>
              <Textarea
                ref={textareaRef}
                placeholder="pl. Mekkora minimális belmagasság szükséges ipari épületnél?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[100px] border-gray-200 focus-visible:ring-[#7CA9D3] resize-none text-sm"
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-400">Ctrl+Enter a kereséshez</p>
                <Button
                  onClick={handleSearch}
                  disabled={!question.trim() || searchMutation.isPending}
                  className="gap-2 text-white"
                  style={{ backgroundColor: "#7CA9D3" }}
                >
                  {searchMutation.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {searchMutation.isPending ? "Keresés..." : "Keresés"}
                </Button>
              </div>

              {/* Example questions */}
              {!result && !searchMutation.isPending && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2 font-medium">Példa kérdések:</p>
                  <div className="flex flex-wrap gap-2">
                    {exampleQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuestion(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-[#7CA9D3] hover:text-[#7CA9D3] transition-colors bg-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Loading state */}
            {searchMutation.isPending && (
              <div className="rounded-xl border bg-white p-8 flex flex-col items-center gap-4" style={{ borderColor: "#e5e7eb" }}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-gray-100 flex items-center justify-center">
                    <Loader2 size={22} className="animate-spin" style={{ color: "#7CA9D3" }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700">Keresés folyamatban...</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {searchMode === "web"
                      ? "Internetes keresés folyamatban → Tartalom letöltés → Válasz generálás"
                      : searchMode === "combined_with_web"
                      ? "Könyvtár keresés + Internetes keresés → Összevonás → Válasz generálás"
                      : operationMode === "accurate"
                      ? "Kérdés pontosítása → Forráskeresés → Válasz generálás → Ellenőrzés"
                      : "Forráskeresés → Válasz generálás"}
                  </p>
                </div>
              </div>
            )}

            {/* Result */}
            {result && !searchMutation.isPending && (
              <div className="space-y-4">
                {/* Answer header */}
                <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Válasz</span>
                      <ConfidenceBadge confidence={result.confidence} />
                      {!result.selfCheckPassed && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} />
                          Önellenőrzés: figyelmeztetés
                        </span>
                      )}
                      {!result.hasSufficientSources && (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                          <XCircle size={11} />
                          Nincs elegendő forrás
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Másolás"
                      >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          setResult(null);
                          setQuestion("");
                          textareaRef.current?.focus();
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Új keresés"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Rewritten question */}
                  {result.rewrittenQuestion && result.rewrittenQuestion !== question && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
                      <Info size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700">
                        <strong>Pontosított kérdés:</strong> {result.rewrittenQuestion}
                      </p>
                    </div>
                  )}

                  {/* Self-check warning */}
                  {!result.selfCheckPassed && result.selfCheckNotes && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
                      <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        <strong>Önellenőrzési megjegyzés:</strong> {result.selfCheckNotes}
                      </p>
                    </div>
                  )}

                  {/* Answer text */}
                  <div className="p-4">
                    {result.hasSufficientSources ? (
                      <div className="prose prose-sm max-w-none text-gray-800">
                        <Streamdown>{showExtended && extendMutation.data?.extendedAnswer
                          ? extendMutation.data.extendedAnswer
                          : result.answer}
                        </Streamdown>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <XCircle size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-700 text-sm">Nem található elegendő információ</p>
                          <p className="text-sm text-gray-500 mt-1">{result.answer}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Javaslat: Töltse fel a releváns szabványokat a{" "}
                            <Link href="/regulations" className="underline" style={{ color: "#7CA9D3" }}>
                              Jogszabály könyvtárba
                            </Link>
                            , vagy ellenőrizze az MSZT kapcsolatot a{" "}
                            <Link href="/platforms" className="underline" style={{ color: "#7CA9D3" }}>
                              Platform kapcsolatok
                            </Link>{" "}
                            oldalon.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extended answer button */}
                  {result.hasSufficientSources && result.queryId && (
                    <div className="px-4 pb-4">
                      {!showExtended ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs border-gray-200"
                          disabled={extendMutation.isPending}
                          onClick={() => {
                            if (extendMutation.data?.extendedAnswer) {
                              setShowExtended(true);
                            } else {
                              extendMutation.mutate({ queryId: result.queryId! });
                            }
                          }}
                        >
                          {extendMutation.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ChevronDown size={12} />
                          )}
                          Bővebb válasz
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs border-gray-200"
                          onClick={() => setShowExtended(false)}
                        >
                          <ChevronUp size={12} />
                          Rövidebb válasz
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sources */}
                {result.sources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <BookOpen size={14} style={{ color: "#7CA9D3" }} />
                      Hivatkozások ({result.sources.length} forrás)
                    </h3>
                    <div className="space-y-2">
                      {result.sources.map((source, i) => (
                        <SourceCard key={i} source={source} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar – settings */}
          <div className="space-y-4">
            <SettingsPanel
              searchMode={searchMode} setSearchMode={setSearchMode}
              answerLength={answerLength} setAnswerLength={setAnswerLength}
              operationMode={operationMode} setOperationMode={setOperationMode}
            />

            {/* Info box */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hogyan működik?</h4>
              <div className="space-y-2">
                {[
                  { step: "1", text: "Kérdés pontosítása AI-val" },
                  { step: "2", text: "Forráskeresés (keyword + szemantikus)" },
                  { step: "3", text: "Strukturált válasz generálás" },
                  { step: "4", text: "Önellenőrzés (hallucináció szűrés)" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: "#7CA9D3" }}
                    >
                      {step}
                    </span>
                    <span className="text-xs text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* MSZT link */}
            <div className="rounded-xl border p-4" style={{ borderColor: "#e5e7eb" }}>
              <p className="text-xs text-gray-500 mb-2">MSZT szabványtár kapcsolat:</p>
              <Link href="/platforms">
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-gray-200">
                  <Settings2 size={12} />
                  Platform beállítások
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
