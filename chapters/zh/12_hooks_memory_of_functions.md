# 第十二章：Hooks —— 函数的记忆 (The Memory of Functions)

![figure 12.1](../../website/public/images/ch12_hooks.png)

## 12.1 抛弃历史包袱

Po 看着刚刚完成的、强大的 Fiber 引擎。

**🐼**：Shifu，我们现在有了可以随时暂停和恢复的 Render 阶段，也有了极速同步的 Commit 阶段。但是，我们之前写的 `class Component` 似乎在新架构里遇到麻烦了？

**🧙‍♂️**：是的。你还记得我们在第八章（复用困境）中遇到的麻烦吗？为了在类组件之间复用逻辑，我们使用了 HOC 和 Render Props，结果导致了"嵌套地狱 (Wrapper Hell)"。

**🐼**：当然记得！那个嵌套地狱造就了深不可测的组件树，引爆了第九章的“浏览器停摆”危机，所以我们才花了三个章节构建全新的 Fiber 引擎。

**🧙‍♂️**：正是。而在 Fiber 架构中，由于 Render 阶段在时间切片下运行，一个组件实例的 `render()` 方法可能会被调用多次，然后又被丢弃（如果调度器认为有更高优先级的任务插入）。这意味着 `class` 的生命周期（如 `constructor` 或早期生命周期里的副作用逻辑）会引发预料之外的 Bug，类组件变得极不可靠且越来越笨重。

**🐼**：既然这样，我们为什么不彻底抛弃 `class`？

**🧙‍♂️**：这正是 React 团队的想法。2018 年的 React Conf 上，Sophie Alpert 和 Dan Abramov 正式提出了 **Hooks** 提案。他们的目标很清晰：让函数组件拥有和类组件同等的能力，同时避免 `class` 带来的一切麻烦。

**🐼**：可是函数组件怎么拥有“状态”呢？函数不是每次调用都从零开始吗？

**🧙‍♂️**：好问题。我们先来看看问题出在哪里。

## 12.2 函数的“失忆症”

**🧙‍♂️**：下面是一个简单的 TodoItem 函数组件：

```javascript
function TodoItem(props) {
  return h('div', { className: 'item' }, props.text);
}
```

它没有 `this` 指向的混乱，没有庞大晦涩的生命周期。给它相同的输入（Props），它永远返回相同的 UI 快照。它天生拥抱“声明式”的本质：`UI = f(state)`。

**🐼**：但它有一个致命缺陷——**它没有记忆**。Shifu 你看，如果我想让这个组件记住自己被点击了多少次：

```javascript
function Counter() {
  let count = 0; // 局部变量
  
  return h('button', { 
    onclick: () => {
      count++;
      console.log('最新的 count 是:', count);
      update(); // 触发重新渲染
    }
  }, `点击次数: ${count}`);
}
```

我每次点击，`count` 确实在闭包里增加了，但只要调用 `update()` 重新渲染，`Counter()` 函数就会被 **重新执行**。一执行，`let count = 0` 就被重新初始化。页面上永远显示 `0`。

**🧙‍♂️**：你可以把函数组件想象成一个 **金鱼**🐟——每次被调用都是全新的一条鱼，完全不记得上一秒发生了什么。要让它“记住”，我们必须把记忆存到鱼缸外面。

**🐼**：鱼缸外面？你是说……把状态存在函数的外部？

## 12.3 第一次尝试：全局变量

**🧙‍♂️**：对。最直觉的方案：把状态放到全局。

```javascript
let globalState;

function useState(initialValue) {
  if (globalState === undefined) {
    globalState = initialValue;
  }
  
  function setState(newValue) {
    globalState = newValue;
    update(); // 触发重新渲染
  }
  
  return [globalState, setState];
}
```

我们将这种“帮纯函数从外部取回状态”的特殊函数，称为 **"Hook（钩子）"**。

**🐼**：钩子？

**🧙‍♂️**：就像钓鱼的钩子🪝——你的纯函数本来只是一条无忧无虑的鱼，但 Hook 让它能够**钩入 (Hook into)** 引擎的内部机制，获得读写状态的超能力。

