# 第十五章：从并发到服务器 —— React 的终极形态 (Concurrent & Server Components)

![figure 15.1](../../website/public/images/ch15_concurrent_and_server.png)

## 15.1 最后一块拼图

Po 已经走过了漫长的旅程。从原生 DOM 到模板、从数据绑定到 Virtual DOM、从类组件到 Hooks、从 Prop Drilling 到基于 Fiber 的 Context……

**🐼**：Shifu，感觉我们已经构建了现代 React 的所有核心！我们用 Fiber 架构重写了引擎，让纯函数拥有了记忆，也解决了状态跨层级传递的问题。还有什么遗漏的吗？

**🧙‍♂️**：还记得我们在第九章和第十章为什么要不惜一切代价，抛弃简单的递归，把架构重写成复杂的 Fiber 链表吗？

**🐼**：为了解决“浏览器停摆”的性能危机。我们把渲染拆成了可以中断的 Render 阶段和极速同步的 Commit 阶段。

**🧙‍♂️**：是的。这种"可以中断渲染、让出主线程"的能力，被 React 团队称为 **Concurrent Mode（并发模式）**。在前几章，我们只是用它来防止大页面卡死浏览器。但实际上，“可中断”这个特性，解锁了前端 UI 开发中两个困扰了业界十年的终极难题。

本章，我们还会跳出浏览器，来看看当渲染不再局限于客户端时，Fiber 的设计带来了什么新的可能性。

## 15.2 并发与优先级调度

**🧙‍♂️**：想象一下，你的 Todo List 有 10,000 条数据，此时网络请求刚回来，触发了整棵树的更新。就在这个时候，用户在输入框里打了一个字。你的代码会怎样执行？

**🐼**：在旧版（Stack Reconciler）里，主线程会被网络请求触发的 10,000 个节点的渲染完全锁死，用户打字的输入框会卡住 150 毫秒。但在我们的 Fiber 架构里，`workLoop` 会在每一帧的末尾把控制权还给浏览器，所以输入框不会卡住！

**🧙‍♂️**：准确地说，浏览器有机会响应用户的打字事件了。但这里有一个更深层的问题：打字事件也会触发 `setState`。现在，引擎里有 **两项任务** 需要做：

1. 更新主列表（庞大，耗时）
2. 更新输入框里的字母（极小，但用户对延迟极其敏感）

如果你是调度器，你会怎么做？

**🐼**：如果我按顺序做，把主列表的 10,000 个节点一点点遍历完，再去更新输入框……那即使浏览器没卡死，用户看到的字母还是慢了半拍才出来！我应该 **暂停** 列表的渲染，**优先** 把输入框的字母渲染出来！

**🧙‍♂️**：这就是 React 18 并发特性的核心：**优先级调度 (Priority Scheduling)**。React 提供了 `useTransition` Hook，让开发者明确告诉它“哪个更新不着急”：

```javascript
function SearchPage() {
  const [query, setQuery] = useState('');       // 输入框状态——高优先级
  const [results, setResults] = useState([]);   // 搜索结果——低优先级

  const [isPending, startTransition] = useTransition();

  function handleInput(e) {
    // 直接更新输入框：高优先级，不包在 startTransition 里
    setQuery(e.target.value);

    // 搜索结果更新：标记为“可以被打断的低优先级任务”
    startTransition(() => {
      setResults(heavySearch(e.target.value)); // 耗时的大列表更新
    });
  }

  return h('div', null,
    h('input', { value: query, oninput: handleInput }),
    // isPending 为 true 时说明列表还在后台渲染，可以显示过渡状态
    isPending
      ? h('p', null, '搜索中…')
      : h('ul', null, results.map(r => h('li', null, r)))
  );
}
```

基于底层的 Fiber 架构，React 就能在 Render 阶段随时中断一个低优先级的长任务（`startTransition` 里的大列表更新），切到高优先级的任务（输入框字母）迅速走完 Render + Commit 流程，然后再回过头来继续做那个低优先级的任务。这一切之所以成为可能，是因为每一个 Fiber 节点都保存了完整的上下文状态——中断后随时可以从断点恢复。

## 15.3 Suspense：优雅的等待

**🧙‍♂️**：第二个世纪难题——**异步数据**。在旧时代，获取数据的代码通常是这样的：

```javascript
function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { // 护城河里的副作用：Commit 之后才发请求
    fetchUser().then(data => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return h('p', null, '加载中…');
  return h('div', null, ['你好，' + user.name]);
}
```

**🐼**：这有什么问题？这是标准做法啊。

**🧙‍♂️**：三个致命痛点。

**问题一：瀑布请求（Waterfall）**——`useEffect` 在 Commit 阶段之后才执行，也就是说组件必须先渲染出来挂到屏幕上，才会开始发请求。如果你的页面是这样嵌套的：

```
<App>
  └── <UserProfile>   ← useEffect 发请求，等待中…
        └── <PostList>  ← 只有 UserProfile 的请求完成并渲染后，
                             PostList 的 useEffect 才会开始发它自己的请求
```

