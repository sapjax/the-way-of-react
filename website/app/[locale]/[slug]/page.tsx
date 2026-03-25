import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { ChapterNav } from "@/components/ChapterNav";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { getAllChapters, getChapterBySlug, getChapterNeighbors, resolveMarkdownAsset } from "@/lib/chapters";
import { extractToc } from "@/lib/markdown";
import { LOCALES, getUIText, isLocale } from "@/lib/i18n";
import { getChapterHref } from "@/lib/routes";

const GITHUB_URL = "https://github.com/sapjax/the-way-of-react";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getAllChapters(locale).map((chapter) => ({
      locale,
      slug: chapter.slug
    }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) return {};

  const chapter = getChapterBySlug(rawLocale, slug);
  if (!chapter) return {};

  const image = chapter.heroImage ? resolveMarkdownAsset(chapter.heroImage) : undefined;

  return {
    title: `${chapter.title} - The Way of React`,
    description: chapter.description,
    openGraph: {
      title: chapter.title,
      description: chapter.description,
      images: image ? [image] : undefined
    }
  };
}

export default async function ChapterPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();

  const locale = rawLocale;
  const chapter = getChapterBySlug(locale, slug);
  if (!chapter) notFound();

  const text = getUIText(locale);
  const chapters = getAllChapters(locale);
  const toc = extractToc(chapter.content);
  const { previous, next } = getChapterNeighbors(locale, slug);
  const heroImage = chapter.heroImage ? resolveMarkdownAsset(chapter.heroImage) : null;
  const demoHref = chapter.hasDemo ? `/api/demo/ch${chapter.chapterNumber}` : null;

  return (
    <AppShell
      locale={locale}
      slug={slug}
      chapters={chapters}
      toc={toc}
      sidebarTitle={text.tableOfContents}
      tocTitle={text.toc}
      homeLabel={text.home}
      bookTitle={text.bookTitle}
      switchLanguageLabel={text.switchLanguage}
      toggleThemeLabel={text.toggleTheme}
      menuLabel={text.openMenu}
      githubUrl={GITHUB_URL}
    >
      <article className="chapter-page">
        <header>
          {heroImage ? (
            <Image 
              src={heroImage} 
              alt="" 
              width={chapter.heroImageWidth || 1200} 
              height={chapter.heroImageHeight || 1200} 
              className="chapter-header__image" 
              style={{ width: "100%", height: "auto" }} 
              priority 
              loading="eager"
            />
          ) : null}
        </header>

        <MarkdownRenderer content={chapter.content} demoHref={demoHref} demoLabel={text.liveDemo} />

        <ChapterNav
          locale={locale}
          previous={previous}
          next={next}
          previousLabel={text.previous}
          nextLabel={text.next}
        />
      </article>
    </AppShell>
  );
}
