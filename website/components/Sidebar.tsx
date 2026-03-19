import Link from "next/link";
import type { ChapterMeta } from "@/lib/chapters";
import type { Locale } from "@/lib/i18n";
import { getChapterHref } from "@/lib/routes";

type Props = {
  chapters: ChapterMeta[];
  currentSlug?: string;
  locale: Locale;
  title: string;
  mobileOpen?: boolean;
  onNavigate?: () => void;
  showOnDesktop?: boolean;
};

export function Sidebar({ 
  chapters, 
  currentSlug, 
  locale, 
  title, 
  mobileOpen = false, 
  onNavigate,
  showOnDesktop = true
}: Props) {
  return (
    <>
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""} ${!showOnDesktop ? "sidebar--desktop-hidden" : ""}`}>
        <div className="sidebar__header">
          <span>{title}</span>
          <span className="sidebar__eyebrow">{chapters.length}</span>
        </div>
        <nav aria-label={title} className="sidebar__nav">
          {chapters.map((chapter) => (
            <Link
              key={chapter.slug}
              href={getChapterHref(locale, chapter.slug)}
              className={chapter.slug === currentSlug ? "sidebar__link sidebar__link--active" : "sidebar__link"}
              onClick={onNavigate}
            >
              <span className="sidebar__number">{chapter.chapterNumber}</span>
              <span>{chapter.title.replace(/^Chapter\s+\d+:\s+|^第.+章：/, "")}</span>
            </Link>
          ))}
        </nav>
      </aside>
      {mobileOpen ? <div className="sidebar-backdrop" onClick={onNavigate} aria-hidden="true" /> : null}
    </>
  );
}
