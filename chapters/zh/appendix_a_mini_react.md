# 附录 A：Mini-React vs React —— 我们简化了什么

![chapter illustration](../images/ch_appendix.png)

在这本书中，我们从零构建了一个 **324 行** 的 Mini-React 引擎（`code/mini-react.js`）。它涵盖了 Virtual DOM、组件系统、Hooks 和状态管理——这些是理解 React 设计哲学的核心。

但真正的 React 是一个拥有数十万行代码的生产级框架。这个附录帮助你理解：**我们刻意简化了哪些部分，为什么简化，以及真正的 React 是如何处理这些问题的。**

---

## 最大的架构差异：递归树 vs Fiber 链表

这是 Mini-React 和真正 React 之间最根本的区别，也是其他所有差异的根源。

**Mini-React** 使用递归的 VNode 树。当你调用 `patch(oldVNode, newVNode)` 时，它从根节点开始递归向下比较，直到遍历完整棵树。这意味着一旦开始，就无法中途停下来。

**React 16+** 使用 **Fiber 架构**。每个组件不再是树中的一个节点，而是一个通过三条链接相连的 Fiber 节点：

```
Fiber 节点的三条链接：
  child    → 第一个子节点
  sibling  → 下一个兄弟节点
  parent   → 父节点

遍历顺序：先 child → 再 sibling → 回到 parent 找 uncle
```

这种链表结构使得 React 可以在**任何 Fiber 节点处暂停**，记住当前位置，把控制权交还给浏览器，然后在下一帧继续工作。这正是第 11 章 Time Slicing 背后的基础设施。

```javascript
// React 的核心渲染循环（简化版）
function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  // 所有工作完成后，一次性提交到 DOM
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop);
}
```

> 💡 我们没有采用 Fiber 架构是一个有意的教学选择。递归树更直观——它对应的就是你脑海中 "树形 UI 结构" 的直觉。但这意味着我们无法实现可中断渲染和并发模式。

---

## Render 阶段与 Commit 阶段的分离

在 Mini-React 中，`patch()` 函数边比较边修改 DOM——发现一个差异就立刻更新一个 DOM 节点。

React 将这个过程拆成了**两个严格分离的阶段**：

| 阶段 | Mini-React | React |
|:-----|:-----------|:------|
| **Render 阶段** | 比较 + 立即修改 DOM（合为一步） | 只比较，构建 Fiber 树，标记 `effectTag`，**不触碰 DOM** |
| **Commit 阶段** | 不存在 | 遍历标记过的 Fiber，**一次性**提交所有 DOM 变更 |

为什么要分离？因为 Render 阶段是**可中断**的——如果浏览器需要处理用户输入，React 可以暂停 Render。但如果边 Render 边改 DOM，用户就会看到**半完成的 UI**（比如列表只更新了前三项）。

分离后，DOM 修改集中在 Commit 阶段一次性完成，用户要么看到旧 UI，要么看到新 UI，永远不会看到中间状态。

---

## Reconciliation 的细节

### effectTag 与 alternate（双缓冲）

Mini-React 的 `patch()` 直接比较新旧 VNode 并就地更新。React 使用了更精细的机制：

```javascript
// React 的 Reconciliation 为每个 Fiber 打上 effectTag
if (sameType) {
  // 类型相同 → 复用 DOM 节点，标记为 UPDATE
  newFiber = { ...oldFiber, props: element.props, effectTag: "UPDATE" };
} else if (element) {
  // 新元素 → 标记为 PLACEMENT（需要插入 DOM）
  newFiber = { type: element.type, props: element.props, effectTag: "PLACEMENT" };
}
if (oldFiber && !sameType) {
  // 旧节点被替换 → 标记为 DELETION
  oldFiber.effectTag = "DELETION";
  deletions.push(oldFiber);
}
```

每个 Fiber 还通过 `alternate` 属性指向上一次渲染的对应 Fiber——这是一种**双缓冲**策略。React 始终维护两棵 Fiber 树：当前显示的（`currentRoot`）和正在构建的（`wipRoot`），构建完成后交换。

---

## Virtual DOM 与 Diff 算法

| 方面 | Mini-React | React |
|:-----|:-----------|:------|
| **子节点 Diff** | 按索引逐个比较（O(n)） | 基于 `key` 的启发式算法，可识别节点的移动、插入和删除 |
| **跨层级移动** | 不处理 | 同样不处理——这是 React 团队有意的 O(n) 权衡 |
| **Fragment** | 不支持 | 支持 `<>...</>` 返回多个根节点 |
| **文本节点** | 直接用字符串表示 | 有独立的 `TEXT_ELEMENT` 类型，统一处理 |

> 💡 React 的 `key` 机制解决了一个真实的性能问题：当列表项被重新排序时，没有 `key` 会导致大量不必要的 DOM 操作。这也是为什么 React 在你忘记加 `key` 时会发出警告。

---

## 组件与渲染

| 方面 | Mini-React | React |
|:-----|:-----------|:------|
| **函数组件** | 引擎中未区分函数组件和普通函数 | 函数组件拥有独立的 Fiber 节点（无 DOM），通过 `updateFunctionComponent` 专门处理 |
| **类组件** | 支持 `render()`、`setState`、`componentDidMount`、`componentWillUnmount` | 完整的生命周期（`getDerivedStateFromProps`、`shouldComponentUpdate`、`getSnapshotBeforeUpdate` 等） |
| **渲染架构** | 同步递归——调用 `render()` 后一口气完成整棵树 | Fiber 架构 + `workLoop`，支持可中断渲染和优先级调度 |
| **批量更新** | 每次 `setState` 立即触发一次完整的重渲染 | 自动批量合并多次 `setState`，只触发一次渲染 |
| **错误边界** | 不支持 | `componentDidCatch` / `getDerivedStateFromError` 捕获子树中的渲染错误 |

