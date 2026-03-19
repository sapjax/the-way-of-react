# 第十四章：状态管理与跨越层级的桥梁 (Context and State)

![figure 14.1](../../website/public/images/ch14_context_and_state.png)

Po 用前几章学到的 Hooks 构建了一个较大的 Todo 应用。`useState` 管理局部状态，`useEffect` 处理副作用，`useMemo` 优化昂贵计算。但很快，他碰到了一个四件法宝都无法解决的新问题。

## 14.1 层层传递的痛 (Prop Drilling)

**🐼**：Shifu，我的应用结构大概像这样：

```text
App
├── Header            ← 需要 user.name
├── Sidebar
│   └── UserProfile   ← 需要 user.name, user.avatar
└── Main
    └── Content
        └── TodoList
            └── TodoItem  ← 需要 theme.color
```

用户的名字在 `App` 组件的 State 里，但需要在 `Header` 和深层嵌套的 `UserProfile` 里使用。主题颜色也在 `App` 里，但要传到五层深的 `TodoItem`。看看这些 Props 是怎么传的：

```javascript
function App() {
  const [user] = useState({ name: 'Po', avatar: '🧑' });
  const [theme] = useState({ color: '#0066cc' });

  return h('div', null, [
    h(Header,  { user: user }),                    // 传
    h(Sidebar, { user: user }),                    // 传
    h(Main,    { user: user, theme: theme }),       // 传
  ]);
}

function Main({ user, theme }) {
  // Main 自己不用 user，但必须往下传！
  return h(Content, { user: user, theme: theme }); // 传
}

function Content({ user, theme }) {
  // Content 也不用 user，但也必须往下传！
  return h(TodoList, { user: user, theme: theme }); // 传
}
```

每一层都在传 `user` 和 `theme`，但中间的层（`Main`、`Content`）根本不需要这些数据！它们只是 “快递员”，接收后无脑转发。

**🧙‍♂️**：这就是 **Prop Drilling（属性钻孔）**。当应用层级加深时，这种模式有两大问题：噪音（中间组件被迫接受和传递无关的 Props），以及脆弱性（如果要给 `TodoItem` 增加新的 `locale` 属性，你需要修改**整条链路上的所有组件**）。

**🐼**：解决方案有哪些？

**🧙‍♂️**：两条路。一条是把共享状态“提取出来”放进一个全局容器（如 Redux），让任何组件都可以直接订阅；另一条是让数据像信号一样“穿透”组件树传递，不经过中间层（Context API）。

但在讲这两条路之前，让我先介绍一个你很快会需要的工具——`useReducer`。

## 14.2 状态逻辑的集中管理：useReducer

**🐼**：`useReducer`？这和 `useState` 有什么区别？

**🧙‍♂️**：当你的状态逻辑变复杂时，`useState` 就会开始变得混乱。想象你的 TodoList 有越来越多的操作：

```javascript
// 用 useState 管理复杂状态：多个 setter，逻辑散落各处
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // 添加：
  const addTodo = (text) => setTodos(prev => [...prev, { text, done: false }]);
  // 删除：
  const removeTodo = (i) => setTodos(prev => prev.filter((_, idx) => idx !== i));
  // 切换完成状态（还需要同时更新 loading）：要写多个 setter……
}
```

**🐼**：这看起来很乱，每个操作都要手动组装新状态。

**🧙‍♂️**：`useReducer` 的思路是：把所有的状态变化逻辑集中到一个 **纯函数（Reducer）** 里，再通过 **dispatch 一个"动作（Action）"** 来触发更新：

```javascript
// Reducer：一个纯函数，负责描述"收到某个动作后，状态如何变化"
function todosReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return { ...state, todos: [...state.todos, { text: action.text, done: false }] };
    case 'REMOVE':
      return { ...state, todos: state.todos.filter((_, i) => i !== action.index) };
    case 'TOGGLE':
      return {
        ...state,
        todos: state.todos.map((t, i) =>
          i === action.index ? { ...t, done: !t.done } : t
        )
      };
    default:
      return state;
  }
}

function TodoApp() {
  const [state, dispatch] = useReducer(todosReducer, { todos: [], filter: 'all' });

  return h('div', null, [
    h('button', { onclick: () => dispatch({ type: 'ADD', text: '买牛奶' }) }, '添加'),
    // ...
  ]);
}
```

