import Link from "next/link";
import type { ChapterMeta } from "@/lib/chapters";
import type { Locale } from "@/lib/i18n";
import { getChapterHref } from "@/lib/routes";

type Props = {
  locale: Locale;
  previous: ChapterMeta | null;
  next: ChapterMeta | null;
  previousLabel: string;
  nextLabel: string;
};

export function ChapterNav({ locale, previous, next, previousLabel, nextLabel }: Props) {
  if (!previous && !next) return null;

  return (
    <nav className="chapter-nav" aria-label="Chapter navigation">
      {previous ? (
        <Link className="chapter-nav__link" href={getChapterHref(locale, previous.slug)}>
          <span className="chapter-nav__eyebrow">{previousLabel}</span>
          <span>{previous.title}</span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link className="chapter-nav__link chapter-nav__link--next" href={getChapterHref(locale, next.slug)}>
          <span className="chapter-nav__eyebrow">{nextLabel}</span>
          <span>{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
