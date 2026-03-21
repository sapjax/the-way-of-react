import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import { isTrySection } from "@/lib/markdown";
import { resolveMarkdownAsset } from "@/lib/chapters";
import { CopyCodeHandler } from "./CopyCodeHandler";

type Props = {
  content: string;
  demoHref?: string | null;
  demoLabel: string;
};

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`~!@#$%^&*()+=|{}[\]:;"'<>,.?/\\]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function renderMarkdown(content: string, demoHref?: string | null, demoLabel?: string) {
  const renderer = new marked.Renderer();
  const options = {
    gfm: true,
    breaks: false,
    renderer
  };

  const inline = (value: string) => marked.parseInline(value, options) as string;

  renderer.heading = ({ tokens, depth }) => {
    const htmlText = inline(tokens.map((token) => token.raw).join("")).trim();
    const plainText = htmlText.replace(/<[^>]+>/g, "");
    const id = slugify(plainText);
    const headingHtml = `<h${depth} id="${id}">${htmlText}</h${depth}>`;

    if ((depth === 2 || depth === 3) && demoHref && demoLabel && isTrySection(plainText)) {
      return `<div class="try-section-heading">${headingHtml}<a class="demo-button" href="${demoHref}" target="_blank" rel="noreferrer">${demoLabel}</a></div>`;
    }

    return headingHtml;
  };

  renderer.paragraph = ({ tokens }) => {
    let htmlText = inline(tokens.map((token) => token.raw).join("")).trim();
    const isPo = /^<strong>🐼<\/strong>[：:]\s*/.test(htmlText);
    const isShifu = /^<strong>🧙‍♂️<\/strong>[：:]\s*/.test(htmlText);
    
    if (isPo || isShifu) {
      const role = isPo ? "po" : "shifu";
      const avatar = isPo ? "🐼" : "🧙‍♂️";
      
      // Strip out the prefix
      htmlText = htmlText.replace(/^<strong>(?:🐼|🧙‍♂️)<\/strong>[：:]\s*/, "");
      
      return `
        <div class="dialogue dialogue--${role}">
          <div class="dialogue__avatar" aria-hidden="true">${avatar}</div>
          <div class="dialogue__bubble">
            <p>${htmlText}</p>
          </div>
        </div>
      `;
    }
    
    return `<p>${htmlText}</p>`;
  };

  renderer.image = ({ href, text, title }) => {
    const resolvedHref = resolveMarkdownAsset(href);
    const isFigure = text.toLowerCase().includes("figure");

    if (isFigure) {
      return `
        <figure class="markdown-figure">
          <img src="${resolvedHref}" alt="${text}" title="${title || ""}" class="markdown-image" loading="lazy" />
          <figcaption class="markdown-figure__caption">${text}</figcaption>
        </figure>
      `;
    }
    
    return `<img src="${resolvedHref}" alt="${text}" title="${title || ""}" loading="lazy" />`;
  };

  renderer.link = ({ href, title, tokens }) => {
    const htmlText = inline(tokens.map((token) => token.raw).join(""));
    const titleAttr = title ? ` title="${title}"` : "";

    if (href.startsWith("http")) {
      return `<a href="${href}"${titleAttr} target="_blank" rel="noreferrer">${htmlText}</a>`;
    }

    return `<a href="${href}"${titleAttr}>${htmlText}</a>`;
  };

  renderer.code = ({ text, lang }) => {
    const language = (lang || "").toLowerCase();
    const validLanguage = language && hljs.getLanguage(language) ? language : "plaintext";
    const highlighted =
      validLanguage === "plaintext" ? text : hljs.highlight(text, { language: validLanguage }).value;

    return `<div class="code-block-wrapper" data-lang="${validLanguage}"><button type="button" class="copy-button" aria-label="Copy code">Copy</button><pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre></div>`;
  };



  return marked.parse(content, options) as string;
}

export function MarkdownRenderer({ content, demoHref, demoLabel }: Props) {
  return (
    <>
      <CopyCodeHandler />
      <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(content, demoHref, demoLabel) }} />
    </>
  );
}