**🐼**：有意思！所有的状态变化都有一个明确的“名字”（`action.type`），逻辑集中在一处，很容易追踪和调试。

**🧙‍♂️**：你抓住了精髓。`useReducer` 其实就是 `useState` 的一个变体——你只是把“如何更新”这件事，从分散的各个 setter 里提取出来，集中放进了一个函数。记住这个模式，因为你接下来要看到的 Redux，正是把这个 Reducer 从**组件内部**提取到了**全局仓库**里。

## 14.3 全局状态：createStore (Mini-Redux)

**🧙‍♂️**：解决 Prop Drilling 的第一种思路是——把共享的状态提取到组件树之外，放在一个 **全局的、可预测的容器** 里。

**🐼**：就像一个公共的“仓库”？

**🧙‍♂️**：正是。这就是 **Redux** (2015) 的核心理念。和你刚才看到的 `useReducer` 一模一样——只是 Store 现在在组件树的外面，任何组件都可以直接订阅它。让我们实现一个极简版：

```javascript
function createStore(reducer, initialState) {
  let state = initialState;
  let listeners = [];

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      // Reducer: 纯函数，(旧状态, 动作) → 新状态
      state = reducer(state, action);
      // 通知所有订阅者
      listeners.forEach(fn => fn());
    },

    subscribe(fn) {
      listeners.push(fn);
      // 返回取消订阅的函数
      return () => {
        listeners = listeners.filter(l => l !== fn);
      };
    }
  };
}
```

下面是一个完整的使用示例，展示 mini-redux 的完整工作流程：

```javascript
// 1. 定义 Reducer：描述"当收到某个动作时，状态如何变化"
function counterReducer(state, action) {
  switch (action.type) {
    case 'INCREMENT': return { ...state, count: state.count + 1 };
    case 'DECREMENT': return { ...state, count: state.count - 1 };
    default: return state;
  }
}

// 2. 创建 Store：初始状态 + Reducer
const store = createStore(counterReducer, { count: 0 });

// 3. 订阅状态变化：每次 dispatch 后自动触发
store.subscribe(() => {
  const { count } = store.getState();
  document.getElementById('display').textContent = 'Count: ' + count;
});

// 4. 用户操作 → dispatch Action → Reducer 计算新状态 → 通知订阅者
document.getElementById('inc-btn').addEventListener('click', () => {
  store.dispatch({ type: 'INCREMENT' });
});
```

注意这个流程：**用户操作 → dispatch → reducer → 新状态 → 订阅者更新 UI**。整个数据流是单向的、可预测的。

**🐼**：这很像第三章的 `EventEmitter`！数据变化时通知订阅者。

**🧙‍♂️**：是的，但有一个关键区别：状态更新必须通过 `dispatch` + `reducer`，这是一个 **纯函数**。这意味着状态变化可预测（给定输入，总是相同输出），而且可以被记录和回放（Time Travel Debugging）。

**🐼**：但我还是需要手动 `subscribe`、手动更新 UI。有没有更简洁的方式？

## 14.4 Fiber 时代的 Context API

**🧙‍♂️**：对于简单的全局数据（如主题、用户信息、语言设置），React 提供了 **Context API**。在旧的组件架构里，它有些晦涩。但在我们的 Fiber 架构里，实现它简直易如反掌。

**🐼**：为什么容易？

**🧙‍♂️**：还记得 Fiber 的数据结构吗？每个 Fiber 节点都有一个 `return` 指针，指向它的父亲。这意味着，无论你身处组件树的哪个恐怖的深层，你都有了一条 **直通根节点的安全通道**。

```javascript
function createContext(defaultValue) {
  return {
    _currentValue: defaultValue, // 兜底的默认值
  };
}

// 一个普通的包装组件，身上带着特殊的标记（type === ContextProvider）
function ContextProvider(props) {
  // 它本质上只是把 children 渲染出来，
  // 但它的 Fiber 节点上挂着 context 和 value，等待子孙来“认领”
  return props.children;
}
```

