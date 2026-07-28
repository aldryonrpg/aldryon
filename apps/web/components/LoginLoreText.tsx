"use client";

import { useEffect, useState } from "react";
import { BrazilFlag } from "@/components/flags/BrazilFlag";
import { UkFlag } from "@/components/flags/UkFlag";
import { type LoreLanguage, loginLore } from "@/lib/loginLore";

const SWITCH_TARGET: Record<
  LoreLanguage,
  { code: LoreLanguage; Flag: typeof BrazilFlag; label: string }
> = {
  en: { code: "pt", Flag: BrazilFlag, label: "PT-BR" },
  pt: { code: "en", Flag: UkFlag, label: "English" },
};

/** Remembers the visitor's language choice across visits — English is
 * always the state on first paint (server-rendered/static, so it can't
 * read localStorage yet) and only swaps to a saved "pt" after mount, which
 * is also the correct behavior for an actual first-time visitor (nothing
 * saved yet, stays English). */
const LANGUAGE_STORAGE_KEY = "aldryon-login-language";

export function LoginLoreText({ fontClassName }: { fontClassName: string }) {
  const [language, setLanguage] = useState<LoreLanguage>("en");

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "en" || saved === "pt") setLanguage(saved);
  }, []);

  function handleSwitch(next: LoreLanguage) {
    setLanguage(next);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }

  const target = SWITCH_TARGET[language];
  const TargetFlag = target.Flag;

  return (
    <>
      <button
        type="button"
        onClick={() => handleSwitch(target.code)}
        aria-label={`Switch to ${target.label}`}
        className="wood-gold-button fixed top-4 left-4 z-30 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
      >
        <TargetFlag className="h-4 w-6 rounded-sm" />
        {target.label}
      </button>
      <div className="flex max-w-md flex-col gap-3">
        <p
          className={`${fontClassName} text-center text-sm leading-relaxed text-stone-900 [text-transform:math-auto] sm:text-base`}
        >
          {loginLore[language].body}
        </p>
        <p
          className={`${fontClassName} whitespace-pre-line text-center text-sm leading-relaxed text-stone-900 [text-transform:math-auto] sm:text-base`}
        >
          {loginLore[language].closing}
        </p>
      </div>
    </>
  );
}
