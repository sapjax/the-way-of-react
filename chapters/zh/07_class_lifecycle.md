# 第七章：类组件与生命周期 (Class Components & Lifecycle)

![chapter illustration](../images/ch07_lifecycle.png)

## 7.1 给组件赋予记忆

Student 试着用上一章的组件做一个计时器，但很快陷入了困境。

**Student**：Master，我想做一个计时器组件，每秒钟数字加一。但我发现目前的组件没有“记忆”能力。Props 是从外面传进来的，组件自己没有办法保存和修改自己的数据。

**Master**：在框架出现之前，开发者已经在用各种方式让“组件”拥有记忆了。你能想到哪些方法？

**Student**：最简单的就是 **全局变量** 吧？把计数器的值存在函数外面。

**Master**：可以，但问题很明显——如果页面上有两个独立的计数器，它们会 **共享同一个全局变量**，互相干扰。而且全局变量容易命名冲突。

**Student**：那用 **闭包** 呢？每个组件用一个闭包来保存自己的数据，外界访问不到。

**Master**：闭包更好一些，但它是“隐蔽”的——谁控制这个闭包？谁决定什么时候更新 UI？开发者必须手动管理这一切。我们需要的是一个框架级的解决方案——让组件自己拥有数据，并且当数据变化时自动触发 UI 更新。

Props 是组件的 **外部参数**，由父组件控制。你缺少的是组件的 **内部记忆** —— 这就是 **State**。
State 和 Props 的区别在于：

*   **Props**：从外部传入，组件不应该直接修改它。
*   **State**：组件自己拥有的数据，组件可以修改它。

让我们来实现它。

## 7.2 实现 `setState` 

**Master**：现在我们需要解决一个具体的问题：当组件内部的数据变化时，UI 应该自动更新。假设我们有一个 API 叫 `setState`，你觉得它应该怎么用？

**Student**：我觉得应该是这样的：我调用 `this.setState({ count: 1 })`，组件就自动更新界面。可能它内部负责合并新旧状态，然后触发重新渲染。

**Master**：很好，那我们就来实现这个 API。它的核心逻辑其实很简单：

```javascript
class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }

  setState(newState) {
    // 合并状态（浅合并）
    this.state = Object.assign({}, this.state, newState);
    // 触发更新
    this._update();
  }

  _update() {
    const oldVNode = this._vnode;
    const newVNode = this.render();
    patch(oldVNode, newVNode);
    this._vnode = newVNode;
  }

  render() {
    throw new Error('Component must implement render()');
  }
}
```

**Master**：看，`setState` 的核心就三步：

1.  合并新旧 State。
2.  调用 `render()` 生成新的 VNode 树。
3.  调用 `patch()` 更新真实 DOM。

> **⚠️ 注意**：我们的简化版 `setState` 是 **同步** 的——每次调用立即触发重新渲染。但真实 React 的 `setState` 是 **批量合并 (Batching)** 的：在同一个事件处理函数中连续调用多次 `setState`，React 只会触发 **一次** 重渲染。
>
> ```javascript
> // 如果不 batch，这两行会触发两次渲染：
> this.setState({ a: 1 });  // 渲染 #1
> this.setState({ b: 2 });  // 渲染 #2
>
> // batch 后，React 合并为 { a: 1, b: 2 }，只渲染一次
> ```
>
> 这是 React 核心的性能优化之一。

这就把我们之前所有章节的成果串联起来了：`setState` → `render()` → `patch()` → 只更新变化的 DOM。

> ⚠️ **简化说明**：当组件调用 `setState` 时，我们的 `_update` 会更新组件内部的 `_vnode`。但**父组件**的 VNode 树仍然持有旧子树的引用。这意味着如果父组件之后重渲染，它可能会对比一棵过时的树。在真正的 React 中，Fiber 架构正确地管理这些跨组件的关系。在我们的 Demo 中这不是问题，因为父组件不会在子组件状态变化后重渲染。

## 7.3 生命周期 (Lifecycle)

**Student**：好，有了 `setState`，我的计时器可以每秒更新数字了。但我遇到了一个实际问题——我需要用 `setInterval` 每秒调用一次 `setState`。可是……**这个 `setInterval` 应该写在哪里？**

我不能写在 `render()` 里——每次重新渲染都会创建一个新的定时器。我也不能写在 `constructor` 里——那时候组件还没被挂载到页面上。

