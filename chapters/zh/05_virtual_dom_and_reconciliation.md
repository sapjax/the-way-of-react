# 第五章：虚拟 DOM 与协调 (Virtual DOM & Reconciliation)

![figure 5.1](../../website/public/images/ch05_virtual_dom.png)

## 5.1 全局心智模型

Po 看着上一课生成的 `vdom` 对象，若有所思。

**🐼**：Shifu，我承认 `UI = f(state)` 的理念很美。但是，每次状态改变都生成一整棵新的节点树，还要去对比差异，难道不会比直接操作 DOM 更慢吗？

**🧙‍♂️**：这是一个常见的疑问。Po，在浏览器中，创建一个 `div` 元素（真实 DOM）和创建一个普通的 JavaScript 对象（虚拟 DOM），哪一个开销更大？

**🐼**：应该是真实 DOM 吧？因为它身上背负着浏览器的各种属性、样式、事件监听器和布局计算。

**🧙‍♂️**：没错。每一个真实的 DOM 节点都极其庞大，而 JavaScript 对象非常轻量。虚拟 DOM (Virtual DOM) 就是对真实 DOM 的轻量级描述。相比于直接销毁并重建庞大的真实 DOM 树，在 JavaScript 中对比两个轻量对象的差异，然后再精准更新真实 DOM，反而更高效。

**🐼**：这听起来像是一个计算与渲染的分离。但在进入代码细节前，能不能先告诉我整个系统是怎么运转的？

**🧙‍♂️**：可以。要让虚拟 DOM 运转起来，我们需要三个核心机制。试着推导一下，当你有一个 `state` 时，第一步需要做什么？

**🐼**：我需要一个函数，把 `state` 转换成那个轻量级的 JavaScript 对象树。我们可以叫它 `render`。

**🧙‍♂️**：是的。拿到了虚拟 DOM 树，接下来呢？

**🐼**：如果这是页面第一次加载，我需要把这棵虚拟的树“翻译”成真实的 DOM，并挂载到页面上。这个过程可以叫 `mount`。

**🧙‍♂️**：继续。那么当用户点击了按钮，`state` 发生了改变呢？

**🐼**：我会再次调用 `render` 生成一棵**新**的虚拟 DOM 树。然后需要一个函数来比较**新树**和**旧树**的差异，并把这些差异应用到已经存在的真实 DOM 上。这应该叫 `patch`。

**🧙‍♂️**：正是。这就是 React 运转的全局心智模型：

```javascript
// --- 1. 定义如何生成 VDOM ---
function render(state) {
  // 返回描述 UI 的 JavaScript 对象
}

// --- 2. 初始化 ---
let state = { count: 0 };
let prevVNode = render(state);                        // 生成第一棵虚拟 DOM 树
mount(prevVNode, document.getElementById('app'));     // 挂载到真实 DOM

// --- 3. 状态更新 ---
function update() {
  state.count++;
  const newVNode = render(state);   // 生成新虚拟 DOM 树
  patch(prevVNode, newVNode);       // 对比新旧差异，精准更新真实 DOM
  prevVNode = newVNode;             // 新树成为下一次对比的基准
}
```

**🐼**：我现在看清全貌了。`render` 负责描述 UI，`mount` 负责初次创建，而 `patch` 负责高效更新。

---

## 5.2 描述 UI：`h` 函数

**🧙‍♂️**：我们先实现第一步。我们需要一个能快速构建虚拟节点的工具函数。在社区中它通常被称为 `h` (Hyperscript) 或 `createElement`。

**🐼**：它就是用来返回那个轻量的 JavaScript 对象的吧？

```javascript
function h(tag, props, children) {
  return {
    tag,
    props: props || {},
    children: children || []
  };
}

// 使用它来构建 VDOM 树
const vnode = h('div', { id: 'app' }, [
  h('h1', null, ['Hello World']),
  h('p',  null, ['This is a VNode'])
]);
```

**🧙‍♂️**：对。注意两点规范：第一，`children` 始终是一个**数组**；第二，数组里的元素可以是字符串（文本节点）或另一个 VNode 对象。

> 💡 **JSX 小预告**：这个 `h()` 函数正是 JSX 编译的目标。当你在 React 中写 `<button onClick={fn}>Add</button>` 时，编译器（如 Babel）会将它转换为 `React.createElement('button', { onClick: fn }, 'Add')` —— 核心原理与我们的 `h` 完全一致。

---

## 5.3 初次渲染：`mount` 函数

**🧙‍♂️**：有了虚拟 DOM 树，我们需要实现 `mount` 函数。假设拿到了 `h('h1', { id: 'title' }, ['Hello'])`，你需要做哪几步把它变成真实的 DOM？