父组件请求完成、渲染、才轮到子组件发请求——请求像瀑布一样一级一级往下流，白白浪费了可以并行请求的时间。

**问题二：Loading 状态爆炸**——每个组件都得写一遍 `if (loading) return ...`，整个代码库里充斥着重复的加载状态判断。

**问题三：竞态条件**——如果用户频繁点击切换，上一个慢吞吞的请求可能会在后一个快速请求完成之后才返回，用过期的数据覆盖最新数据。

**🧙‍♂️**：Suspense 的核心思想是颠覆性的：**组件在 Render 阶段如果发现数据还没准备好，直接 `throw` 一个 Promise 当作异常！**

```javascript
// 把一个 fetch 包装成 Suspense 可以读取的“资源”
function createResource(fetchFn) {
  let status = 'pending';
  let result;
  // 立刻开始请求（注意：不是在 useEffect 里，而是在模块加载时）
  let promise = fetchFn().then(
    data => { status = 'success'; result = data; },
    error => { status = 'error'; result = error; }
  );

  return {
    read() {
      if (status === 'pending') throw promise;   // 🔥 数据没好？直接抛 Promise！
      if (status === 'error')   throw result;    // 数据出错？抛错误
      return result;                             // 数据就绪，正常返回
    }
  };
}

const userResource = createResource(() => fetch('/api/user').then(r => r.json()));

function UserProfile() {
  const user = userResource.read(); // 没好就 throw，走到这里说明数据必然存在
  return h('div', null, ['你好，' + user.name]); // 无需 if (loading) 判断！
}
```

**🐼**：把 Promise 当异常抛出去？那谁来接？

### 引擎如何捕获"被抛出的 Promise"

**🧙‍♂️**：答案就在我们自己写的 `updateFunctionComponent` 里。执行组件函数的地方，只需要加一个 `try/catch`：

```javascript
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  try {
    // 正常情况：执行组件函数，得到子元素
    const children = [fiber.type(fiber.props)].flat();
    reconcileChildren(fiber, children);
  } catch (e) {
    // 🔥 Suspense 核心：捕获被抛出的 Promise
    if (e instanceof Promise) {
      // 1. 先用 fallback UI 占位（让用户看到“加载中”）
      const fallback = fiber.props.fallback || '⏳ 加载中…';
      reconcileChildren(fiber, [h('span', null, fallback)]);

      // 2. 等 Promise resolve 后，重新调度这棵子树的渲染
      e.then(() => {
        wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
        deletions = [];
        workInProgress = wipRoot;
      });
    } else {
      throw e; // 不是 Promise，说明是真正的错误，继续往上抛
    }
  }
}
```

**🐼**：哦！`try/catch` 住了那个 Promise，渲染 fallback，然后等 Promise resolve 后重新触发一次渲染——数据好了，`read()` 就不再 throw 了，组件正常渲染！

**🧙‍♂️**：你完全描述对了。再回头看看引擎找到 Suspense 边界的方式——是不是很眼熟？捕获到 Promise 后，引擎顺着 `return` 指针向上找包裹了 `fallback` 的父组件，把那层的 UI 替换成 fallback。这和 `useContext` 向上爬寻找 Provider 是完全相同的机制：**沿着 Fiber 的 `return` 链向上查找**。

你已经理解了 Fiber "可暂停/可恢复"架构的终极应用。

## 15.4 SPA 的局限

**🧙‍♂️**：Po，到目前为止，我们构建的一切——从虚拟 DOM 到 Hooks，从状态管理到并发渲染——都运行在 **同一个地方**。

**🐼**：浏览器？

**🧙‍♂️**：对。用户访问你的网站时，浏览器下载了一个 HTML 文件，然后加载 JavaScript，JavaScript 在浏览器中从零开始构建整个 UI。这种模式叫做 **SPA (单页应用, Single-Page Application)**。

**🐼**：这不就是我们一直在做的吗？打开 `ch05.html`，JavaScript 接管一切。

**🧙‍♂️**：正是。现在想象一下，你把 Todo List 发布到了互联网上。一个真实用户打开你的页面，他的浏览器会收到什么？

**🐼**：一个 HTML 文件，里面有一个空的 `<div id="app"></div>`，加上一个 `<script>` 标签？

**🧙‍♂️**：没错。在 JavaScript 加载并执行完成之前，用户看到的是什么？

**🐼**：……空白页面？

**🧙‍♂️**：对。**白屏**。这个空白可能持续 1-3 秒——取决于 JavaScript 的大小和用户的网速。现在再想另一个问题：Google 的搜索引擎爬虫访问你的页面时，它看到了什么？

**🐼**：也是那个空的 `<div id="app">`？因为爬虫不一定会执行 JavaScript……

**🧙‍♂️**：你现在看到了 SPA 的三大致命问题：