**Master**：你发现了一个关键问题。`setState` 解决了"**如何更新**"，但没有解决"**何时启动**"。你的 `setInterval` 需要在组件挂载到 DOM **之后**才启动。

而且，还有一个你可能还没想到的问题——假设用户切换了页面，这个计时器组件被从 DOM 中移除了，但 `setInterval` 还在后台跑。它会不断调用一个已经不存在的组件的 `setState`，造成内存泄漏。

**Student**：所以我不仅需要一个"**组件已挂载，可以安全启动副作用**"的时机，还需要一个"**组件即将被移除，请清理副作用**"的时机？

**Master**：这就是 **生命周期方法 (Lifecycle Methods)** 的由来。

*   `componentDidMount()`：组件第一次挂载到 DOM 后调用。
*   `componentWillUnmount()`：组件从 DOM 移除前调用。

让我们升级 `mount` 函数来支持生命周期：

> 💡 **坦诚说明**：我们的简化版实现了 `componentDidMount`（在 `mount` 时调用），但 **`componentWillUnmount` 不会被自动调用**——当组件被 `patch` 替换时，我们只是简单地 `replaceChild`，并没有调用旧组件的清理函数。在真实的 React 中，当组件从树中移除时，`componentWillUnmount` 会被自动调用。在我们的 Demo 中，计时器不会被替换，所以这个限制不会造成问题。

```javascript
// 在 mount 里，挂载组件后调用 componentDidMount
function mount(vnode, container) {
  // ... 其他逻辑 ...
  
  if (typeof vnode.tag === 'function') {
    const instance = new vnode.tag(vnode.props);
    vnode._instance = instance;
    const subTree = instance.render();
    instance._vnode = subTree;
    mount(subTree, container);
    vnode.el = subTree.el;
    
    // 🆕 组件已挂载，触发生命周期
    if (instance.componentDidMount) {
      instance.componentDidMount();
    }
    return;
  }
  
  // ... 普通节点逻辑 ...
}
```

## 7.4 `this` 的陷阱

**Student**：Master，我来重新写一个计时器试试。

```javascript
class Timer extends Component {
  constructor(props) {
    super(props);
    this.state = { seconds: 0 };
  }

  componentDidMount() {
    this.timerId = setInterval(function() {
      this.setState({ seconds: this.state.seconds + 1 });
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerId);
  }

  render() {
    return h('div', null, [
      h('h2', null, ['Timer: ' + this.state.seconds + 's'])
    ]);
  }
}
```

**Master**：试一下。

Student 运行代码后，控制台报错：`TypeError: this.setState is not a function`。

**Student**：什么？！为什么 `this` 不是组件实例？

**Master**：欢迎来到 JavaScript 最容易掉进去的坑之一——**`this` 绑定 (this binding)**。
在 `setInterval` 的回调函数里，`this` 不再指向你的组件实例。它指向了 `window`（严格模式下是 `undefined`）。

**Student**：那怎么修？

**Master**：有三种常见的修复方式：

```javascript
// ✅ 方法 1: 箭头函数（最推荐）
// 箭头函数没有自己的 this，它会捕获外层的 this
componentDidMount() {
  this.timerId = setInterval(() => {
    this.setState({ seconds: this.state.seconds + 1 });
  }, 1000);
}

// ✅ 方法 2: bind
componentDidMount() {
  this.timerId = setInterval(function() {
    this.setState({ seconds: this.state.seconds + 1 });
  }.bind(this), 1000);
}

// ✅ 方法 3: 保存引用
componentDidMount() {
  const self = this;
  this.timerId = setInterval(function() {
    self.setState({ seconds: self.state.seconds + 1 });
  }, 1000);
}
```

**Master**：在类组件时代，`this` 绑定问题是最常见的 Bug 来源之一。几乎每个 React 新手都会踩这个坑。而且，这不是 React 独有的问题，这是 JavaScript 本身的设计。
这种 **“非本质复杂度” (Accidental Complexity)** ——它不是你的业务需要的复杂度，而是语言机制带来的副作用——后来成为了推动 React 转向函数式组件和 Hooks 的一个重要因素。

**Student**: Hook? 听起来像是一个魔法钩子，做什么用的？

**Master**: 别急，后面我们会讲到。现在我们继续看类组件。

