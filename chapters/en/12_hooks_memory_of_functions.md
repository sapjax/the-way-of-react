# Chapter 12: Hooks — The Memory of Functions

![figure 12.1](../images/ch12_hooks.png)

## 12.1 Leaving the Old Baggage Behind

Po looked at the powerful Fiber engine just completed.

**🐼**: Shifu, we now have a Render phase that can pause and resume anytime, and an ultra-fast synchronous Commit phase. But the `class Component` we wrote earlier seems to have trouble in the new architecture?

**🧙‍♂️**: Yes. Remember the trouble we ran into in chapter eight (Patterns of Reuse)? To reuse logic between class components, we used HOC and Render Props, which led to "Wrapper Hell."

**🐼**: Of course I remember! That wrapper hell caused impossibly deep component trees, triggering the "browser freeze" crisis in chapter nine, which is why we spent three chapters building the brand new Fiber engine.

**🧙‍♂️**: Exactly. And in the Fiber architecture, since Render phase runs under time slicing, a component instance's `render()` method might be called multiple times then discarded (if the scheduler deems a higher-priority task has arrived). This means lifecycle methods in `class` (like `constructor` or early lifecycle side effects) would cause unexpected bugs, making class components extremely unreliable and increasingly bloated.

**🐼**: Since that's the case, why not completely drop `class`?

**🧙‍♂️**: That was exactly the React team's idea. At React Conf 2018, Sophie Alpert and Dan Abramov formally proposed the **Hooks** proposal. Their goal was clear: give function components the same capabilities as class components, while avoiding all the trouble `class` brings.

**🐼**: But how can function components have "state"? Functions start fresh every time they're called, right?

**🧙‍♂️**: Good question. Let's first look at where the problem is.

## 12.2 Functions Have "Amnesia"

**🧙‍♂️**: Here's a simple TodoItem function component:

```javascript
function TodoItem(props) {
  return h('div', { className: 'item' }, props.text);
}
```

No `this` confusion, no large confusing lifecycle. Given the same input (Props), it always returns the same UI snapshot. It naturally embraces the declarative essence: `UI = f(state)`.

**🐼**: But it has a fatal flaw — **no memory**. Look — if I want this component to remember how many times it's been clicked:

```javascript
function Counter() {
  let count = 0; // local variable
  
  return h('button', { 
    onclick: () => {
      count++;
      console.log('Latest count:', count);
      update(); // trigger re-render
    }
  }, `Clicks: ${count}`);
}
```

Every time I click, `count` does increment in the closure, but calling `update()` causes `Counter()` to be **re-executed**. When it re-executes, `let count = 0` is re-initialized. The page always shows `0`.

**🧙‍♂️**: Think of function components as a **goldfish** 🐟 — every call is a brand new fish with no memory of the previous second. To make it "remember," we must store the memory **outside the fish**.

**🐼**: Outside the fish? You mean... store state outside the function?

## 12.3 First Attempt: Global Variable

**🧙‍♂️**: Right. The most intuitive approach: put state in a global variable.

```javascript
let globalState;

function useState(initialValue) {
  if (globalState === undefined) {
    globalState = initialValue;
  }
  
  function setState(newValue) {
    globalState = newValue;
    update(); // trigger re-render
  }
  
  return [globalState, setState];
}
```

We call this special function that "helps pure functions retrieve state from outside" a **Hook**.

**🐼**: Hook?

**🧙‍♂️**: Like a fishing hook 🪝 — your pure function is just a carefree fish, but a Hook lets it **hook into** the engine's internal mechanisms to gain the superpower of reading and writing state.

Usage:

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  return h('h1', { onclick: () => setCount(count + 1) }, count);
}
```

**🐼**: Elegant! But what if there are **two** `Counter` components on the page?

**🧙‍♂️**: Disaster — two `Counter` components share the same `globalState`, overwriting each other.

**🐼**: What if we upgrade the global variable to a **global array**? Each `useState` takes its slot from the array in order:

```javascript
let hooksArray = [];
let hookIndex = 0;

function useState(initialValue) {
  const currentIndex = hookIndex;
  
  if (hooksArray[currentIndex] === undefined) {
    hooksArray[currentIndex] = initialValue;
  }
  
  function setState(newValue) {
    hooksArray[currentIndex] = newValue;
    update();
  }
  
  hookIndex++;
  return [hooksArray[currentIndex], setState];
}
```

**🧙‍♂️**: Yes. The array approach lets one component call `useState` multiple times. But think about the bigger picture —

**🐼**: 100 components, each with 3 `useState` calls... 300 states crammed into one giant array. How does React know which section belongs to which component? If a component unmounts, does the array still align?

**🧙‍♂️**: You immediately spotted the fragility of the global array approach. Now let's go back to the real architecture we spent three chapters building.

## 12.4 Give Memory to Fiber — Each Component Has Its Own "Drawer Cabinet"

### Analogy: One Cabinet Per Person

**🧙‍♂️**: In the Fiber architecture, each component corresponds to a Fiber node. Think of **each Fiber node as a small cabinet with drawers** 🗄️:

```
Fiber: <Counter title="Counter A">
┌──────────────────────────┐
│  Drawer 0:  count = 0    │  ← 1st useState call
│  Drawer 1:  step  = 1    │  ← 2nd useState call
└──────────────────────────┘

