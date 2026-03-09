# Chapter 15: From Concurrent to Server — React's Ultimate Form

![figure 15.1](../images/ch15_concurrent_and_server.png)

## 15.1 The Last Piece

Po had come a long way. From raw DOM to templates, from data binding to Virtual DOM, from class components to Hooks, from Prop Drilling to Fiber-based Context...

**🐼**: Shifu, I feel like we've built all the core of modern React! We rewrote the engine with Fiber architecture, gave pure functions memory, and solved cross-layer state passing. Is there anything we missed?

**🧙‍♂️**: Remember why in chapters nine and ten we went to all that trouble, abandoned simple recursion, and rewrote the architecture as a complex Fiber linked list?

**🐼**: To solve the "browser freeze" performance crisis. We split rendering into an interruptible Render phase and an ultra-fast synchronous Commit phase.

**🧙‍♂️**: Yes. This ability to "interrupt rendering and yield the main thread" is what the React team calls **Concurrent Mode**. In previous chapters we only used it to prevent large pages from freezing the browser. But "interruptibility" actually unlocks two ultimate problems that had haunted the frontend industry for a decade.

This chapter, we'll also step outside the browser and see what new possibilities Fiber's design enables when rendering isn't limited to the client.

## 15.2 Concurrency and Priority Scheduling

**🧙‍♂️**: Imagine your Todo List has 10,000 items. A network request just came back, triggering an update of the entire tree. Right then, the user types a letter in the input box. How does your code execute?

**🐼**: With the old version (Stack Reconciler), the main thread would be completely locked by the 10,000-node render triggered by the network request, and the input box would freeze for 150ms. But with our Fiber architecture, `workLoop` returns control to the browser at the end of each frame, so the input won't freeze!

**🧙‍♂️**: To be precise, the browser now gets a chance to respond to the user's typing event. But there's a deeper problem: the typing event also triggers `setState`. Now the engine has **two tasks**:

1. Update the main list (large, slow)
2. Update the letter in the input box (tiny, but the user is very sensitive to delay)

If you were the scheduler, what would you do?

**🐼**: If I process them in order — traversing 10,000 list nodes one by one, then updating the input box — even if the browser doesn't freeze, the user sees the letter appear with a lag! I should **pause** the list rendering and **prioritize** rendering the input box letter!

**🧙‍♂️**: That's the core of React 18's concurrent features: **Priority Scheduling**. React provides the `useTransition` Hook, letting developers explicitly tell it "which update isn't urgent":

```javascript
function SearchPage() {
  const [query, setQuery] = useState('');       // input state — high priority
  const [results, setResults] = useState([]);   // search results — low priority

  const [isPending, startTransition] = useTransition();

  function handleInput(e) {
    // Update input directly: high priority, not wrapped in startTransition
    setQuery(e.target.value);

    // Search results update: marked as "interruptible low-priority task"
    startTransition(() => {
      setResults(heavySearch(e.target.value)); // expensive large list update
    });
  }

  return h('div', null,
    h('input', { value: query, oninput: handleInput }),
    // isPending = true means list is still rendering in background, show transition state
    isPending
      ? h('p', null, 'Searching...')
      : h('ul', null, results.map(r => h('li', null, r)))
  );
}
```

