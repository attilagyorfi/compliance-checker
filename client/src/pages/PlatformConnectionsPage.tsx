import { useState } from "react";
import {
  Link2, CheckCircle2, XCircle, Clock, Eye, EyeOff,
  Loader2, ExternalLink, Shield, Lock, Globe, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = "mszt" | "jogtar" | "epitesijog" | "eurlex";

interface PlatformInfo {
  platform: Platform;
  name: string;
  url: string;
  description: string;
  loginUrl: string;
  isFree: boolean;
  isConfigured: boolean;
  username: string | null;
  status: "untested" | "connected" | "failed";
  lastConnectedAt: Date | null;
  lastError: string | null;
  credentialId: number | null;
}

// ── Credential dialog ──────────────────────────────────────────────────────────

function CredentialDialog({
  platform,
  info,
  open,
  onClose,
}: {
  platform: Platform;
  info: PlatformInfo;
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(info.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();
  const saveMutation = trpc.platformCredentials.saveCredentials.useMutation({
    onSuccess: () => {
      toast.success("Hitelesítő adatok mentve.");
      utils.platformCredentials.listPlatforms.invalidate();
      onClose();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  const deleteMutation = trpc.platformCredentials.deleteCredentials.useMutation({
    onSuccess: () => {
      toast.success("Hitelesítő adatok törölve.");
      utils.platformCredentials.listPlatforms.invalidate();
      onClose();
    },
    onError: (err) => toast.error(`Hiba: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock size={18} style={{ color: "#7CA9D3" }} />
            {info.name} – Bejelentkezési adatok
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg border text-sm" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
            <p className="text-gray-600 mb-2">{info.description}</p>
            <a
              href={info.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: "#7CA9D3" }}
            >
              <ExternalLink size={11} />
              Regisztráció / előfizetés: {info.url}
            </a>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
              {platform === "mszt" ? "Felhasználónév" : "E-mail cím"}
            </Label>
            <Input
              type={platform === "mszt" ? "text" : "email"}
              placeholder={platform === "mszt" ? "felhasznalonev" : "email@example.com"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-gray-200 focus-visible:ring-[#7CA9D3]"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Jelszó</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-gray-200 focus-visible:ring-[#7CA9D3] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <Shield size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              A jelszó titkosítva kerül tárolásra a szerveren. Az elemzések során automatikusan bejelentkezünk az Ön nevében a tartalom letöltéséhez.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {info.isConfigured && (
            <Button
              variant="outline"
              className="text-red-500 border-red-200 hover:bg-red-50 mr-auto"
              onClick={() => deleteMutation.mutate({ platform })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Törlés"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button
            onClick={() => saveMutation.mutate({ platform, username, password })}
            disabled={!username || !password || saveMutation.isPending}
            className="text-white gap-2"
            style={{ backgroundColor: "#7CA9D3" }}
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Platform card ──────────────────────────────────────────────────────────────

function PlatformCard({ info }: { info: PlatformInfo }) {
  const [showDialog, setShowDialog] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const utils = trpc.useUtils();

  const testMutation = trpc.platformCredentials.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      if (data.success) {
        toast.success(`${info.name}: Sikeres kapcsolat!`);
      } else {
        toast.error(`${info.name}: ${data.error ?? "Kapcsolat sikertelen"}`);
      }
      utils.platformCredentials.listPlatforms.invalidate();
    },
    onError: (err) => {
      setIsTesting(false);
      toast.error(`Hiba: ${err.message}`);
    },
  });

  const statusConfig = {
    connected: { icon: <CheckCircle2 size={14} />, color: "#16a34a", label: "Kapcsolódva" },
    failed: { icon: <XCircle size={14} />, color: "#dc2626", label: "Sikertelen" },
    untested: { icon: <Clock size={14} />, color: "#6b7280", label: "Nem tesztelve" },
  };

  const status = statusConfig[info.status];

  return (
    <>
      <div
        className="rounded-xl border bg-white p-5 flex flex-col gap-4"
        style={{ borderColor: info.isConfigured ? "#7CA9D3" : "#e5e7eb" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: info.isFree ? "#EBF3FA" : "#FEF3C7" }}
            >
              {info.isFree ? (
                <Globe size={18} style={{ color: "#7CA9D3" }} />
              ) : (
                <Lock size={18} className="text-amber-500" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">{info.name}</h3>
              <a
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: "#7CA9D3" }}
              >
                {info.url.replace("https://", "")}
                <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {info.isFree ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600 border border-green-100">
              Ingyenes
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 border border-amber-100">
              Előfizetéses
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed">{info.description}</p>

        {/* Status */}
        {!info.isFree && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color: status.color }}>{status.icon}</span>
              <span className="text-xs font-medium" style={{ color: status.color }}>{status.label}</span>
              {info.isConfigured && info.username && (
                <span className="text-xs text-gray-400">· {info.username}</span>
              )}
            </div>
            {info.lastConnectedAt && (
              <span className="text-xs text-gray-400">
                {new Date(info.lastConnectedAt).toLocaleDateString("hu-HU")}
              </span>
            )}
          </div>
        )}

        {info.status === "failed" && info.lastError && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
            <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{info.lastError}</p>
          </div>
        )}

        {/* Actions */}
        {info.isFree ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100">
            <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
            <p className="text-xs text-green-700">
              Ez a platform ingyenesen elérhető. Bejelentkezés nem szükséges.
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-xs border-gray-200"
              onClick={() => setShowDialog(true)}
            >
              <Lock size={12} />
              {info.isConfigured ? "Adatok módosítása" : "Bejelentkezési adatok"}
            </Button>
            {info.isConfigured && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-gray-200"
                disabled={isTesting}
                onClick={() => {
                  setIsTesting(true);
                  testMutation.mutate({ platform: info.platform });
                }}
              >
                {isTesting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Link2 size={12} />
                )}
                Teszt
              </Button>
            )}
          </div>
        )}
      </div>

      {showDialog && (
        <CredentialDialog
          platform={info.platform}
          info={info}
          open={showDialog}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlatformConnectionsPage() {
  const { data: platforms, isLoading } = trpc.platformCredentials.listPlatforms.useQuery();

  const connectedCount = platforms?.filter((p) => p.status === "connected").length ?? 0;
  const configuredCount = platforms?.filter((p) => p.isConfigured).length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Page header */}
      <div className="border-b" style={{ borderColor: "#e5e7eb", backgroundColor: "#F8FAFC" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7CA9D3" }}>
              <Link2 size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "#161718" }}>Platform-kapcsolatok</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Kösse össze a rendszert a jogszabályi adatbázisokkal. Ingyenes forrásoknál nincs szükség bejelentkezésre.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8">
        {/* Stats */}
        {platforms && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold" style={{ color: "#161718" }}>{platforms.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Összes platform</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold text-green-600">{connectedCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">Aktív kapcsolat</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "#e5e7eb" }}>
              <div className="text-2xl font-bold" style={{ color: "#7CA9D3" }}>{configuredCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">Beállított</div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mb-6 p-4 rounded-lg border bg-blue-50 border-blue-100 flex gap-3">
          <Shield size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <strong>Hogyan működik?</strong> Az ingyenes platformok (NJT, net.jogtar.hu, EUR-Lex) automatikusan elérhetők.
            A fizetős platformokhoz (MSZT Szabványtár, Jogtár Premium, Építésijog.hu) adja meg az előfizetéses fiókja
            adatait. A rendszer az elemzések során automatikusan bejelentkezik és letölti a szükséges tartalmakat.
          </div>
        </div>

        {/* Platform grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(platforms as PlatformInfo[] | undefined)?.map((p) => (
              <PlatformCard key={p.platform} info={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