```text
┌──────────────────────────────────────────────────────┐
│  SPA 的三大问题                                        │
│                                                      │
│  1. 首屏白屏                                          │
│     空 HTML → 下载 JS → 执行 JS → 渲染               │
│     等待时间 = 网络延迟 + JS 解析 + 渲染耗时           │
│                                                      │
│  2. SEO 不友好                                        │
│     搜索引擎看到空的 <div>，无法建立索引               │
│                                                      │
│  3. 包体积膨胀                                        │
│     所有页面打进一个 JS 文件                           │
│     功能越多 → 包越大 → 加载越慢                      │
└──────────────────────────────────────────────────────┘
```

**🐼**：等一下……以前没有 SPA 的时候是怎么做的？传统网站不就是服务器直接返回完整的 HTML 吗？比如 PHP、Ruby on Rails？

**🧙‍♂️**：你已经闻到了正确的方向。

## 15.5 SSR：回到服务器

**🧙‍♂️**：如果服务器先把 React 组件渲染成 HTML 字符串，发送给浏览器呢？

**🐼**：你是说……在服务器上运行我们的 `render` 函数？

**🧙‍♂️**：正是。还记得我们的 `h()` 函数吗？它返回的是一个普通的 JavaScript 对象——VNode。这个对象不依赖浏览器，它在 Node.js 上一样可以生成。我们只需要一个额外的函数，把 VNode **转成 HTML 字符串**。

注意这里的 VNode 格式：我们整本书一直用的是 `vnode.type`（标签类型）和 `vnode.props.children`（子节点）。

```javascript
// 把 VNode 渲染成 HTML 字符串（在服务器 / Node.js 环境运行）
function renderToString(vnode) {
  // 文本节点：直接返回转义后的文本
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return escapeHtml(String(vnode));
  }
  // 处理由 h 函数自动包装的 TEXT_ELEMENT
  if (vnode.type === 'TEXT_ELEMENT') {
    return escapeHtml(String(vnode.props.nodeValue));
  }

  let html = '<' + vnode.type;

  // 处理 props（跳过 children 和事件处理器）
  for (const key in vnode.props) {
    if (key === 'children') continue;
    if (key.startsWith('on')) continue; // ⚡ 事件属于客户端，服务端无意义
    html += ' ' + key + '="' + escapeHtml(vnode.props[key]) + '"';
  }
  html += '>';

  // 递归渲染子节点（子节点存在 vnode.props.children 里）
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

**🐼**：这就是 React 的 `renderToString`？

**🧙‍♂️**：简化版，但原理一样。现在来看整个流程的变化：

```text
SPA 流程：
  浏览器请求 → 服务器返回空 HTML → 下载 JS → 执行 JS → 用户看到内容
                                  ↑
                              白屏等待（1-3秒）

SSR 流程：
  浏览器请求 → 服务器运行 renderToString → 返回完整 HTML → 用户立刻看到内容
                                                        ↓（同时）
                                                   下载 JS → Hydration（激活交互）
```

**🐼**：用户立刻就能看到内容了！但等一下……`renderToString` 会跳过事件处理器（`onclick` 等），那页面虽然看起来有内容，但按钮点了没反应？

**🧙‍♂️**：关键问题。这就引出了 SSR 中最重要的概念——**Hydration（水合）**。

服务器给了你 **骨架**（HTML 结构），客户端 JavaScript 加载完成后，会在这个现有的 DOM 上 **附着事件处理器和状态**，让它变得可交互。这个过程叫做 Hydration——就像给干燥的骨骼注入水分，让它活过来。

```text
服务器                              客户端
┌────────────────────────┐         ┌─────────────────────────────────┐
│  renderToString        │         │                                 │
│                        │  HTML   │  ① 用户立刻看到页面内容          │
│  <div>                 │ ──────> │     （但还不可交互）             │
│    <h1>你好</h1>        │         │                                 │
│    <button>+1</button> │         │  ② JS bundle 下载完成            │
│  </div>                │         │                                 │
└────────────────────────┘         │  ③ Hydration：                  │
                                   │     - 遍历现有 DOM               │
                                   │     - 绑定 onclick 等事件        │
                                   │     - 恢复组件状态               │
                                   │                                 │
                                   │  ④ 页面变得可交互！              │
                                   └─────────────────────────────────┘
