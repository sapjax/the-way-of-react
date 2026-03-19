import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllChapters, getCodeFileByParam } from "@/lib/chapters";
import { DEFAULT_LOCALE, UI_TEXT } from "@/lib/i18n";

type Props = {
  params: Promise<{ chapter: string }>;
};

export async function generateStaticParams() {
  return getAllChapters(DEFAULT_LOCALE)
    .filter((chapter) => chapter.hasDemo)
    .map((chapter) => ({ chapter: `ch${chapter.chapterNumber}` }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapter } = await params;
  return {
    title: `${chapter.toUpperCase()} Demo - The Way of React`
  };
}

export default async function DemoPage({ params }: Props) {
  const { chapter } = await params;
  const demo = getCodeFileByParam(chapter);
  if (!demo) notFound();

  const slug = chapter.replace(/^ch/, "");
  const targetChapter = getAllChapters(DEFAULT_LOCALE).find((item) => item.chapterNumber === slug);
  const backHref = targetChapter ? `/en/${targetChapter.slug}` : "/en";

  return (
    <main className="demo-page">
      <header className="demo-page__header">
        <div>
          <p className="eyebrow">{UI_TEXT.en.demoTitle}</p>
          <h1>{chapter.toUpperCase()}</h1>
          <p>{UI_TEXT.en.demoDescription}</p>
        </div>
        <Link href={backHref} className="secondary-button">
          {UI_TEXT.en.backToChapter}
        </Link>
      </header>

      <div className="demo-page__frame">
        <iframe src={`/api/demo/${chapter}`} title={`${chapter} demo`} />
      </div>
    </main>
  );
}