用起来是这样的：

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  return h('h1', { onclick: () => setCount(count + 1) }, count);
}
```

**🐼**：漂亮！但如果页面上有 **两个** `Counter` 呢？

**🧙‍♂️**：灾难——两个 `Counter` 共享同一个 `globalState`，互相覆盖。

**🐼**：那把全局变量升级成 **全局数组** 呢？每个 `useState` 按顺序从数组里取自己的位置：

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

**🧙‍♂️**：是的。数组方案让一个组件内可以调用多次 `useState`。但现在想想更大的场景——

**🐼**：100 个组件，每个用 3 个 `useState`……300 个状态挤在一个巨大的数组里。React 怎么知道哪段属于哪个组件？组件被卸载了数组还对齐吗？

**🧙‍♂️**：你一眼看穿了全局数组方案的脆弱。现在该回到我们花了三章搭建的真正架构了。

## 12.4 把记忆交给 Fiber —— 每个组件自带“抽屉柜”

### 类比：一人一柜

**🧙‍♂️**：在 Fiber 架构中，每个组件都对应一个 Fiber 节点。你可以想象 **每个 Fiber 节点是一个带抽屉的小柜子**🗄️：

```
Fiber: <Counter title="计数器 A">
┌──────────────────────────┐
│  抽屉 0:  count = 0      │  ← 第 1 次 useState
│  抽屉 1:  step  = 1      │  ← 第 2 次 useState
└──────────────────────────┘

Fiber: <Counter title="计数器 B">
┌──────────────────────────┐
│  抽屉 0:  count = 0      │  ← 第 1 次 useState
│  抽屉 1:  step  = 1      │  ← 第 2 次 useState
└──────────────────────────┘
```

每个组件拥有 **自己的抽屉柜**（`fiber.hooks` 数组），互不干扰。`useState` 调用时按顺序打开第 0 个、第 1 个抽屉……

**🐼**：这样无论有多少个 `Counter`，状态都不会互相串了！但具体怎么实现呢？

### 技术映射：wipFiber 和 hookIndex

**🧙‍♂️**：我们只需要两个“全局指针”：

| 变量 | 含义 | 类比 |
|------|------|------|
| `wipFiber` | 当前正在渲染的 Fiber 节点 | “现在打开了哪个柜子” |
| `hookIndex` | 当前是第几次 `useState` 调用 | “正在拉第几个抽屉” |

每当引擎开始渲染一个函数组件，它做三件事：

```javascript
function updateFunctionComponent(fiber) {
  // ① 把指针指向当前 Fiber（打开这个柜子）
  wipFiber = fiber;
  // ② 重置抽屉计数器（从第 0 个抽屉开始）
  hookIndex = 0;
  // ③ 准备一个新的 hooks 数组
  wipFiber.hooks = [];
  
  // 执行函数组件，得到子元素
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}
```

**🐼**：所以当 `Counter()` 函数体内调用 `useState(0)` 时，`useState` 只需要去 `wipFiber.hooks[hookIndex]` 取状态就行了！

**🧙‍♂️**：没错。而且因为 Fiber 有 `alternate` 指针（指向上一次渲染的 Fiber），我们可以轻松地从“旧柜子”里取出上次存的值。

### 最简版 useState：只处理读取

我们先写一个最小版本，只关注“怎么读到上一次的状态”：

```javascript
function useState(initial) {
  // 尝试从旧 Fiber 的同一个抽屉里取旧值
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
  };

  wipFiber.hooks.push(hook); // 放进新柜子
  hookIndex++;               // 准备给下一个 useState
  return [hook.state, null]; // setState 稍后补上
}
```

**🐼**：等等，让我用一个具体例子走一遍：

### 推演：Counter 的第一次渲染

假设我们有 `Counter({ title: "计数器 A" })`，它的函数体里有两次 `useState` 调用：

```
第一次渲染 Counter A：
  wipFiber = Counter_A 的 Fiber 节点
  hookIndex = 0
  wipFiber.alternate = null（首次渲染，没有旧 Fiber）

  ① useState(0)
     → oldHook = null（没有旧 Fiber）
     → hook.state = 0（用初始值）
     → wipFiber.hooks = [{ state: 0 }]
     → hookIndex 变成 1
     → 返回 [0, ...]

  ② useState(1)
     → oldHook = null
     → hook.state = 1（用初始值）
     → wipFiber.hooks = [{ state: 0 }, { state: 1 }]
     → hookIndex 变成 2
     → 返回 [1, ...]
```

**🧙‍♂️**：正确。那用户点击按钮后呢？

### 推演：Counter 的第二次渲染

```
用户点击 → 触发重新渲染 → Counter A 被再次调用
  wipFiber = Counter_A 的新 Fiber 节点
  wipFiber.alternate = 上一次的 Fiber（里面有 hooks: [{ state: 3 }, { state: 1 }]）
  hookIndex = 0

  ① useState(0)
     → oldHook = alternate.hooks[0] = { state: 3 }
     → hook.state = 3（从旧抽屉取值，忽略初始值！）
     → 返回 [3, ...]

  ② useState(1)
     → oldHook = alternate.hooks[1] = { state: 1 }
     → hook.state = 1（从旧抽屉取值）
     → 返回 [1, ...]
