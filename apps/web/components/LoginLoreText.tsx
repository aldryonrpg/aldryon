"use client";

import { useState } from "react";
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

export function LoginLoreText({ fontClassName }: { fontClassName: string }) {
  const [language, setLanguage] = useState<LoreLanguage>("en");
  const target = SWITCH_TARGET[language];
  const TargetFlag = target.Flag;

  return (
    <>
      <button
        type="button"
        onClick={() => setLanguage(target.code)}
        aria-label={`Switch to ${target.label}`}
        className="wood-gold-button fixed top-4 left-4 z-30 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
      >
        <TargetFlag className="h-4 w-6 rounded-sm" />
        {target.label}
      </button>
      <p
        className={`${fontClassName} max-w-md text-center text-sm leading-relaxed text-stone-900 sm:text-base`}
      >
        {loginLore[language]}
      </p>
    </>
  );
}
