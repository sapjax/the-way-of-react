import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import sizeOf from "image-size";
import { Locale } from "@/lib/i18n";

const REPO_ROOT = path.join(process.cwd(), "..");
const CHAPTERS_ROOT = path.join(REPO_ROOT, "chapters");
const CODE_ROOT = path.join(REPO_ROOT, "code");

const CHAPTER_FILES = [
  "01_the_raw_dom",
  "02_the_template_era",
  "03_data_binding",
  "04_the_big_idea",
  "05_virtual_dom_and_reconciliation",
  "06_components",
  "07_class_lifecycle",
  "08_patterns_of_reuse",
  "09_the_browser_freeze",
  "10_the_fiber_architecture",
  "11_fiber_reconciliation_and_commit",
  "12_hooks_memory_of_functions",
  "13_effects_and_memoization",
  "14_context_and_state_management",
  "15_concurrent_and_server",
  "appendix_a_mini_react"
] as const;

export type ChapterId = (typeof CHAPTER_FILES)[number];

export type ChapterMeta = {
  id: ChapterId;
  order: number;
  slug: string;
  chapterNumber: string;
  locale: Locale;
  title: string;
  description: string;
  filePath: string;
  heroImage: string | null;
  heroImageWidth: number | null;
  heroImageHeight: number | null;
  hasDemo: boolean;
};

export type ChapterData = ChapterMeta & {
  content: string;
};

function getChapterPath(locale: Locale, id: ChapterId) {
  return path.join(CHAPTERS_ROOT, locale, `${id}.md`);
}

function getDemoPath(chapterNumber: string) {
  return path.join(CODE_ROOT, `ch${chapterNumber}.html`);
}

function chapterNumberFromId(id: ChapterId): string {
  if (id.startsWith("appendix")) return "16";
  return id.slice(0, 2);
}

function slugFromId(id: ChapterId): string {
  if (id.startsWith("appendix_a_")) {
    return id.replace(/_/g, "-");
  }

  const [prefix, ...rest] = id.split("_");
  return `${prefix}-${rest.join("-")}`;
}

function extractTitle(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function extractHeroImage(markdown: string) {
  const match = markdown.match(/!\[[^\]]*]\(([^)]+)\)/);
  return match ? match[1] : null;
}

function stripMarkdown(text: string) {
  return text
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]+]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/>\s?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDescription(markdown: string) {
  const body = markdown
    .split("\n")
    .slice(1)
    .join("\n");
  return stripMarkdown(body).slice(0, 160);
}

function readChapter(locale: Locale, id: ChapterId): ChapterData {
  const filePath = getChapterPath(locale, id);
  const raw = fs.readFileSync(filePath, "utf8");
  const { content } = matter(raw);
  const chapterNumber = chapterNumberFromId(id);
  const hasDemo = /^\d+$/.test(chapterNumber) && fs.existsSync(getDemoPath(chapterNumber));

  const heroImage = extractHeroImage(content);
  let heroImageWidth: number | null = null;
  let heroImageHeight: number | null = null;
  let finalContent = content;

  if (heroImage) {
    const resolved = resolveMarkdownAsset(heroImage);
    try {
      const localPath = path.join(process.cwd(), "public", resolved);
      if (fs.existsSync(localPath)) {
        // @ts-expect-error: image-size string path typing
        const dimensions = sizeOf(localPath);
        if (dimensions.width && dimensions.height) {
          heroImageWidth = dimensions.width;
          heroImageHeight = dimensions.height;
        }
      }
    } catch (e) {}

    // Escape the hero image path for use in a regex
    const escapedHeroImage = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heroImageRegex = new RegExp(`^!\\[[^\\]]*\\]\\(${escapedHeroImage}\\)\\s*$`, "m");
    finalContent = content.replace(heroImageRegex, "");
  }

  return {
    id,
    order: CHAPTER_FILES.indexOf(id),
    slug: slugFromId(id),
    chapterNumber,
    locale,
    title: extractTitle(content),
    description: extractDescription(content),
    filePath,
    heroImage,
    heroImageWidth,
    heroImageHeight,
    hasDemo,
    content: finalContent
  };
}

export function getAllChapters(locale: Locale): ChapterMeta[] {
  return CHAPTER_FILES.map((id) => {
    const chapter = readChapter(locale, id);
    return {
      id: chapter.id,
      order: chapter.order,
      slug: chapter.slug,
      chapterNumber: chapter.chapterNumber,
      locale: chapter.locale,
      title: chapter.title,
      description: chapter.description,
      filePath: chapter.filePath,
      heroImage: chapter.heroImage,
      heroImageWidth: chapter.heroImageWidth,
      heroImageHeight: chapter.heroImageHeight,
      hasDemo: chapter.hasDemo
    };
  });
}

export function getChapterBySlug(locale: Locale, slug: string): ChapterData | null {
  const match = CHAPTER_FILES.find((id) => slugFromId(id) === slug);
  if (!match) return null;
  return readChapter(locale, match);
}

export function getChapterNeighbors(locale: Locale, slug: string) {
  const chapters = getAllChapters(locale);
  const index = chapters.findIndex((chapter) => chapter.slug === slug);

  return {
    previous: index > 0 ? chapters[index - 1] : null,
    next: index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null
  };
}

export function resolveMarkdownAsset(source: string) {
  // Matches ../../website/public/images/ or similar relative paths
  const match = source.match(/.*website\/public\/images\/(.+)$/);
  if (match) {
    const filename = match[1];
    const resolved = `/images/${filename}`;
    return resolved;
  }
  return source;
}

export function getRepoRoot() {
  return REPO_ROOT;
}

export function getCodeFileByParam(chapterParam: string) {
  if (!/^ch\d{2}$/.test(chapterParam)) return null;
  const filePath = path.join(CODE_ROOT, `${chapterParam}.html`);
  if (!fs.existsSync(filePath)) return null;
  return {
    chapter: chapterParam,
    filePath,
    content: fs.readFileSync(filePath, "utf8")
  };
}
