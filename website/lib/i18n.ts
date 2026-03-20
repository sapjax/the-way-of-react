export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "twor-locale";

export const UI_TEXT = {
  en: {
    home: "Home",
    chapters: "Chapters",
    toc: "On this page",
    github: "GitHub",
    language: "Language",
    buy: "Buy on Leanpub",
    credits: "Credits",
    intro: "What This Book Is About",
    audience: "Who This Book Is For",
    readStart: "Start reading",
    readBook: "Read the book",
    previous: "Previous chapter",
    next: "Next chapter",
    backToChapter: "Back to chapter",
    liveDemo: "Open demo",
    demoTitle: "Interactive Demo",
    demoDescription: "This page runs the original HTML demo for the chapter.",
    tableOfContents: "Table of contents",
    feynman: "What I cannot create, I do not understand.",
    toggleTheme: "Toggle theme",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    bookTitle: "The Way of React",
    subtitle: "Reinventing React from Scratch",
    noteNoDemo: "This chapter has no standalone demo.",
    switchLanguage: "Switch language"
  },
  zh: {
    home: "首页",
    chapters: "目录",
    toc: "本页目录",
    github: "GitHub",
    language: "语言",
    buy: "前往 Leanpub",
    credits: "致谢",
    intro: "本书讲什么",
    audience: "适合谁读",
    readStart: "开始阅读",
    readBook: "在线阅读",
    previous: "上一章",
    next: "下一章",
    backToChapter: "返回章节",
    liveDemo: "打开 Demo",
    demoTitle: "互动 Demo",
    demoDescription: "此页面直接运行该章节原始 HTML Demo。",
    tableOfContents: "章节目录",
    feynman: "凡是我不能创造的，我就不真正理解。",
    toggleTheme: "切换主题",
    openMenu: "打开目录",
    closeMenu: "关闭目录",
    bookTitle: "The Way of React",
    subtitle: "从零重造 React",
    noteNoDemo: "本章没有独立 Demo。",
    switchLanguage: "切换语言"
  }
} as const;

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getOppositeLocale(locale: Locale): Locale {
  return locale === "en" ? "zh" : "en";
}

export function getUIText(locale: Locale) {
  return UI_TEXT[locale];
}

export function pickLocaleFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const entries = header.split(",").map((entry) => {
    const [tag, weightStr] = entry.split(";q=");
    const name = tag.trim().toLowerCase();
    const q = weightStr ? parseFloat(weightStr) : 1.0;
    return { name, q };
  });

  entries.sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    if (entry.name.startsWith("zh")) return "zh";
    if (entry.name.startsWith("en")) return "en";
  }

  return DEFAULT_LOCALE;
}