当我们在极深处的子组件里调用 `useContext` 时，发生的事情非常直觉——顺着 `return` 指针一路往祖先爬，找到第一个提供了这个 Context 的节点：

```javascript
function useContext(contextType) {
  let currentFiber = wipFiber;
  
  // 顺着 return 指针，一路往上爬！
  while (currentFiber) {
    if (
      currentFiber.type === ContextProvider && 
      currentFiber.props.context === contextType
    ) {
      // 从这个祖先的 props 里把值“偷”出来！
      return currentFiber.props.value;
    }
    currentFiber = currentFiber.return;
  }
  
  // 爬到了根节点都没找到 Provider，返回 createContext 时的默认值
  return contextType._currentValue;
}
```

**🐼**：哦！这简直就是作用域链（Scope Chain）的组件树版本！内部组件需要一个值，如果自己没有，就问父亲；父亲没有，就问爷爷……直到找到最近的一个提供了这个 Context 的祖先。

**🧙‍♂️**：正是。而且由于 `useContext` 发生在 Render 阶段，如果祖先的 `value` 变了，当这个子组件被要求重绘时，它再次往上爬，自然就会拿到全新的值。

不过，真实 React 的 Context 比这个要复杂一些，它需要解决一个性能问题：当 Provider 的 `value` 变化时，如果中间的某些组件使用了 `React.memo` 阻断了更新，子组件如何依然能够获得通知并强制更新呢？React 源码在 Context 上做了一些精巧的依赖收集机制来突破这个屏障。但在心智模型上，**顺藤摸瓜往上爬**就是 Context 的本质。

## 14.5 状态管理的全景与未来

**🐼**：有了 Redux 和 Context，我是不是就掌握了所有的状态管理武器？

**🧙‍♂️**：这两种模式依然是生态的中流砥柱。但对于更复杂的现代应用，它们也各自暴露出了一些痛点：Redux 的样板代码（Action、Reducer、Store）过于繁琐；而 Context 在值更新时，会导致所有订阅了该 Context 的组件重新执行，缺乏细粒度的**精准更新**能力。

因此，状态管理的“未来”正在向两个方向演进：**极简主义**（如 Zustand，将 Redux 大幅简化，并使用基于 Hook 的精确订阅机制），和**原子化状态**（如 Jotai / Recoil，将状态拆散成无数个极小的独立“原子”，当原子变化时只有真正订阅了该原子的组件才会更新，从根本上解决 Context 的性能问题）。

**🐼**：听起来，“精准更新”是大家都在追求的终极目标？

**🧙‍♂️**：一语中的！这个追求，甚至催生了一种从根本上与 React 不同的框架设计。接下来，我们就来看看这种截然不同的设计——以及它如何让我们重新审视“完整重执行”模型的本质。

## 14.6 延伸阅读：React vs Signals (SolidJS)

**🧙‍♂️**：Po，在你学习了 React 的状态管理之后，我想让你看看一种完全不同的心智模型——**SolidJS 的 Signals**。

React 的核心假设是：每次状态变化，整个组件函数 **重新执行**（你在第十二章已经认识了这个“完整重执行”模型）。SolidJS 的做法完全相反——组件函数只执行 **一次**，状态变化时直接更新对应的 DOM 节点，不需要 Virtual DOM 和 Diff。

```javascript
// React：每次 count 变化，整个函数重新执行
function Counter() {
  const [count, setCount] = useState(0);
  return <h1>Count: {count}</h1>;
}

// SolidJS：函数只执行一次，count() 是一个“订阅”
function Counter() {
  const [count, setCount] = createSignal(0);
  return <h1>Count: {count()}</h1>;  // 只有这个文本节点被直接更新
}
```

| 维度 | React (重新执行) | SolidJS (Signals) |
|:-----|:-----------------|:-------------------|
| **心智模型** | 简单——“每次渲染就是一个快照” | 需要理解响应式——"哪些值是 Signal" |
| **默认性能** | 需要 memo/useMemo 手动优化 | 默认最优——精准更新 |
| **代码一致性** | 高——组件就是普通函数 | 有 “陷阱”——解构 props 会丢失响应式 |
| **并发能力** | ✅ 可以中断和恢复渲染 | ❌ 同步更新，难以实现时间切片 |

