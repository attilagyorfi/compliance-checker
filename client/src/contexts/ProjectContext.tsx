/**
 * ProjectContext — V11.2 globális "aktív projekt" állapot.
 *
 * Ha be van állítva, a listázó és kereső oldalak automatikusan erre a projektre
 * szűrnek (Dashboard, Tudástár, Keresési előzmények stb.), és az új analízis /
 * KB-feltöltés / keresés flow-k alapértelmezetten ehhez a projekthez
 * rendelődnek. localStorage-ben perzisztált (`active-project-id`), hogy reload
 * után is megmaradjon. Null = nincs aktív projekt = "minden adat" nézet.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface ProjectContextType {
  activeProjectId: number | null;
  setActiveProjectId: (id: number | null) => void;
  /** Convenience: clear the active project (same as setActiveProjectId(null)). */
  clearActiveProject: () => void;
  /** True when a project is selected; lets pages quickly conditionalize UI. */
  isScoped: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = "active-project-id";

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<number | null>(readStoredId);

  useEffect(() => {
    try {
      if (activeProjectId == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(activeProjectId));
    } catch {
      // ignore storage errors (e.g. private mode)
    }
  }, [activeProjectId]);

  const setActiveProjectId = useCallback((id: number | null) => {
    setActiveProjectIdState(id);
  }, []);

  const clearActiveProject = useCallback(() => setActiveProjectIdState(null), []);

  return (
    <ProjectContext.Provider
      value={{
        activeProjectId,
        setActiveProjectId,
        clearActiveProject,
        isScoped: activeProjectId != null,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useActiveProject(): ProjectContextType {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within ProjectProvider");
  }
  return ctx;
}