Built on the Fiber architecture, React can interrupt a low-priority long task (`startTransition`'s large list update) at any time during Render phase, switch to the high-priority task (input box letter) to quickly complete Render + Commit, then go back to continue the low-priority task. All this is possible because every Fiber node saves its complete context state — it can resume from the breakpoint any time after interruption.

## 15.3 Suspense: Graceful Waiting

**🧙‍♂️**: The second long-standing problem — **async data**. In the old days, data-fetching code looked like this:

```javascript
function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { // side effect in the moat: request starts after Commit
    fetchUser().then(data => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return h('p', null, 'Loading...');
  return h('div', null, ['Hello, ' + user.name]);
}
```

**🐼**: What's wrong with this? It's the standard approach.

**🧙‍♂️**: Three fatal pain points.

**Problem 1: Waterfall Requests** — `useEffect` runs after Commit phase, meaning the component must first render and mount on screen before requests start. If your page is nested like this:

```
<App>
  └── <UserProfile>   ← useEffect fires request, waiting...
        └── <PostList>  ← Only after UserProfile's request completes and renders
                           does PostList's useEffect start its own request
```

Parent completes request, renders, then it's the child's turn — requests flow down one level at a time like a waterfall, wasting time that could have been parallel.

**Problem 2: Loading state explosion** — Every component must write `if (loading) return ...`, filling the whole codebase with repeated loading checks.

**Problem 3: Race conditions** — If the user clicks frequently, a slow previous request might return after a fast later request has already completed, overwriting fresh data with stale data.

**🧙‍♂️**: Suspense's core idea is revolutionary: **if a component finds data isn't ready during Render phase, directly `throw` a Promise as an exception!**

```javascript
// Wrap a fetch into a "resource" that Suspense can read
function createResource(fetchFn) {
  let status = 'pending';
  let result;
  // Start request immediately (not in useEffect — at module load time)
  let promise = fetchFn().then(
    data => { status = 'success'; result = data; },
    error => { status = 'error'; result = error; }
  );

  return {
    read() {
      if (status === 'pending') throw promise;   // 🔥 Data not ready? Throw the Promise!
      if (status === 'error')   throw result;
      return result;                             // Data ready, return normally
    }
  };
}

const userResource = createResource(() => fetch('/api/user').then(r => r.json()));

function UserProfile() {
  const user = userResource.read(); // throws if not ready; reaching here means data exists
  return h('div', null, ['Hello, ' + user.name]); // no if (loading) needed!
}
```

**🐼**: Throw a Promise as an exception? Who catches it?

### How the Engine Catches a "Thrown Promise"

**🧙‍♂️**: The answer is in our own `updateFunctionComponent`. Just add a `try/catch` where component functions are executed:

```javascript
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  try {
    // Normal case: execute component function, get children
    const children = [fiber.type(fiber.props)].flat();
    reconcileChildren(fiber, children);
  } catch (e) {
    // 🔥 Suspense core: catch the thrown Promise
    if (e instanceof Promise) {
      // 1. Render fallback UI (let user see "loading")
      const fallback = fiber.props.fallback || '⏳ Loading...';
      reconcileChildren(fiber, [h('span', null, fallback)]);

      // 2. After Promise resolves, re-schedule rendering of this subtree
      e.then(() => {
        wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
        deletions = [];
        workInProgress = wipRoot;
      });
    } else {
      throw e; // not a Promise, it's a real error, keep propagating
    }
  }
}
```

**🐼**: The `try/catch` catches the Promise, renders fallback, then when Promise resolves, triggers a re-render — data is ready, `read()` no longer throws, component renders normally!

**🧙‍♂️**: You described it perfectly. Look at how the engine finds the Suspense boundary — familiar? After catching the Promise, the engine walks up the `return` pointer to find the parent component wrapping `fallback`, replacing that layer's UI with fallback. This is exactly the same mechanism as `useContext` walking up to find a Provider: **walking up the Fiber `return` chain**.

You've understood the ultimate application of Fiber's "pauseable/resumable" architecture.

## 15.4 Limitations of SPAs

**🧙‍♂️**: Po, everything we've built so far — from Virtual DOM to Hooks, from state management to concurrent rendering — all runs in **one place**.

**🐼**: The browser?

**🧙‍♂️**: Right. When a user visits your website, the browser downloads an HTML file, loads JavaScript, and JavaScript builds the entire UI from scratch in the browser. This pattern is called **SPA (Single-Page Application)**.

**🐼**: Isn't that what we've been doing? Open `ch05.html` and JavaScript takes over everything.

**🧙‍♂️**: Exactly. Now imagine you published your Todo List to the internet. A real user opens your page — what does their browser receive?

**🐼**: An HTML file with an empty `<div id="app"></div>` and a `<script>` tag?

**🧙‍♂️**: Right. Before JavaScript loads and executes, what does the user see?

**🐼**: ...a blank page?

**🧙‍♂️**: Yes. **White screen**. This blank might last 1–3 seconds — depending on JavaScript size and the user's network speed. Now another question: when Google's search crawler visits your page, what does it see?

**🐼**: Also that empty `<div id="app">`? Because crawlers might not execute JavaScript...

**🧙‍♂️**: You can now see SPA's three fatal problems:

```text
┌──────────────────────────────────────────────────────┐
│  Three Major Problems of SPAs                        │
│                                                      │
│  1. Blank First Screen                               │
│     Empty HTML → Download JS → Execute JS → Render   │
│     Wait Time = Latency + JS Parsing + Rendering     │
│                                                      │
│  2. Poor SEO                                         │
│     Search engines see empty <div>, can't index;     │
│     Content is opaque to non-JS executing crawlers.  │
│                                                      │
│  3. Bundle Bloat                                     │
│     All page logic bundled into one JS file          │
│     More features → bigger bundle → slower load      │
└──────────────────────────────────────────────────────┘
```

## 15.5 SSR: Back to the Server

**🧙‍♂️**: What if the server first renders React components into an HTML string and sends it to the browser?

**🐼**: You mean... run our `render` function on the server?

**🧙‍♂️**: Right. Our `h()` function returns a plain JavaScript object — a VNode. This object doesn't depend on the browser; it can be generated on Node.js just as well. We just need an extra function to **convert VNodes to HTML strings**. Note the VNode format: throughout this book we've used `vnode.type` and `vnode.props.children`.

```javascript
// Render VNode to HTML string (runs on server / Node.js)
function renderToString(vnode) {
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return escapeHtml(String(vnode));
  }
  if (vnode.type === 'TEXT_ELEMENT') {
    return escapeHtml(String(vnode.props.nodeValue));
  }

  let html = '<' + vnode.type;

  for (const key in vnode.props) {
    if (key === 'children') continue;
    if (key.startsWith('on')) continue; // ⚡ events belong to client, meaningless on server
    html += ' ' + key + '="' + escapeHtml(vnode.props[key]) + '"';
  }
  html += '>';

  const children = vnode.props.children || [];
  for (const child of children) {
    html += renderToString(child);
  }

  html += '</' + vnode.type + '>';
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}
```

**🐼**: Is this React's `renderToString`?

**🧙‍♂️**: A simplified version, but same principle. The flow change:

```text
SPA flow:
  browser requests → server returns empty HTML → download JS → execute JS → user sees content
                                               ↑
                                          blank wait (1-3s)

SSR flow:
  browser requests → server runs renderToString → returns complete HTML → user sees content immediately
                                                                        ↓ (simultaneously)
                                                                   download JS → Hydration (activate interaction)
```

**🐼**: Users see content immediately! But wait... `renderToString` skips event handlers (`onclick`, etc.), so the page looks like it has content but buttons don't respond?

**🧙‍♂️**: The key question. This leads to the most important concept in SSR — **Hydration**.

The server gave you a **skeleton** (HTML structure). After client JavaScript loads, it **attaches event handlers and state** to the existing DOM, making it interactive. This process is called Hydration — like injecting water into dry bones, bringing them back to life.

```text
Server                              Client
┌────────────────────────┐         ┌─────────────────────────────────┐
│  renderToString        │         │                                 │
│                        │  HTML   │  ① User immediately sees page   │
│  <div>                 │ ──────> │     (not yet interactive)       │
│    <h1>Hello</h1>      │         │                                 │
│    <button>+1</button> │         │  ② JS bundle downloads          │
│  </div>                │         │                                 │
└────────────────────────┘         │  ③ Hydration:                   │
                                   │     - traverse existing DOM     │
                                   │     - bind onclick events       │
                                   │     - restore component state   │
                                   │                                 │
                                   │  ④ Page becomes interactive!    │
                                   └─────────────────────────────────┘
```

**🐼**: I understand! The server handles the "visuals," the client providing the "soul." But does that mean the client's JS Bundle still hasn't gotten smaller? All component code still has to be sent to the client?

**🧙‍♂️**: You've spotted SSR's key limitation. There are three costs to SSR:

First, **Server Pressure**: for every user request, the server must perform a render. 100 simultaneous users means 100 renders. Second, **TTFB (Time To First Byte) Latency**: users must wait for the server to finish rendering before receiving the first byte. Third, and most critical — **Full Hydration**: the client still needs to load **all** component JavaScript and traverse the entire DOM tree to "claim" each node, even if some components never need interaction.

**🐼**: The third point sounds particularly wasteful. Like a blog post's body — it's just static text, why send JS code to the client and re-Hydrate it?

**🧙‍♂️**: Remember that question. We'll come back to it soon.

## 15.6 SSG and ISR: The Static Temptation

**🐼**: Shifu, if a page's content doesn't change often — like a blog post — why re-render on every user request? Could we pre-generate the HTML?

**🧙‍♂️**: You just derived **SSG (Static Site Generation)**.

SSG's idea: run `renderToString` at **build time**, generate each page as a `.html` file, deploy to CDN. When users request, CDN returns static files — no server computation needed.

```
SSR: request → server renders live → returns HTML (computes every time)
SSG: render at build → generate .html files → deploy CDN → request → CDN returns directly
```

**🐼**: Like pre-baked bread — customers just grab it. Much faster than baking fresh (SSR)! But — if a blog post updates, I have to rebuild the entire website?

**🧙‍♂️**: If your site has 10,000 articles and rebuilding 10,000 pages for one change is unrealistic — that's what **ISR (Incremental Static Regeneration)** solves.

ISR: give each page a **freshness period**. After a page is first generated, it's static. Once expired, the next visitor still sees the old version (returned immediately, no wait), but that request triggers a background rebuild — the next visitor sees the new version.

**🐼**: Like a bread expiry date? After expiry, give the customer the old bread, while quietly baking a new one in the background?

**🧙‍♂️**: That analogy is spot-on. Let's summarize all rendering strategies:

| Strategy | When it renders | Pros | Cons | Use case |
|:-----|:---------|:-----|:-----|:---------|
| **SPA** | Client runtime | Smooth interaction | Blank first screen, poor SEO | Admin panels, web apps |
| **SSR** | Each request | Good SEO, fast first screen | Server pressure, slow TTFB | Dynamic content (social, e-commerce) |
| **SSG** | Build time | Very fast, zero server cost | Content updates require rebuild | Blog, docs, marketing pages |
| **ISR** | Build time + periodic background refresh | Balances speed and freshness | Triggering visitor sees stale content | News, product pages |

## 15.7 React Server Components (RSC)

**🧙‍♂️**: Back to the key question — the waste of full Hydration. A typical blog page:

```text
BlogPage
├── Header          ← has a search box, needs interaction
├── ArticleBody     ← pure text and images, completely static
│   └── 3000 words
├── CodeBlock       ← syntax-highlighted code, static
├── CommentList     ← comment list, fetched from database
│   └── 100 comments
└── LikeButton      ← like button, needs interaction
```

**🐼**: Of five components, only `Header` and `LikeButton` actually need interaction (need JavaScript). `ArticleBody`, `CodeBlock`, `CommentList` are pure display.

**🧙‍♂️**: But in traditional SSR, all five components' JS code gets sent to the client, which Hydrates the entire DOM tree. That 3000-word body and 100 comments — their component code might total 50KB. The client downloads and executes 50KB of JS just to "confirm these static texts don't need event handlers."

**🐼**: So wasteful. If we could tell React "these components are server-only, don't send JS to client" that would be perfect.

**🧙‍♂️**: That's the core insight of **React Server Components (RSC)**.

### Server Component vs Client Component

**🧙‍♂️**: RSC splits components into two categories:

```text
┌────────────────────────────────┐     ┌────────────────────────────────┐
│        Server Component        │     │        Client Component        │
│                                │     │                                │
│  ✅ Can await db.query()       │     │  ✅ useState / useEffect       │
│  ✅ Can read filesystem        │     │  ✅ Handle user events         │
│  ✅ Can access server secrets  │     │  ✅ Access browser APIs        │
│                                │     │                                │
│  ❌ No useState                │     │  ❌ Can't access database      │
│  ❌ No useEffect               │     │  ❌ Can't read server files    │
│  ❌ No event listeners         │     │                                │
│                                │     │                                │
│  📦 Zero JS sent to client     │     │  📦 JS bundle sent to client   │
└────────────────────────────────┘     └────────────────────────────────┘
```

**🐼**: So Server Component code never appears in the user's browser JS Bundle?

**🧙‍♂️**: Right. `ArticleBody`, `CodeBlock`, `CommentList` can all be Server Components — they finish rendering on the server, zero JS sent to client. Only `Header` and `LikeButton` are Client Components — only their JS code needs to be downloaded and Hydrated.

### RSC Is Not SSR

**🐼**: Wait, Server Components render on the server... how is that different from SSR?

**🧙‍♂️**: The most confusing point. The core difference is **output format**:

```text
                  SSR                           RSC
          ┌────────────────┐           ┌────────────────────┐
Output    │   HTML string  │           │  RSC Payload (JSON) │
Format    └────────────────┘           └────────────────────┘
          "<div><h1>Title</h1>         { type: "article",
           <button>Like</button>          children: [
           </div>"                         { type: "h1", ... },
                                           { $$typeof: "client-ref",
                                             module: "LikeButton" }  ← reference
                                         ]
                                       }

Client    Must Hydrate entire tree     Only Hydrate Client Component parts
Does      (LikeButton's JS must         (ArticleBody, CodeBlock's JS
What?     download and run)             not needed at all)
```

**🐼**: So the `h1` title is directly "inlined" as data, but the `LikeButton` is preserved as a **reference** — the client only loads JS and Hydrates for the reference parts!

**🧙‍♂️**: Exactly! RSC's essence:

1. Server Component output is **inlined** into Payload (pure data, zero JS).
2. Client Components are represented as **references** ("go load this JS file").
3. Client receives Payload, renders static parts directly to DOM, only loads JS and Hydrates Client Component parts.

```javascript
// Server component (conceptual code, needs full-stack environment)
async function BlogPost({ id }) {
  const post = await db.query('SELECT * FROM posts WHERE id = ?', [id]);
  
  return h('article', null,
    h('h1', null, post.title),
    h('p', null, post.content),
    // LikeButton is a Client Component — marked as "client-reference"
    { $$typeof: 'client-reference', module: './LikeButton.js', props: { postId: id } }
  );
}

### Simulating the RSC Flow

**🧙‍♂️**: We can't run real RSC in a single HTML file — it requires a server environment. But we can **simulate its core idea**: Server Component pre-rendering → generating a Payload → Client consuming that Payload.

Note that the code below uses the VNode format we've used throughout the book (`node.type` and `node.props`):

```javascript
// === Core Flow of RSC Simulation ===

// Step 1: "Server Side" — Render component into an RSC Payload (pure data, zero JS logic)
function serverRender(componentFn, props) {
  const vnode = componentFn(props);
  return resolveToPayload(vnode);
}

function resolveToPayload(node) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;  // Keep text as-is
  }
  if (node.$$typeof === 'client-reference') {
    return node;  // Client Component: keep the reference, don't render on "server"
  }
  // Host element: resolve recursively using node.type (not node.tag)
  return {
    type: node.type,                                       // ← Important: use type, not tag
    props: Object.keys(node.props).reduce((acc, k) => {
      if (k !== 'children') acc[k] = node.props[k];
      return acc;
    }, {}),
    children: (node.props.children || []).map(c => resolveToPayload(c))
  };
}

