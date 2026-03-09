# 第十一章：协调与提交 —— 填充引擎的蓝图 (Fiber Reconciliation & Commit)

![figure 11.1](../images/ch11_reconciliation.png)

## 11.1 统一节点格式 (改造 h 函数)

**🧙‍♂️**：在上一章，我们搭建了 Fiber 引擎的宏伟蓝图。现在我们要开始写代码，填满 `performUnitOfWork` 和 `commitRoot` 这两个黑盒。但在那之前，我们需要确保输入给引擎的数据格式是统一的。

**🐼**：你是说 `h()` 函数生成的虚拟 DOM 树吗？

**🧙‍♂️**：是的。在旧引擎里，纯文本往往是个裸字符串。但在 Fiber 引擎中，每个节点都必须是一个对象，拥有 `type` 和 `props`。如果遍历算法在处理 `children` 数组时突然撞见一个字符串，整个链表结构就会崩溃。

**🐼**：那我们需要把字符串也包装成对象？就像给它包上一层标准的外壳。

**🧙‍♂️**：正是。我们来改造 `h()` 函数。顺便用 `.flat()` 处理一下嵌套数组：

```javascript
function h(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.flat().map(child =>
        typeof child === "object"
          ? child
          // 统一格式：将非对象子元素包装为特殊的 TEXT_ELEMENT 对象
          : { type: "TEXT_ELEMENT", props: { nodeValue: child, children: [] } }
      ),
    },
  };
}
```

**🐼**：巧妙！`TEXT_ELEMENT` 是我们自定义的标签。这样所有节点都是标准对象，Fiber 遍历算法就可以一视同仁地读取 `type` 和 `props` 了。而且文本节点有 `children: []`，这意味着它是叶子节点，不用再往下走了。

## 11.2 引擎状态初始化

**🧙‍♂️**：积木准备好了。现在我们把上一章提到的全局变量真正在代码里写出来。每次调用 `render` 函数时，就是我们开始起草“新蓝图”（Render 阶段）的时刻。

```javascript
let currentRoot = null;    // 完工蓝图（当前显示在屏幕上的树）
let wipRoot = null;        // 草稿纸（正在构建中的新树）
let workInProgress = null; // 遍历游标
let deletions = null;      // 垃圾桶：收集在比对过程中发现需要被删除的旧节点

function render(element, container) {
  // 1. 创建全新的草稿纸根节点
  wipRoot = {
    dom: container,
    props: { children: [element] },
    alternate: currentRoot,  // 👈 关键：通过 alternate 指针连上旧的完工蓝图
  };
  
  // 2. 清空垃圾桶
  deletions = [];
  
  // 3. 把游标放在起点，等待 workLoop 运转
  workInProgress = wipRoot;
}
```

**🐼**：这和我们上一章画的图一模一样！草稿纸（`wipRoot`）准备好了，并悄悄连上了原图（`alternate`）。

## 11.3 揭秘第一个黑盒：performUnitOfWork

**🧙‍♂️**：当浏览器空闲时，`workLoop` 会不断调用 `performUnitOfWork`。这个函数每一次被调用，只会处理**一个节点**。它需要做三件事：

1. 如果这个节点还没有真实的 DOM，就创建它（但不挂载）。
2. **协调（Reconcile）**：为它的子元素创建新的 Fiber 节点，并与旧的蓝图做比对。
3. 根据我们在上一章定下的“迷宫规则”（下、右、上），返回下一个要处理的节点。

```javascript
function performUnitOfWork(fiber) {
  // 1. 创建 DOM（暂不挂载到页面，因为我们还在草稿阶段！）
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 2. 协调子节点（核心黑盒的内部核心）
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  // 3. 迷宫导航规则：返回下一个节点
  if (fiber.child) return fiber.child;
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.return;
  }
  return null;
}
```

**🐼**：`createDom` 应该很简单，就是根据 `type` 创建元素并设置属性对吧？我比较好奇第二步的 `reconcileChildren`，它是怎么做对比的？

### 协调（Reconciliation）：质检员的工作

**🧙‍♂️**：想象你是一个质检员。在 `reconcileChildren` 函数里，你左手拿着一张**新的子元素列表**（来自我们刚写的 `h()` 函数），右手拿着**旧的蓝图的子链表**（通过 `fiber.alternate.child` 拿到）。

你从第一个孩子开始，一对一地同时往下看。

```
左手 = 新草稿里的元素    右手 = 完工蓝图里的旧 Fiber (oldFiber)
```

如果你发现左右两边的节点 `type` 是一样的（比如都是 `h1`），你会怎么做？

**🐼**：既然类型一样，我根本不需要重新 `document.createElement`！我可以直接把旧 Fiber 身上的那个真实 DOM 节点“搬”过来放在新草稿上，只更新一下有变化的属性就行了。

**🧙‍♂️**：完美的直觉。如果 `type` 不同呢？

**🐼**：那说明旧的没用了，需要全新创建一个。

**🧙‍♂️**：没错。在 Render 阶段，由于我们绝对不能碰真实的页面，所以质检员的工作只是**贴标签**。我们给新创建的 Fiber 节点加一个属性叫 `effectTag`（特效标签）：

