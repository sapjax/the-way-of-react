"use client";

import { useEffect } from "react";

export function CopyCodeHandler() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest(".copy-button");
      if (!button) return;

      const wrapper = button.closest(".code-block-wrapper");
      if (!wrapper) return;

      const codeEl = wrapper.querySelector("code");
      if (!codeEl) return;

      // `textContent` reads the raw text correctly from the syntax-highlighted HTML
      const text = codeEl.textContent || "";
      
      navigator.clipboard.writeText(text).then(() => {
        button.textContent = "Copied!";
        button.classList.add("copy-button--copied");
        setTimeout(() => {
          if (button.textContent === "Copied!") {
            button.textContent = "Copy";
            button.classList.remove("copy-button--copied");
          }
        }, 2000);
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