// Step 2: "Client Side" — Consume the Payload; when encountering client-reference, find the Client Component in the registry
function payloadToVNode(node, registry) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }
  if (node.$$typeof === 'client-reference') {
    // Find Client Component function from registry and execute — actually running on the client now
    const componentFn = registry[node.module];
    return componentFn(node.props);
  }
  return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
}
```

**🐼**: `serverRender` "flattens" the component tree into pure data, and `payloadToVNode` "re-inflates" it into VNodes. The Client Component isn't actually executed until it reaches the client.

**🧙‍♂️**: Exactly. In our demo, the "server" and "client" are in the same HTML file — but the way data is passed (via Payload instead of direct function sharing) perfectly simulates the core mechanism of RSC.

> 💡 **To truly experience RSC**: RSC needs a full-stack environment (like Next.js App Router). Run `npx create-next-app` and choose App Router. In App Router, all components are Server Components by default; only files marked `'use client'` are Client Components.

**🐼**: So SSR and RSC can be combined?

**🧙‍♂️**: Not only can they — in Next.js that's exactly how they work. On first request:

1. RSC runs Server Components on server, generates RSC Payload.
2. SSR renders RSC Payload + Client Components together as HTML string, sends to browser.
3. Browser immediately displays HTML (fast first screen).
4. After JS loads, only Hydrates Client Component parts (small bundle).

**🐼**: Isn't this going back to the PHP era? Writing database queries and UI on the server?

**🧙‍♂️**: On the surface it looks circular, but it's actually a spiral upward. PHP returns HTML strings — the client can't understand its structure. RSC returns a **serializable component tree** — the client can seamlessly combine it with interactive Client Components, implement navigation without refresh, and even streaming. It's a re-examination of 20-year-old simplicity using 20-year-newer technology.

## 15.8 Looking Back: You've "Reinvented" React

**🧙‍♂️**: Po, before we discuss the future, let's look back at what you built on this journey.

```
From scratch, you built:

Ch01  document.createElement     → felt the pain of imperative code
Ch02  render(template, data)     → invented declarative templates
Ch03  EventEmitter + Model       → created observer-pattern data binding
Ch04  UI = f(state)              → grasped React's core idea
Ch05  h() + mount() + patch()    → implemented a Virtual DOM engine
Ch06  Component + Props          → built a component system
Ch07  setState + Lifecycle       → gave components memory and sense of time
Ch08  HOC + Render Props         → experienced class component reuse struggles
Ch09  Stack Reconciler           → hit the browser freeze crisis
Ch10  Fiber Architecture         → designed an interruptible linked-list engine
Ch11  Render & Commit Phase      → implemented the two-phase render mechanism
Ch12  useState (Hooks)           → gave function components memory
Ch13  useEffect & Memoization    → mastered side effects and reactive dependencies
Ch14  createStore & Context      → built cross-layer state management
Ch15  useTransition              → understood concurrent priority scheduling
      throw Promise              → understood Suspense
      renderToString             → understood SSR
      RSC Payload                → understood Server Components

This is the core of React.
```

**🐼**: ...So React isn't magic. It's a series of brilliant engineering trade-offs made at the right time.

## 15.9 The Final Chapter: Principle and Tool

**🧙‍♂️** slowly took a sip of tea. Outside the window, dusk was falling.

**🧙‍♂️**: Po, do you remember what you wanted to learn when you first walked in?

**🐼**: ...I wanted to learn React. I thought it was a tool.

**🧙‍♂️**: And now?

**🐼**: Now I understand. React isn't just a library. It's a crystallization of a series of **engineering decisions** — each one born from a real pain point:

- Imperative too exhausting? → Declarative.
- Full re-renders too slow? → Virtual DOM Diff.
- Logic coupled to `this`? → Hooks.
- Data hard to pass across layers? → Context / state management.
- Synchronous rendering blocks users? → Concurrent scheduling.
- SPA blank first screen? → SSR / SSG.
- Full Hydration waste? → Server Components.

Every "solution" brings new "problems," and new "problems" spawn new "solutions." That's the essence of technology evolution.

**🧙‍♂️**: Exactly. The best technology isn't invented out of thin air — it grows naturally in the process of solving real problems. The path you walked today is the path thousands of engineers walked over the past twenty years.

**🐼**: What if one day React gets replaced by something better?

**🧙‍♂️**: That's fine. Because what you understand isn't just React's API — it's **the eternal trade-offs in UI development**:

- Declarative vs Imperative
- Full updates vs Fine-grained updates
- Runtime flexibility vs Compile-time optimization
- Developer experience vs Runtime performance
- Client-side rendering vs Server-side rendering

Whatever future frameworks are called, they can't escape choices across these dimensions. And you — you already have the ability to move freely among them.

Po bowed deeply.

**🐼**: Thank you, Shifu.

Shifu smiled gently.

**🧙‍♂️**: Go, and build your own world.

---

### 📦 Try It Yourself

Save the following code as `ch15.html` — the ultimate experiment covering Suspense, SSR, and RSC:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chapter 15 — Concurrent, Suspense, SSR & RSC</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; background: #fafafa; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; background: #fff; }
    .card h3 { margin-top: 0; }
    button { padding: 8px 16px; cursor: pointer; margin: 4px; border-radius: 4px; border: 1px solid #ccc; background: #eee; }
    .user-card { background: #f0f8ff; padding: 10px; border-radius: 4px; margin-top: 10px; border-left: 4px solid #0066cc; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto; }
    .html-output { background: #e8f5e9; padding: 12px; border-radius: 6px; margin-top: 8px; border: 1px dashed #4caf50; }
    .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .rsc-server { background: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .rsc-client { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .arrow { text-align: center; font-size: 24px; color: #999; margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Chapter 15 — The Ultimate React Architecture</h1>
  
  <!-- Demo 1: Suspense on Fiber Engine -->
  <div class="card">
    <h3>1. Suspense: throw Promise pattern</h3>
    <p>Click the button to simulate data loading. In the Fiber engine, if a component throws a Promise,
       the current tree's rendering is suspended and switches to fallback UI.
       After data resolves, Fiber automatically re-renders.</p>
    <button id="btn-suspense">🔄 Load user data (Suspense)</button>
    <div id="suspense-root" style="margin-top: 10px; min-height: 80px;">
      <p style="color: #999; font-style: italic;">Click the button above to experience Fiber suspension...</p>
    </div>
  </div>

  <!-- Demo 2: renderToString (SSR) -->
  <div class="card">
    <h3>2. renderToString: SSR simulation</h3>
    <p>Click the button and watch how VNodes are converted to HTML strings (the core of SSR).
       Event listeners are deliberately skipped (waiting for Hydration to fix them).</p>
    <button id="btn-ssr">🖥️ Run renderToString</button>
    <div id="ssr-root"></div>
  </div>

  <!-- Demo 3: RSC Payload -->
  <div class="card">
    <h3>3. RSC Payload: Server Component simulation</h3>
    <p>Simulates the RSC core flow: Server Component renders on server → generates clean RSC Payload JSON
       → client receives and awakens Client Component.</p>
    <button id="btn-rsc">🚀 Simulate RSC flow</button>
    <div id="rsc-root"></div>
  </div>

  <script>
    // ============================================
    // 1. Engine: Mini-React (Fiber + Suspense)
    // ============================================
    function h(type, props, ...children) {
      return {
        type,
        props: {
          ...props,
          children: children.flat().map(child =>
            typeof child === "object" ? child : { type: "TEXT_ELEMENT", props: { nodeValue: child, children: [] } }
          )
        }
      };
    }

    let workInProgress = null, currentRoot = null, wipRoot = null, deletions = null, wipFiber = null, hookIndex = null;

    function render(element, container) {
      wipRoot = { dom: container, props: { children: [element] }, alternate: currentRoot };
      deletions = [];
      workInProgress = wipRoot;
    }

    function workLoop(deadline) {
      let shouldYield = false;
      while (workInProgress && !shouldYield) {
        workInProgress = performUnitOfWork(workInProgress);
        shouldYield = deadline.timeRemaining() < 1;
      }
      if (!workInProgress && wipRoot) commitRoot();
      requestIdleCallback(workLoop);
    }
    requestIdleCallback(workLoop);

    function performUnitOfWork(fiber) {
      const isFunctionComponent = fiber.type instanceof Function;
      if (isFunctionComponent) {
        updateFunctionComponent(fiber);
      } else {
        if (!fiber.dom) fiber.dom = createDom(fiber);
        reconcileChildren(fiber, fiber.props.children);
      }
      if (fiber.child) return fiber.child;
      let nextFiber = fiber;
      while (nextFiber) {
        if (nextFiber.sibling) return nextFiber.sibling;
        nextFiber = nextFiber.return;
      }
      return null;
    }

    function updateFunctionComponent(fiber) {
      wipFiber = fiber;
      hookIndex = 0;
      wipFiber.hooks = [];
      
      try {
        const children = [fiber.type(fiber.props)].flat();
        reconcileChildren(fiber, children);
      } catch (e) {
        if (e instanceof Promise) {
          const fallbackMsg = fiber.props.fallback || '⏳ Loading...';
          reconcileChildren(fiber, [h('span', { style: 'color:#999' }, fallbackMsg)]);
          e.then(() => {
            wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
            deletions = [];
            workInProgress = wipRoot;
          });
        } else {
          throw e;
        }
      }
    }

    function useState(initial) {
      const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];
      const hook = { 
        state: oldHook ? oldHook.state : initial, 
        queue: oldHook ? oldHook.queue : [],
        setState: oldHook ? oldHook.setState : null
      };
      hook.queue.forEach(action => hook.state = typeof action === 'function' ? action(hook.state) : action);
      hook.queue.length = 0;
      if (!hook.setState) {
        hook.setState = action => {
          hook.queue.push(action);
          wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
          workInProgress = wipRoot;
          deletions = [];
        };
      }
      wipFiber.hooks.push(hook);
      hookIndex++;
      return [hook.state, hook.setState];
    }

    function createDom(fiber) {
      const dom = fiber.type === "TEXT_ELEMENT" ? document.createTextNode("") : document.createElement(fiber.type);
      updateDom(dom, {}, fiber.props);
      return dom;
    }

    function updateDom(dom, prevProps, nextProps) {
      for (const k in prevProps) {
        if (k !== 'children') {
          if (!(k in nextProps) || prevProps[k] !== nextProps[k]) {
            if (k.startsWith('on')) dom.removeEventListener(k.slice(2).toLowerCase(), prevProps[k]);
            else if (!(k in nextProps)) {
              if (k === 'className') dom.removeAttribute('class');
              else if (k === 'style') dom.style.cssText = '';
              else dom[k] = '';
            }
          }
        }
      }
      for (const k in nextProps) {
        if (k !== 'children' && prevProps[k] !== nextProps[k]) {
          if (k.startsWith('on')) dom.addEventListener(k.slice(2).toLowerCase(), nextProps[k]);
          else {
            if (k === 'className') dom.setAttribute('class', nextProps[k]);
            else if (k === 'style' && typeof nextProps[k] === 'string') dom.style.cssText = nextProps[k];
            else dom[k] = nextProps[k];
          }
        }
      }
    }

    function reconcileChildren(wipFiber, elements) {
      let index = 0, oldFiber = wipFiber.alternate && wipFiber.alternate.child, prevSibling = null;
      while (index < elements.length || oldFiber != null) {
        const element = elements[index];
        let newFiber = null;
        const sameType = oldFiber && element && element.type === oldFiber.type;
        if (sameType) newFiber = { type: oldFiber.type, props: element.props, dom: oldFiber.dom, return: wipFiber, alternate: oldFiber, effectTag: "UPDATE" };
        if (element && !sameType) newFiber = { type: element.type, props: element.props, dom: null, return: wipFiber, alternate: null, effectTag: "PLACEMENT" };
        if (oldFiber && !sameType) { oldFiber.effectTag = "DELETION"; deletions.push(oldFiber); }
        if (oldFiber) oldFiber = oldFiber.sibling;
        if (index === 0) wipFiber.child = newFiber;
        else if (element) prevSibling.sibling = newFiber;
        prevSibling = newFiber;
        index++;
      }
    }

    function commitRoot() {
      deletions.forEach(commitWork);
      commitWork(wipRoot.child);
      currentRoot = wipRoot;
      wipRoot = null;
    }

    function commitWork(fiber) {
      if (!fiber) return;
      let domParentFiber = fiber.return;
      while (!domParentFiber.dom) domParentFiber = domParentFiber.return;
      const domParent = domParentFiber.dom;
      if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) domParent.appendChild(fiber.dom);
      else if (fiber.effectTag === "UPDATE" && fiber.dom != null) updateDom(fiber.dom, fiber.alternate.props, fiber.props);
      else if (fiber.effectTag === "DELETION") { commitDeletion(fiber, domParent); return; }
      commitWork(fiber.child);
      commitWork(fiber.sibling);
    }
    
    function commitDeletion(fiber, domParent) {
      if (fiber.dom) domParent.removeChild(fiber.dom);
      else commitDeletion(fiber.child, domParent);
    }

    // ============================================
    // 2. Demo: Suspense
    // ============================================
    function createResource(fetchFn) {
      let status = 'pending';
      let result;
      let promise = fetchFn().then(
        data => { status = 'success'; result = data; },
        err => { status = 'error'; result = err; }
      );
      return {
        read() {
          if (status === 'pending') throw promise;
          if (status === 'error') throw result;
          return result;
        }
      };
    }

    let userResource = null;

    function UserProfile() {
      const user = userResource.read();
      return h('div', { className: 'user-card' },
        h('strong', null, user.name),
        h('p', null, 'Role: ' + user.role),
        h('p', null, 'Level: ' + user.level),
        h('em', { style: 'color: green' }, '✅ Data loaded, Fiber resumed rendering!')
      );
    }

    function SuspenseApp() {
      const [started, setStarted] = useState(false);
      
      window.triggerSuspense = () => {
        userResource = createResource(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ name: 'Po, the Dragon Warrior', role: 'React Explorer', level: 99 }), 1500)
          )
        );
        setStarted(true);
      };

      if (!started) return h('p', { style: 'color: #999; font-style: italic;' }, 'Click the button above to experience Fiber suspension with fallback...');
      return h(UserProfile, { fallback: '⏳ Fetching user data from server... (Fiber execution suspended)' });
    }

    render(h(SuspenseApp, null), document.getElementById('suspense-root'));

    document.getElementById('btn-suspense').addEventListener('click', () => {
      if (window.triggerSuspense) window.triggerSuspense();
    });

    // ============================================
    // 3. Demo: renderToString (SSR simulation)
    // ============================================
    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderToString(vnode) {
      if (typeof vnode === 'string' || typeof vnode === 'number') return escapeHtml(String(vnode));
      if (vnode.type === 'TEXT_ELEMENT') return escapeHtml(String(vnode.props.nodeValue));
      let html = '<' + vnode.type;
      for (const key in vnode.props) {
        if (key === 'children') continue;
        if (key.startsWith('on')) continue;
        html += ' ' + key + '="' + escapeHtml(vnode.props[key]) + '"';
      }
      html += '>';
      const children = vnode.props.children || [];
      for (const child of children) html += renderToString(child);
      html += '</' + vnode.type + '>';
      return html;
    }

    const ssrRoot = document.getElementById('ssr-root');
    document.getElementById('btn-ssr').addEventListener('click', () => {
      ssrRoot.innerHTML = '';
      const vnode = h('div', { className: 'card' },
        h('h2', null, 'SSR-rendered list'),
        h('ul', null,
          h('li', null, 'Learn React'),
          h('li', null, 'Understand SSR')
        ),
        h('button', { onclick: () => alert('This button has no Hydration yet — clicking does nothing!') }, 'Inactive button (needs Hydration)')
      );

      const htmlString = renderToString(vnode);
      ssrRoot.innerHTML += `<p class="label">① VNode data structure</p><pre>${JSON.stringify(vnode, null, 2)}</pre>`;
      ssrRoot.innerHTML += `<p class="label">② renderToString pure string output</p><pre>${escapeHtml(htmlString.replace(/></g, '>\n<'))}</pre>`;
      ssrRoot.innerHTML += `<p class="label">③ Browser renders HTML (button inactive because onclick was stripped)</p><div class="html-output">${htmlString}</div>`;
    });

    // ============================================
    // 4. Demo: RSC Payload (Server Component simulation)
    // ============================================
    const rscRoot = document.getElementById('rsc-root');

    // Server Component: runs on "server," never sent to client
    function BlogPage(props) {
      const post = { title: 'Understanding RSC', content: 'RSC generates a JSON Payload instead of raw HTML. The client only needs to Hydrate the Client Component parts...', author: 'Shifu' };
      return h('article', null,
        h('h2', null, post.title),
        h('p', null, post.content),
        h('p', { style: 'color: #666; font-size: 13px;' }, 'Author: ' + post.author),
        { $$typeof: 'client-reference', module: 'LikeButton', props: { postId: props.id } }
      );
    }

    function serverRender(componentFn, props) {
      return resolveToPayload(componentFn(props));
    }

    function resolveToPayload(node) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') return node;
      return {
        type: node.type,
        props: Object.keys(node.props).reduce((acc, k) => {
          if (k !== 'children') acc[k] = node.props[k];
          return acc;
        }, {}),
        children: (node.props.children || []).map(c => resolveToPayload(c))
      };
    }

    function payloadToVNode(node, registry) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') {
        const fn = registry[node.module];
        return fn(node.props);
      }
      return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
    }

    function LikeButton(props) {
      const [count, setCount] = useState(0);
      return h('button', { 
        style: 'background:#ff6b6b;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;font-size:14px;',
        onclick: () => setCount(count + 1)
      }, `❤️ Like (${count})`);
    }

    const clientRegistry = { 'LikeButton': LikeButton };
    let _rscRendered = false;

    document.getElementById('btn-rsc').addEventListener('click', () => {
      if (_rscRendered) return;
      _rscRendered = true;
      rscRoot.innerHTML = '';

      const rscServerDiv = document.createElement('div');
      rscServerDiv.className = 'rsc-server';
      rscServerDiv.innerHTML = '<strong>🖥️ Remote Server</strong>: executes BlogPage, generates RSC Payload (pure JSON, BlogPage function code not included)';
      rscRoot.appendChild(rscServerDiv);

      const payload = serverRender(BlogPage, { id: 42 });
      
      const pLabel1 = document.createElement('p');
      pLabel1.className = 'label';
      pLabel1.innerText = 'RSC Payload (network transport format: pure JSON, BlogPage function never sent to browser)';
      rscRoot.appendChild(pLabel1);

      const pre1 = document.createElement('pre');
      pre1.innerText = JSON.stringify(payload, null, 2);
      rscRoot.appendChild(pre1);
      
      const arrowDiv = document.createElement('div');
      arrowDiv.className = 'arrow';
      arrowDiv.innerText = '⬇️ Network transfer (pure JSON, zero JS)';
      rscRoot.appendChild(arrowDiv);

      const rscClientDiv = document.createElement('div');
      rscClientDiv.className = 'rsc-client';
      rscClientDiv.innerHTML = '<strong>🌐 Local Client</strong>: receives Payload, finds client-reference, loads LikeButton Client Component, hands to Fiber for rendering';
      rscRoot.appendChild(rscClientDiv);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'html-output';
      rscRoot.appendChild(wrapper);
      
      function PayloadRenderer() {
        return payloadToVNode(payload, clientRegistry);
      }
      render(h(PayloadRenderer, null), wrapper);
    });
  </script>
</body>
</html>
```