```

**🐼**：我理解了！服务器负责“画面”，客户端负责“灵魂”。但这是不是意味着客户端的 JS Bundle 也没有变小？所有的组件代码还是要发送到客户端？

**🧙‍♂️**：你发现了 SSR 的关键局限。SSR 的三大代价：

第一，**服务器压力**：每次用户请求，服务器都要执行一次渲染。100 个用户同时访问 = 100 次渲染。第二，**TTFB 延迟 (Time To First Byte)**：用户必须等服务器渲染完成才能收到第一个字节的响应。第三，也是最关键的——**全量 Hydration**：客户端仍然需要加载 **所有** 组件的 JavaScript，然后遍历整棵 DOM 树去“认领”每个节点，即使某些组件永远不需要交互。

**🐼**：第三点听起来特别浪费。比如一篇博客文章的正文——它就是静态的文字，为什么还要发送 JS 代码到客户端，再 Hydrate 一遍？

**🧙‍♂️**：记住这个问题。我们一会会回来。

## 15.6 SSG 与 ISR：静态的诱惑

**🐼**：Shifu，如果页面的内容不会频繁变化——比如一篇博客文章——那为什么每次用户请求都要重新渲染呢？能不能提前把 HTML 生成好？

**🧙‍♂️**：你刚刚推导出了 **SSG (静态站点生成, Static Site Generation)**。

SSG 的思路是：在 **构建时（build time）** 就运行 `renderToString`，把每个页面都渲染成一个 `.html` 文件，部署到 CDN 上。用户请求时，CDN 直接返回静态文件——不需要任何服务器计算。

```
SSR：用户请求 → 服务器实时渲染 → 返回 HTML（每次都要算）
SSG：构建时渲染 → 生成 .html 文件 → 部署 CDN → 用户请求 → CDN 直接返回
```

**🐼**：就像是提前烤好的面包，顾客来了直接拿。比现烤（SSR）快多了！但有个问题——如果博客文章更新了，我得重新构建整个网站？

**🧙‍♂️**：如果你的网站有 10,000 篇文章，改一篇就重新构建 10,000 个页面，确实不太现实。这就是 **ISR (增量静态再生, Incremental Static Regeneration)** 解决的问题。

ISR 的思路是：给每个页面设置一个 **有效期**。页面首次生成后是静态的；一旦过了有效期，下一个访问该页面的用户依然会看到旧版本（立即返回，不等待），但这次请求会在**后台**触发重新生成——下一个访问者就能看到新版本了。

**🐼**：就像面包的保质期？过期了之后先把旧面包给客人，同时在后台悄悄烤一个新的？

**🧙‍♂️**：这个比喻非常准确。来整理一下我们目前见过的所有渲染策略：

| 策略 | 渲染时机 | 优点 | 缺点 | 适用场景 |
|:-----|:---------|:-----|:-----|:---------|
| **SPA** | 客户端运行时 | 交互体验流畅 | 首屏白屏、SEO 差 | 后台管理系统、Web 应用 |
| **SSR** | 每次请求时 | SEO 好、首屏快 | 服务器压力大、TTFB 慢 | 动态内容（社交、电商） |
| **SSG** | 构建时 | 极快、零服务器成本 | 内容更新需重新构建 | 博客、文档、营销页 |
| **ISR** | 构建时 + 后台定期刷新 | 兼顾速度和时效性 | 触发刷新的用户会看到旧内容 | 新闻、产品页 |

**🐼**：每种方案都是前一种的“补丁”，解决了旧问题又带来了新问题。

**🧙‍♂️**：这就是技术演进的本质。而且你注意到没有——不管是 SSR、SSG 还是 ISR，它们都有一个共同的遗留问题。

**🐼**：全量 Hydration？服务器渲染了 HTML，但客户端还是要加载 **所有** 组件的 JS，把整棵 DOM 树重新“认领”一遍。

**🧙‍♂️**：正是。现在让我们来解决这个问题。

## 15.7 React Server Components (RSC)

**🧙‍♂️**：让我们回到那个关键问题——全量 Hydration 的浪费。看看一个典型的博客页面：

```text
BlogPage
├── Header          ← 有一个搜索框，需要交互
├── ArticleBody     ← 纯文本和图片，完全静态
│   └── 3000 字正文
├── CodeBlock       ← 语法高亮的代码块，静态
├── CommentList     ← 评论列表，从数据库读取
│   └── 100 条评论
└── LikeButton      ← 点赞按钮，需要交互
```

**🐼**：五个组件中，真正需要交互（需要 JavaScript）的只有 `Header` 和 `LikeButton`。`ArticleBody`、`CodeBlock`、`CommentList` 都是纯展示的。

**🧙‍♂️**：但在传统 SSR 中，所有五个组件的 JS 代码都会被发送到客户端，客户端会对整棵 DOM 树做 Hydration。想想那 3000 字正文和 100 条评论——它们的组件代码加起来可能有 50KB，客户端下载并执行了这 50KB 的 JS，只是为了“确认一下这些静态文本不需要事件处理器”。

**🐼**：太浪费了。如果能告诉 React "这些组件是纯服务端的，不需要发 JS 到客户端"就好了。

**🧙‍♂️**：这就是 **React Server Components (RSC)** 的核心洞见。

### Server Component vs Client Component

**🧙‍♂️**：RSC 把组件分成了两类：

```text
┌────────────────────────────────┐     ┌────────────────────────────────┐
│        Server Component        │     │        Client Component        │
│                                │     │                                │
│  ✅ 可以 await db.query()      │     │  ✅ useState / useEffect       │
│  ✅ 可以读文件系统              │     │  ✅ 处理用户事件               │
│  ✅ 可以访问服务器密钥          │     │  ✅ 访问浏览器 API             │
│                                │     │                                │
│  ❌ 无 useState                │     │  ❌ 不能直接访问数据库          │
│  ❌ 无 useEffect               │     │  ❌ 不能读服务器文件系统        │
│  ❌ 无事件监听器               │     │                                │
│                                │     │                                │
│  📦 零 JS 发送到客户端          │     │  📦 JS bundle 发送到客户端     │
└────────────────────────────────┘     └────────────────────────────────┘
```

**🐼**：所以 Server Component 的代码从来不会出现在用户浏览器的 JS Bundle 里？

**🧙‍♂️**：对。这意味着 `ArticleBody`、`CodeBlock`、`CommentList` 可以是 Server Component——它们在服务器上渲染完就结束了，零 JS 送到客户端。只有 `Header` 和 `LikeButton` 是 Client Component，只有它们的 JS 代码需要下载和 Hydration。

### RSC 不是 SSR

**🐼**：等一下，Server Component 在服务器上渲染……这和 SSR 有什么区别？

**🧙‍♂️**：这是最容易混淆的地方，核心区别在于 **输出格式**。让我们把它们并排放在一起：

```text
                  SSR                           RSC
          ┌────────────────┐           ┌────────────────────┐