> 💡 React 中函数组件的 Fiber 节点**没有对应的 DOM 节点**。这意味着在 Commit 阶段寻找父 DOM 节点时，React 需要沿 Fiber 树向上遍历直到找到一个有 DOM 的祖先。这是一个简单但容易被忽视的细节。

---

## Hooks

| 方面 | Mini-React | React |
|:-----|:-----------|:------|
| **Hook 存储** | 全局数组 `_hooks[]`，仅支持单个组件 | 每个 Fiber 节点拥有独立的 `hooks` 数组 |
| **useState 的更新方式** | `setState(newValue)` 直接赋值 | `setState(action)` 支持传入函数，通过 action queue 批量执行 |
| **支持的 Hooks** | `useState`、`useEffect`、`useRef`、`useContext`、`useMemo` | 还有 `useReducer`、`useCallback`、`useRef`、`useLayoutEffect`、`useTransition`、`useDeferredValue` 等 |
| **useEffect 执行时机** | 同步执行，在渲染过程中立即调用
| **useRef** | 通过 `useMemo(() => ({ current }), [])` 实现 | 原生实现，有专用的 Fiber hook 类型 | | 异步执行，在浏览器绘制完成后才执行（不阻塞绘制） |
| **Hooks 规则检查** | 不检查 | 通过 ESLint 插件 `eslint-plugin-react-hooks` 强制执行调用顺序规则 |

### Action Queue 模式

Mini-React 的 `setState` 直接替换值。React 的 `setState` 则将更新操作推入一个**队列**（action queue），在下一次渲染时依次执行：

```javascript
// React 的 useState 内部（简化版）
function useState(initial) {
  const oldHook = wipFiber.alternate?.hooks?.[hookIndex];
  const hook = { state: oldHook ? oldHook.state : initial, queue: [] };

  // 执行上一轮积累的所有 action
  oldHook?.queue.forEach(action => {
    hook.state = action(hook.state);
  });

  function setState(action) {
    hook.queue.push(action);       // 不立即执行，而是入队
    wipRoot = { ... };             // 触发新一轮渲染
    nextUnitOfWork = wipRoot;
  }

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}
```

这就是为什么在 React 中你可以写 `setCount(c => c + 1)` 而不只是 `setCount(count + 1)`——前者是一个 action 函数，多次调用时能正确地基于最新值累加。

> 💡 我们的全局 `_hooks[]` 数组是最重要的简化之一。它意味着同一时刻只能有一个组件使用 Hooks——这在教学中足够了，但在真实应用中是不可行的。React 通过 Fiber 节点上的 `hooks` 数组让每个组件实例都有自己的 Hook 状态。

---

## 状态管理

| 方面 | Mini-React | React / Redux |
|:-----|:-----------|:--------------|
| **createStore** | 简化版：`getState`、`dispatch`、`subscribe` | Redux 还有中间件（middleware）、`combineReducers`、Redux Toolkit 等完整生态 |
| **Context** | 简化的值存储 + 订阅 | React Context 与组件树深度集成，`Provider` 是一个真正的组件节点 |
| **性能优化** | 无——Context 值变化会导致所有消费者重渲染 | 同样存在此问题，社区通过 `useMemo`、状态拆分、`use-context-selector` 等方案缓解 |

---

## 我们完全没有实现的部分

以下是真实 React 中存在，但我们的 Mini-React 刻意跳过的：

- **合成事件系统 (SyntheticEvent)**：React 将所有事件委托到根节点，提供跨浏览器一致的事件对象。我们直接使用了原生 `addEventListener`。
- **Portal**：`ReactDOM.createPortal` 允许组件将子节点渲染到 DOM 树的其他位置（如模态框）。
- **Suspense & 并发渲染**：第 11 章通过独立 demo 演示了其核心思想，但没有集成到引擎中——因为它们需要 Fiber 架构作为基础。
- **服务端渲染 (SSR) & Server Components (RSC)**：需要 Node.js 服务器环境和全栈架构，超出了单文件引擎的范畴。
- **React DOM 的属性处理**：`className` vs `class`、`htmlFor` vs `for`、`style` 对象语法、受控组件（`value`/`onChange`）等。
- **调和器调度 (Scheduler)**：React 的 `scheduler` 包基于 `MessageChannel` 实现了优先级队列，是并发模式的基础设施。

---

## 代码规模对比

```
Mini-React    ≈     324 行    教学实现，覆盖核心概念
React 18      ≈  200,000+ 行  生产级实现，覆盖所有边界情况
```

这个 **~617 倍** 的差距来自哪里？主要是：

1. **边界情况处理**：空值、嵌套数组、错误恢复、浏览器兼容性……
2. **性能优化**：Fiber、批量更新、懒加载、Suspense……
3. **开发者工具**：错误提示、警告信息、DevTools 集成……
4. **多平台支持**：React DOM、React Native、React Test Renderer……

---

## 接下来学什么？

你已经从零构建了 React 的核心。接下来可以探索：

- **[react.dev](https://react.dev)** —— React 官方文档，从 "Learn" 部分开始。
- **[Next.js](https://nextjs.org)** —— 最流行的全栈 React 框架。试试 App Router 来体验真正的 RSC。
- **[React 源码](https://github.com/facebook/react)** —— 查看 `packages/react-reconciler` 了解真实的 Fiber 架构。
- **[React Compiler](https://react.dev/learn/react-compiler)** —— 下一步进化：构建时自动记忆化。
- **[Dan Abramov 的博客](https://overreacted.io)** —— React 核心团队成员的深度文章。
- **[OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/)** —— 启发本书写作风格的操作系统教材。