**🐼**：我想想……
1. 先根据 `tag` 创建一个空的 `<h1>` 标签。
2. 然后遍历 `props`，把 `id="title"` 设置到标签上。
3. 接着处理 `children`，因为里面是字符串 `'Hello'`，就把文字塞进去。如果子节点是别的 VNode，就递归调用 `mount`。
4. 最后，把建好的真实 DOM 节点追加到页面容器里。

**🧙‍♂️**：是的。我们来看代码。注意其中非常关键的一行：我们将创建的真实 DOM 节点挂载到了 VNode 对象上。

```javascript
function mount(vnode, container) {
  // 处理文本节点（字符串或数字直接创建文本）
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    container.appendChild(document.createTextNode(vnode));
    return;
  }

  // 步骤 1：创建真实 DOM 元素
  // 关键桥梁：把真实的 DOM 节点保存在 vnode.el 上
  const el = (vnode.el = document.createElement(vnode.tag));

  // 步骤 2：处理属性 (Props)
  for (const key in vnode.props) {
    if (key.startsWith('on')) {
      // 事件监听：onclick → click
      el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
    } else if (key === 'className') {
      // React 用 className 代替 class
      el.setAttribute('class', vnode.props[key]);
    } else if (key === 'style' && typeof vnode.props[key] === 'string') {
      el.style.cssText = vnode.props[key];
    } else {
      el.setAttribute(key, vnode.props[key]);
    }
  }

  // 步骤 3：递归处理子节点
  if (typeof vnode.children === 'string') {
    el.textContent = vnode.children;
  } else {
    vnode.children.forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(child));
      } else {
        mount(child, el); // 递归挂载子 VNode
      }
    });
  }

  // 步骤 4：挂载到容器
  container.appendChild(el);
}
```

**🐼**：为什么要把真实 DOM 节点保存在 `vnode.el` 上？

**🧙‍♂️**：因为虚拟 DOM 只是一个描述对象，它本身并不能改变页面。当我们执行 `patch` 对比新旧 VNode 时，一旦发现了差异，我们必须知道去修改**哪一个具体的真实 DOM 节点**。`vnode.el` 就是虚拟世界通往真实世界的**唯一桥梁**。

---

## 5.4 协调 (Reconciliation) 与 Diff 算法

**🧙‍♂️**：现在我们来到核心部分：`patch` 函数。当状态变化产生新的 VNode 树时，如何将新旧差异用最少的真实 DOM 操作同步过去？这个过程叫做**协调 (Reconciliation)**，寻找差异的算法叫做 **Diff**。

**🐼**：如果我有一棵很深很复杂的树，全量对比每一个节点的每一个属性，性能不会很差吗？

**🧙‍♂️**：是的，传统的树比对算法时间复杂度是 O(n³)。React 引入了一个启发式假设：如果两个节点的 `tag` 类型不同（比如 `div` 变成了 `p`），React 会认为它们的内部结构完全改变，直接销毁旧节点，重建新节点，不再进行深度对比。这样把复杂度直接降到了 O(n)。

**🐼**：如果 `tag` 相同呢？

**🧙‍♂️**：那我们就复用已有的真实 DOM 节点，只更新那些改变了的属性（Props），然后再去递归比对它们的子节点。

下面这张流程图展示了 `patch` 的核心决策过程：

![figure 5.4](../../website/public/images/figure_5_4.png)

### 第一步：节点类型改变

**🐼**：如果标签不一样，比如 `h('h1', ...)` 变成了 `h('p', ...)`，按照你说的，直接替换整个节点。

**🧙‍♂️**：是的。我们需要找到旧节点的父元素，并用新节点替换它。由于新 VNode 还没有真实的 DOM 节点，可以借助一个临时容器先把它 `mount` 出来。

```javascript
function patch(oldVNode, newVNode) {
  // 1. 节点类型不同：直接替换
  if (oldVNode.tag !== newVNode.tag) {
    const parent = oldVNode.el.parentNode;

    // 用一个临时容器暂存，通过 mount 生成 newVNode.el
    const tempContainer = document.createElement('div');
    mount(newVNode, tempContainer);

    // 用新节点替换旧节点
    parent.replaceChild(newVNode.el, oldVNode.el);
    return;
  }

  // ...
}
```

### 第二步：复用 DOM 与更新属性

**🐼**：如果标签一样，说明可以复用真实 DOM。我需要把 `oldVNode.el` 上的真实 DOM 引用传递给 `newVNode.el`，然后比对 `props`。

**🧙‍♂️**：逻辑正确。写出代码。

