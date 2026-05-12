"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { translations, type AppLanguage } from "./translations";

type LanguageContextType = {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: typeof translations.pt;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>("pt");
  const t = translations[lang];
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
