import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, Layout, Dropdown, Menu } from "@arco-design/web-react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";
import PermissionGuard from "./PermissionGuard";
import type { Language } from "../types/game";
import { ROLE_LABELS } from "../types/permissions";

export default function NavBar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const langs: { key: Language; label: string }[] = [
    { key: "en", label: "English" },
    { key: "zh", label: "中文" },
    { key: "code", label: "Code" },
  ];
  const current = langs.find((l) => l.key === language)!;

  const navLinkClass = (isActive: boolean) =>
    `text-sm tracking-[0.15em] transition-colors ${
      isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
    }`;

  const userMenu = (
    <Menu onClickMenuItem={(key) => { if (key === "logout") logout(); }}>
      <Menu.Item key="profile">
        <NavLink to="/profile" className="no-underline text-inherit">个人信息</NavLink>
      </Menu.Item>
      <PermissionGuard permission="admin:panel">
        <Menu.Item key="admin">
          <NavLink to="/admin" className="no-underline text-inherit">管理面板</NavLink>
        </Menu.Item>
      </PermissionGuard>
      <Menu.Item key="logout" style={{ color: "var(--color-text-3)" }}>退出登录</Menu.Item>
    </Menu>
  );

  return (
    <Layout.Header className="flex items-center px-6 h-14 border-b border-[var(--border)] bg-card/90 backdrop-blur-sm sticky top-0 z-50 transition-colors">
      {/* Brand */}
      <NavLink to="/" className="no-underline mr-8">
        <span className="text-[var(--text-primary)] font-bold tracking-[0.25em] text-base uppercase select-none">
          NLType
        </span>
      </NavLink>

      {/* Left nav links */}
      <div className="flex items-center gap-5">
        <NavLink to="/" end className="no-underline">
          {({ isActive }) => <span className={navLinkClass(isActive || location.pathname === "/game")}>游戏</span>}
        </NavLink>
        <NavLink to="/leaderboard" className="no-underline">
          {({ isActive }) => <span className={navLinkClass(isActive)}>排行榜</span>}
        </NavLink>
        <PermissionGuard permission="admin:panel">
          <NavLink to="/admin" className="no-underline">
            {({ isActive }) => <span className={navLinkClass(isActive)}>管理</span>}
          </NavLink>
        </PermissionGuard>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            onBlur={() => setTimeout(() => setLangOpen(false), 150)}
            className="text-xs tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors font-mono"
          >
            {current.key === "en" ? "EN" : current.key === "zh" ? "中文" : "Code"}
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

        {/* Auth */}
        {user ? (
          <Dropdown droplist={userMenu} trigger="click" position="br">
            <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-[var(--bg-alt)] transition-colors">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-mono font-bold">
                {user.username[0].toUpperCase()}
              </span>
              <span className="text-sm text-[var(--text-secondary)] font-mono">{user.username}</span>
              {user.role !== "user" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  user.role === "developer" ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                }`}>
                  {ROLE_LABELS[user.role]}
                </span>
              )}
            </button>
          </Dropdown>
        ) : (
          <Button
            type="outline"
            size="mini"
            onClick={() => setAuthOpen(true)}
            className="!text-xs !tracking-[0.15em] !rounded-lg !h-8 !border-[var(--border)] !text-[var(--text-secondary)]"
          >
            登录
          </Button>
        )}
      </div>

      <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
    </Layout.Header>
  );
}
