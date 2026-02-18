# 第八章：复用的困境 (Patterns of Reuse)

![chapter illustration](../images/ch08_reuse.png)

## 8.1 复用的需求

Student 在第七章里构建了一个 Timer。现在他想在另一个组件里追踪鼠标位置。

**Student**：Master，我想写一个组件，跟踪鼠标的坐标并显示出来。

**Master**：试试看。

```javascript
class MouseTracker extends Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };
    this._onMouseMove = (e) => {
      this.setState({ x: e.clientX, y: e.clientY });
    };
  }

  componentDidMount() {
    window.addEventListener('mousemove', this._onMouseMove);
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this._onMouseMove);
  }

  render() {
    return h('p', null, [
      'Position: ' + this.state.x + ', ' + this.state.y
    ]);
  }
}
```

**Student**：效果不错！但现在我还想做另一个组件——一个跟随鼠标移动的圆。它也需要追踪鼠标位置，但展示方式完全不同。

**Master**：那你打算怎么做？

**Student**：嗯……最直接的办法就是把鼠标追踪的代码 **再写一遍**？

```javascript
class MouseCircle extends Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };       // 👈 一模一样
    this._onMouseMove = (e) => {
      this.setState({ x: e.clientX, y: e.clientY });
    };
  }

  componentDidMount() {
    window.addEventListener('mousemove', this._onMouseMove);  // 👈 一模一样
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this._onMouseMove); // 👈 一模一样
  }

  render() {
    // 只有这里不同
    return h('div', {
      style: `position:fixed; left:${this.state.x}px; top:${this.state.y}px;
              width:30px; height:30px; border-radius:50%; background:#0066cc;
              transform:translate(-50%,-50%); pointer-events:none;`
    });
  }
}
```

**Student**：两个组件里的 `constructor`、`componentDidMount`、`componentWillUnmount` 几乎一字不差，只有 `render()` 不同。如果以后鼠标追踪的逻辑要改——比如加一个节流 (throttle)——我得改 **两个地方**。如果有十个组件需要追踪鼠标，那就是 **十份几乎相同的代码**。

