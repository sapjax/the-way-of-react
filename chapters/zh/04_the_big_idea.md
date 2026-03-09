# 第四章：伟大的构想 —— UI 即状态的函数 (The Big Idea)

![figure 4.1](../images/ch04_big_idea.png)

## 4.1 简化的渴望

Po 疲惫地靠在椅背上。上一课的 MVC 模式虽然精准，但那些错综复杂的事件监听器让他感到窒息。

**🐼**：Shifu，为了所谓的“精准更新”，我们不得不手动编写大量的 `on('change')` 代码。每次添加一个新功能，我都要小心翼翼地去绑定事件、解绑事件。这太累了。
我怀念第二课里的那个“模板引擎”。虽然它性能差、体验差，但它真的很简单——只要数据变了，重新调用一下 `renderApp()` 也就行了。

**🧙‍♂️**：你察觉到了问题的本质。
在 MVC 中，我们为了性能（只更新局部 DOM），牺牲了开发的简洁性（手动管理依赖）。
在模板时代，我们拥有了开发的简洁性（全量刷新），却牺牲了性能和体验。

**🐼**：难道就没有两全其美的方法吗？
我想像写模板一样写代码（声明式），但又希望它运行起来像 MVC 一样快（细粒度更新）。

换句话说，我想要一个函数——给它当前的状态，它直接告诉我界面应该长什么样。

**🧙‍♂️**：你刚才用一句话概括了前端框架历史上最重要的思想转变。用公式来表达就是：

$$ UI = f(state) $$

2011 年，Facebook 的工程师面对同样的困境时，做出了完全相同的思考。后来这个思想演变成了 React 框架的核心。而我们接下来要做的，就是亲手实现这个思想。

## 4.2 重新思考“刷新”

**🧙‍♂️**：Po，假设一个理想的世界——浏览器的 DOM 操作极其快速，快到忽略不计。在那个世界里，你会怎么写代码？

**🐼**：那我就直接用 `innerHTML` 每次重绘整个页面啊！那样最简单，根本不需要什么 `Model`，也不需要监听器。

**🧙‍♂️**：没错。可惜，我们在第二章已经见识了全量重绘的代价——不仅性能昂贵，还会销毁整棵 DOM 树，导致输入框失去焦点、用户状态丢失。问题出在哪？

**🐼**：出在直接操作真实 DOM 上。每次全量重建太浪费了。

**🧙‍♂️**：那如果我们不直接操作真实 DOM 呢？先退一步想——能不能在真正动手之前，先做一次“演习”？

**🐼**：“演习”？您是说……先在脑子里想好要改什么，再动手？

**🧙‍♂️**：差不多。但不是在“脑子里”——是在 JavaScript 里。如果我们不把 UI 渲染成真实的 DOM，而是渲染成一个普通的 **JavaScript 对象**呢？

**🐼**：JavaScript 对象？您是说用一个对象来描述页面的结构……比如 `{ tag: 'div', children: [...] }` 这样的？

**🧙‍♂️**：正是。这只是一些普通的 JS 对象，创建它们几乎不花时间。现在，假设你已经有了上一次渲染的对象树，又生成了一棵新的对象树——接下来你会做什么？

**🐼**：把两棵树做对比……找出哪些地方不同！

**🧙‍♂️**：然后呢？

**🐼**：然后只把不同的部分应用到真实的 DOM 上！这样就不用每次都重建整棵 DOM 树了！

**🧙‍♂️**：现在把这两步连起来——对开发者来说，体验是怎样的？

**🐼**：对开发者来说，每次都重新生成了整棵对象树——代码写起来像模板一样简单。但对浏览器来说，只有真正变化的节点被更新——性能接近手动优化的 MVC。唯一的代价是多一些 CPU 计算去做对比……等等，这不就是两全其美吗？！

**🧙‍♂️**：你刚才一步步推导出来的，正是虚拟 DOM 的核心思想——这个"JavaScript 对象树"被称为 **虚拟 DOM (Virtual DOM)**。

## 4.3 纯粹的映射

**🧙‍♂️**：既然你已经推导出了核心思想，让我们来实践它。为了聚焦在虚拟节点 (VNode) 的结构和差异对比上，我们暂时用一个更简单的 Counter 来演示，等引擎成熟后再回到 Todo List。
首先，我们要改变描述 UI 的方式。在模板时代，我们用字符串描述 UI：
`<li>${todo.text}</li>`

而现在，我们用 **数据结构** 描述 UI。

**🐼**：用对象而不是字符串来描述 UI，是因为对象可以逐层对比差异，而字符串很难做到这一点吧？

