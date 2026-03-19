import type { Locale } from "@/lib/i18n";

export function getChapterHref(locale: Locale, slug: string) {
  return `/${locale}/${slug}`;
}