- 如果 type 相同：贴上 **`"UPDATE"`** 标签。
- 如果有新元素但没旧元素（或 type 不同）：贴上 **`"PLACEMENT"`** 标签（新增）。
- 如果有多余的旧元素：把它丢进 `deletions` 垃圾桶，贴上 **`"DELETION"`** 标签。

```javascript
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  // 拿到旧树中对应层级的第一个子 Fiber（“右手”的起点）
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  // 只要新元素没走完，或者旧节点没走完，就继续循环
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    // 比较类型是否相同
    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // ✅ type 相同：复用旧 DOM，贴 UPDATE 标签
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,     // 👈 直接复用！避免昂贵的 DOM 创建
        return: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      // 🆕 发现新元素（或 type 不同）：需要全新创建 DOM，贴 PLACEMENT 标签
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        return: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      // 🗑️ 多余的旧节点：没有对应的新元素，需要删除
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber); // 扔进垃圾桶，等待 Commit 阶段统一处理
    }

    // 游标前进：右手翻到下一个旧节点
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // 把新生成的 Fiber 串成一条链表
    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
  }
}
```

**🐼**：我明白了！`reconcileChildren` 不仅把子节点变成了 Fiber 链表，还顺便完成了新旧对比。而且所有会影响页面的操作都被抽象成了 `effectTag` 小便签。Render 阶段真的就像在“打草稿”，什么也没发生！

## 11.4 揭秘第二个黑盒：commitRoot

**🧙‍♂️**：当 `workInProgress` 变成了 `null`，意味着草稿纸画到了尽头。所有的标签都贴好了。现在进入 **Commit Phase（提交阶段）**。这个阶段是同步的，一口气执行完毕。

**🐼**：所以这里就是看标签干活的地方了。遇到 `PLACEMENT` 就 `appendChild`，遇到 `UPDATE` 就改属性。

**🧙‍♂️**：是的，我们首先要处理 `deletions` 垃圾桶里的删除任务，然后沿着整棵草稿树遍历，执行所有的标签。

```javascript
function commitRoot() {
  // 1. 先把垃圾桶里的节点从页面上干掉
  deletions.forEach(commitWork);
  
  // 2. 然后处理新草稿树上的新增和更新
  commitWork(wipRoot.child);
  
  // 3. 完美收工！把草稿纸设为新的完工蓝图，以备下次更新之用
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) return;

  // 找到拥有真实 DOM 的父节点
  let domParentFiber = fiber.return;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.return;
  }
  const domParent = domParentFiber.dom;

  // 根据便签干活
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
    return; // ⚠️ 删除后必须立即返回！不要再遍历它的子节点了
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
```

**🐼**：为什么删除操作后要 `return`，不继续往下遍历了？

**🧙‍♂️**：如果一棵树被砍断了根，你就不需要去管它的树枝了。继续遍历已经被删除的旧节点的子树是非常危险的，它们身上可能还残留着上一次更新的过期便签，这会导致“僵尸节点”死而复生。

**🐼**：原来如此！至于 `updateDom` 和 `createDom`，我猜就是我们在旧引擎（第五章）里写过的那些属性对比逻辑，对吧？找出新增的属性加上，找出没有的属性删掉，事件监听器特殊处理一下。

**🧙‍♂️**：完全正确。这些底层的 DOM 操作没有任何变化。Fiber 改变的是“何时更新”（从边遍历边更新变成统一提交），而不是“如何更新 DOM”。

## 11.5 时代的更替

**🐼**：Shifu，跟着你一步步拆解下来，我现在心里有一种非常通透的感觉。从第五章到第十一章，我们亲手将引擎彻底换代了。

**🧙‍♂️**：我们用一张表来做最后的告别吧：

| 概念 | 旧引擎 (Stack 架构) | 新引擎 (Fiber 架构) |
| :--- | :--- | :--- |
| 工作方式 | 递归遍历，不可中断 | 时间切片 (`workLoop`)，随叫随停 |
| 阶段划分 | 边对比边改 DOM | 分为 **Render** (打草稿) 和 **Commit** (一口气提交) |
| 数据结构 | VNode 树 (`children` 数组) | Fiber 链表 (`child`, `sibling`, `return`) |
| 状态保存 | JS 调用栈自动保存 | `workInProgress` 游标显式保存 |
| 差异标记 | 直接修改真实 DOM | 使用 `effectTag` (`UPDATE`, `PLACEMENT`, `DELETION`) 延迟操作 |
| 新旧对比 | 传入旧树和新树进行 `patch` | 通过 `alternate` 指针连接 `currentRoot` (原图) 进行比对 |

---

### 📦 实践一下