```javascript
  // 2. 节点类型相同：复用真实 DOM，传递桥梁
  const el = (newVNode.el = oldVNode.el);

  const oldProps = oldVNode.props || {};
  const newProps = newVNode.props || {};

  // 添加/更新新属性
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        if (oldProps[key]) el.removeEventListener(eventName, oldProps[key]);
        el.addEventListener(eventName, newProps[key]);
      } else if (key === 'className') {
        el.setAttribute('class', newProps[key]);
      } else if (key === 'style' && typeof newProps[key] === 'string') {
        el.style.cssText = newProps[key];
      } else {
        el.setAttribute(key, newProps[key]);
      }
    }
  }

  // 移除已经不存在的旧属性
  for (const key in oldProps) {
    if (!(key in newProps)) {
      if (key.startsWith('on')) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else if (key === 'className') {
        el.removeAttribute('class');
      } else {
        el.removeAttribute(key);
      }
    }
  }
```

### 第三步：处理子节点

**🧙‍♂️**：最后一步是比对子节点。假设新旧子节点都是数组，你会怎么做？

**🐼**：既然是数组，那就逐个索引比对。
1. 遍历共有长度的部分，对相同位置的子节点递归调用 `patch`。
2. 如果新数组更长，把多出来的新节点 `mount` 追加进去。
3. 如果旧数组更长，把多余的旧节点对应的真实 DOM 删掉。

**🧙‍♂️**：对。实现如下：

```javascript
  // 3. 处理子节点
  const oldChildren = oldVNode.children;
  const newChildren = newVNode.children;

  if (typeof newChildren === 'string') {
    if (oldChildren !== newChildren) {
      el.textContent = newChildren;
    }
  } else if (typeof oldChildren === 'string') {
    el.textContent = '';
    newChildren.forEach(child => mount(child, el));
  } else {
    // 新旧都是数组：逐个比较共有部分
    const commonLength = Math.min(oldChildren.length, newChildren.length);
    for (let i = 0; i < commonLength; i++) {
      patch(oldChildren[i], newChildren[i]); // 递归深度比对
    }

    // 新节点更多：挂载剩余的
    if (newChildren.length > oldChildren.length) {
      newChildren.slice(oldChildren.length).forEach(child => mount(child, el));
    }

    // 旧节点更多：移除多余的
    if (newChildren.length < oldChildren.length) {
      for (let i = oldChildren.length - 1; i >= commonLength; i--) {
        el.removeChild(el.childNodes[i]);
      }
    }
  }
```

**🐼**：如果列表元素的顺序变了，比如 `[A, B, C]` 变成了 `[C, A, B]`，按照索引比对，`patch` 会认为每一个节点都发生了变化，从而做了三次无谓的 DOM 内容更新。

**🧙‍♂️**：没错。正因如此，React 引入了 `key` 属性。给节点分配唯一的 `key` 后，React 的 Diff 算法就不再盲目地按索引比对，而是能识别出元素的移动，进而只改变真实 DOM 节点的顺序。在我们这个精简版里，为了聚焦核心流程省略了 `key` 的实现，但在真实业务中，这是列表渲染性能优化的关键。

---

### 📦 实践一下

将以下代码保存为 `ch05.html`，这是我们第一个真正工作的 Mini-React 原型。

**运行后你会看到什么**：页面上有一个计数器和一个按钮。每次点击按钮，标题颜色会在蓝色和红色之间切换。下方的 **Patch Log** 会实时记录 Diff 算法做了哪些 DOM 操作——你会发现，每次只有真正变化的那一个属性被更新，其余节点纹丝不动。

