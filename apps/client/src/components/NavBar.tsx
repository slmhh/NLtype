import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, Divider, Layout } from "@arco-design/web-react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import type { Language } from "../types/game";

export default function NavBar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const langs: { key: Language; label: string }[] = [
    { key: "en", label: "English" },
    { key: "zh", label: "中文" },
  ];
  const current = langs.find((l) => l.key === language)!;

  return (
    <Layout.Header className="flex items-center justify-between px-6 h-14 border-b border-[var(--border)] bg-card/90 backdrop-blur-sm sticky top-0 z-50 transition-colors">
      {/* ── Left: brand ── */}
      <NavLink to="/" className="no-underline">
        <span className="text-[var(--text-primary)] font-bold tracking-[0.25em] text-base uppercase select-none">
          NLType
        </span>
      </NavLink>

      {/* ── Center: mode switch ── */}
      <div className="flex items-center gap-0.5 bg-[var(--bg-alt)] rounded-full p-0.5">
        <span className="px-5 py-1.5 text-sm tracking-[0.15em] rounded-full bg-[var(--accent)] text-white font-medium transition-all cursor-default select-none">
          单人模式
        </span>
        <span className="px-5 py-1.5 text-sm tracking-[0.15em] rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-not-allowed select-none">
          多人模式
        </span>
      </div>

      {/* ── Right: nav links + actions ── */}
      <div className="flex items-center gap-3">
        {/* Nav links */}
        <div className="flex items-center gap-2">
          <NavLink to="/" end className="no-underline">
            {({ isActive }) => (
              <span className={`text-sm tracking-[0.15em] transition-colors ${
                isActive || location.pathname === "/game"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
                游戏
              </span>
            )}
          </NavLink>
          <NavLink to="/leaderboard" className="no-underline">
            {({ isActive }) => (
              <span className={`text-sm tracking-[0.15em] transition-colors ${
                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
                排行榜
              </span>
            )}
          </NavLink>
        </div>

        <Divider type="vertical" className="!border-[var(--border)]" />

        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            onBlur={() => setTimeout(() => setLangOpen(false), 150)}
            className="text-xs tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors font-mono px-1.5 py-0.5 rounded"
          >
            {current.key === "en" ? "EN" : "中文"}
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[100px] bg-card border border-[var(--border)] rounded-lg shadow-card py-1 z-50">
              {langs.map((l) => (
                <button
                  key={l.key}
                  onMouseDown={() => { setLanguage(l.key); setLangOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs tracking-wider transition-colors font-mono ${
                    language === l.key
                      ? "text-[var(--accent)] bg-[var(--accent-soft)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-alt)]"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-alt)] transition-all text-base"
          aria-label="Toggle theme"
        >
          {theme === "light" ? "\u263E" : "\u2600"}
        </button>

        {/* Login */}
        <Button type="outline" size="mini" className="!text-xs !tracking-[0.15em] !rounded-lg !h-8 !border-[var(--border)] !text-[var(--text-secondary)]">
          登录
        </Button>
      </div>
    </Layout.Header>
  );
}