将以下代码保存为 `ch11.html`，这是我们第一个完全成型、拥有时间切片和完整协调能力的 Fiber 引擎：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 11 — The Complete Fiber Engine</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { color: #0066cc; }
    button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
    #log { margin-top: 20px; font-family: monospace; background: #fdfdfd; border: 1px solid #ddd; padding: 10px; height: 150px; overflow-y: auto; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="log"></div>

  <script>
    const logEl = document.getElementById('log');
    function log(msg) {
      const p = document.createElement('div');
      p.textContent = msg;
      logEl.prepend(p);
    }

    // === 1. 统一节点格式，文本自动包装为 TEXT_ELEMEN ===
    function h(type, props, ...children) {
      return {
        type,
        props: {
          ...props,
          children: children.flat().map(child =>
            typeof child === "object"
              ? child
              : { type: "TEXT_ELEMENT", props: { nodeValue: child, children: [] } }
          )
        }
      };
    }

    // === 2. 引擎状态初始化 ===
    let currentRoot = null;
    let wipRoot = null;
    let workInProgress = null;
    let deletions = [];

    function render(element, container) {
      wipRoot = {
        dom: container,
        props: { children: [element] },
        alternate: currentRoot  // 连上完工蓝图
      };
      deletions = [];
      workInProgress = wipRoot;
      log('🚀 render() 触发，开始 Render Phase...');
    }

    // === 3. 时间切片与引擎心跳 ===
    function workLoop(deadline) {
      let shouldYield = false;
      while (workInProgress && !shouldYield) {
        workInProgress = performUnitOfWork(workInProgress);
        shouldYield = deadline.timeRemaining() < 1;
      }
      
      // Render Phase 结束，进入 Commit Phase
      if (!workInProgress && wipRoot) {
        log('✅ Render Phase 完成！进入 Commit Phase...');
        commitRoot();
      }
      requestIdleCallback(workLoop);
    }
    requestIdleCallback(workLoop);

    // 保持浏览器活跃以稳定触发 idle 回调
    function keepAwake() { requestAnimationFrame(keepAwake); }
    requestAnimationFrame(keepAwake);

    // === 4. 黑盒 1：Render Phase (协调与打草稿) ===
    function performUnitOfWork(fiber) {
      if (!fiber.dom) {
        fiber.dom = createDom(fiber);
      }
      reconcileChildren(fiber, fiber.props.children);

      // 返回下一个节点（下 -> 右 -> 上）
      if (fiber.child) return fiber.child;
      let nextFiber = fiber;
      while (nextFiber) {
        if (nextFiber.sibling) return nextFiber.sibling;
        nextFiber = nextFiber.return;
      }
      return null;
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
          // 复用旧 DOM
          newFiber = {
            type: oldFiber.type, props: element.props, dom: oldFiber.dom,
            return: wipFiber, alternate: oldFiber, effectTag: "UPDATE"
          };
        }
        if (element && !sameType) {
          // 创建新 DOM
          newFiber = {
            type: element.type, props: element.props, dom: null,
            return: wipFiber, alternate: null, effectTag: "PLACEMENT"
          };
        }
        if (oldFiber && !sameType) {
          // 标记删除
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

    // === 5. 黑盒 2：Commit Phase (一口气更新) ===
    function commitRoot() {
      deletions.forEach(commitWork); 
      commitWork(wipRoot.child);     
      currentRoot = wipRoot;         
      wipRoot = null;
      log('🎉 Commit Phase 完成！页面已更新。');
    }

    function commitWork(fiber) {
      if (!fiber) return;
      
      let domParentFiber = fiber.return;
      while (!domParentFiber.dom) domParentFiber = domParentFiber.return;
      const domParent = domParentFiber.dom;

      if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
        domParent.appendChild(fiber.dom);
      } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props);
      } else if (fiber.effectTag === "DELETION") {
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

    // === 6. 底层 DOM 操作 ===
    function createDom(fiber) {
      const dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);

      updateDom(dom, {}, fiber.props);

      return dom;
    }

    function updateDom(dom, prevProps, nextProps) {
      // 第一遍：移除旧的属性和事件监听器
      for (const key in prevProps) {
        if (key === "children") continue;
        if (!(key in nextProps) || prevProps[key] !== nextProps[key]) {
          if (key.startsWith("on")) {
            // 事件监听器：移除旧的
            dom.removeEventListener(key.slice(2).toLowerCase(), prevProps[key]);
          } else if (!(key in nextProps)) {
            // 属性：旧的有、新的没有，清空
            dom[key] = "";
          }
        }
      }
      // 第二遍：添加或更新新的属性和事件监听器
      for (const key in nextProps) {
        if (key === "children") continue;
        if (prevProps[key] !== nextProps[key]) {
          if (key.startsWith("on")) {
            dom.addEventListener(key.slice(2).toLowerCase(), nextProps[key]);
          } else {
            dom[key] = nextProps[key];
          }
        }
      }
    }

    // === 应用层面演示 ===
    // 由于 Hooks 还没有实现，这里用全局变量模拟状态
    let counter = 1;
    function getAppVNode() {
      return h('div', { id: 'container' },
        h('h1', null, '完整 Fiber 引擎运行中'),
        h('p', null, `当前渲染次数: ${counter}`),
        h('button', { onclick: () => { counter++; renderApp(); } }, '触发 Fiber 更新')
      );
    }

    function renderApp() {
      render(getAppVNode(), document.getElementById('app'));
    }

    // 首次挂载
    renderApp();
  </script>
</body>
</html>
