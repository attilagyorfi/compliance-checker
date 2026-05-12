import { Link } from "wouter";
import { FileSearch, ClipboardList, Zap, Shield, FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/109169450/Lkoz8HcKNEz8RQmUhyV4qZ/hero_compliance-NzTkasoFPDFh8GPKx9JaW6.webp";

const features = [
  {
    icon: FileText,
    title: "PDF Dokumentum-elemzés",
    desc: "Tervdokumentumok és jogszabályok automatikus szövegkinyerése és feldolgozása.",
  },
  {
    icon: Zap,
    title: "AI alapú összevetés",
    desc: "Nagy nyelvi modell segítségével azonosítja a megfelelési pontokat és eltéréseket.",
  },
  {
    icon: Shield,
    title: "Strukturált riport",
    desc: "Áttekinthető kártyás megjelenítés státuszjelöléssel, indoklással és szabályhivatkozással.",
  },
];

const steps = [
  { n: "01", title: "Dokumentumok feltöltése", desc: "Töltse fel a tervdokumentumot és a vonatkozó jogszabályokat PDF formátumban." },
  { n: "02", title: "AI elemzés", desc: "A rendszer automatikusan kinyeri a szöveget és elvégzi az AI alapú megfelelőség-ellenőrzést." },
  { n: "03", title: "Riport letöltése", desc: "Tekintse meg a strukturált eredményeket és töltse le a PDF riportot." },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ minHeight: 480 }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(22,23,24,0.85) 0%, rgba(22,23,24,0.55) 60%, rgba(22,23,24,0.2) 100%)" }} />
        <div className="relative container py-24 md:py-32">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
              style={{ backgroundColor: "#7CA9D3", color: "white" }}
            >
              <Zap size={12} />
              AI Pilot Rendszer
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              Tervmegfelelőség-<br />
              <span style={{ color: "#7CA9D3" }}>ellenőrző rendszer</span>
            </h1>
            <p className="text-gray-200 text-lg leading-relaxed mb-8 max-w-xl">
              Töltse fel tervdokumentumát és a vonatkozó jogszabályokat — az AI elvégzi az összevetést, és strukturált megfelelőségi riportot generál.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/search">
                <Button
                  size="lg"
                  className="gap-2 font-semibold text-white"
                  style={{ backgroundColor: "#7CA9D3", borderColor: "#7CA9D3" }}
                >
                  <FileSearch size={18} />
                  Elemzés indítása
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/reports">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 font-semibold border-white/40 text-white hover:bg-surface/10"
                >
                  <ClipboardList size={18} />
                  Korábbi riportok
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--text-strong)" }}>
              Rendszer képességei
            </h2>
            <div className="w-12 h-0.5 mx-auto mb-4" style={{ backgroundColor: "#7CA9D3" }} />
            <p className="text-text-muted max-w-xl mx-auto">
              Az M Mérnöki Iroda Kft. számára fejlesztett pilot rendszer végponttól végpontig kezeli a tervmegfelelőség-ellenőrzés folyamatát.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-8 rounded-lg border bg-surface shadow-sm hover:shadow-md transition-shadow group"
                style={{ borderColor: "var(--line)" }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-5 transition-colors"
                  style={{ backgroundColor: "#EBF3FA" }}
                >
                  <Icon size={22} style={{ color: "#7CA9D3" }} />
                </div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--text-strong)" }}>
                  {title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20" style={{ backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--text-strong)" }}>
              Hogyan működik?
            </h2>
            <div className="w-12 h-0.5 mx-auto" style={{ backgroundColor: "#7CA9D3" }} />
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 text-xl font-bold text-white"
                  style={{ backgroundColor: "#7CA9D3" }}
                >
                  {n}
                </div>
                <h3 className="font-semibold text-base mb-2" style={{ color: "var(--text-strong)" }}>
                  {title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16" style={{ backgroundColor: "#161718" }}>
        <div className="container text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Kezdje el az elemzést most
          </h2>
          <p className="text-text-faint mb-8 max-w-md mx-auto">
            Töltse fel dokumentumait és kapjon részletes megfelelőségi riportot percek alatt.
          </p>
          <Link href="/search">
            <Button
              size="lg"
              className="gap-2 font-semibold text-white"
              style={{ backgroundColor: "#7CA9D3" }}
            >
              <FileSearch size={18} />
              Elemzés indítása
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-text-faint">
            © 2026 M Mérnöki Iroda Kft. — Tervmegfelelőség-ellenőrző Pilot
          </div>
          <div className="flex items-center gap-2 text-sm text-text-faint">
            <CheckCircle2 size={14} style={{ color: "#7CA9D3" }} />
            AI alapú megfelelőség-ellenőrzés
          </div>
        </div>
      </footer>
    </div>
  );
}
