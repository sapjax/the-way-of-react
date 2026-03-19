"use client";

import { useRouter } from "next/navigation";
import { Locale, LOCALE_COOKIE, getOppositeLocale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  slug?: string;
  label: string;
};

export function LanguageToggle({ locale, slug, label }: Props) {
  const router = useRouter();

  function handleClick() {
    const nextLocale = getOppositeLocale(locale);
    window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    const nextPath = slug ? `/${nextLocale}/${slug}` : `/${nextLocale}`;
    router.push(nextPath);
  }

  return (
    <button type="button" className="lang-toggle" onClick={handleClick} aria-label={label}>
      <span aria-hidden="true">🌐</span>
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
