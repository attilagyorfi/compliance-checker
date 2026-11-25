/** Felhasználók az admin oldalon: új felhasználó felvétele és a meglévők listája. */

import { useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QueryErrorState } from "@/components/QueryErrorState";
import { trpc } from "@/lib/trpc";
import { hasQueryLoadFailed } from "@shared/analysisRoute";

const ROLE_LABELS = {
  user: "Felhasználó",
  reviewer: "Ellenőr",
  admin: "Admin",
} as const;

type Role = keyof typeof ROLE_LABELS;

export default function AdminUsersSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("user");

  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.listUsers.useQuery();
  const createMut = trpc.admin.createUser.useMutation({
    onSuccess: (_data, input) => {
      toast.success(`Felhasználó felvéve: ${input.email}`);
      setEmail("");
      setName("");
      setRole("user");
      utils.admin.listUsers.invalidate();
    },
    onError: (err) =>
      toast.error(
        err.data?.code === "BAD_REQUEST"
          ? "Ellenőrizd a nevet és az e-mail-címet."
          : err.message,
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ email, name, role });
  };

  return (
    <section className="rounded-xl border bg-surface p-5 space-y-5" style={{ borderColor: "var(--line)" }}>
      <h2 className="text-base font-semibold text-text-strong flex items-center gap-2">
        <Users size={16} style={{ color: "#7CA9D3" }} />
        Felhasználók
      </h2>

      <form onSubmit={submit} className="space-y-2">
        <p className="text-sm font-medium text-text-strong">Felhasználó hozzáadása</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-name">Név</Label>
            <Input id="new-user-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-email">E-mail-cím</Label>
            <Input id="new-user-email" type="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nev@pelda.hu" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-role">Szerepkör</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="new-user-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="gap-2 text-white" style={{ backgroundColor: "#7CA9D3" }} disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Hozzáadás
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          A felvett felhasználó a belépőoldalon, ezzel az e-mail-címmel kérhet belépési linket. Értesítést nem küldünk neki.
        </p>
      </form>

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin" style={{ color: "#7CA9D3" }} />
        </div>
      ) : hasQueryLoadFailed(usersQuery) ? (
        <QueryErrorState onRetry={usersQuery.refetch} />
      ) : (
        <ul className="divide-y text-sm" style={{ borderColor: "var(--line)" }}>
          {usersQuery.data?.map((u) => (
            <li key={u.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-text-strong">{u.name || "Név nélkül"}</span>
              <span className="text-text-muted break-all">{u.email}</span>
              <span className="text-xs text-text-faint ml-auto">{ROLE_LABELS[u.role]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
