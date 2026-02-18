# Project Manifesto: The Way of React — Learn React by Recreating It

## 1. Project Purpose

This repository contains a book titled **"The Way of React: Learn React by Recreating It"**.

It is **not** a tutorial on *how* to use React. It is a deep dive into **why** React exists — tracing the history of web UI development from raw DOM manipulation through jQuery, template engines, MVC frameworks, and ultimately to React and its evolution. Along the way, we **build a working mini-React** from scratch.

**The final deliverable** is a set of chapters (in Chinese) plus a runnable `mini-react.js` (~150 lines) that implements: `h()`, `mount()`, `patch()`, `Component`, `setState`, `useState`, and `useEffect`.

---

## 2. Core Philosophy

1. **Problem → Solution**: Every technology is introduced as a solution to a painful problem in the previous era. Never introduce a concept "because it exists" — always show the pain first.
2. **Historical Accuracy**: Include real dates, real people, real projects (jQuery 2006, Backbone 2010, Knockout 2010, AngularJS 2010, React 2013 JSConf US, Hooks 2018 React Conf).
3. **Code-Driven**: Every chapter includes code that the reader can copy into an HTML file and open in a browser. No pseudocode without a runnable companion.
4. **Incremental Construction**: Code across chapters is **cumulative**. Chapter 5's `h()` + `mount()` + `patch()` feed into Chapter 6's `Component`, which feeds into Chapter 7's `setState`, and so on. The final `mini-react.js` is the aggregation of all chapters.
5. **Comparative Context**: When introducing a React concept, briefly mention how competing frameworks (Angular, Vue, Svelte, Solid) solved the same problem differently.

---

## 3. Technical Requirements

### Code Standards

- **Runnable**: Every code snippet must be embeddable in a single HTML file with `<script>` tags and work when opened in a modern browser. No build tools, no npm, no transpilation.
- **Incremental**: Each chapter adds to the previous chapter's code. Use clear markers:
  ```
  // === Chapter 5 Code ===
  // (carried forward from previous chapter)
  ```
- **Minimal but Complete**: No `// ...` placeholders in core logic. Helper details (like full CSS) may be abbreviated, but all JavaScript logic must be complete.
- **Consistent Style**: Use `h()` function calls throughout (not JSX). JSX may be **explained** in an appendix or sidebar, but all code must use the `h()` API the reader built themselves.

## 7. Quality Checklist (Per Chapter)

Before a chapter is considered complete, verify:

- [ ] **Historical accuracy**: Dates, people, and framework versions are correct
- [ ] **Code runnability**: The "Try It" HTML file works in Chrome/Firefox with zero errors
- [ ] **Code continuity**: New code builds on previous chapters; no redefinitions that conflict
- [ ] **Self-contained** Re-invented, without assuming that students and readers are already familiar with React, I hope this book is self-contained.
- [ ] **Pain-first**: The problem is demonstrated with code BEFORE the solution is introduced
- [ ] **mini-react.js updated**: If this chapter adds core code, `mini-react.js` is updated and still works
