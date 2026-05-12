import { Link, useLocation } from "wouter";
import { ClipboardList, Menu, X, BookOpen, Search, History, Database, LayoutDashboard, FolderOpen, ChevronDown, Check, Shield, Settings as SettingsIcon, Sun, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useActiveProject } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/109169450/Lkoz8HcKNEz8RQmUhyV4qZ/mmernoki_logo_326d035b.webp";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projektek", icon: FolderOpen },
  { href: "/search", label: "Szabványkereső", icon: Search },
  { href: "/knowledge-base", label: "Tudástár", icon: Database },
  { href: "/regulations", label: "Jogszabályok", icon: BookOpen },
  { href: "/search-history", label: "Előzmények", icon: History },
  { href: "/audit", label: "Audit", icon: Shield },
];

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-8 h-8 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-all"
      title={isDark ? "Világos téma" : "Sötét téma"}
      aria-label={isDark ? "Váltás világos témára" : "Váltás sötét témára"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function MobileThemeRow() {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {isDark ? "Világos téma" : "Sötét téma"}
    </button>
  );
}

function ActiveProjectSelector() {
  const { activeProjectId, setActiveProjectId, clearActiveProject } = useActiveProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const projectsQuery = trpc.projects.list.useQuery({ includeDeleted: false });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const projects = projectsQuery.data ?? [];

  // Auto-clear the active project if it has been deleted in another tab/browser
  // or by another user. Only checked once the list has loaded successfully.
  useEffect(() => {
    if (activeProjectId == null) return;
    if (!projectsQuery.isSuccess) return;
    const exists = projects.some((p) => p.id === activeProjectId);
    if (!exists) clearActiveProject();
  }, [activeProjectId, projectsQuery.isSuccess, projects, clearActiveProject]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const label = activeProject ? activeProject.name : "Minden projekt";
  const isScoped = activeProjectId != null && activeProject != null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
          isScoped
            ? "bg-white/10 border-white/20 text-white"
            : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
        }`}
        title={isScoped ? "Aktív projekt — kattints a váltáshoz" : "Nincs aktív projekt — minden adat látszik"}
      >
        <FolderOpen size={13} style={isScoped ? { color: "#7CA9D3" } : undefined} />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-lg shadow-xl border z-50"
          style={{ backgroundColor: "white", borderColor: "#e5e7eb" }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: "#e5e7eb" }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktív projekt</p>
            <p className="text-xs text-gray-400 mt-0.5">A listák és keresések ehhez szűrnek.</p>
          </div>
          <button
            onClick={() => { clearActiveProject(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
          >
            <span className={!isScoped ? "font-semibold text-gray-900" : "text-gray-700"}>
              Minden projekt
            </span>
            {!isScoped && <Check size={14} style={{ color: "#7CA9D3" }} />}
          </button>
          <div className="border-t" style={{ borderColor: "#f3f4f6" }} />
          {projectsQuery.isLoading ? (
            <div className="px-3 py-3 text-xs text-gray-400">Projektek betöltése…</div>
          ) : projects.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              Nincs még projekt. Hozz létre egyet a <Link href="/projects" onClick={() => setOpen(false)} className="underline" style={{ color: "#7CA9D3" }}>Projektek</Link> oldalon.
            </div>
          ) : (
            projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${isActive ? "font-semibold text-gray-900" : "text-gray-700"}`}>{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-gray-400 truncate">{p.description}</p>
                    )}
                  </div>
                  {isActive && <Check size={14} className="flex-shrink-0" style={{ color: "#7CA9D3" }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      style={{ backgroundColor: "#161718" }}
      className="sticky top-0 z-50 shadow-md"
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src={LOGO_URL}
              alt="M Mérnöki Iroda Kft."
              className="h-10 w-auto object-contain brightness-0 invert"
            />
            <div className="hidden sm:block">
              <div className="text-white font-semibold text-sm leading-tight">
                M Mérnöki Iroda Kft.
              </div>
              <div style={{ color: "#7CA9D3" }} className="text-xs font-medium tracking-wide uppercase">
                Tervmegfelelőség-ellenőrző
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = location === href || location.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  style={isActive ? { backgroundColor: "#7CA9D3", color: "white" } : {}}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Active project selector + Theme toggle + Settings icon — desktop only */}
          <div className="hidden md:flex items-center gap-2 ml-2">
            <ActiveProjectSelector />
            <ThemeToggleButton />
            <Link
              href="/settings"
              className={`flex items-center justify-center w-8 h-8 rounded transition-all ${
                location === "/settings"
                  ? "text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              style={location === "/settings" ? { backgroundColor: "#7CA9D3" } : {}}
              title="Beállítások"
              aria-label="Beállítások"
            >
              <SettingsIcon size={15} />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-300 hover:text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menü"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 py-2 pb-3">
            <div className="px-2 pb-2">
              <ActiveProjectSelector />
            </div>
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-gray-300 hover:text-white"
                  }`}
                  style={isActive ? { color: "#7CA9D3" } : {}}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                location === "/settings" ? "text-white" : "text-gray-300 hover:text-white"
              }`}
              style={location === "/settings" ? { color: "#7CA9D3" } : {}}
            >
              <SettingsIcon size={16} />
              Beállítások
            </Link>
            <MobileThemeRow />
          </div>
        )}
      </div>
    </header>
  );
}