**重点观察**：点击两次按钮，对比两次 Patch Log 的内容，感受 Diff 算法的精准性。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 5 — Virtual DOM Implementation</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    button { padding: 5px 10px; cursor: pointer; }
    #log {
      background: #f5f5f5; padding: 10px; margin-top: 15px;
      border-radius: 4px; font-family: monospace; font-size: 12px;
      max-height: 200px; overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <h3>Patch Log（Diff 每次具体做了什么）：</h3>
  <div id="log"></div>

  <script>
    // ── 日志工具 ──────────────────────────────────────────────
    const logEl = document.getElementById('log');
    function patchLog(msg) {
      const line = document.createElement('div');
      line.textContent = '→ ' + msg;
      logEl.prepend(line);
    }

    // ── h：生成虚拟节点 ───────────────────────────────────────
    function h(tag, props, children) {
      return { tag, props: props || {}, children: children || [] };
    }

    // ── mount：把虚拟节点变成真实 DOM 并挂载 ─────────────────
    function mount(vnode, container) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        container.appendChild(document.createTextNode(vnode));
        return;
      }

      const el = (vnode.el = document.createElement(vnode.tag));

      for (const key in vnode.props) {
        if (key.startsWith('on')) {
          el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
        } else if (key === 'className') {
          el.setAttribute('class', vnode.props[key]);
        } else if (key === 'style' && typeof vnode.props[key] === 'string') {
          el.style.cssText = vnode.props[key];
        } else {
          el.setAttribute(key, vnode.props[key]);
        }
      }

      if (typeof vnode.children === 'string') {
        el.textContent = vnode.children;
      } else {
        vnode.children.forEach(child => {
          if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
          } else {
            mount(child, el);
          }
        });
      }

      container.appendChild(el);
    }

    // ── patch：对比新旧节点差异并更新 DOM ───────────────────
    function patch(oldVNode, newVNode) {
      // 情况 1：节点类型不同 → 替换
      if (oldVNode.tag !== newVNode.tag) {
        patchLog(`REPLACE <${oldVNode.tag}> → <${newVNode.tag}>`);
        const parent = oldVNode.el.parentNode;
        const tmp = document.createElement('div');
        mount(newVNode, tmp);
        parent.replaceChild(newVNode.el, oldVNode.el);
        return;
      }

      // 情况 2：节点类型相同 → 复用真实 DOM，传递 el 引用
      const el = (newVNode.el = oldVNode.el);
      const oldProps = oldVNode.props || {};
      const newProps = newVNode.props || {};

      // 添加/更新属性
      for (const key in newProps) {
        if (oldProps[key] !== newProps[key]) {
          if (key.startsWith('on')) {
            const evt = key.slice(2).toLowerCase();
            if (oldProps[key]) el.removeEventListener(evt, oldProps[key]);
            el.addEventListener(evt, newProps[key]);
          } else if (key === 'className') {
            patchLog(`SET class="${newProps[key]}"`);
            el.setAttribute('class', newProps[key]);
          } else if (key === 'style' && typeof newProps[key] === 'string') {
            patchLog(`SET style="${newProps[key]}"`);
            el.style.cssText = newProps[key];
          } else {
            patchLog(`SET ${key}="${newProps[key]}"`);
            el.setAttribute(key, newProps[key]);
          }
        }
      }

      // 移除旧属性
      for (const key in oldProps) {
        if (!(key in newProps)) {
          if (key.startsWith('on')) {
            el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
          } else if (key === 'className') {
            el.removeAttribute('class');
          } else {
            patchLog(`REMOVE attr: ${key}`);
            el.removeAttribute(key);
          }
        }
      }

      // 情况 3：更新子节点
      const oldChildren = oldVNode.children;
      const newChildren = newVNode.children;

      if (typeof newChildren === 'string') {
        if (oldChildren !== newChildren) {
          patchLog(`SET textContent: "${newChildren}"`);
          el.textContent = newChildren;
        }
      } else if (typeof oldChildren === 'string') {
        el.textContent = '';
        newChildren.forEach(c => mount(c, el));
      } else {
        const commonLength = Math.min(oldChildren.length, newChildren.length);

        for (let i = 0; i < commonLength; i++) {
          const oldChild = oldChildren[i];
          const newChild = newChildren[i];

          if ((typeof oldChild === 'string' || typeof oldChild === 'number') &&
              (typeof newChild === 'string' || typeof newChild === 'number')) {
            if (oldChild !== newChild) {
              patchLog(`UPDATE text[${i}]: "${oldChild}" → "${newChild}"`);
              el.childNodes[i].textContent = newChild;
            }
          } else if (typeof oldChild === 'object' && typeof newChild === 'object') {
            patch(oldChild, newChild);
          } else {
            if (typeof newChild === 'string' || typeof newChild === 'number') {
              el.replaceChild(document.createTextNode(newChild), el.childNodes[i]);
            } else {
              const tmp = document.createElement('div');
              mount(newChild, tmp);
              el.replaceChild(newChild.el, el.childNodes[i]);
            }
          }
        }

        if (newChildren.length > oldChildren.length) {
          patchLog(`ADD ${newChildren.length - oldChildren.length} child(ren)`);
          newChildren.slice(oldChildren.length).forEach(c => mount(c, el));
        }

        if (newChildren.length < oldChildren.length) {
          patchLog(`REMOVE ${oldChildren.length - newChildren.length} child(ren)`);
          for (let i = oldChildren.length - 1; i >= commonLength; i--) {
            el.removeChild(el.childNodes[i]);
          }
        }
      }
    }

    // ── 应用逻辑 ──────────────────────────────────────────────
    let state = { count: 0 };
    let prevVNode = null;

    function render(state) {
      return h('div', { id: 'container' }, [
        h('h1',
          { style: state.count % 2 === 0 ? 'color:blue' : 'color:red' },
          ['Current Count: ' + state.count]
        ),
        h('button',
          { onclick: () => { state.count++; update(); } },
          ['Increment']
        ),
        h('p', null, ['Open DevTools → 观察只有变化的节点被更新！'])
      ]);
    }

    function update() {
      patchLog('─── New render cycle ───');
      const newVNode = render(state);
      if (!prevVNode) {
        mount(newVNode, document.getElementById('app'));
      } else {
        patch(prevVNode, newVNode);
      }
      prevVNode = newVNode;
    }

    update(); // 初始渲染
  </script>
</body>
</html>
```
