import type { MetadataRoute } from "next";
import { getAllChapters } from "@/lib/chapters";
import { getChapterHref } from "@/lib/routes";

const BASE_URL = "https://the-way-of-react.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["en", "zh"] as const;
  const entries = locales.flatMap((locale) =>
    getAllChapters(locale).map((chapter) => ({
      url: `${BASE_URL}${getChapterHref(locale, chapter.slug)}`,
      lastModified: new Date()
    }))
  );

  return [
    { url: `${BASE_URL}/`, lastModified: new Date() },
    ...locales.map((locale) => ({ url: `${BASE_URL}/${locale}`, lastModified: new Date() })),
    ...entries
  ];
}
