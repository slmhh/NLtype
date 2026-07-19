import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, Layout, Dropdown, Menu } from "@arco-design/web-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { UILang } from "../context/I18nContext";
import AuthModal from "./AuthModal";
import PermissionGuard from "./PermissionGuard";

export default function NavBar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { lang: uiLang, setLang: setUILang, t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);

  const navLinkClass = (isActive: boolean) =>
    `text-sm tracking-[0.15em] transition-colors ${
      isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
    }`;

  const userMenu = (
    <Menu onClickMenuItem={(key) => { if (key === "logout") logout(); }}>
      <Menu.Item key="profile">
        <NavLink to="/profile" className="no-underline text-inherit">{t("nav.profile")}</NavLink>
      </Menu.Item>
      <Menu.Item key="settings">
        <NavLink to="/settings" className="no-underline text-inherit">{t("settings.title")}</NavLink>
      </Menu.Item>
      <PermissionGuard permission="admin:panel">
        <Menu.Item key="admin">
          <NavLink to="/admin" className="no-underline text-inherit">{t("nav.adminPanel")}</NavLink>
        </Menu.Item>
      </PermissionGuard>
      <PermissionGuard permission="roles:assign">
        <Menu.Item key="developer">
          <NavLink to="/developer" className="no-underline text-inherit">{t("nav.devPanel")}</NavLink>
        </Menu.Item>
      </PermissionGuard>
      <Menu.Item key="logout" style={{ color: "var(--color-text-3)" }}>{t("nav.logout")}</Menu.Item>
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
          {({ isActive }) => <span className={navLinkClass(isActive || location.pathname === "/game")}>{t("nav.game")}</span>}
        </NavLink>
        <NavLink to="/leaderboard" className="no-underline">
          {({ isActive }) => <span className={navLinkClass(isActive)}>{t("nav.leaderboard")}</span>}
        </NavLink>
        <NavLink to="/lobby" className="no-underline">
          {({ isActive }) => <span className={navLinkClass(isActive)}>{t("nav.multiplayer")}</span>}
        </NavLink>
        {user && (
          <NavLink to="/entries" className="no-underline">
            {({ isActive }) => <span className={navLinkClass(isActive)}>{t("nav.entries")}</span>}
          </NavLink>
        )}
        <PermissionGuard permission="admin:panel">
          <NavLink to="/admin" className="no-underline">
            {({ isActive }) => <span className={navLinkClass(isActive)}>{t("nav.admin")}</span>}
          </NavLink>
        </PermissionGuard>
        <PermissionGuard permission="roles:assign">
          <NavLink to="/developer" className="no-underline">
            {({ isActive }) => <span className={navLinkClass(isActive)}>{t("nav.developer")}</span>}
          </NavLink>
        </PermissionGuard>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* UI language dropdown */}
        <Dropdown
          droplist={
            <Menu onClickMenuItem={(key) => setUILang(key as UILang)}>
              {(["zh", "en"] as const).map((l) => (
                <Menu.Item key={l}>{uiLang === l ? "✓ " : ""}{l === "zh" ? "中文" : "EN"}</Menu.Item>
              ))}
            </Menu>
          }
          trigger="click"
          position="br"
        >
          <button className="text-xs font-mono tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
            {uiLang === "zh" ? "中" : "EN"}
          </button>
        </Dropdown>

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
                  {t(`role.${user.role}`)}
                </span>
              )}
            </button>
          </Dropdown>
        ) : (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[var(--bg-alt)] text-[var(--text-tertiary)]">
              {t("role.guest")}
            </span>
            <Button
              type="outline"
              size="mini"
              onClick={() => setAuthOpen(true)}
              className="!text-xs !tracking-[0.15em] !rounded-lg !h-8 !border-[var(--border)] !text-[var(--text-secondary)]"
            >
              {t("nav.login")}
            </Button>
          </>
        )}
      </div>

      <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
    </Layout.Header>
  );
}
