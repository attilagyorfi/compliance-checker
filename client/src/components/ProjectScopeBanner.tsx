/**
 * Sárga sáv a listázó oldalak tetején, jelezve hogy az adatok az aktív
 * projektre szűrnek. Csak akkor renderelődik, ha van aktív projekt.
 */

import { FolderOpen, X } from "lucide-react";
import { Link } from "wouter";
import { useActiveProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";

interface Props {
  /** A leírás a sávban — pl. "Az alábbi keresések csak a(z) <projektnév> projektben végzettek." */
  describe: (projectName: string) => string;
}

export function ProjectScopeBanner({ describe }: Props) {
  const { activeProjectId, clearActiveProject } = useActiveProject();
  const projectQuery = trpc.projects.getById.useQuery(
    { id: activeProjectId ?? 0 },
    { enabled: activeProjectId != null },
  );

  if (activeProjectId == null) return null;
  const projectName = projectQuery.data?.name ?? `#${activeProjectId}`;

  return (
    <div
      className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2"
      style={{ backgroundColor: "#f0f7fb", borderColor: "#cee0ed", color: "#1a4a6b" }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 text-xs">
        <FolderOpen size={13} style={{ color: "#7CA9D3" }} />
        <span className="truncate">{describe(projectName)}</span>
        <Link
          href={`/projects/${activeProjectId}`}
          className="underline whitespace-nowrap"
          style={{ color: "#5a8ab8" }}
        >
          Projekt megnyitása
        </Link>
      </div>
      <button
        onClick={clearActiveProject}
        className="flex items-center gap-1 text-xs hover:underline whitespace-nowrap"
        title="Aktív projekt feloldása — minden adat látszódik"
        style={{ color: "#5a8ab8" }}
      >
        <X size={12} />
        Feloldás
      </button>
    </div>
  );
}
