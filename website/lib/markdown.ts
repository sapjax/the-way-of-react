export type TocItem = {
  id: string;
  text: string;
  level: number;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=|{}[\]:;"'<>,.?/\\]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractToc(markdown: string): TocItem[] {
  const toc: TocItem[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(##|###)\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/!\[[^\]]*]\([^)]+\)/g, "")
      .replace(/\[[^\]]+]\([^)]+\)/g, "$1")
      .trim();

    if (!text) continue;

    toc.push({
      id: slugify(text),
      text,
      level
    });
  }

  return toc;
}

export function isTrySection(text: string) {
  return /try it yourself|实践一下/i.test(text);
}