**🐼**：那 React 的“完整重执行”模型岂不是白白浪费了性能？上一章我们讲 `useMemo` 和 `useCallback` 时，那个电商商品列表的例子简直是性能灾难——切个护眼模式整个页面都要重新计算。

**🧙‍♂️**：是的。所以在 React 中，为了避免这种“全树重新执行”带来的性能雪崩，开发者需要 **手动** 使用 `useMemo`、`useCallback` 和 `React.memo` 告诉框架“这个不用重新算”、“这个不用重新创建”。

**🐼**：那 SolidJS 根本不需要这些小修小补咯？

**🧙‍♂️**：对。在 SolidJS 中，状态被更新时，只有相关的 DOM 节点会被重新求值，函数不会被重新创建。这就是表格中“默认性能”那一行的含义——**SolidJS 默认就是精准更新，React 需要开发者手动优化**。

**🐼**：那 React 这种模型除了给开发者添负担，还有什么好处？

**🧙‍♂️**：关键在于 React 的渲染过程只是"调用函数，生成 VNode 数据结构"——它不直接操作 DOM。这意味着这个过程是**纯粹的、可丢弃的**：React 可以渲染到一半就暂停，先去处理用户输入，之后再回来继续。这正是第十一章并发模式的基础。

而 SolidJS 的 Signal 变化直接修改 DOM——没有中间的“规划阶段”，所以也就没有什么可以暂停的东西。更快、更精准，但换不来并发能力。

**🐼**：所以 React 的“完整重执行”不只是缺陷，它反而 **使得并发模式成为可能**？

**🧙‍♂️**：正是如此。这是两种架构的**根本权衡**——React 选择了“用冗余的规划阶段换取可中断性”，SolidJS 选择了“用精准的直接更新换取默认性能”。没有完美的答案，只有不同场景下的最佳选择。

### SolidJS 的“陷阱”

**🧙‍♂️**：最后，我要让你看到 Signals 心智模型中的一些 **非直觉行为**，这样你才能做出公平的评判。

```javascript
// SolidJS 的陷阱：解构会“杀死”响应式
function Greeting(props) {
  // ❌ 解构后，name 变成了一个静态值，不再追踪变化！
  const { name } = props;
  return <h1>Hello, {name}</h1>;  // name 永远是初始值

  // ✅ 必须用 props.name 保持响应式
  return <h1>Hello, {props.name}</h1>;
}

// React 中不存在这个问题！因为每次都重新执行，每次都拿到最新的值。
```

```javascript
// SolidJS 的陷阱：提前求值会“杀死”响应式
function App() {
  const [count, setCount] = createSignal(0);

  // ❌ 在组件设置阶段直接求值，只执行一次！
  const doubled = count() * 2;  // 永远是 0

  // ✅ 必须用函数包裹，保持“惰性求值”
  const doubled = () => count() * 2;

  return <p>Doubled: {doubled()}</p>;
}
```

**🐼**：我明白了。React 的心智模型更 **宽容**——因为每次重新执行，所以不管你写什么表达式，它都会拿到最新值。SolidJS 的心智模型更 **高效**——但你必须时刻理解“响应式链在哪里断了”。

**🧙‍♂️**：这是每个框架选择的 **核心权衡**。没有完美的答案，只有不同场景下的最佳选择。

## 14.7 对比一览

| 方案 | 优点 | 缺点 | 适用场景 |
|:-----|:-----|:-----|:---------|
| **Prop Drilling** | 简单、显式、可追踪 | 深层嵌套时冗余，修改链路长 | 扁平组件树 |
| **useReducer** | 集中管理复杂状态逻辑 | 仍是局部状态，无法跨组件共享 | 单个组件内的复杂状态 |
| **Redux** | 可预测、Time Travel Debug | 大量样板代码（Action、Reducer、Store） | 大规模应用、复杂状态逻辑 |
| **Context API** | 轻量、无需外部库 | 性能问题（全组件重渲染） | 低频变化的全局数据 |
| **原子化 (Jotai/Recoil)** | 精准更新、最小样板 | API 较新、生态较小 | 中大型应用、精细控制 |