输出格式   │   HTML 字符串  │           │   RSC Payload（JSON）│
          └────────────────┘           └────────────────────┘
          "<div><h1>标题</h1>           { type: "article",
           <button>点赞</button>          children: [
           </div>"                         { type: "h1", ... },
                                           { $$typeof: "client-ref",
                                             module: "LikeButton" }  ← 保留引用
                                         ]
                                       }

客户端     需要 Hydrate 整棵树           只需 Hydrate Client Component 部分
做什么？   （LikeButton 的 JS 也          （ArticleBody、CodeBlock 的 JS
           必须下载并执行）                完全不需要下载）
```

**🐼**：`h1` 标题直接被“内联”成了数据，但 `LikeButton` 被保留为一个**引用**——客户端只对引用部分加载 JS 和做 Hydration！

**🧙‍♂️**：精确！这就是 RSC 的精髓：

1. Server Component 的输出被 **内联** 到 Payload 中（纯数据，零 JS）。
2. Client Component 被表示为一个 **引用**（"去加载这个 JS 文件"）。
3. 客户端收到 Payload 后，把静态部分直接渲染为 DOM，只对 Client Component 部分加载 JS 和做 Hydration。

让我们看看服务器上的组件是什么样的：

```javascript
// 服务器组件（概念代码，需要全栈环境运行）
async function BlogPost({ id }) {
  const post = await db.query('SELECT * FROM posts WHERE id = ?', [id]);
  
  return h('article', null,
    h('h1', null, post.title),
    h('p', null, post.content),
    // LikeButton 是 Client Component——标记为 "client-reference" 引用
    { $$typeof: 'client-reference', module: './LikeButton.js', props: { postId: id } }
  );
}
```

服务器把这棵树渲染后，生成的 RSC Payload（简化版）大致是：

```json
{
  "type": "article",
  "props": {},
  "children": [
    { "type": "h1", "children": ["深入理解 React Server Components"] },
    { "type": "p",  "children": ["RSC 把组件分为两类……（3000字正文）"] },
    { "$$typeof": "client-reference", "module": "./LikeButton.js", "props": { "postId": 42 } }
  ]
}
```

**🐼**：这样就不需要全量 Hydration 了！只有标记为 Client Component 的部分才需要 JS。

### 模拟 RSC 的思路

**🧙‍♂️**：我们无法在单个 HTML 文件中运行真正的 RSC——它需要服务器环境。但我们可以 **模拟它的核心思想**：Server Component 预先渲染 → 生成 Payload → 客户端消费 Payload。

注意下面的代码用的是我们书中一直使用的 VNode 格式（`node.type` 和 `node.props`）：

```javascript
// === 模拟 RSC 的核心流程 ===

// 第一步：“服务器端”——把组件渲染成 RSC Payload（纯数据，不含 JS 引用）
function serverRender(componentFn, props) {
  const vnode = componentFn(props);
  return resolveToPayload(vnode);
}

function resolveToPayload(node) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;  // 文本直接保留
  }
  if (node.$$typeof === 'client-reference') {
    return node;  // Client Component：保留引用，不在“服务端”展开渲染
  }
  // 普通元素：递归解析，使用 node.type（不是 node.tag）
  return {
    type: node.type,                                       // ← 注意：是 type，不是 tag
    props: Object.keys(node.props).reduce((acc, k) => {
      if (k !== 'children') acc[k] = node.props[k];
      return acc;
    }, {}),
    children: (node.props.children || []).map(c => resolveToPayload(c))
  };
}