**🧙‍♂️**：正是如此。对象是结构化的，天然适合算法分析。
来，试着写一个函数，它接受状态，返回一个描述 UI 的对象树。

首先，让我们想清楚这个 UI 用 HTML 描述应该长什么样：

```html
<div id="app">
  <h1>Count: 0</h1>
  <button onclick="increment()">Add</button>
  <ul>
    <li>Buy Milk</li>
    <li>Learn React</li>
  </ul>
</div>
```

现在，我们要用 JavaScript 对象来描述 **完全相同的结构**。每个 HTML 标签变成一个 `{ tag, props, children }` 对象。

**🐼**：

```javascript
// 状态
const state = {
  count: 0,
  todos: ['Buy Milk', 'Learn React']
};

function render(state) {
  return {
    tag: 'div',
    props: { id: 'app' },
    children: [
      {
        tag: 'h1',
        props: {},
        children: ['Count: ' + state.count]
      },
      {
        tag: 'button',
        props: { onclick: () => { state.count++; } }, // 注意：这是函数引用，不是字符串！
        children: ['Add']
      },
      {
        tag: 'ul',
        props: {},
        children: state.todos.map(todo => ({
          tag: 'li',
          props: {},
          children: [todo]
        }))
      }
    ]
  };
}

const vdom = render(state);
console.log(vdom);
```

**🧙‍♂️**：看，这个 `vdom` 对象就是当前状态下 UI 的 **快照 (Snapshot)**。
注意两个关键点：

1. **属性值是 JS 值**：`onclick: increment` 是一个函数的引用，不是字符串。这既安全（不再有 XSS 风险），又高效（可以通过 `===` 比较引用是否变了）。
2. **嵌套结构映射 UI 树**：这棵对象树的结构完全对应 DOM 树的结构。

如果 `state.count` 变成了 1，你再调用一次 `render(state)`，会得到一个新的快照。

**🐼**：这一步很快，因为我只是创建了一些 JS 对象，没有碰真实的 DOM。

**🧙‍♂️**：对。接下来的魔法，就在于如何把这两个快照之间的“差异”，转化为真实 DOM 的操作指令。

## 4.4 数据的唯一真相 (Single Source of Truth)

**🧙‍♂️**：在这个模型中，数据是如何流动的？

**🐼**：看起来是 **单向的**。

1.  数据 (State) 进入 `render` 函数。
2.  `render` 函数输出 虚拟 DOM。
3.  虚拟 DOM 最终变成 真实 DOM。

不像 MVC 那样，View 可以直接改 Model，Model 又改 View，乱成一团。在这里，UI 永远是 State 的投影。

**🧙‍♂️**：这正是我们所追求的 **唯一真相源 (Single Source of Truth)**。

*   **MVC/MVVM**：View 的输入可以直接修改 Model，Model 又触发 View 更新，数据源头变得模糊。
*   **React**：UI 是 State 的纯函数。如果要改变 UI，必须改变 State（源头），然后重新生成整个 UI。

**🐼**：我明白了。就像投影仪一样，画面永远来自胶片。如果我想改变画面，我不能去擦投影幕布，我必须去换胶片。

**🧙‍♂️**：非常精妙的比喻。这一原则不仅简化了状态管理，更为日后我们构建复杂的 **组件系统** 奠定了坚实的基础。
现在的关键是：它让程序变得 **可预测 (Predictable)**。不管你的应用跑了多久，只要给我这一刻的 State，我就能确切地知道 UI 长什么样。

## 4.5 历史的脚注：React 的诞生 (2011-2013)

**🧙‍♂️**：这个 “UI = f(state)” 的想法，最初并不是所有人都接受的。
2011 年，Facebook 的广告系统变得难以维护。工程师 **Jordan Walke** 受到了 **XHP**——一种 Facebook 内部使用的 PHP 扩展，它允许在 PHP 代码中直接编写 XML/HTML，从而模糊了模板与代码的边界——的启发，在内部创造了 React 的早期原型。

> **背景**：当时的主流是双向绑定（Angular, Knockout）。当 Jordan 在 2013 年的 JSConf US 上首次公开 React 时，台下的观众并没有欢呼。大家都觉得“在 JS 里写 HTML”（即后来的 JSX）是极大的倒退，而且“全量重绘”听起来性能极其糟糕。

**🧙‍♂️**：但这正是天才的洞见。Jordan 意识到，只要虚拟 DOM 足够快，我们就可以为了**开发体验** 而牺牲一点点**运行时性能**。

## 4.6 一切就绪

**🧙‍♂️**：React 并不是什么神奇的黑科技，它只是做了一个大胆的权衡：
它引入了额外的 CPU 计算（生成虚拟 DOM、对比差异）和内存开销（始终在内存中保存一份完整的虚拟 DOM 树），来换取开发者心智负担的减轻（不再手动管理 DOM 更新）。