---

### 📦 实践一下

将以下代码保存为 `ch14.html`，这是全面升级到 Fiber 环境下的完整应用（包含 Context 穿透绑定与 Mini-Redux 状态机制）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 14 — Context and State (Fiber Version)</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f9f9f9; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; background: white; }
    .card h3 { margin-top: 0; }
    button { padding: 6px 12px; cursor: pointer; margin: 4px; border-radius: 4px; border: 1px solid #ccc; background: #eee; }
    li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; list-style: none; }
    li .task-content { display: flex; align-items: center; gap: 8px; }
    li.done span { text-decoration: line-through; color: #999; }
    li .delete-btn { background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
    input[type="text"] { padding: 8px; width: 60%; border-radius: 4px; border: 1px solid #ccc; }
    #stats { font-size: 14px; color: #666; margin-top: 10px; }
    #empty-msg { color: #999; font-style: italic; font-size: 14px; margin-top: 10px; }
    #log { background: #282c34; color: #abb2bf; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 13px; max-height: 150px; overflow-y: auto; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>State Management (Fiber & Hooks)</h1>
  <div id="app"></div>
  <div id="log"></div>

  <script>
    // ============================================
    // 1. 底层引擎: Mini-React (Fiber + Hooks)
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

    let workInProgress = null, currentRoot = null, wipRoot = null, deletions = null;
    let wipFiber = null, hookIndex = null;

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
        wipFiber = fiber;
        hookIndex = 0;
        wipFiber.hooks = [];
        const children = [fiber.type(fiber.props)].flat();
        reconcileChildren(fiber, children);
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
      commitEffects(wipRoot.child);
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

    function commitEffects(fiber) {
      if (!fiber) return;
      if (fiber.hooks) {
        fiber.hooks.forEach(hook => {
          if (hook.tag === 'effect' && hook.hasChanged && hook.callback) {
            if (hook.cleanup) hook.cleanup();
            hook.cleanup = hook.callback();
          }
        });
      }
      commitEffects(fiber.child);
      commitEffects(fiber.sibling);
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

    function useEffect(callback, deps) {
      const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];
      let hasChanged = true;
      if (oldHook && deps) hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
      const hook = { tag: 'effect', callback, deps, hasChanged, cleanup: oldHook ? oldHook.cleanup : undefined };
      wipFiber.hooks.push(hook);
      hookIndex++;
    }

    // ============================================
    // 2. 新增：Context 机制
    // ============================================
    function createContext(defaultValue) {
      return { _currentValue: defaultValue };
    }
    
    // ContextProvider 只负责透传 children，
    // 但它的 Fiber 节点上带着 context 和 value，供子孙通过 useContext 查找
    function ContextProvider(props) {
      return props.children;
    }

    function useContext(contextType) {
      let currentFiber = wipFiber;
      // 顺着 return 指针往上爬，找最近的 Provider
      while (currentFiber) {
        if (currentFiber.type === ContextProvider && currentFiber.props.context === contextType) {
          return currentFiber.props.value;
        }
        currentFiber = currentFiber.return;
      }
      return contextType._currentValue; // 没找到则返回默认值
    }

    // ============================================
    // 3. 新增：Mini-Redux
    // ============================================
    const logEl = document.getElementById('log');
    function log(msg) {
      const line = document.createElement('div');
      line.textContent = '➤ ' + msg;
      logEl.prepend(line);
    }

    function createStore(reducer, initial) {
      let state = initial;
      let listeners = [];
      return {
        getState: () => state,
        dispatch: (action) => {
          state = reducer(state, action);
          listeners.forEach(fn => fn());
        },
        subscribe: (fn) => {
          listeners.push(fn);
          return () => { listeners = listeners.filter(l => l !== fn); };
        }
      };
    }

    function todosReducer(state, action) {
      switch (action.type) {
        case 'ADD_TODO':
          log('dispatch: ADD_TODO "' + action.text + '"');
          return { ...state, todos: [...state.todos, { text: action.text, done: false }] };
        case 'REMOVE_TODO':
          log('dispatch: REMOVE_TODO index=' + action.index);
          return { ...state, todos: state.todos.filter((_, i) => i !== action.index) };
        case 'TOGGLE_TODO':
          log('dispatch: TOGGLE_TODO index=' + action.index);
          return {
            ...state,
            todos: state.todos.map((t, i) => i === action.index ? { ...t, done: !t.done } : t)
          };
        default:
          return state;
      }
    }

    const store = createStore(todosReducer, { 
      todos: [
        { text: 'Learn React', done: true }, 
        { text: 'Build Mini-React', done: false }
      ] 
    });

    // 自定义 Hook：将外部 Redux Store 接入 Fiber 的渲染机制
    // useEffect 负责在挂载时订阅 store，在卸载时取消订阅（清理函数）
    function useStore(store) {
      const [state, setState] = useState(store.getState());
      
      useEffect(() => {
        const unsubscribe = store.subscribe(() => {
          setState(store.getState());
        });
        return unsubscribe; // 返回取消订阅函数作为清理函数
      }, [store]); 
      
      return state;
    }

    // ============================================
    // 4. 业务应用
    // ============================================
    const ThemeContext = createContext('#0066cc');

    function TodoApp() {
      const state = useStore(store); 
      const [inputValue, setInputValue] = useState('');

      const doneCount = state.todos.filter(t => t.done).length;

      return h('div', { className: 'card' },
        h('h3', null, 'My Todo List (Fiber & Hooks)'),
        h('div', null,
          h('input', { 
            type: 'text',
            placeholder: 'Add a task', 
            value: inputValue, 
            oninput: e => setInputValue(e.target.value) 
          }),
          h('button', { 
            id: 'add-btn',
            onclick: () => {
              if (!inputValue.trim()) return;
              store.dispatch({ type: 'ADD_TODO', text: inputValue });
              setInputValue('');
            }
          }, 'Add')
        ),
        h('p', { id: 'stats' }, `已完成 ${doneCount} / 总共 ${state.todos.length} 项`),
        h('p', { id: 'empty-msg', style: `display: ${state.todos.length === 0 ? 'block' : 'none'}` }, '暂无数据'),
        h('ul', { style: 'padding-left: 0; margin-bottom: 0;' }, state.todos.map((todo, i) => h(TodoItem, { text: todo.text, done: todo.done, index: i })))
      );
    }

    function TodoItem({ text, done, index }) {
      // useContext：从 Fiber.return 链往上找 ThemeContext 的 Provider，不经过 Props！
      const themeColor = useContext(ThemeContext);
      
      return h('li', done ? { className: 'done' } : null,
        h('div', { className: 'task-content' }, 
          h('input', Object.assign({ type: 'checkbox', onchange: () => store.dispatch({ type: 'TOGGLE_TODO', index }) }, done ? { checked: true } : {})), 
          h('span', { style: `color: ${done ? '#999' : themeColor}; font-weight: bold;` }, text)
        ),
        h('button', { className: 'delete-btn', onclick: () => store.dispatch({ type: 'REMOVE_TODO', index }) }, '×')
      );
    }

    function App() {
      const [isBlue, setIsBlue] = useState(true);
      const currentColor = isBlue ? '#0066cc' : '#cc6600';

      return h('div', null,
        // ContextProvider 包裹子树，value 的变化会在下次渲染时被 useContext 自动取到
        h(ContextProvider, { context: ThemeContext, value: currentColor },
          h('div', { className: 'card' },
            h('h3', null, 'Context API Demo'),
            h('p', null, '下方的 Todo 列表文字颜色是借助 Fiber.return 从这里直接穿越层级传递过去的：'),
            h('div', { style: `padding: 10px; border-radius: 4px; color: white; background: ${currentColor}` },
              `当前全局颜色: ${currentColor}`
            ),
            h('button', { onclick: () => setIsBlue(!isBlue), style: 'margin-top: 10px' }, 'Toggle Theme Color')
          ),
          h(TodoApp, null)
        )
      );
    }

    render(h(App, null), document.getElementById('app'));
    log('应用已启动并在 Fiber 架构下运转');
  </script>
</body>
</html>
```