// 第二步：“客户端”——消费 Payload，遇到 client-reference 时找对应的 Client Component 渲染
function payloadToVNode(node, registry) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }
  if (node.$$typeof === 'client-reference') {
    // 从注册表中找到 Client Component 函数并执行——此刻才在客户端运行
    const componentFn = registry[node.module];
    return componentFn(node.props);
  }
  return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
}
```

**🐼**：`serverRender` 把组件树“压平”成纯数据，`payloadToVNode` 再把数据“充气”成 VNode。Client Component 直到客户端才被真正执行。

**🧙‍♂️**：对。在我们的 demo 中，“服务端”和“客户端”在同一个 HTML 文件里——但数据传递的方式（通过 Payload 而不是直接共享函数引用）完整地模拟了 RSC 的核心机制。

> 💡 **真正体验 RSC**：RSC 需要全栈环境（如 Next.js App Router）。运行 `npx create-next-app` 并选择 App Router 即可上手。在 App Router 中，默认所有组件都是 Server Component，只有标记了 `'use client'` 的文件才是 Client Component。

**🐼**：所以 SSR 和 RSC 可以结合使用？

**🧙‍♂️**：不仅可以，在 Next.js 中它们就是这样工作的。首次请求中：

1. RSC 在服务器上运行 Server Component，生成 RSC Payload。
2. SSR 把 RSC Payload + Client Component 一起渲染为 HTML 字符串，发给浏览器。
3. 浏览器立刻显示 HTML（首屏快）。
4. JS 加载后，只对 Client Component 部分做 Hydration（Bundle 小）。

**🐼**：这不就是回到了 PHP 的时代？在服务器上写数据查询和 UI？

**🧙‍♂️**：表面上是循环，本质上是螺旋上升。PHP 返回的是 HTML 字符串——客户端无法理解它的结构。RSC 返回的是 **可序列化的组件树**——客户端可以无缝地将它与交互式的 Client Component 结合、实现无刷新导航、流式传输。这是一种用 20 年后的技术重新审视 20 年前的简洁。

## 15.8 回望旅途：你已经“重新发明”了 React

**🧙‍♂️**：Po，在我们讨论未来之前，让我们先回头看看你在这趟旅程中做了什么。

```
你从零开始，亲手构建了：

Ch01  document.createElement     → 感受了命令式的痛苦
Ch02  render(template, data)     → 发明了声明式的模板
Ch03  EventEmitter + Model       → 创造了观察者模式的数据绑定
Ch04  UI = f(state)              → 领悟了 React 的核心思想
Ch05  h() + mount() + patch()    → 实现了虚拟 DOM 引擎
Ch06  Component + Props          → 构建了组件系统
Ch07  setState + Lifecycle       → 赋予了组件记忆和时间感
Ch08  HOC + Render Props         → 体验了类组件逻辑复用的困境
Ch09  Stack Reconciler           → 遭遇了浏览器停摆危机
Ch10  Fiber Architecture         → 设计了可中断的链表引擎
Ch11  Render & Commit Phase      → 实现了两阶段渲染机制
Ch12  useState (Hooks)           → 赋予了函数组件记忆力
Ch13  useEffect & Memoization    → 掌握了副作用与响应式依赖
Ch14  createStore & Context      → 构建了跨层级的状态管理
Ch15  useTransition              → 理解了并发优先级调度
      throw Promise              → 理解了 Suspense
      renderToString             → 理解了 SSR
      RSC Payload                → 理解了 Server Components

