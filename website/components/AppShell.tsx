"use client";

import { useState } from "react";
import type { ChapterMeta } from "@/lib/chapters";
import type { Locale } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { TableOfContents } from "@/components/TableOfContents";
import type { TocItem } from "@/lib/markdown";

type Props = {
  locale: Locale;
  slug?: string;
  chapters: ChapterMeta[];
  toc: TocItem[];
  showSidebar?: boolean;
  showToc?: boolean;
  sidebarTitle: string;
  tocTitle: string;
  homeLabel: string;
  bookTitle: string;
  switchLanguageLabel: string;
  toggleThemeLabel: string;
  menuLabel: string;
  githubUrl: string;
  children: React.ReactNode;
};

export function AppShell({
  locale,
  slug,
  chapters,
  toc,
  showSidebar = true,
  showToc = true,
  sidebarTitle,
  tocTitle,
  homeLabel,
  bookTitle,
  switchLanguageLabel,
  toggleThemeLabel,
  menuLabel,
  githubUrl,
  children
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="site-frame">
      <Navbar
        locale={locale}
        slug={slug}
        githubUrl={githubUrl}
        homeLabel={homeLabel}
        bookTitle={bookTitle}
        switchLanguageLabel={switchLanguageLabel}
        toggleThemeLabel={toggleThemeLabel}
        menuLabel={menuLabel}
        onMenuToggle={() => setMobileOpen((value) => !value)}
      />

      <div className={`site-grid ${!showSidebar ? "site-grid--no-sidebar" : ""} ${!showToc ? "site-grid--no-toc" : ""}`}>
        <Sidebar
          chapters={chapters}
          currentSlug={slug}
          locale={locale}
          title={sidebarTitle}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
          showOnDesktop={showSidebar}
        />
        <main className="site-main">{children}</main>
        {showToc ? <TableOfContents items={toc} title={tocTitle} /> : null}
      </div>
    </div>
  );
}
