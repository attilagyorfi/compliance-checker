/** Egységes nézet olyan oldalhoz, amelyet csak admin érhet el. */

import { ShieldAlert } from "lucide-react";
import Header from "@/components/Header";

export function AccessDenied() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex-1 container py-16 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldAlert size={26} className="text-red-600" />
        </div>
        <p className="font-semibold text-text-strong">Hozzáférés megtagadva</p>
        <p className="text-sm text-text-muted text-center max-w-md">
          Ez az oldal csak admin szerepkörű felhasználóknak elérhető.
        </p>
      </main>
    </div>
  );
}
