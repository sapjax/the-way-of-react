"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

type Props = {
  items: TocItem[];
  title: string;
};

export function TableOfContents({ items, title }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "0px 0px -70% 0px",
        threshold: 0.1
      }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <aside className="toc">
      <div className="toc__title">
        <span>{title}</span>
        <span className="toc__count">{items.length}</span>
      </div>
      <nav aria-label={title}>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={item.id === activeId ? "toc__link toc__link--active" : "toc__link"}
            data-level={item.level}
          >
            {item.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