## 7.5 避免浪费：shouldComponentUpdate

**Master**：还有一个问题值得思考。如果父组件重新渲染了，但传给子组件的 Props 完全没变，子组件也会重新渲染吗？

**Student**：按照我们的实现……会的。`patch` 会对子组件调用 `render()`，不管 Props 有没有变化。

**Master**：这就是 **不必要的渲染**。试想一个有 100 个子组件的列表，只有第 3 个的 Props 变了，但所有 100 个都要重新执行 `render()`。

为此，React 提供了 `shouldComponentUpdate`：

```javascript
class TodoItem extends Component {
  // 如果返回 false，就跳过 render 和 patch
  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.text !== this.props.text;
  }

  render() {
    return h('li', null, [this.props.text]);
  }
}
```

**Student**：这相当于给组件加了一个“守门人”，只在必要时才让渲染发生。

**Master**：是的。后来的 `React.PureComponent` 和 `React.memo()` 就是对这一模式的封装——它们自动执行浅比较 (Shallow Comparison) 来决定是否需要重新渲染。

## 7.6 上帝组件的困境

**Master**：一切看起来很美？但是，让我们看看当一个组件变得越来越复杂时，会发生什么。

```javascript
class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [],
      searchTerm: '',
      isLoading: false,
      selectedTab: 'all',
      notifications: [],
      windowWidth: window.innerWidth,
    };
  }

  componentDidMount() {
    // 获取用户数据
    this.fetchUsers();
    // 监听窗口大小
    window.addEventListener('resize', this.handleResize);
    // 建立 WebSocket 连接
    this.ws = new WebSocket('...');
    this.ws.onmessage = (e) => {
      this.setState({ notifications: [...this.state.notifications, JSON.parse(e.data)] });
    };
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.ws.close();
  }

  // ... 十几个方法 ...
}
```

**Student**：天啊，这个组件做了太多事。它同时管理用户数据、搜索、加载状态、Tab 切换、通知和窗口大小。这些逻辑完全不相关，却被塞进了一个组件里！

**Master**：这就是 **上帝组件 (God Component)** 的问题。在类组件中：

*   `componentDidMount` 里塞满了不相关的初始化逻辑。
*   `componentWillUnmount` 里要记得清理所有的副作用。
*   相关的逻辑被 **分散** 在不同的生命周期方法中（fetch 在 didMount 里，cleanup 在 willUnmount 里），而不相关的逻辑却被 **混合** 在同一个生命周期方法中， 因为它是按照 **timing**（时间点）来组织逻辑——'挂载时做什么'、'卸载时做什么'。但真正有意义的划分应该按 **concerns**（关注点）——'数据获取'、'事件监听'、'动画'。。

**Student**：如何才能实现按照关注点划分呢？

**Master**：这正是下一章的主题。人们为了在类组件中实现逻辑复用，发明了各种巧妙（但也痛苦）的模式。

---

### 📦 目前的成果

