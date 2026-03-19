import { Link, useLocation } from "wouter";
import { FileSearch, ClipboardList, Menu, X, BookOpen, Link2, Search, History } from "lucide-react";
import { useState } from "react";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/109169450/Lkoz8HcKNEz8RQmUhyV4qZ/mmernoki_logo_326d035b.webp";

const navItems = [
  { href: "/analysis", label: "Ellenőrzés", icon: FileSearch },
  { href: "/search", label: "Szabványkereső", icon: Search },
  { href: "/reports", label: "Riportok", icon: ClipboardList },
  { href: "/regulations", label: "Jogszabályok", icon: BookOpen },
  { href: "/platforms", label: "Platformok", icon: Link2 },
];

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
                  className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all duration-150 ${
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
          </div>
        )}
      </div>
    </header>
  );
}
