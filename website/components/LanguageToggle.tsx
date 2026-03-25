"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, Locale, LOCALE_COOKIE } from "@/lib/i18n";

type Props = {
  locale: Locale;
  slug?: string;
  label: string;
};

export function LanguageToggle({ locale, slug, label }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      setOpen(false);
      return;
    }

    window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    const nextPath = slug ? `/${nextLocale}/${slug}` : `/${nextLocale}`;
    setOpen(false);
    router.push(nextPath);
  }

  function displayName(targetLocale: Locale) {
    if (targetLocale === "en") return "English";
    if (targetLocale === "zh") return "中文";
    return "日本語";
  }

  return (
    <div className="lang-menu" ref={rootRef}>
      <button
        type="button"
        className="lang-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden="true">🌐</span>
        <span>{displayName(locale)}</span>
        <span className={`lang-toggle__caret ${open ? "lang-toggle__caret--open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="lang-menu__list" role="menu" aria-label={label}>
          {LOCALES.map((targetLocale) => (
            <li key={targetLocale} role="none">
              <button
                type="button"
                className={`lang-menu__item ${targetLocale === locale ? "lang-menu__item--active" : ""}`}
                role="menuitemradio"
                aria-checked={targetLocale === locale}
                onClick={() => switchLocale(targetLocale)}
              >
                {displayName(targetLocale)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
