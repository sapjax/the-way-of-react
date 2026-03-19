"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

type Props = {
  locale: Locale;
  slug?: string;
  githubUrl: string;
  homeLabel: string;
  bookTitle: string;
  switchLanguageLabel: string;
  toggleThemeLabel: string;
  menuLabel: string;
  onMenuToggle?: () => void;
};

export function Navbar({
  locale,
  slug,
  githubUrl,
  homeLabel,
  bookTitle,
  switchLanguageLabel,
  toggleThemeLabel,
  menuLabel,
  onMenuToggle
}: Props) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false); // scrolling down
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true); // scrolling up
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${isVisible ? "" : "site-header--hidden"}`}>
      <div className="site-header__left">
        <button type="button" className="icon-button mobile-only" onClick={onMenuToggle} aria-label={menuLabel}>
          ☰
        </button>
        <Link className="brand-link" href={`/${locale}`}>
          <span className="brand-link__home">道 · React</span>
          <span className="brand-link__title">{bookTitle}</span>
          <span className="brand-link__meta">{homeLabel}</span>
        </Link>
      </div>

      <div className="site-header__actions">
        <a className="icon-link" href={githubUrl} target="_blank" rel="noreferrer" style={{ gap: "8px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          GitHub
        </a>
        <LanguageToggle locale={locale} slug={slug} label={switchLanguageLabel} />
        <ThemeToggle label={toggleThemeLabel} />
      </div>
    </header>
  );
}