将以下代码保存为 `ch07.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 7 — Class Components & Lifecycle</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; }
    button { padding: 6px 12px; cursor: pointer; margin: 4px; }
    .timer { font-size: 48px; font-weight: bold; color: #333; }
    .info { color: #666; font-size: 13px; margin-top: 10px; }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    // === Mini-React Engine (cumulative) ===

    function h(tag, props, children) {
      return { tag, props: props || {}, children: children || [] };
    }

    class Component {
      constructor(props) {
        this.props = props || {};
        this.state = {};
      }
      setState(newState) {
        this.state = Object.assign({}, this.state, newState);
        this._update();
      }
      _update() {
        if (!this._vnode) return;
        const oldVNode = this._vnode;
        const newVNode = this.render();
        patch(oldVNode, newVNode);
        this._vnode = newVNode;
      }
      render() { throw new Error('Must implement render()'); }
    }

    function mount(vnode, container) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        container.appendChild(document.createTextNode(vnode));
        return;
      }
      if (typeof vnode.tag === 'function') {
        const instance = new vnode.tag(vnode.props);
        vnode._instance = instance;
        const subTree = instance.render();
        instance._vnode = subTree;
        mount(subTree, container);
        vnode.el = subTree.el;
        if (instance.componentDidMount) instance.componentDidMount();
        return;
      }
      const el = (vnode.el = document.createElement(vnode.tag));
      for (const key in vnode.props) {
        if (key.startsWith('on')) {
          el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
        } else {
          el.setAttribute(key, vnode.props[key]);
        }
      }
      if (typeof vnode.children === 'string') {
        el.textContent = vnode.children;
      } else {
        (vnode.children || []).forEach(child => {
          if (typeof child === 'string' || typeof child === 'number')
            el.appendChild(document.createTextNode(child));
          else mount(child, el);
        });
      }
      container.appendChild(el);
    }

    function patch(oldVNode, newVNode) {
      if (typeof newVNode.tag === 'function') {
        if (oldVNode.tag === newVNode.tag) {
          const instance = (newVNode._instance = oldVNode._instance);
          instance.props = newVNode.props;
          const oldSub = instance._vnode;
          const newSub = instance.render();
          instance._vnode = newSub;
          patch(oldSub, newSub);
          newVNode.el = newSub.el;
        } else {
          const parent = oldVNode.el.parentNode;
          mount(newVNode, parent);
          parent.replaceChild(newVNode.el, oldVNode.el);
        }
        return;
      }
      if (oldVNode.tag !== newVNode.tag) {
        const parent = oldVNode.el.parentNode;
        const tmp = document.createElement('div');
        mount(newVNode, tmp);
        parent.replaceChild(newVNode.el, oldVNode.el);
        return;
      }
      const el = (newVNode.el = oldVNode.el);
      const oldP = oldVNode.props || {}, newP = newVNode.props || {};
      for (const key in newP) {
        if (oldP[key] !== newP[key]) {
          if (key.startsWith('on')) {
            const e = key.slice(2).toLowerCase();
            if (oldP[key]) el.removeEventListener(e, oldP[key]);
            el.addEventListener(e, newP[key]);
          } else el.setAttribute(key, newP[key]);
        }
      }
      for (const key in oldP) {
        if (!(key in newP)) {
          if (key.startsWith('on')) el.removeEventListener(key.slice(2).toLowerCase(), oldP[key]);
          else el.removeAttribute(key);
        }
      }
      const oldCh = oldVNode.children || [];
      const newCh = newVNode.children || [];
      if (typeof newCh === 'string') {
        if (oldCh !== newCh) el.textContent = newCh;
      } else if (typeof oldCh === 'string') {
        el.textContent = '';
        newCh.forEach(c => mount(c, el));
      } else {
        const cl = Math.min(oldCh.length, newCh.length);
        for (let i = 0; i < cl; i++) {
          const oc = oldCh[i], nc = newCh[i];
          if (typeof oc === 'string' && typeof nc === 'string') {
            if (oc !== nc) el.childNodes[i].textContent = nc;
          } else if (typeof oc === 'object' && typeof nc === 'object') {
            patch(oc, nc);
          }
        }
        if (newCh.length > oldCh.length) newCh.slice(oldCh.length).forEach(c => mount(c, el));
        if (newCh.length < oldCh.length) {
          for (let i = oldCh.length - 1; i >= cl; i--) el.removeChild(el.childNodes[i]);
        }
      }
    }

    // === Timer Component with Lifecycle ===

    class Timer extends Component {
      constructor(props) {
        super(props);
        this.state = { seconds: 0 };
      }

      componentDidMount() {
        // ✅ 使用箭头函数解决 this 绑定！
        this.timerId = setInterval(() => {
          this.setState({ seconds: this.state.seconds + 1 });
        }, 1000);
      }

      componentWillUnmount() {
        clearInterval(this.timerId);
      }

      render() {
        const color = this.state.seconds % 2 === 0 ? '#333' : '#0066cc'; 
        return h('div', { class: 'card' }, [
          h('div', { class: 'timer', style: 'color:' + color }, [
            String(this.state.seconds) + 's'
          ]),
          h('p', { class: 'info' }, [
            'This timer uses setState + patch. Only the number updates, not the whole page.'
          ]),
          h('p', { class: 'info' }, [
            'componentDidMount → starts setInterval | componentWillUnmount → clears it'
          ])
        ]);
      }
    }

    // === Mount the App ===

    const appVNode = h('div', null, [
      h('h1', null, ['Class Components & Lifecycle']),
      h(Timer, null)
    ]);

    mount(appVNode, document.getElementById('app'));
  </script>
</body>
</html>
```

*(下一章：复用的困境——Mixins、HOC 与 Render Props)*