```

**🐼**：我明白了！`initial` 参数只在 **第一次渲染** 时生效，之后每次渲染都从旧 Fiber 的对应位置取值。这就是函数的“记忆”！

### “完整重执行”模型：命名这个核心机制

**🧙‍♂️**：在继续之前，让我们正式命名一个会贯穿接下来几章的核心机制——**“完整重执行”模型**。

每次状态发生变化，React 不会在上一次执行结果上“打补丁”，而是把整个组件函数 **从头到尾重新执行一遍**，生成一张全新的 UI 快照，再通过 Reconciliation 找出差异、更新 DOM。Fiber 负责把 `hook.state` 从“旧抽屉”里取出来，让这次重新执行能“记得”上一次的状态——但除此之外，函数里的一切变量、表达式，都是从零计算出来的。

**🐼**：就好像每次渲染，那条金鱼都是一条全新的鱼，只是从鱼缸外面继承了之前金鱼的 DNA？

**🧙‍♂️**：这个比喻相当准确。这个模型给了我们一个简单纯粹的思维框架——`UI = f(state)`——同时也带来了两类你即将遭遇的挑战：

第一，如果函数里有“只应该做一次”的事情（比如启动定时器、发送网络请求），每次重新执行都会把它再做一遍，引发灾难。第二，如果函数里有“非常昂贵的计算”（比如过滤一万条数据），每次无关紧要的重渲染都会把它重算一遍，造成性能浪费。**第十三章的全部内容，就是在回答如何在这个“完整重执行”的模型下妥善应对这两类挑战。**

## 12.5 让 setState 触发更新

**🧙‍♂️**：现在补上最关键的部分——`setState` 怎么让引擎重新渲染？

**🐼**：`setState` 需要做两件事吧：① 记录新的值；② 告诉引擎“开工”。

**🧙‍♂️**：对。但有个细节：`setState` 可能在一帧内被调用多次（比如连续点击两下），所以我们不直接覆盖 `state`，而是用一个 **队列 (queue)** 来存放更新请求。等到下次渲染时，再一次性“清算”队列里的所有更新。

```javascript
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: oldHook ? oldHook.queue : [],       // 更新队列
    setState: oldHook ? oldHook.setState : null,
  };

  // 清算队列：把所有待处理的更新依次应用
  hook.queue.forEach(action => {
    hook.state = typeof action === 'function'
      ? action(hook.state) // 支持函数式更新：setCount(c => c + 1)
      : action;            // 也支持直接赋值：setCount(5)
  });
  hook.queue.length = 0; // 清空已处理的队列

  // 首次渲染时创建 setState
  if (!hook.setState) {
    hook.setState = action => {
      hook.queue.push(action);   // ① 把更新请求放入队列
      // ② 告诉引擎“开工”——创建新的 wipRoot
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

**🐼**：让我确认一下整个流程：

> 1. 用户点击按钮 → 调用 `setCount(c => c + 1)`
> 2. `setCount` 将 `c => c + 1` 推入 `hook.queue`
> 3. `setCount` 创建新的 `wipRoot`，引擎开始新的 Render 阶段
> 4. 引擎遍历到 Counter 的 Fiber → 调用 `updateFunctionComponent`
> 5. `Counter()` 被执行 → 内部调用 `useState(0)`
> 6. `useState` 从旧 Fiber 取出 `oldHook`，发现 `queue` 里有一个 `c => c + 1`
> 7. 执行 `action(oldHook.state)` → 得到新的 `state`
> 8. 返回 `[新 state, setState]`，Counter 渲染出新的 UI

**🧙‍♂️**：没错，这就是 Hooks 的完整生命周期。

## 12.6 Hooks 的铁律：不能写在 if 里

**🐼**：等等，我突然想到一个问题。`useState` 是靠 `hookIndex`（抽屉编号）来对应状态的，那如果我这么写：

```javascript
function BadCounter() {
  const [count, setCount] = useState(0);
  
  if (count > 5) {
    const [warning, setWarning] = useState('太多了！');
  }
  
  const [step, setStep] = useState(1);
  return /* ... */;
}
```

**🧙‍♂️**：灾难来了。让我们推演两种情况：

```
count = 3 时（if 不执行）：
  抽屉 0 → count    ✓
  抽屉 1 → step     ✓

count = 6 时（if 执行了）：
  抽屉 0 → count    ✓
  抽屉 1 → warning  ← 本来应该是 step！
  抽屉 2 → step     ← 多出来一个抽屉，对不上了
```

**🐼**：抽屉全乱了！因为 `hookIndex` 是按调用顺序递增的，一旦某次渲染比上次多了或少了一个 `useState` 调用，后面所有的抽屉编号都会错位。

**🧙‍♂️**：这就是为什么 React 有一条铁律：

> **Hook 必须在函数的最顶层调用，不能写在条件语句、循环或嵌套函数里。**

因为只有保证每次渲染的调用顺序和数量完全一致，“按序号取抽屉”的机制才能正确工作。

| ✅ 正确写法 | ❌ 错误写法 |
|------------|------------|
| 在函数体最顶部调用 `useState` | 在 `if` 里调用 `useState` |
| 每次渲染调用数量不变 | 在循环里动态调用 `useState` |
| 调用顺序不变 | 在提前 `return` 之后调用 |

## 12.7 历史一刻：2018 React Conf

**🧙‍♂️**：让我们暂停一下代码，回到历史现场。

2018 年 10 月的 React Conf 上，Sophie Alpert 先展示了 Class 组件的三大痛点：

1. **逻辑复用难**——HOC / Render Props 带来嵌套地狱
2. **生命周期碎片化**——相关逻辑被拆散到不同生命周期方法
3. **`this` 令人困惑**——事件处理需要绑定 `this`，新手陷阱密集

**🐼**：这就是我们这一路走来深有体会的问题！

**🧙‍♂️**：是的。然后 Dan Abramov 上台，现场 live demo 了 `useState` 和 `useEffect`。台下一片惊呼——原来函数组件也可以拥有状态和副作用！

这就是 Hooks 的诞生。它不是凭空出现的“新语法糖”，而是从 **复用困境**（第八章）→ **浏览器停摆**（第九章）→ **Fiber 架构**（第十、十一章）一路走来的必然产物。

**🐼**：等等，Dan 在台上展示的 `useEffect` 是什么？我们只实现了 `useState`。

**🧙‍♂️**：这正是下一章的主题。有了“完整重执行”的心智模型打底，你会很快理解 `useEffect` 为何必须存在，以及它如何保护你的函数不被重新执行所伤害。

## 12.8 试一试：完整代码

下面是包含 `useState` 的完整 mini-React 引擎。打开浏览器即可运行：两个独立的 `Counter` 函数组件，各自维护自己的状态。

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
    // === 虚拟 DOM 工厂函数 ===
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

    // === Fiber 引擎（第十、十一章构建的） ===
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

    // === 第十二章新增：函数组件渲染 + Hooks ===
    function updateFunctionComponent(fiber) {
      // 设置全局指针，让 useState 知道当前在哪个 Fiber
      wipFiber = fiber;
      hookIndex = 0;
      wipFiber.hooks = []; // 准备新的 hooks 数组（“打开抽屉柜”）
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
      // 从旧 Fiber 的同位置抽屉里取出上次的 hook 对象
      const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex];

      const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: oldHook ? oldHook.queue : [],
        setState: oldHook ? oldHook.setState : null,
      };

      // 清算队列：把所有待处理的更新依次应用
      hook.queue.forEach(action => {
        hook.state = typeof action === 'function' ? action(hook.state) : action;
      });
      hook.queue.length = 0;

      if (!hook.setState) {
        hook.setState = action => {
          hook.queue.push(action);
          // 创建新的 wipRoot，触发整棵树重新渲染
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

    // === 应用层面：两个独立的 Counter，各自维护自己的状态 ===
    function Counter({ title }) {
      const [count, setCount] = useState(0);
      const [step, setStep] = useState(1);

      return h('div', { className: 'counter' },
        h('h2', null, title),
        h('p', null, `当前计数: ${count}`),
        h('button', { onclick: () => setCount(c => c + step) }, `+${step}`),
        h('button', { onclick: () => setStep(s => s + 1) }, '增大幅度')
      );
    }

    function App() {
      return h('div', null,
        h('h1', null, 'Hooks: The Memory of Functions'),
        h('p', null, '下面是两个独立的函数组件，它们各自记住了自己的状态。'),
        h(Counter, { title: "计数器 A" }),
        h(Counter, { title: "计数器 B" })
      );
    }

    render(h(App, null), document.getElementById('app'));
  </script>
</body>
</html>
```