这就是 React 的核心。
```

**🐼**：……原来 React 不是魔法。它是你在对的时间做的一系列精妙的工程权衡。

## 15.9 终章：道与器

**🧙‍♂️** 缓缓饮了一口茶。窗外的天色渐暗。

**🧙‍♂️**：Po，你还记得第一天走进来时，你想学什么吗？

**🐼**：……我想学 React。我以为它是一个工具。

**🧙‍♂️**：现在呢？

**🐼**：现在我明白了。React 不只是一个库。它是一系列 **工程决策** 的结晶——每一个决策都来自一个真实的痛点：

- 命令式太累？→ 声明式。
- 全量重绘太慢？→ Virtual DOM Diff。
- 逻辑耦合在 `this` 上？→ Hooks。
- 数据穿越层级太难？→ Context / 状态管理。
- 同步渲染阻塞用户？→ 并发调度。
- SPA 首屏白屏？→ SSR / SSG。
- 全量 Hydration 浪费？→ Server Components。

每一个“解决方案”都带来了新的“问题”，而新的“问题”又催生了新的“解决方案”。这就是技术演进的本质。

**🧙‍♂️**：正是如此。最好的技术不是凭空发明的，而是在解决真实问题的过程中，自然而然地生长出来的。你今天走过的路，就是过去二十年来数千名工程师走过的路。

**🐼**：如果有一天 React 被更好的东西取代了呢？

**🧙‍♂️**：那也没关系。因为你理解的不仅仅是 React 的 API，更是 **UI 开发中永恒的权衡**：

- 声明式 vs 命令式
- 全量更新 vs 细粒度更新
- 运行时灵活性 vs 编译时优化
- 开发体验 vs 运行性能
- 客户端渲染 vs 服务端渲染

无论未来的框架叫什么名字，它们都逃不出这些维度的抉择。而你，已经拥有了在这些维度之间自如游走的能力。

**🐼** 深深鞠了一躬。

**🐼**：谢谢您，Shifu。

**🧙‍♂️** 微微一笑。

**🧙‍♂️**：去吧，去构建你自己的世界。

---

### 📦 实践一下

将以下代码保存为 `ch15.html`，体验涵盖了挂起（Suspense）、服务端渲染（SSR）和 React 服务端组件（RSC）全流程的终极实验：

```html
<!DOCTYPE html>
<html lang="zh-CN">
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
    <h3>1. Suspense: throw Promise 模式</h3>
    <p>点击按钮模拟数据加载。在 Fiber 引擎下，若组件内抛出（throw）了 Promise，
       当前树的渲染会被中断并切到备用 UI（fallback），数据就绪后 Fiber 自动重绘。</p>
    <button id="btn-suspense">🔄 加载用户数据 (Suspense)</button>
    <div id="suspense-root" style="margin-top: 10px; min-height: 80px;">
      <p style="color: #999; font-style: italic;">点击上方按钮体验 Fiber 挂起…</p>
    </div>
  </div>

  <!-- Demo 2: renderToString (SSR) -->
  <div class="card">
    <h3>2. renderToString: 服务端渲染模拟</h3>
    <p>点击按钮，观察 VNode 是如何被转换成 HTML 字符串的（SSR 的核心）。
       事件监听器会被刻意跳过（等待 Hydration 修复）。</p>
    <button id="btn-ssr">🖥️ 运行 renderToString</button>
    <div id="ssr-root"></div>
  </div>

  <!-- Demo 3: RSC Payload -->
  <div class="card">
    <h3>3. RSC Payload: Server Component 模拟</h3>
    <p>模拟 RSC 的核心流程：Server Component 在服务器渲染 → 生成纯净的 RSC Payload JSON
       → 客户端接收并唤醒 Client Component。</p>
    <button id="btn-rsc">🚀 模拟 RSC 流程</button>
    <div id="rsc-root"></div>
  </div>

  <script>
    // ============================================
    // 1. 底层引擎: Mini-React (Fiber + Suspense)
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
        // 正常情况：执行组件函数，得到子元素
        const children = [fiber.type(fiber.props)].flat();
        reconcileChildren(fiber, children);
      } catch (e) {
        // 🔥 Suspense 核心：捕获被抛出的 Promise
        if (e instanceof Promise) {
          // 1. 渲染 fallback UI（备用加载界面）
          const fallbackMsg = fiber.props.fallback || '⏳ 加载中…';
          reconcileChildren(fiber, [h('span', { style: 'color:#999' }, fallbackMsg)]);
          
          // 2. 等 Promise resolve 后，重新触发整棵树渲染
          e.then(() => {
            wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
            deletions = [];
            workInProgress = wipRoot;
          });
        } else {
          throw e; // 不是 Promise，是真正的错误，继续往上抛
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

    // ============================================
    // 2. Demo: Suspense（throw Promise 极致演示）
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
          if (status === 'pending') throw promise; // 🔥 数据没好就抛 Promise！
          if (status === 'error') throw result;
          return result;
        }
      };
    }

    let userResource = null;

    function UserProfile() {
      // 在 Fiber Render 阶段读取数据，未准备好就 throw Promise
      const user = userResource.read();
      return h('div', { className: 'user-card' },
        h('strong', null, user.name),
        h('p', null, '角色: ' + user.role),
        h('p', null, '等级: ' + user.level),
        h('em', { style: 'color: green' }, '✅ 数据加载完成，Fiber 已恢复渲染！')
      );
    }

    function SuspenseApp() {
      const [started, setStarted] = useState(false);
      
      window.triggerSuspense = () => {
        userResource = createResource(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ name: 'Po，神龙大侠', role: 'React 探索者', level: 99 }), 1500)
          )
        );
        setStarted(true);
      };

      if (!started) return h('p', { style: 'color: #999; font-style: italic;' }, '请点击上方按钮体验 Fiber 遇到未就绪数据如何挂起并使用 fallback…');

      // UserProfile 内部会 throw Promise，updateFunctionComponent 的 try/catch 会捕获它，
      // 并把 fallback 文字渲染出来，等 Promise resolve 后重新渲染
      return h(UserProfile, { fallback: '⏳ 正在从服务器获取用户数据…（Fiber 执行已挂起）' });
    }

    render(h(SuspenseApp, null), document.getElementById('suspense-root'));

    document.getElementById('btn-suspense').addEventListener('click', () => {
      if (window.triggerSuspense) window.triggerSuspense();
    });

    // ============================================
    // 3. Demo: renderToString（SSR 模拟）
    // ============================================
    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 注意：这里使用 vnode.type 和 vnode.props.children，与全书 VNode 格式一致
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
        if (key.startsWith('on')) continue; // ⚡ 服务端不挂载事件监听器
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

    const ssrRoot = document.getElementById('ssr-root');
    document.getElementById('btn-ssr').addEventListener('click', () => {
      ssrRoot.innerHTML = '';
      const vnode = h('div', { className: 'card' },
        h('h2', null, '通过 SSR 渲染的列表'),
        h('ul', null,
          h('li', null, '学习 React'),
          h('li', null, '理解 SSR')
        ),
        h('button', { onclick: () => alert('SSR HTML 中的按钮还没有 Hydration，点击无效！') }, '未激活的按钮（需要 Hydration）')
      );

      const htmlString = renderToString(vnode);

      ssrRoot.innerHTML += `<p class="label">① VNode 数据结构</p><pre>${JSON.stringify(vnode, null, 2)}</pre>`;
      ssrRoot.innerHTML += `<p class="label">② renderToString 纯字符串产出</p><pre>${escapeHtml(htmlString.replace(/></g, '>\n<'))}</pre>`;
      ssrRoot.innerHTML += `<p class="label">③ 浏览器渲染 HTML（点击按钮无效，因为 onclick 被剥离了）</p><div class="html-output">${htmlString}</div>`;
    });

    // ============================================
    // 4. Demo: RSC Payload（Server Component 模拟）
    // ============================================
    const rscRoot = document.getElementById('rsc-root');

    // Server Component：在“服务端”执行，不会发送到客户端
    function BlogPage(props) {
      const post = { title: '理解 RSC', content: 'RSC 生成 JSON Payload 而非原始 HTML，客户端只需 Hydrate Client Component 部分…', author: 'Shifu' };
      return h('article', null,
        h('h2', null, post.title),
        h('p', null, post.content),
        h('p', { style: 'color: #666; font-size: 13px;' }, '作者: ' + post.author),
        // LikeButton 是 Client Component：保留为引用，不在服务端展开
        { $$typeof: 'client-reference', module: 'LikeButton', props: { postId: props.id } }
      );
    }

    // “服务端”：将组件树压平为可序列化的 Payload（注意使用 node.type，不是 node.tag）
    function serverRender(componentFn, props) {
      return resolveToPayload(componentFn(props));
    }

    function resolveToPayload(node) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') return node; // Client Component：保留引用
      return {
        type: node.type, // ← 使用 type，与 VNode 格式一致
        props: Object.keys(node.props).reduce((acc, k) => {
          if (k !== 'children') acc[k] = node.props[k];
          return acc;
        }, {}),
        children: (node.props.children || []).map(c => resolveToPayload(c))
      };
    }

    // “客户端”：将 Payload 恢复为 VNode，遇到 client-reference 时执行对应 Client Component
    function payloadToVNode(node, registry) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') {
        // 此刻才在客户端真正执行 Client Component
        const fn = registry[node.module];
        return fn(node.props);
      }
      return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
    }

    // Client Component：LikeButton（有交互，需要在客户端执行并拥有 State）
    function LikeButton(props) {
      const [count, setCount] = useState(0);
      return h('button', { 
        style: 'background:#ff6b6b;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;font-size:14px;',
        onclick: () => setCount(count + 1)
      }, `❤️ 点赞 (${count})`);
    }

    const clientRegistry = { 'LikeButton': LikeButton };
    let _rscRendered = false;

    document.getElementById('btn-rsc').addEventListener('click', () => {
      if (_rscRendered) return;
      _rscRendered = true;
      rscRoot.innerHTML = '';

      // 第一步：服务端生成 Payload
      const rscServerDiv = document.createElement('div');
      rscServerDiv.className = 'rsc-server';
      rscServerDiv.innerHTML = '<strong>🖥️ 远端服务器</strong>：执行 BlogPage，生成 RSC Payload（纯 JSON，不含 BlogPage 的函数代码）';
      rscRoot.appendChild(rscServerDiv);

      const payload = serverRender(BlogPage, { id: 42 });
      
      const pLabel1 = document.createElement('p');
      pLabel1.className = 'label';
      pLabel1.innerText = 'RSC Payload（网络传输形态：纯文本 JSON，BlogPage 组件函数不会发往浏览器）';
      rscRoot.appendChild(pLabel1);

      const pre1 = document.createElement('pre');
      pre1.innerText = JSON.stringify(payload, null, 2);
      rscRoot.appendChild(pre1);
      
      const arrowDiv = document.createElement('div');
      arrowDiv.className = 'arrow';
      arrowDiv.innerText = '⬇️ 网络传输（纯 JSON，零 JS）';
      rscRoot.appendChild(arrowDiv);

      // 第二步：客户端消费 Payload
      const rscClientDiv = document.createElement('div');
      rscClientDiv.className = 'rsc-client';
      rscClientDiv.innerHTML = '<strong>🌐 本地客户端</strong>：接收 Payload，找到 client-reference，加载对应的 LikeButton Client Component，交由 Fiber 渲染';
      rscRoot.appendChild(rscClientDiv);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'html-output';
      rscRoot.appendChild(wrapper);
      
      // payloadToVNode 将触发 LikeButton 函数组件在客户端执行
      function PayloadRenderer() {
        return payloadToVNode(payload, clientRegistry);
      }
      render(h(PayloadRenderer, null), wrapper);
    });
  </script>
</body>
</html>
```