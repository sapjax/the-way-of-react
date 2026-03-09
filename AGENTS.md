# AGENTS.md — The Way of React: Content Collaboration Handbook

> Mandatory specification for all LLMs generating content for this book. Read in full before modifying any chapter.

## 1. Core Identity & Narrative Arc
- **Format**: technical book written entirely in dialogue form between Shifu 🧙‍♂️ (Master) and Po 🐼 (Student).
- **Goal**: Reinvent React from scratch to understand *why* it's designed this way, resulting in a ~400-line runnable `mini-react`.
- **Two Phases**:
  - **Phase 1 (Ch 1-8)**: Build Stack Reconciler. Readers must feel its fatal performance limits.
  - **Phase 2 (Ch 9-15)**: Rewrite with Fiber architecture to solve those limits.

## 2. Teaching Methodology (Strictly Socratic)
- **Pain Before Solution**: Never introduce a concept (Fiber, Hooks, etc.) before Po experiences and articulates the problem it solves through code.
- **Top-Down**: Use a top-down approach, Understand the mechanism first, then explain the strategy.
- **Mental model**: After establishing a clear mental model, enter the detailed code and details.
- **Po Derives, Shifu Confirms**: Shifu asks guiding questions; Po deduces the answers. Shifu NEVER dumps direct answers.
- **Character personality**: 
  - Po: passionate, naughty, witty.
  - Shifu: steady, humorous and calm.
- **Dialogue Rhythm**: Ping-pong style. Shifu must not speak > 300 characters without a response.
- **No Fake Praise**: Shifu never says "Great!" or "Exactly right!". Use calm, brief confirmations ("Yes", "Precisely").
- **Consistent Analogies**: Using analogies, Do not invent conflicting analogies, It is better not to use analogy than to use lame analogy.
- **A relaxed feeling**: Weaken the feeling of classrooms and textbooks: it is more like two people chatting and discussing, rather than sitting in the classroom.

## 3. Strict Technical Specifications
**CRITICAL: Never mix the two engine conventions!**

### Phase 1: Stack Reconciler (Ch 1-8)
- **VNode**: Uses `tag` (not type), `el` (not dom), `children` as top-level array.
- **Signature**: `h(tag, props, children)`

### Phase 2: Fiber Architecture (Ch 9-15)
- **VNode**: Uses `type`, `props.children`.
- **Fiber Node Fields**: `type`, `props`, `dom`, `return` (parent), `child`, `sibling`, `alternate`, `effectTag`, `hooks`.
- **Signature**: `h(type, props, ...children)`
- **Fixed Globals**: `workInProgress`, `wipRoot`, `currentRoot`, `deletions`, `wipFiber`, `hookIndex`.

### Translation
- Avoid using long sentences and difficult sentences, avoid using uncommon words.
- keep technical terms.
- keep the tone of the characters consistent.
- **Ensure all markdown formatting (especially code block backticks ```) is perfectly preserved.**

## 4. Prohibited Actions (Zero Tolerance)
- ❌ Defining a concept before demonstrating the pain point it solves.
- ❌ Mixing `tag`/`type` or `el`/`dom` terminology in the same phase.
- ❌ Using JSX in "Try It Yourself" code.
- ❌ Shifu giving long textbook explanations or direct answers.