Fiber: <Counter title="Counter B">
┌──────────────────────────┐
│  Drawer 0:  count = 0    │  ← 1st useState call
│  Drawer 1:  step  = 1    │  ← 2nd useState call
└──────────────────────────┘
```

Each component has its **own drawer cabinet** (`fiber.hooks` array), completely independent. `useState` calls open drawers 0, 1, 2 in order...

**🐼**: This way no matter how many `Counter` components there are, states won't interfere! But how is it implemented?

### Technical Mapping: wipFiber and hookIndex

**🧙‍♂️**: We only need two "global pointers":

| Variable | Meaning | Analogy |
|------|------|------|
| `wipFiber` | The Fiber node currently being rendered | "Which cabinet is currently open" |
| `hookIndex` | Which `useState` call we're on | "Which drawer are we pulling" |

Every time the engine starts rendering a function component, it does three things:

```javascript
function updateFunctionComponent(fiber) {
  // ① Point the pointer to the current Fiber (open this cabinet)
  wipFiber = fiber;
  // ② Reset drawer counter (start from drawer 0)
  hookIndex = 0;
  // ③ Prepare a new hooks array
  wipFiber.hooks = [];
  
  // Execute the function component, get children
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}
```

**🐼**: So when `useState(0)` is called inside `Counter()`'s function body, `useState` just needs to get state from `wipFiber.hooks[hookIndex]`!

**🧙‍♂️**: Right. And because Fiber has an `alternate` pointer (pointing to the last render's Fiber), we can easily take the previously stored value from the "old cabinet."

### Minimal useState: Read Only

```javascript
function useState(initial) {
  // Try to get old value from same drawer in old Fiber
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
  };

  wipFiber.hooks.push(hook); // put in new cabinet
  hookIndex++;               // ready for next useState
  return [hook.state, null]; // setState added later
}
```

### Tracing: Counter's First Render

```
First render of Counter A:
  wipFiber = Counter_A's Fiber node
  hookIndex = 0
  wipFiber.alternate = null (first render, no old Fiber)

  ① useState(0)
     → oldHook = null (no old Fiber)
     → hook.state = 0 (use initial value)
     → wipFiber.hooks = [{ state: 0 }]
     → hookIndex becomes 1
     → returns [0, ...]

  ② useState(1)
     → oldHook = null
     → hook.state = 1 (use initial value)
     → wipFiber.hooks = [{ state: 0 }, { state: 1 }]
     → hookIndex becomes 2
     → returns [1, ...]
```

**🧙‍♂️**: Correct. And what happens after the user clicks the button?

### Tracing: Counter's Second Render

```
User clicks → triggers re-render → Counter A called again
  wipFiber = Counter_A's new Fiber node
  wipFiber.alternate = previous Fiber (has hooks: [{ state: 3 }, { state: 1 }])
  hookIndex = 0

  ① useState(0)
     → oldHook = alternate.hooks[0] = { state: 3 }
     → hook.state = 3 (take from old drawer, ignore initial value!)
     → returns [3, ...]

  ② useState(1)
     → oldHook = alternate.hooks[1] = { state: 1 }
     → hook.state = 1 (take from old drawer)
     → returns [1, ...]
