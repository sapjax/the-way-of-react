# Preface: The Way

> *"What I cannot create, I do not understand."*
> *— Richard Feynman*

---

## What This Book Is About

In this book, you will **reinvent React from scratch with your own hands**.

Not learning how to use React's API — but **retracing the entire evolutionary path through which React was invented**. You will start from the most primitive `document.createElement`, experience every pain point firsthand, and naturally derive solutions from those pain points. In the end, you will find that these solutions are exactly the core architectural ideas behind React.

Each chapter follows the same pattern: **feel the pain first, then derive the solution, then write it yourself**. By the end, you will have a mini-react of about **400 lines** — small but complete — containing Virtual DOM, Time Slicing, Fiber Reconciliation, synchronous Commit, and the core Hooks.

## Writing Style: Socratic Dialogue

This book unfolds entirely in **conversation form**, driven by two characters:

- **Shifu (🧙‍♂️)**: A wise mentor who knows the history of frontend evolution inside out. He never gives you answers to memorize — he guides Po to derive the answers himself through layers of questions.
- **Po (🐼)**: A smart panda with no React experience but solid fundamentals, full of curiosity, and good at asking the right questions.

This narrative draws on two sources of inspiration:

**The Socratic Method** — guiding students to discover truth through questions rather than passive instruction. Shifu never says "React uses a Virtual DOM." Instead he asks: "If every state change requires you to redraw the whole UI, but you don't want to tear down the real DOM tree each time, what would you do?" — and Po derives the concept of Virtual DOM step by step using his own intuition.

**The style of *Operating Systems: Three Easy Pieces* (OSTEP)** — Remzi and Andrea Arpaci-Dusseau's OS textbook cleverly uses light conversation and carefully designed code to make highly complex operating system concepts approachable. OSTEP proves one thing: **the deepest technical principles can be told in the most natural plain language.** This book pursues the same reading experience — you don't need to sit up straight and "grind through it." Just follow Po and Shifu's conversation like listening to a story.

At the end of each chapter, you will take away a **fully runnable HTML file under a few hundred lines** — you can double-click it to open in a browser, modify the code, and verify everything you just learned. No npm, no webpack, no painful build tooling. Just pure JavaScript and your browser.

## Who This Book Is For

This book assumes you have basic knowledge of JavaScript, HTML, and DOM manipulation.

You may have never touched React, or even used any frontend framework, and simply want to build a clear mental model of React from the ground up.

Or you may have used React heavily at work but know little about how it works internally, and want to lift the lid off this black box to see what's inside.

Either way, this book is written for you.

We will build React's mechanisms piece by piece. Every concept is derived from first principles in dialogue, with each step grounded in reason.

This is a self-contained journey. As long as you know JavaScript, you already have everything you need.

## Beyond React

Today's frontend world is noisier than ever. SolidJS, Svelte, Qwik, Angular Signals — new frameworks and paradigms keep emerging.

In such an era, **memorizing React's API is the worst learning strategy.** Because APIs change.

**What won't easily change are the engineering trade-offs hidden behind them:**

- Declarative vs. Imperative
- Full re-render vs. Fine-grained updates
- Runtime flexibility vs. Compile-time optimization (React Compiler / Forget)
- Concurrent scheduling with time slicing vs. traditional synchronous rendering
- The cost of client-side Hydration vs. the zero-bundle ideal of Server Components (RSC)

Once you understand these trade-offs, you understand not just React — you see through **the design considerations of all UI frameworks**. No matter what new framework appears in the future, you'll be able to instantly see through to its core ideas, because on the road to first principles, you've already built them yourself.

---

*Turn the page. Let's temporarily forget those high-level APIs and start from a single lonely `document.createElement`.*
