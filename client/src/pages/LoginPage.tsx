/**
 * Belépés oldal — V11.13 M4 (Manus-leválasztás)
 *
 * Magic-link auth a better-auth /api/auth/magic-link/sign-in endpointon át.
 * Az e-mail beírása után a backend egy egyszer használatos URL-t küld
 * (jelenleg console-log placeholder, M5-ben SMTP/Resend integráció).
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Mail, Loader2, CheckCircle2, AlertCircle, BookOpen, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo-belépés (csak akkor jelenik meg, ha a szerveren be van állítva
  // DEMO_PASSWORD — azaz bemutató-környezetben).
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoPassword, setDemoPassword] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    fetch("/api/demo-enabled")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setDemoEnabled(Boolean(d?.enabled)))
      .catch(() => setDemoEnabled(false));
  }, []);

  const demoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoPassword.trim()) return;
    setDemoBusy(true);
    try {
      const res = await fetch("/api/demo-login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: demoPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success("Belépve a demóba");
      navigate("/search");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setDemoBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          callbackURL: "/search",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }
      setSent(true);
      toast.success("Belépési link elküldve");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(`Belépési hiba: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page-bg-subtle px-4">
      <div className="w-full max-w-md">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "#7CA9D3" }}>
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-text-strong">M Mérnöki Iroda</h1>
          <p className="text-xs text-text-muted mt-1">Tervmegfelelőség-ellenőrző</p>
        </div>

        <div className="rounded-xl border bg-surface p-6 shadow-sm" style={{ borderColor: "var(--line)" }}>
          {sent ? (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <p className="font-semibold text-text-strong">Ellenőrizd a postafiókodat</p>
              <p className="text-sm text-text-muted">
                Elküldtük a belépési linket <strong>{email}</strong> címre.
                A linkre kattintva azonnal beléphetsz.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Másik e-mail
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-sm font-semibold text-text-strong">
                  E-mail cím
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="te@pelda.hu"
                  className="h-11"
                />
                <p className="text-xs text-text-muted">
                  Egyszer használatos belépési linket küldünk a megadott e-mail címre.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border bg-red-50 border-red-200 p-3 flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-900">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2 h-11"
                style={{ backgroundColor: "#7CA9D3" }}
                disabled={sending || !email.trim()}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Belépési link kérése
              </Button>
            </form>
          )}

          {/* Demo-belépés — csak bemutató-környezetben jelenik meg */}
          {demoEnabled && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--line)" }} />
                <span className="text-xs text-text-faint uppercase tracking-wide">vagy</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--line)" }} />
              </div>
              <form onSubmit={demoSubmit} className="space-y-2">
                <Label htmlFor="demo-password" className="text-sm font-semibold text-text-strong">
                  Demo belépés
                </Label>
                <Input
                  id="demo-password"
                  type="password"
                  value={demoPassword}
                  onChange={(e) => setDemoPassword(e.target.value)}
                  placeholder="Demo jelszó"
                  className="h-11"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full gap-2 h-11"
                  disabled={demoBusy || !demoPassword.trim()}
                >
                  {demoBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  Belépés a bemutatóhoz
                </Button>
                <p className="text-xs text-text-muted">
                  Bemutató-hozzáférés e-mail nélkül, a kapott demo-jelszóval.
                </p>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-text-faint text-center mt-6">
          A bejelentkezéssel elfogadod, hogy a rendszer az e-mail címed és
          IP-címed audit-naplót vezet.
        </p>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/")}
            className="text-xs text-text-muted hover:text-text-strong underline"
          >
            Vissza a kezdőlapra
          </button>
        </div>
      </div>
    </div>
  );
}
