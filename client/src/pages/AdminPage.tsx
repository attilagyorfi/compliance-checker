/**
 * Admin oldal — V11.16
 *
 * Csak role: "admin" user-ek érik el. A korábbi statisztikák, kuka-kezelés,
 * felhasználó- és projekt-listák megszűntek — az oldal a keresési előzményeket
 * mutatja (az egyetlen admin-only nézet, amire szükség van).
 */

import { Shield, Loader2 } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import Header from "@/components/Header";
import SearchHistorySection from "@/components/SearchHistorySection";
import { trpc } from "@/lib/trpc";

export default function AdminPage() {
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 5 * 60 * 1000 });
  const isAdmin = meQuery.data?.role === "admin";

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 container py-16 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin mr-2" /> Betöltés…
        </main>
      </div>
    );
  }

  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="border-b" style={{ borderColor: "var(--line)", backgroundColor: "var(--page-bg-subtle)" }}>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#a16207" }}>
              <Shield size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>Admin</h1>
          </div>
          <p className="text-text-muted text-sm ml-11">
            Keresési előzmények áttekintése.
          </p>
        </div>
      </div>

      <main className="flex-1 container py-8">
        <SearchHistorySection />
      </main>
    </div>
  );
}
