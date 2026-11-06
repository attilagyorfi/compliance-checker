/**
 * Egységes hibanézet sikertelen kezdeti betöltéshez. A szöveg szándékosan
 * rögzített: a nyers hibaüzenet angol vagy technikai is lehet.
 */

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Általában a lekérdezés `refetch` függvénye. */
  onRetry: () => unknown;
}

export function QueryErrorState({ onRetry }: Props) {
  return (
    <div role="alert" className="text-center py-20">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-red-50">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
        Nem sikerült betölteni az adatokat
      </h2>
      <p className="text-text-faint text-sm mb-6">
        Kérjük, ellenőrizze az internetkapcsolatát, majd próbálja újra.
      </p>
      <Button onClick={() => onRetry()} className="gap-2 text-white" style={{ backgroundColor: "#7CA9D3" }}>
        <RotateCcw size={15} />
        Újrapróbálom
      </Button>
    </div>
  );
}
