import { Link, useLocation } from "wouter";
import { Menu, X, BookOpen, Search, Settings as SettingsIcon, Sun, Moon, ShieldAlert, Bell, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/109169450/Lkoz8HcKNEz8RQmUhyV4qZ/mmernoki_logo_326d035b.webp";

// V11.16: leegyszerűsített menü. A Dashboard, Projektek, Tudástár, Előzmények és
// Audit menüpontok megszűntek (az Előzmények az Admin oldalra költözött).
const navItems = [
  { href: "/search", label: "Szabványkereső", icon: Search },
  { href: "/regulations", label: "Jogszabályok", icon: BookOpen },
];

// Admin nav-item, csak role: "admin" user-eknek látszik
const adminNavItem = { href: "/admin", label: "Admin", icon: ShieldAlert };

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

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });
  const listQuery = trpc.notifications.list.useQuery(
    { unreadOnly: false, limit: 15 },
    { enabled: open, retry: false },
  );
  const utils = trpc.useUtils();
  const markReadMut = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllMut = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Don't show the bell at all if the user isn't authenticated (unreadCount errors)
  if (unreadQuery.isError) return null;

  const count = unreadQuery.data?.count ?? 0;
  const items = listQuery.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-all"
        title={count > 0 ? `${count} olvasatlan értesítés` : "Értesítések"}
        aria-label="Értesítések"
      >
        <Bell size={15} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ backgroundColor: "#dc2626" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-[480px] overflow-hidden rounded-lg shadow-xl border z-50 flex flex-col"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "var(--line)" }}>
            <p className="text-xs font-semibold text-text-strong uppercase tracking-wide">Értesítések</p>
            {count > 0 && (
              <button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                className="text-xs text-text-muted hover:text-text-strong underline"
              >
                Mind olvasottra
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="px-3 py-4 text-xs text-text-faint text-center">Betöltés…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-xs text-text-faint text-center">Nincs új értesítés.</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b text-xs flex items-start gap-2 cursor-pointer hover:bg-page-bg-subtle transition-colors ${n.isRead ? "" : "bg-page-bg-subtle"}`}
                  style={{ borderColor: "var(--line-subtle)" }}
                  onClick={() => {
                    if (!n.isRead) markReadMut.mutate({ id: n.id });
                    if (n.link) {
                      setOpen(false);
                      navigate(n.link);
                    }
                  }}
                >
                  {!n.isRead && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: "#7CA9D3" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`${n.isRead ? "text-text-default" : "text-text-strong font-medium"} truncate`}>{n.title}</p>
                    {n.body && <p className="text-text-muted line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-text-faint mt-1">
                      {new Date(n.createdAt).toLocaleString("hu-HU", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {n.link && <ExternalLink size={11} className="text-text-faint flex-shrink-0 mt-0.5" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Admin-link csak akkor látszik, ha a user role === "admin"
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const isAdmin = meQuery.data?.role === "admin";
  const effectiveNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

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
            {effectiveNavItems.map(({ href, label, icon: Icon }) => {
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

          {/* Notifications + Theme toggle + Settings icon — desktop only */}
          <div className="hidden md:flex items-center gap-2 ml-2">
            <NotificationsBell />
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
            {effectiveNavItems.map(({ href, label, icon: Icon }) => {
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
