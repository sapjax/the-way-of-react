import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getAllChapters } from "@/lib/chapters";
import { Locale, getUIText, isLocale } from "@/lib/i18n";
import { getChapterHref } from "@/lib/routes";

const GITHUB_URL = "https://github.com/sapjax/the-way-of-react";
const LEANPUB_URL = "https://leanpub.com/the-way-of-react";

function getHomeCopy(locale: Locale) {
  if (locale === "zh") {
    return {
      heroKicker: "从 DOM 到 Fiber",
      heroNote: "对话式从零发明 React",
      summary:
        "从零开始重新发明 React，整本书以苏格拉底式的启发式对话形式展开，带你从第一性原理出发，一步步推导出 React 的核心设计。",
      audience:
        "适合懂基础 JavaScript / HTML / DOM，但想真正理解 React 为什么长成今天这个样子的人。无论你没用过 React，还是天天写 React 却不清楚内部机制，都可以从这里建立完整心智模型。",
      credits: "本书由作者与 AI 协作完成。所有错误都是我的，全部功劳归于 AI。",
      journeyLabel: "学习路径",
      phaseOne: "Phase 1 · Stack Reconciler",
      phaseOneNote: "第 1-8 章，先把旧路走到极限。",
      phaseTwo: "Phase 2 · Fiber Architecture",
      phaseTwoNote: "第 9-15 章，再重写引擎解决卡顿。",
      chaptersLabel: "章节",
      demosLabel: "Demo",
      bilingualLabel: "双语",
      statValueBilingual: "中英",
      appendixLabel: "附录",
      openerLabel: "开篇引子"
    };
  }

  return {
    heroKicker: "From DOM to Fiber",
    heroNote: "A dialogue-driven reconstruction of React's inner logic",
    summary:
      "Reinventing React from scratch, the whole book is unfolded in the form of Socratic heuristic dialogue, which takes you to deduce the core design of React step by step from first principles.",
    audience:
      "It is for readers with basic JavaScript, HTML, and DOM knowledge who want a real mental model of React, whether they are brand new to React or use it every day without a clear picture of the internals.",
    credits: "This book was vibe written with AI tools. All mistakes are mine, all credit goes to AI.",
    journeyLabel: "Learning Path",
    phaseOne: "Phase 1 · Stack Reconciler",
    phaseOneNote: "Chapters 1-8 push the old model until it breaks.",
    phaseTwo: "Phase 2 · Fiber Architecture",
    phaseTwoNote: "Chapters 9-15 rebuild the engine to fix the freeze.",
    chaptersLabel: "Chapters",
    demosLabel: "Demos",
    bilingualLabel: "Language",
    statValueBilingual: "EN / 中文",
    appendixLabel: "Appendix",
    openerLabel: "Opening Arc"
  };
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return {};
  return {
    title: `The Way of React`,
    description: localeDescription(rawLocale)
  };
}

function localeDescription(locale: Locale) {
  return locale === "zh"
    ? "《The Way of React》在线阅读，支持中英双语切换与章节 Demo。"
    : "Read The Way of React online with bilingual chapters and runnable demos.";
}

