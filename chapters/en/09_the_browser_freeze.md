# Chapter 9: The Browser Freeze

![figure 9.1](../images/ch09_browser_freeze.png)

## 9.1 The Bottomless Pit of the Stack

**🐼**: Shifu, in the last chapter I added many Higher-Order Components to reuse logic. But when I tested it, I found that if the data is slightly larger, the page stutters when I type in the input box. Why is this happening?

**🧙‍♂️**: Recall how our `patch` function from Chapter 5 traverses a virtual DOM tree with thousands of nodes. How does it work?

**🐼**: It compares the root node, and then uses a `for` loop to traverse the `children`. If a child node is also a component, it recursively calls `patch` to continue comparing downwards.

**🧙‍♂️**: Yes. This architecture, which deeply relies on the JavaScript engine's own Call Stack, is called the **Stack Reconciler**.

**🐼**: Is there a problem with the recursive call stack? It compares the whole tree in one breath, and then updates the real DOM uniformly. It sounds very reasonable.

**🧙‍♂️**: The code logic is fine. But what about the runtime environment of the browser? How many threads does the frontend have to handle rendering and scripts?

**🐼**: Ah! The frontend is single-threaded. JavaScript execution, page layout, painting the screen, and handling user interactions are all crowded on the same Main Thread.

**🧙‍♂️**: Precisely. Then, to keep animations and pages smooth, what frame rate does a browser usually need to maintain? What does this mean for the time left for the main thread per frame?

**🐼**: Generally it's 60 FPS (frames per second). That means 1000 milliseconds divided by 60, so there are only about **16 milliseconds** to render a frame.

```text
|--- 16ms ---|--- 16ms ---|--- 16ms ---|--- 16ms ---|
  JS + Paint   JS + Paint   JS + Paint   JS + Paint
```

**🐼**: I understand! In these 16 milliseconds, the browser has to execute JS, calculate layout, and paint pixels. If the JS execution takes too long, it will squeeze out the time for painting.

## 9.2 The Tyrannical Main Thread

**🧙‍♂️**: Yes. Now apply this mechanism to our `patch` function. If you have 10,000 nodes, and a single recursive traversal takes 500 milliseconds, what will happen?

**🐼**: Once `patch` is triggered, JavaScript will frantically push hundreds or thousands of functions into the call stack. Because the recursion is synchronous, the main thread will be completely locked down for these 500 milliseconds.

**🧙‍♂️**: During this long half-second, what state is the browser in?

**🐼**: The browser is like it has crashed! It has no time to repaint the screen, nor can it handle my keyboard inputs. Even if I press a key, the letter has to wait for this 500-millisecond recursion to finish before it shows up. This is the truth behind the stuttering.

```text
|--------- 500ms of pure JS execution (React Patch) ---------| -> | Paint |
↑                                                          ↑
User presses key                                        Screen finally updates
(Browser cannot respond)
```

**🧙‍♂️**: Furthermore, if there are CSS animations playing on the page, or the user is scrolling, they will see the screen freeze completely.

## 9.3 Trying to Yield Control

**🐼**: This is too tyrannical. Since 500 milliseconds is too long, can we chop it up? Like breaking it into 50 small pieces of 10 milliseconds each.

**🧙‍♂️**: The thinking is clear. After executing one small piece, give control back to the browser to handle inputs and painting. When it's idle, continue with the next piece. What is this technique called?

**🐼**: This should be "Time Slicing" or Cooperative Multitasking in operating systems, right?

**🧙‍♂️**: Yes. But look at our `patch` code. Can you implement such "pause" and "resume" in a native `for` loop and recursion?

```javascript
// The fatal flaw of the Stack Reconciler:
function patch(oldVNode, newVNode) {
  // ... other logic ...

  // Once it enters the loop and starts recursion, control will absolutely not be returned until the whole tree is traversed!
  for (let i = 0; i < children.length; i++) {
    patch(oldChild[i], newChild[i]); // Deep recursion
  }
}
```

**🐼**: No... The native call stack is like a slide. Once you slide down, you must slide all the way to the bottom. You simply cannot stop in mid-air, let alone remember where you stopped and continue sliding later.

**🧙‍♂️**: Indeed. As long as we use the native JavaScript call stack to traverse the tree, Time Slicing can never be achieved.

**🐼**: Then what should we do? Do we have to simulate a call stack ourselves, and change the tree traversal from recursion to some kind of loop iteration that can be stopped at any time?

**🧙‍♂️**: This is exactly the core turning point of modern React. To solve this fatal performance crisis, the React team spent two full years completely rewriting the underlying reconciliation engine.

**🐼**: A complete rewrite? Does that mean the original tree structure has to change too?

**🧙‍♂️**: Yes. They abandoned the native call stack and introduced a brand new linked-list architecture designed specifically for being "interruptible" and for "Time Slicing". This is the protagonist of the next chapter — **Fiber**. But before that, experience the feeling of the main thread being locked by deep recursion in today's experiment.

---

### 📦 Try It Yourself

Save the following code as `ch09.html` and open it in a browser to personally experience the "browser freeze" caused by deep recursion:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chapter 9 — The Browser Freeze</title>
  <style>
    body { font-family: sans-serif; padding: 20px; text-align: center; }
    .box { display: inline-block; width: 10px; height: 10px; margin: 1px; background: #0066cc; }
    input { padding: 10px; font-size: 16px; width: 300px; margin: 20px; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    #status { color: #ff4444; font-weight: bold; margin: 10px; }
  </style>
</head>
<body>
  <h1>Browser Freeze Demo</h1>
  <p>1. Try typing steadily in the input box below to feel how smooth it is.</p>
  <p>2. Click the "Trigger 10k Node Render" button.</p>
  <p>3. <strong>Before the render finishes</strong> (when the page freezes), immediately go back to the input box and type frantically.</p>
  
  <input type="text" placeholder="Try typing here...">
  <br>
  <button id="render-btn">Trigger 10k Node Render</button>
  <div id="status"></div>
  <div id="app"></div>

  <script>
    // Simulate the recursive rendering of the Stack Reconciler
    function renderTree(depth) {
      if (depth === 0) {
        const el = document.createElement('div');
        el.className = 'box';
        // Simulate some CPU-consuming component logic
        let sum = 0;
        for (let i = 0; i < 50000; i++) sum += Math.random();
        return el;
      }
      
      const container = document.createElement('div');
      // Two branches per level, exponential growth
      container.appendChild(renderTree(depth - 1));
      container.appendChild(renderTree(depth - 1));
      return container;
    }

    document.getElementById('render-btn').addEventListener('click', () => {
      const app = document.getElementById('app');
      const status = document.getElementById('status');
      
      status.textContent = 'Rendering... The page is frozen, try typing quickly!';
      
      // Use setTimeout to allow the status text above to render first, then lock the main thread
      setTimeout(() => {
        const start = performance.now();
        
        // Generate a tree of depth 13, totally 8192 nodes, with time-consuming calculations
        const tree = renderTree(13);
        
        app.innerHTML = '';
        app.appendChild(tree);
        
        const time = (performance.now() - start).toFixed(0);
        status.textContent = `Done in ${time} ms. (The keys you pressed just popped up now!)`;
      }, 50);
    });
  </script>
</body>
</html>
```