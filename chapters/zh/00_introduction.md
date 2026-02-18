# Preface: The Way

> *"What I cannot create, I do not understand."*
> *——Richard Feynman*

---

## What This Book Is About

In this book, you will **reinvent React from scratch, with your own hands**.

Not by learning React's API, but by **retracing the path along which React was invented**. You'll start from the most primitive `document.createElement`, experience every pain point firsthand, and naturally derive solutions from that pain — solutions that turn out to be the core design decisions of React itself.

```
Ch01  document.createElement     → Feel the pain of imperative code
Ch02  render(template, data)     → Invent declarative templates
Ch03  EventEmitter + Model       → Create Observer-pattern data binding
Ch04  UI = f(state)              → Discover React's core idea
Ch05  h() + mount() + patch()    → Implement a Virtual DOM engine
Ch06  Component + Props          → Build a component system
Ch07  setState + Lifecycle       → Give components memory and a sense of time
Ch08  HOC + Render Props         → Experience the struggles of class-based logic reuse
Ch09  useState + useEffect       → Invent Hooks
Ch10  createStore + Context      → Build state management solutions
Ch11  requestIdleCallback        → Understand concurrent scheduling & Suspense
```

Every chapter follows the same pattern: **feel the problem first, then derive the solution, then build it yourself**. By the end, you'll realize — React is not magic. It is the crystallization of a series of elegant engineering trade-offs.

## Who This Book Is For

This book assumes you have a **working knowledge of JavaScript, HTML, and the DOM**. You should be comfortable with variables, functions, classes, closures, and basic DOM operations like `document.createElement` and `addEventListener`.

However, you **do not need any prior experience with React** — or any other frontend framework. We will not reference React's API without first building it ourselves. Every concept is derived from first principles in the dialogue.

This is a **self-contained** journey. If you know JavaScript and the browser, you have everything you need. No prior reading, no prerequisites beyond the language itself.

## Writing Style: Socratic Dialogue

This book is written entirely in **dialogue form**, carried by two characters:

- **Master**: A mentor deeply versed in the evolution of frontend technology. He never gives answers directly; instead, he guides Student to derive solutions through questions and nudges.
- **Student**: A sharp programmer with no React experience. He has a solid JavaScript foundation, is endlessly curious, and asks great questions.

This approach draws inspiration from two traditions:

**The Socratic Method** — guiding learners to discover truth through dialogue and questioning, rather than passively receiving knowledge. Master never says "React uses a Virtual DOM." He asks: "If you re-render the entire UI every time, but don't want to rebuild the whole DOM tree, what would you do?" — and Student derives the concept of a Virtual DOM on his own.

**The writing style of *Operating Systems: Three Easy Pieces*** — Remzi and Andrea Arpaci-Dusseau's OS textbook uses light-hearted dialogue and carefully designed experiments to make complex OS concepts approachable. OSTEP demonstrated something important: **the most profound technical knowledge can be conveyed in the most natural language.** This book pursues the same quality — you don't need to sit up straight and "study." Just follow the conversation between Student and Master, as if you're listening to a story unfold.

At the end of each chapter, you'll find a **fully runnable HTML file** — open it directly in your browser, interact with it, and verify everything you've learned. No npm, no webpack, no build tools whatsoever. Just pure JavaScript and your browser.

## Learn React, but not only React

Today's frontend world is more complex than ever. SolidJS, Svelte, Qwik, Angular Signals — new frameworks and paradigms emerge constantly, each claiming to be faster and better than React.

In such times, **memorizing React APIs is the worst possible learning strategy.**

Because APIs change. `componentDidMount` has already been replaced by `useEffect`. Class Components have given way to Function Components. Tomorrow, perhaps `useEffect` itself will step aside.

**What doesn't change are the engineering trade-offs behind them:**

- Declarative vs. Imperative
- Full re-render vs. Fine-grained updates
- Runtime flexibility vs. Compile-time optimization
- Developer experience vs. Runtime performance

Once you understand the trade-offs across these dimensions, you don't just understand React — you understand the **design space of all UI frameworks**. No matter what future frameworks are called, you'll be able to grasp their core ideas quickly, because you've already walked the path from first principles.

---

*Turn the page. Let's start with a single line of `document.createElement`.*