export default async function LocaleHomePage({ params }: Props) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  const locale = rawLocale;
  const text = getUIText(locale);
  const chapters = getAllChapters(locale);
  const copy = getHomeCopy(locale);
  const mainChapters = chapters.filter((chapter) => !chapter.slug.startsWith("appendix"));
  const phaseOneChapters = mainChapters.filter((chapter) => Number(chapter.chapterNumber) <= 8);
  const phaseTwoChapters = mainChapters.filter((chapter) => Number(chapter.chapterNumber) >= 9);
  const appendixChapters = chapters.filter((chapter) => chapter.slug.startsWith("appendix"));

  return (
    <AppShell
      locale={locale}
      chapters={chapters}
      toc={[]}
      showSidebar={false}
      showToc={false}
      sidebarTitle={text.tableOfContents}
      tocTitle={text.toc}
      homeLabel={text.home}
      bookTitle={text.bookTitle}
      switchLanguageLabel={text.switchLanguage}
      toggleThemeLabel={text.toggleTheme}
      menuLabel={text.openMenu}
      githubUrl={GITHUB_URL}
    >
      <article className="home-page">
        <section className="home-hero">
          <div className="home-hero__cover">
            <img src="/images/cover.png" alt="The Way of React cover" />
          </div>
          <div className="home-hero__content">
            <p className="eyebrow">{copy.heroKicker}</p>
            <h1>{text.bookTitle}</h1>
            <p className="home-hero__lede">{copy.heroNote}</p>
            <blockquote>
              <p>{text.feynman}</p>
              <footer>Richard Feynman</footer>
            </blockquote>
            <p>{copy.summary}</p>
            <div className="home-hero__actions">
              <Link href={getChapterHref(locale, chapters[0].slug)} className="primary-button">
                {text.readStart}
              </Link>
              <a href={LEANPUB_URL} target="_blank" rel="noreferrer" className="secondary-button">
                {text.buy}
              </a>
            </div>
          </div>
        </section>

        <section className="home-section home-section--path">
          <div className="section-heading">
            <p className="eyebrow">{copy.journeyLabel}</p>
            <h2>{text.chapters}</h2>
          </div>
          <div className="phase-grid">
            <div className="phase-card">
              <p className="phase-card__label">{copy.openerLabel}</p>
              <div className="phase-card__list">
                {phaseOneChapters.slice(0, 2).map((chapter) => (
                  <Link key={chapter.slug} href={getChapterHref(locale, chapter.slug)} className="phase-link">
                    <span>{chapter.chapterNumber}</span>
                    <strong>{chapter.title.replace(/^Chapter\s+\d+:\s+|^第.+章：/, "")}</strong>
                  </Link>
                ))}
              </div>
            </div>
            <div className="phase-card">
              <p className="phase-card__label">{copy.phaseOne}</p>
              <p className="phase-card__note">{copy.phaseOneNote}</p>
              <div className="phase-card__range">
                {phaseOneChapters.map((chapter) => (
                  <Link key={chapter.slug} href={getChapterHref(locale, chapter.slug)} className="phase-pill">
                    {chapter.chapterNumber}
                  </Link>
                ))}
              </div>
            </div>
            <div className="phase-card">
              <p className="phase-card__label">{copy.phaseTwo}</p>
              <p className="phase-card__note">{copy.phaseTwoNote}</p>
              <div className="phase-card__range">
                {phaseTwoChapters.map((chapter) => (
                  <Link key={chapter.slug} href={getChapterHref(locale, chapter.slug)} className="phase-pill">
                    {chapter.chapterNumber}
                  </Link>
                ))}
              </div>
            </div>
            {appendixChapters.length ? (
              <div className="phase-card">
                <p className="phase-card__label">{copy.appendixLabel}</p>
                <div className="phase-card__list">
                  {appendixChapters.map((chapter) => (
                    <Link key={chapter.slug} href={getChapterHref(locale, chapter.slug)} className="phase-link">
                      <span>{chapter.chapterNumber}</span>
                      <strong>{chapter.title.replace(/^Appendix\s+[A-Z]:\s+/, "")}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p className="eyebrow">{text.intro}</p>
            <h2>{copy.heroKicker}</h2>
          </div>
          <p>{copy.summary}</p>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p className="eyebrow">{text.audience}</p>
            <h2>{text.subtitle}</h2>
          </div>
          <p>{copy.audience}</p>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p className="eyebrow">{text.chapters}</p>
            <h2>{copy.journeyLabel}</h2>
          </div>
          <div className="chapter-list">
            {chapters.map((chapter) => (
              <Link key={chapter.slug} href={getChapterHref(locale, chapter.slug)} className="chapter-card">
                <span className="chapter-card__number">{chapter.chapterNumber}</span>
                <span className="chapter-card__title">{chapter.title}</span>
                <span className="chapter-card__meta">{chapter.hasDemo ? copy.demosLabel : copy.chaptersLabel}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p className="eyebrow">{text.credits}</p>
            <h2>{text.bookTitle}</h2>
          </div>
          <p>{copy.credits}</p>
        </section>
      </article>
    </AppShell>
  );
}