**🐼**：所以代价是 CPU 和内存，换来的是开发效率和可维护性。考虑到现代设备的性能越来越强，这笔账算下来还是划算的。

**🧙‍♂️**：但是，Po，光有理念是不够的。你说“对比新旧差异”，这具体该怎么做？
如果我想把这个 `vdom` 变成真实的界面，该怎么写 `mount` 函数？
如果状态变了，我怎么通过 `patch` 函数只更新变化的部分？

**🐼**：这……似乎涉及到了复杂的算法。

**🧙‍♂️**：下一课，我们将深入引擎盖之下，亲手打造这个核心引擎。

---

### 📦 实践一下

将以下代码保存为 `ch04.html`。
这一章我们还没有实现 Diff 算法，但我们可以先看看 **Virtual DOM** 到底长什么样。下一课我们将用 `patch` 函数替代这里的 `innerHTML`。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 4 — The Big Idea</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 13px; }
    button { padding: 8px 16px; font-size: 16px; margin-top: 10px; cursor: pointer; }
    .note { color: #999; font-size: 13px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>UI = f(state)</h1>
  <p>点击按钮，观察 Virtual DOM 对象如何随状态变化。
     注意：在这一章里我们还在用 innerHTML（下一课将会用 patch 替代它）。</p>
  
  <div id="app">
    <!-- UI 将会渲染在这里 -->
  </div>
  
  <h3>当前的 Virtual DOM 快照：</h3>
  <pre id="vdom-display"></pre>

  <p class="note">💡 按钮的 onclick 在 VNode 中是一个函数引用（而非字符串），
    这比模板时代的 <code>onclick="increment()"</code> 更安全（无 XSS 风险），
    也更高效（可以通过 === 比较引用）。</p>

  <script>
    // 1. 状态
    const state = {
      count: 0
    };

    let prevSnapshot = null; // 保存上一次的 VNode 快照

    // 2. 也是模板，但返回的是 JS 对象 (Virtual DOM)
    // 这是 React.createElement 的雏形
    function render(state) {
      return {
        tag: 'div',
        props: { style: 'border: 1px solid #ccc; padding: 10px;' },
        children: [
          {
            tag: 'h1',
            props: { style: 'color: #333' },
            children: ['Count: ' + state.count]
          },
          {
            tag: 'p',
            props: {},
            children: ['The UI is a function of state.']
          },
          {
            tag: 'button',
            props: { onclick: increment }, // 函数引用！
            children: ['Add']
          }
        ]
      };
    }

    function increment() {
      state.count++;
      updateApp();
    }

    // 3. 模拟渲染 
    // ⚠️ 这里仍在用 innerHTML —— 下一课的 patch 将替代它
    function updateApp() {
      const vnode = render(state);
      
      // 展示新旧 VNode 对比（高亮变化）
      const display = document.getElementById('vdom-display');
      const newJson = JSON.stringify(vnode, (key, val) => typeof val === 'function' ? '[Function: ' + val.name + ']' : val, 2);
      
      if (prevSnapshot) {
        // 高亮显示 diff
        const oldLines = prevSnapshot.split('\n');
        const newLines = newJson.split('\n');
        let diffHtml = '';
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const ol = oldLines[i] || '';
          const nl = newLines[i] || '';
          if (ol !== nl) {
            diffHtml += '<span style="background:#ffe0e0;text-decoration:line-through;">' + ol.replace(/</g,'&lt;') + '</span>\n';
            diffHtml += '<span style="background:#e0ffe0;font-weight:bold;">' + nl.replace(/</g,'&lt;') + '</span>\n';
          } else {
            diffHtml += nl.replace(/</g,'&lt;') + '\n';
          }
        }
        display.innerHTML = diffHtml;
      } else {
        display.textContent = newJson;
      }
      prevSnapshot = newJson;
        
      // 简单粗暴地更新视图 (下一课我们将用 Diff + Patch 替代)
      const appEl = document.getElementById('app');
      appEl.innerHTML = `
        <div style="${vnode.props.style}">
           <h1 style="${vnode.children[0].props.style}">${vnode.children[0].children[0]}</h1>
           <p>${vnode.children[1].children[0]}</p>
           <button id="inc-btn">${vnode.children[2].children[0]}</button>
        </div>
      `;
      // 因为 innerHTML 重建了 DOM，需要重新绑定事件
      document.getElementById('inc-btn').addEventListener('click', increment);
    }

    // 初始化
    updateApp();
  </script>
</body>
</html>
```