**Master**：你体会到痛点了。在编程中，这叫做 **DRY 原则 (Don't Repeat Yourself)** 的违反。当同一段逻辑散布在多个地方，维护成本会随着组件数量线性增长。

**Student**：那我能不能把鼠标追踪的逻辑提取出来，像一个"功能模块"一样，让任何组件都能用？

**Master**：这正是 React 社区十年来一直在探索的问题。在类组件时代，人们发明了三种不同的模式来解决它，每一种都比前一种更好，但也都有自己的缺陷。让我们逐一体验。

## 8.2 Mixins：把逻辑混进去 (2013-2015)

**Master**：在 React 最早期，使用 `React.createClass` 时，有一个叫 **Mixin** 的概念。它的思路非常朴素——既然多个组件需要相同的逻辑，那就把这段逻辑提取到一个对象里，然后"混入"到每个组件中。

**Student**："混入"是什么意思？

**Master**：你可以把它理解为 **复制粘贴，但是由框架自动完成**。当你写 `mixins: [MouseMixin]` 时，`React.createClass` 会把 `MouseMixin` 对象上的所有方法——`getInitialState`、`componentDidMount`、`_onMouseMove` 等——**合并到你的组件上**，就好像你亲手把它们写在了组件里一样。

简单类比的话：

```javascript
// Mixin 的本质 ≈ 把对象的属性合并到组件上
Object.assign(YourComponent.prototype, MouseMixin);
// 之后 YourComponent 就拥有了 MouseMixin 的所有方法
```

实际的 Mixin 长这样：

```javascript
// 早期 React.createClass 的 Mixin（已废弃）
var MouseMixin = {
  getInitialState: function() {
    return { x: 0, y: 0 };
  },
  componentDidMount: function() {
    window.addEventListener('mousemove', this._onMouseMove);
  },
  componentWillUnmount: function() {
    window.removeEventListener('mousemove', this._onMouseMove);
  },
  _onMouseMove: function(e) {
    this.setState({ x: e.clientX, y: e.clientY });
  }
};
```

使用时，只需要在 `mixins` 数组里列出来：

```javascript
var MouseTracker = React.createClass({
  mixins: [MouseMixin],  // 框架会自动把 MouseMixin 的所有方法"混进来"
  render: function() {
    // 这里可以直接用 this.state.x 和 this.state.y
    // 它们是 MouseMixin 的 getInitialState 提供的
    return <p>Position: {this.state.x}, {this.state.y}</p>;
  }
});
```

**Student**：我明白了！所以 `MouseTracker` 自己没有写 `componentDidMount`，但因为 `MouseMixin` 被混入了，它就"继承"了 Mixin 里的 `componentDidMount`，框架会在挂载时自动调用它。这样我就不用把鼠标追踪的代码手动复制到每个组件里了。

**Master**：没错。看起来很方便，但 Mixins 有三个致命问题：

1.  **命名冲突**：如果你同时混入两个 Mixin，它们都定义了 `this.state.x`——一个是鼠标坐标，另一个是滚动条位置——谁覆盖谁？你在 `render` 里读到的 `this.state.x` 到底是哪个？
2.  **隐式依赖**：组件里突然冒出了 `this.state.x`，但组件自己没有定义它。新来的开发者看代码时完全不知道这个值从哪来，只能去翻 Mixin 的源码。Mixin 之间也可能互相依赖——A Mixin 依赖 B Mixin 提供的某个方法，但这种依赖关系没有任何地方声明。
3.  **滚雪球**：Mixins 会累积复杂度。一个组件用了 5 个 Mixin，debug 时你得看 6 份代码，而且它们的方法和状态全部"平铺"在同一个 `this` 上，混成一锅粥。

Facebook 自己后来也承认：**Mixins Considered Harmful**。到了 ES6 Class 组件时代，Mixins 不再被支持。



## 8.3 高阶组件：用函数包装组件 (2015-2018)

**Master**：既然 Mixins 不行，聪明的开发者想到了另一个办法——用 **函数接受一个组件，返回一个新的增强组件**。这就是 **高阶组件 (Higher-Order Component, HOC)**。

```javascript
function withMouse(WrappedComponent) {
  // 返回一个新的组件类
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = { x: 0, y: 0 };
      this._onMouseMove = this._onMouseMove.bind(this);
    }

    componentDidMount() {
      window.addEventListener('mousemove', this._onMouseMove);
    }

    componentWillUnmount() {
      window.removeEventListener('mousemove', this._onMouseMove);
    }

    _onMouseMove(e) {
      this.setState({ x: e.clientX, y: e.clientY });
    }

    render() {
      // 把鼠标位置作为 props 传递给被包装的组件
      return h(WrappedComponent, {
        ...this.props,
        mouse: { x: this.state.x, y: this.state.y }
      });
    }
  };
}

// 使用
class RawDisplay extends Component {
  render() {
    return h('p', null, [
      'Mouse: ' + this.props.mouse.x + ', ' + this.props.mouse.y
    ]);
  }
}

// 增强后的组件
const MouseDisplay = withMouse(RawDisplay);
```

**Student**：这比 Mixins 好多了！逻辑被封装在 `withMouse` 函数里，没有命名冲突的问题。

**Master**：是的，但 HOC 也有自己的痛点：

1.  **Wrapper Hell（包装地狱）**：如果你的组件需要鼠标追踪 + 窗口大小 + 用户信息 + ... ：
    ```javascript
    const Enhanced = withMouse(withWindowSize(withUser(withTheme(MyComponent))));
    ```
    DevTools 里的组件树变成了一层又一层的洋葱：
    `<WithTheme><WithUser><WithWindowSize><WithMouse><MyComponent /></...`

2.  **Props 冲突**：如果 `withMouse` 传了 `mouse` 这个 prop，但 `withWindowSize` 也想传一个叫 `mouse` 的 prop？

3.  **可读性差**：光看 `MyComponent` 的代码，你根本不知道它最终会收到哪些 Props——因为每一层 HOC 都可能偷偷注入新的 Props。

## 8.4 Render Props：把渲染权交给调用者 (2017+)

**Master**：为了避免 HOC 的缺陷，社区又发明了一种新模式——**Render Props**。思路是：让用户传入一个“渲染函数”，由外部来控制如何展示数据。

```javascript
class Mouse extends Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };
    this._onMouseMove = this._onMouseMove.bind(this);
  }

  componentDidMount() {
    window.addEventListener('mousemove', this._onMouseMove);
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this._onMouseMove);
  }

  _onMouseMove(e) {
    this.setState({ x: e.clientX, y: e.clientY });
  }

  render() {
    // 调用用户传入的渲染函数，把数据传给它
    return this.props.render(this.state);
  }
}

// 使用
// h(Mouse, { render: (mouse) => h('p', null, [`Position: ${mouse.x}, ${mouse.y}`]) })
```

**Student**：这样确实在使用的地方很灵活，我可以自由决定如何渲染数据。

**Master**：但多个 Render Props 组合在一起时呢？

```jsx
// 想象一下在 JSX 里的样子
<Mouse render={mouse => (
  <WindowSize render={size => (
    <Theme render={theme => (
      <MyComponent mouse={mouse} size={size} theme={theme} />
    )} />
  )} />
)} />
```

**Student**：天哪，这是 **回调地狱 (Callback Hell)**！

**Master**：是的。每一种模式都存在着它的局限性。

## 8.5 对比一览

| 模式 | 优点 | 缺点 |
|:-----|:-----|:-----|
| **Mixins** | 简单直观 | 命名冲突、隐式依赖、已废弃 |
| **HOCs** | 组合灵活、无命名冲突 | Wrapper Hell、Props 冲突、Debug 困难 |
| **Render Props** | 使用时灵活、数据流清晰 | Callback Hell、代码嵌套深 |

**Student**：Master，这三种模式虽然各有不同，但感觉都有一个共同的别扭——明明我只想复用一段“行为”，却不得不把组件层级搞得越来越复杂。

**Master**：你一语中的。我们一直在试图用“结构”（组件缠绕结构）来解决“行为”（逻辑复用）的问题。
如果有一种方式，可以在不改变组件层级结构的前提下，直接把一段“行为”注入到组件中呢？

**Student**：那不就是 Mixin 的思路吗？但 Mixin 已经证明有问题了……

**Master**：Mixin 的问题在于“隐式”和“混乱”。但如果有一种机制，既能像 Mixin 一样直接引入逻辑，又像函数调用一样 **显式** 且 **可组合**，不依赖 `this`，没有命名冲突，怎么样？

**Student**：那……每一种行为就像一个函数调用，我可以在组件里直接“调用”它……

**Master**：你即将推开通向新世界的大门。

---

### 📦 目前的成果

将以下代码保存为 `ch08.html`，完整展示 HOC 和 Render Props 在 Mini-React 中的运作

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 8 — Patterns of Reuse</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .circle { width: 30px; height: 30px; border-radius: 50%; background: #0066cc; position: fixed; pointer-events: none; transform: translate(-50%, -50%); z-index: 100; }
    h3 { margin-top: 0; }
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
        const o = this._vnode;
        const n = this.render();
        patch(o, n);
        this._vnode = n;
      }
      render() { throw new Error('Must implement render()'); }
    }

    function mount(vnode, container) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        container.appendChild(document.createTextNode(vnode)); return;
      }
      if (typeof vnode.tag === 'function') {
        const instance = new vnode.tag(vnode.props);
        vnode._instance = instance;
        const sub = instance.render();
        instance._vnode = sub;
        mount(sub, container);
        vnode.el = sub.el;
        if (instance.componentDidMount) instance.componentDidMount();
        return;
      }
      const el = (vnode.el = document.createElement(vnode.tag));
      for (const k in vnode.props) {
        if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), vnode.props[k]);
        else el.setAttribute(k, vnode.props[k]);
      }
      if (typeof vnode.children === 'string') el.textContent = vnode.children;
      else (vnode.children||[]).forEach(c => {
        if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(c));
        else mount(c, el);
      });
      container.appendChild(el);
    }

    function patch(o, n) {
      if (typeof n.tag === 'function') {
        if (o.tag === n.tag) {
          const inst = (n._instance = o._instance);
          inst.props = n.props;
          const os = inst._vnode, ns = inst.render();
          inst._vnode = ns;
          patch(os, ns);
          n.el = ns.el;
        } else {
          const p = o.el.parentNode;
          mount(n, p);
          p.replaceChild(n.el, o.el);
        }
        return;
      }
      if (o.tag !== n.tag) {
        const p = o.el.parentNode;
        const t = document.createElement('div');
        mount(n, t);
        p.replaceChild(n.el, o.el);
        return;
      }
      const el = (n.el = o.el);
      const op = o.props||{}, np = n.props||{};
      for (const k in np) {
        if (op[k] !== np[k]) {
          if (k.startsWith('on')) {
            const e = k.slice(2).toLowerCase();
            if (op[k]) el.removeEventListener(e, op[k]);
            el.addEventListener(e, np[k]);
          } else el.setAttribute(k, np[k]);
        }
      }
      for (const k in op) {
        if (!(k in np)) {
          if (k.startsWith('on')) el.removeEventListener(k.slice(2).toLowerCase(), op[k]);
          else el.removeAttribute(k);
        }
      }
      const oc = o.children||[], nc = n.children||[];
      if (typeof nc === 'string') { if (oc !== nc) el.textContent = nc; }
      else if (typeof oc === 'string') { el.textContent = ''; nc.forEach(c => mount(c, el)); }
      else {
        const cl = Math.min(oc.length, nc.length);
        for (let i = 0; i < cl; i++) {
          const a = oc[i], b = nc[i];
          if (typeof a === 'string' && typeof b === 'string') { if (a !== b) el.childNodes[i].textContent = b; }
          else if (typeof a === 'object' && typeof b === 'object') patch(a, b);
        }
        if (nc.length > oc.length) nc.slice(oc.length).forEach(c => mount(c, el));
        if (nc.length < oc.length) for (let i = oc.length-1; i >= cl; i--) el.removeChild(el.childNodes[i]);
      }
    }

    // === HOC Pattern: withMouse ===
    function withMouse(WrappedComponent) {
      return class WithMouse extends Component {
        constructor(props) {
          super(props);
          this.state = { x: 0, y: 0 };
          this._handler = (e) => this.setState({ x: e.clientX, y: e.clientY });
        }
        componentDidMount() {
          window.addEventListener('mousemove', this._handler);
        }
        componentWillUnmount() {
          window.removeEventListener('mousemove', this._handler);
        }
        render() {
          return h(WrappedComponent, {
            ...this.props,
            mouse: { x: this.state.x, y: this.state.y }
          });
        }
      };
    }

    // Display component that uses mouse data via HOC
    class RawDisplay extends Component {
      render() {
        const m = this.props.mouse || { x: 0, y: 0 };
        return h('div', { class: 'card' }, [
          h('h3', null, ['HOC Pattern: withMouse']),
          h('p', null, ['Mouse position: ' + m.x + ', ' + m.y]),
        ]);
      }
    }
    const MouseDisplay = withMouse(RawDisplay);

    // === Render Props Pattern: Mouse ===
    class Mouse extends Component {
      constructor(props) {
        super(props);
        this.state = { x: 0, y: 0 };
        this._handler = (e) => this.setState({ x: e.clientX, y: e.clientY });
      }
      componentDidMount() {
        window.addEventListener('mousemove', this._handler);
      }
      componentWillUnmount() {
        window.removeEventListener('mousemove', this._handler);
      }
      render() {
        // Call the render prop function with current state
        return this.props.render(this.state);
      }
    }

    // === App ===
    const appVNode = h('div', null, [
      h('h1', null, ['Patterns of Reuse']),
      h('p', null, ['Move your mouse to see both patterns in action.']),
      
      // HOC version
      h(MouseDisplay, null),
      
      // Render Props version
      h('div', { class: 'card' }, [
        h('h3', null, ['Render Props Pattern: Mouse']),
        h(Mouse, {
          render: (mouse) => h('p', null, [
            'Mouse position: ' + mouse.x + ', ' + mouse.y
          ])
        })
      ]),
    ]);

    mount(appVNode, document.getElementById('app'));
  </script>
</body>
</html>
```

*(下一章：Hooks——函数式的文艺复兴)*
