import { useState, useEffect } from "react";
import { Message, Select } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";

export default function SettingsPage() {
  const { user, token } = useAuth();
  const { t, lang: uiLang, setLang: setUILang } = useI18n();
  const { theme, toggle } = useTheme();
  const [saving, setSaving] = useState(false);

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    if (theme !== newTheme) toggle();
    if (!token) return;
    setSaving(true);
    try {
      await api("/api/auth/settings", {
        method: "PATCH",
        body: { settings: { theme: newTheme, uiLang } },
        token,
      });
    } catch (e) { if (import.meta.env.DEV) console.warn("saveSettings failed", e); }
    setSaving(false);
  };

  const handleUILangChange = async (newLang: string) => {
    setUILang(newLang as "zh" | "en");
    if (!token) return;
    setSaving(true);
    try {
      await api("/api/auth/settings", {
        method: "PATCH",
        body: { settings: { theme, uiLang: newLang } },
        token,
      });
    } catch (e) { if (import.meta.env.DEV) console.warn("saveUILang failed", e); }
    setSaving(false);
  };

  const themeOptions = [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];

  const langOptions = [
    { value: "zh", label: t("lang.zh") },
    { value: "en", label: t("lang.en") },
  ];

  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      <div className="w-full max-w-lg">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">
          {t("settings.title")}
        </h2>

        <div className="bg-card rounded-2xl shadow-card p-8 space-y-6">
          {/* Theme */}
          <div>
            <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-3">
              {t("settings.theme")}
            </label>
            <div className="flex gap-3">
              {themeOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => handleThemeChange(o.value as "light" | "dark")}
                  className={`flex-1 py-3 rounded-xl text-sm tracking-wider font-mono transition-all border ${
                    theme === o.value
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* UI Language */}
          <div>
            <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-3">
              {t("settings.uiLanguage")}
            </label>
            <Select
              value={uiLang}
              onChange={handleUILangChange}
              options={langOptions}
              className="!w-full"
            />
          </div>

          {user && (
            <p className="text-[var(--text-tertiary)] text-xs text-center tracking-wider pt-2">
              {t("settings.syncNote")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