```

**🐼**: I understand! The `initial` parameter only takes effect on the **first render**. Every subsequent render takes the value from the corresponding old Fiber position. That's the function's "memory"!

### The "Full Re-execution" Model

**🧙‍♂️**: Before continuing, let's formally name a core mechanism that will run through the next few chapters — the **"Full Re-execution" model**.

Every time state changes, React doesn't "patch" the last execution result. Instead it **re-executes the entire component function from top to bottom**, generating a fresh UI snapshot, then uses Reconciliation to find differences and update the DOM. Fiber is responsible for pulling `hook.state` from the "old drawer" so this fresh execution can "remember" the previous state — but beyond that, every variable and expression in the function is computed from scratch.

**🐼**: Like every render, that goldfish is a brand new fish, just inheriting the DNA of the previous goldfish from outside the tank?

**🧙‍♂️**: That analogy is quite accurate. This model gives us a simple, pure mental framework — `UI = f(state)` — while also bringing two challenges you're about to encounter:

First, if the function has "things that should only be done once" (like starting a timer or sending a network request), re-executing every time would do them repeatedly, causing disaster. Second, if the function has "expensive computations" (like filtering ten thousand rows of data), every trivial re-render would recompute everything, wasting performance. **All of chapter thirteen is about how to properly handle these two challenges within the "full re-execution" model.**

## 12.5 Making setState Trigger Updates

**🧙‍♂️**: Now let's add the most crucial part — how does `setState` make the engine re-render?

**🐼**: `setState` needs to do two things: ① record the new value; ② tell the engine to "start work."

**🧙‍♂️**: Right. But one detail: `setState` might be called multiple times in one frame (like clicking twice quickly), so instead of directly overwriting `state`, we use a **queue** to store update requests. At the next render, we "settle" all updates in the queue at once.

```javascript
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: oldHook ? oldHook.queue : [],
    setState: oldHook ? oldHook.setState : null,
  };

  // Settle queue: apply all pending updates in order
  hook.queue.forEach(action => {
    hook.state = typeof action === 'function'
      ? action(hook.state) // support functional update: setCount(c => c + 1)
      : action;            // also support direct assignment: setCount(5)
  });
  hook.queue.length = 0; // clear settled queue

  // Create setState on first render
  if (!hook.setState) {
    hook.setState = action => {
      hook.queue.push(action);   // ① queue the update request
      // ② tell the engine to "start work" — create new wipRoot
      wipRoot = {
        dom: currentRoot.dom,
        props: currentRoot.props,
        alternate: currentRoot,
      };
      workInProgress = wipRoot;
      deletions = [];
    };
  }

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, hook.setState];
}
```

**🐼**: Let me verify the full flow:

> 1. User clicks button → calls `setCount(c => c + 1)`
> 2. `setCount` pushes `c => c + 1` into `hook.queue`
> 3. `setCount` creates new `wipRoot`, engine starts new Render phase
> 4. Engine traverses to Counter's Fiber → calls `updateFunctionComponent`
> 5. `Counter()` executes → calls `useState(0)` inside
> 6. `useState` gets `oldHook` from old Fiber, finds `c => c + 1` in `queue`
> 7. Executes `action(oldHook.state)` → gets new `state`
> 8. Returns `[new state, setState]`, Counter renders new UI

**🧙‍♂️**: Exactly. That's the complete lifecycle of Hooks.

## 12.6 The Iron Rule of Hooks: Can't Go Inside `if`

**🐼**: Wait, I just thought of something. `useState` relies on `hookIndex` (drawer number) to match state. What if I write this:

```javascript
function BadCounter() {
  const [count, setCount] = useState(0);
  
  if (count > 5) {
    const [warning, setWarning] = useState('Too many!');
  }
  
  const [step, setStep] = useState(1);
  return /* ... */;
}
```

**🧙‍♂️**: Disaster. Let's trace two cases:

```
When count = 3 (if doesn't run):
  Drawer 0 → count    ✓
  Drawer 1 → step     ✓

When count = 6 (if runs):
  Drawer 0 → count    ✓
  Drawer 1 → warning  ← should be step!
  Drawer 2 → step     ← extra drawer, misaligned
```

**🐼**: All drawers got mixed up! Because `hookIndex` increments in call order — once one render has one more or fewer `useState` calls than the previous, all subsequent drawer numbers are off.

**🧙‍♂️**: This is why React has an iron rule:

> **Hooks must be called at the top level of the function, never inside conditionals, loops, or nested functions.**

Because only by ensuring call order and count are identical in every render can the "sequential drawer" mechanism work correctly.

| ✅ Correct | ❌ Wrong |
|------------|--------------|
| Call `useState` at function body top | Call `useState` inside `if` |
| Same number of calls every render | Call `useState` in a loop dynamically |
| Call order never changes | Call `useState` after an early `return` |

## 12.7 A Historic Moment: React Conf 2018

**🧙‍♂️**: Let's pause the code and go back to the historical scene.

At React Conf in October 2018, Sophie Alpert first showed class components' three major pain points:

1. **Hard to reuse logic** — HOC / Render Props bring wrapper hell
2. **Fragmented lifecycle** — related logic split across different lifecycle methods
3. **`this` is confusing** — event handlers need `this` binding, a dense trap for beginners

**🐼**: That's exactly the trouble we've been experiencing firsthand!

**🧙‍♂️**: Yes. Then Dan Abramov took the stage and live-demo'd `useState` and `useEffect`. The audience gasped — function components can have state and side effects too!

That was the birth of Hooks. It didn't appear out of thin air as "new syntax sugar" — it was the inevitable product of a journey from **reuse struggles** (chapter eight) → **browser freeze** (chapter nine) → **Fiber architecture** (chapters ten and eleven).

**🐼**: Wait, what's `useEffect` that Dan showed? We only implemented `useState`.

**🧙‍♂️**: That's the topic of the next chapter. With the "full re-execution" mental model in place, you'll quickly understand why `useEffect` must exist and how it protects your functions from being harmed by re-execution.

## 12.8 Try It Yourself

The following is the complete mini-React engine with `useState`. Open in a browser to run: two independent `Counter` function components, each maintaining their own state.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chapter 12 - Hooks: The Memory of Functions</title>
  <style>
    body { font-family: sans-serif; padding: 20px; text-align: center; }
    .counter { max-width: 400px; margin: 20px auto; border: 1px solid #999; }
    button { margin: 10px 20px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // === Virtual DOM factory ===
    function h(type, props, ...children) {
      return {
        type,
        props: {
          ...props,
          children: children.flat().map(child =>
            typeof child === "object" ? child : { type: "TEXT_ELEMENT", props: { nodeValue: child, children: [] } }
          ),
        },
      };
    }

    // === Fiber Engine (built in chapters 10 and 11) ===
    let workInProgress = null;
    let currentRoot = null;
    let wipRoot = null;
    let deletions = [];
    let wipFiber = null;
    let hookIndex = null;

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
      if (isFunctionComponent) updateFunctionComponent(fiber);
      else updateHostComponent(fiber);

      if (fiber.child) return fiber.child;
      let nextFiber = fiber;
      while (nextFiber) {
        if (nextFiber.sibling) return nextFiber.sibling;
        nextFiber = nextFiber.return;
      }
      return null;
    }

    // === Chapter 12 new: function component rendering + Hooks ===
    function updateFunctionComponent(fiber) {
      wipFiber = fiber;
      hookIndex = 0;
      wipFiber.hooks = []; // prepare new hooks array ("open the cabinet")
      const children = [fiber.type(fiber.props)];
      reconcileChildren(fiber, children);
    }

    function updateHostComponent(fiber) {
      if (!fiber.dom) fiber.dom = createDom(fiber);
      reconcileChildren(fiber, fiber.props.children);
    }

    function createDom(fiber) {
      const dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);
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
      let index = 0;
      let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
      let prevSibling = null;

      while (index < elements.length || oldFiber != null) {
        const element = elements[index];
        let newFiber = null;
        const sameType = oldFiber && element && element.type === oldFiber.type;

        if (sameType) {
          newFiber = { type: oldFiber.type, props: element.props, dom: oldFiber.dom, return: wipFiber, alternate: oldFiber, effectTag: "UPDATE" };
        }
        if (element && !sameType) {
          newFiber = { type: element.type, props: element.props, dom: null, return: wipFiber, alternate: null, effectTag: "PLACEMENT" };
        }
        if (oldFiber && !sameType) {
          oldFiber.effectTag = "DELETION";
          deletions.push(oldFiber);
        }

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
      else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber, domParent);
        return;
      }

      commitWork(fiber.child);
      commitWork(fiber.sibling);
    }
    
    function commitDeletion(fiber, domParent) {
      if (fiber.dom) domParent.removeChild(fiber.dom);
      else commitDeletion(fiber.child, domParent);
    }

    // === Hooks API ===
    function useState(initial) {
      const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex];

      const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: oldHook ? oldHook.queue : [],
        setState: oldHook ? oldHook.setState : null,
      };

      hook.queue.forEach(action => {
        hook.state = typeof action === 'function' ? action(hook.state) : action;
      });
      hook.queue.length = 0;

      if (!hook.setState) {
        hook.setState = action => {
          hook.queue.push(action);
          wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
          };
          workInProgress = wipRoot;
          deletions = [];
        };
      }

      wipFiber.hooks.push(hook);
      hookIndex++;
      return [hook.state, hook.setState];
    }

    // === App: two independent Counters each maintaining their own state ===
    function Counter({ title }) {
      const [count, setCount] = useState(0);
      const [step, setStep] = useState(1);

      return h('div', { className: 'counter' },
        h('h2', null, title),
        h('p', null, `Current count: ${count}`),
        h('button', { onclick: () => setCount(c => c + step) }, `+${step}`),
        h('button', { onclick: () => setStep(s => s + 1) }, 'Increase step')
      );
    }

    function App() {
      return h('div', null,
        h('h1', null, 'Hooks: The Memory of Functions'),
        h('p', null, 'Two independent function components, each remembering their own state.'),
        h(Counter, { title: "Counter A" }),
        h(Counter, { title: "Counter B" })
      );
    }

    render(h(App, null), document.getElementById('app'));
  </script>
</body>
</html>
```
