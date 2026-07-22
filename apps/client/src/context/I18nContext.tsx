import { createContext, useContext, useCallback, useState, useEffect } from "react";
import { load, save } from "../services/storage";
import zh from "../data/i18n/zh";
import en from "../data/i18n/en";

export type UILang = "zh" | "en";
const UI_LANG_KEY = "ui-lang";

const dict: Record<UILang, Record<string, string>> = { zh, en };

function tpl(t: string, vars?: Record<string, string | number>): string {
  if (!vars) return t;
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

interface I18nCtx {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({
  lang: "zh",
  setLang: () => {},
  t: (k, vars) => tpl(dict.zh[k] ?? k, vars),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<UILang>(() => load<UILang>(UI_LANG_KEY, "zh"));

  useEffect(() => {
    save(UI_LANG_KEY, lang);
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tpl(dict[lang]?.[key] ?? key, vars),
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
