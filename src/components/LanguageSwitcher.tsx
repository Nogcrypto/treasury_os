"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function toggle() {
    const next = locale === "pt" ? "en" : "pt";
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[10px] font-mono text-fg-3 hover:text-fg hover:border-fg-3 transition-all"
      title={locale === "pt" ? "Switch to English" : "Mudar para Português"}
    >
      <span className={locale === "pt" ? "text-fg" : "text-fg-3"}>PT</span>
      <span className="text-fg-3/40">|</span>
      <span className={locale === "en" ? "text-fg" : "text-fg-3"}>EN</span>
    </button>
  );
}
