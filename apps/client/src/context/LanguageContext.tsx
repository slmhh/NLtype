import { createContext, useContext, useCallback, useState, useEffect } from "react";
import type { Language } from "../types/game";
import { load, save } from "../services/storage";

const LANG_KEY = "lang";

interface LanguageCtx {
  language: Language;
  setLanguage: (l: Language) => void;
}

const Ctx = createContext<LanguageCtx>({
  language: "en",
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, set] = useState<Language>(() => load<Language>(LANG_KEY, "en"));

  useEffect(() => {
    save(LANG_KEY, language);
  }, [language]);

  const setLanguage = useCallback((l: Language) => set(l), []);

  return <Ctx.Provider value={{ language, setLanguage }}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  return useContext(Ctx);
}
