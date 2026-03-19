"use client";

import { useEffect, useState } from "react";

type Props = {
  label: string;
};

export function ThemeToggle({ label }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("twor-theme");
    const nextTheme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("twor-theme", nextTheme);
  }

  return (
    <button type="button" className="icon-button" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
