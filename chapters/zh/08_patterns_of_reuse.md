# 第八章：复用的困境 (Patterns of Reuse)

![figure 8.1](../images/ch08_reuse.png)

## 8.1 复用的需求

Po 在第七章里构建了一个 Timer。现在他想在另一个组件里追踪鼠标位置。

**🐼**：Shifu，我想写一个组件，跟踪鼠标的坐标并显示出来。

**🧙‍♂️**：试试看。

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

**🐼**：效果不错！但现在我还想做另一个组件——一个跟随鼠标移动的圆。它也需要追踪鼠标位置，但展示方式完全不同。

**🧙‍♂️**：那你打算怎么做？

**🐼**：嗯……最直接的办法就是把鼠标追踪的代码 **再写一遍**？

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
    }, []);
  }
}
```

**🐼**：两个组件里的 `constructor`、`componentDidMount`、`componentWillUnmount` 几乎一字不差，只有 `render()` 不同。如果以后鼠标追踪的逻辑要改——比如加一个节流 (throttle)——我得改 **两个地方**。如果有十个组件需要追踪鼠标，那就是 **十份几乎相同的代码**。

**🧙‍♂️**：你体会到痛点了。在编程中，这叫做 **DRY 原则 (Don't Repeat Yourself)** 的违反。当同一段逻辑散布在多个地方，维护成本会随着组件数量线性增长。

**🐼**：那我能不能把鼠标追踪的逻辑提取出来，像一个“功能模块”一样，让任何组件都能用？

**🧙‍♂️**：这正是 React 社区十年来一直在探索的问题。在类组件时代，人们发明了三种不同的模式来解决它，每一种都比前一种更好，但也都有自己的缺陷。让我们逐一体验。

## 8.2 Mixins：把逻辑混进去 (2013-2015)

**🧙‍♂️**：在 React 最早期，使用 `React.createClass` 时，有一个叫 **Mixin** 的概念。它的思路非常朴素——既然多个组件需要相同的逻辑，那就把这段逻辑提取到一个对象里，然后“混入”到每个组件中。

**🐼**：“混入”是什么意思？

**🧙‍♂️**：你可以把它理解为 **复制粘贴，但是由框架自动完成**。当你写 `mixins: [MouseMixin]` 时，`React.createClass` 会把 `MouseMixin` 对象上的所有方法——`getInitialState`、`componentDidMount`、`_onMouseMove` 等——**合并到你的组件上**，就好像你亲手把它们写在了组件里一样。

简单类比的话：

```javascript
// Mixin 的本质 ≈ 把对象的属性合并到组件上
Object.assign(YourComponent.prototype, MouseMixin);
// 之后 YourComponent 就拥有了 MouseMixin 的所有方法
```

实际的 Mixin 长这样：

```javascript
// 早期 React.createClass 的 Mixin（已废弃）
const MouseMixin = {
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
const MouseTracker = React.createClass({
  mixins: [MouseMixin],  // 框架会自动把 MouseMixin 的所有方法“混进来”
  render: function() {
    // 这里可以直接用 this.state.x 和 this.state.y
    // 它们是 MouseMixin 的 getInitialState 提供的
    return h('p', null, ['Position: ' + this.state.x + ', ' + this.state.y]);
  }
});
```

**🐼**：我明白了！所以 `MouseTracker` 自己没有写 `componentDidMount`，但因为 `MouseMixin` 被混入了，它就“继承”了 Mixin 里的 `componentDidMount`，框架会在挂载时自动调用它。这样我就不用把鼠标追踪的代码手动复制到每个组件里了。

**🧙‍♂️**：没错。看起来很方便，但 Mixins 有致命的缺陷。假设你同时混入两个 Mixin，它们都定义了 `this.state.x`——一个是鼠标坐标，另一个是滚动条位置。你觉得会发生什么？

**🐼**：呃……后面混入的会覆盖前面的？这样的话，其中一个功能就彻底坏了！这就是**命名冲突**吧。

**🧙‍♂️**：是的。其次是**隐式依赖**。组件里突然冒出 `this.state.x`，但组件自己没定义。看代码的人完全不知道它从哪来，只能去翻所有 Mixin 的源码。

**🐼**：确实，如果一个组件用了 5 个 Mixin，找起问题来简直是大海捞针。而且它们的方法全挤在同一个 `this` 上，乱成一锅粥。

**🧙‍♂️**：这叫**滚雪球**效应。正因为这些问题，React 官方后来发表了著名的[《Mixins Considered Harmful》](https://legacy.reactjs.org/blog/2016/07/13/mixins-considered-harmful.html)，并在 ES6 Class 时代废弃了它。



## 8.3 高阶组件：用函数包装组件 (2015-2018)

**🧙‍♂️**：既然 Mixins 不行，聪明的开发者想到了另一个办法——用 **函数接受一个组件，返回一个新的增强组件**。这就是 **高阶组件 (Higher-Order Component, HOC)**。

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
        ...this.props, // ⚠️ 注意：对象展开语法 ({ ...obj }) 是 ES2018 特性
        mouse: { x: this.state.x, y: this.state.y }
      }, []);
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

**🐼**：这比 Mixins 好多了！状态被封装在 `withMouse` 函数内部的组件里，通过 props 传给目标组件，这就不会像 Mixin 那样直接污染目标组件的 `this` 了。

**🧙‍♂️**：是的。但如果你的组件不仅需要鼠标追踪，还需要窗口大小、用户信息、主题颜色呢？你会怎么写？

**🐼**：那就多包几层？比如 `withMouse(withWindowSize(withUser(withTheme(MyComponent))))`。

**🧙‍♂️**：精准。但这会导致 **Wrapper Hell（包装地狱）**。在开发者工具里，你的组件树会变成一层层的洋葱：`<WithTheme><WithUser><WithWindowSize>...`。不仅如此，Props 冲突的问题依然存在。

**🐼**：啊！如果 `withMouse` 传了 `data` 这个 prop，而 `withUser` 也想传一个叫 `data` 的 prop，后面的还是会覆盖前面的！

**🧙‍♂️**：没错。并且代码的可读性很差。光看 `MyComponent` 的代码，你根本不知道它最终会收到哪些 Props，因为每一层外包装都可能偷偷注入新数据。

## 8.4 Render Props：把渲染权交给调用者 (2017+)

**🧙‍♂️**：为了避免 HOC 的缺陷，社区又发明了一种新模式——**Render Props**。思路是：让用户传入一个“渲染函数”，由外部来控制如何展示数据。

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

**🐼**：这样确实在使用的地方很灵活，我可以自由决定如何渲染数据。

**🧙‍♂️**：但多个 Render Props 组合在一起时呢？

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

**🐼**：天哪，这是 **回调地狱 (Callback Hell)**！

**🧙‍♂️**：是的。除了嵌套深，Render Props 还有一个隐蔽的缺陷：**性能问题（匿名函数导致的重复渲染）**。

**🐼**：性能问题？

**🧙‍♂️**：是的。如果在 `render` 中直接定义匿名函数作为 Render Prop，每次父组件渲染时都会创建全新的函数引用。

**🐼**：我懂了！这样一来，即使数据没变，由于 prop 里的函数引用变了，子组件的浅比较（Shallow Compare）就会失效，导致无意义的重复渲染！

**🧙‍♂️**：完全正确。所以不论是 HOC 还是 Render Props，每一种模式都有它的局限性。

## 8.5 对比一览

| 模式 | 优点 | 缺点 |
|:-----|:-----|:-----|
| **Mixins** | 简单直观 | 命名冲突、隐式依赖、已废弃 |
| **HOCs** | 组合灵活、无命名冲突 | Wrapper Hell、Props 冲突、Debug 困难 |
| **Render Props** | 使用时灵活、数据流清晰 | Callback Hell、代码嵌套深、匿名函数破坏性能优化 |

**🐼**：Shifu，后两种模式虽然各有不同，但感觉都有一个共同的别扭——明明我只想复用一段“行为”，却不得不把组件层级搞得越来越复杂。

**🧙‍♂️**：你一语中的。我们一直在试图用“结构”（组件缠绕结构）来解决“行为”（逻辑复用）的问题。
如果有一种方式，可以在不改变组件层级结构的前提下，直接把一段“行为”注入到组件中呢？

**🐼**：那不就是 Mixin 的思路吗？但 Mixin 已经证明有问题了……

**🧙‍♂️**：Mixin 的问题在于“隐式”和“混乱”。但如果有一种机制，既能像 Mixin 一样直接引入逻辑，又像函数调用一样 **显式** 且 **可组合**，不依赖 `this`，没有命名冲突，怎么样？

**🐼**：那……每一种行为就像一个函数调用，我可以在组件里直接“调用”它……就像普通的 JavaScript 函数那样？

**🧙‍♂️**：你即将推开通向新世界的大门，这正是 **Hooks** 的核心思想。

**🐼**：那我们赶紧在现在的引擎里实现它吧！

**🧙‍♂️**：遗憾的是，我们当前的引擎（Stack Reconciler）**根本无法支撑这样的设计**。你想想，如果只用普通函数组件，函数执行完内部状态就销毁了，函数是没有“记忆”的。

**🐼**：对哦……现在的引擎只是死板地同步递归调用 `render()`，并没有为函数组件提供存储状态的地方。

**🧙‍♂️**：嗯， 我们将在后面想办法解决这个问题。

---

### 📦 实践一下

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
          if (key === 'className') el.setAttribute('class', vnode.props[key]);
          else if (key === 'style' && typeof vnode.props[key] === 'string') el.style.cssText = vnode.props[key];
          else el.setAttribute(key, vnode.props[key]);
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
          const nextProps = newVNode.props;
          const nextState = instance.state;
          if (instance.shouldComponentUpdate &&
              !instance.shouldComponentUpdate(nextProps, nextState)) {
            instance.props = nextProps;
            newVNode.el = oldVNode.el;
            newVNode._instance = instance;
            return;
          }
          instance.props = nextProps;
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
            const evt = key.slice(2).toLowerCase();
            if (oldP[key]) el.removeEventListener(evt, oldP[key]);
            el.addEventListener(evt, newP[key]);
          } else {
            if (key === 'className') el.setAttribute('class', newP[key]);
            else if (key === 'style' && typeof newP[key] === 'string') el.style.cssText = newP[key];
            else el.setAttribute(key, newP[key]);
          }
        }
      }
      for (const key in oldP) {
        if (!(key in newP)) {
          if (key.startsWith('on')) el.removeEventListener(key.slice(2).toLowerCase(), oldP[key]);
          else if (key === 'className') el.removeAttribute('class');
          else if (key === 'style') el.style.cssText = '';
          else el.removeAttribute(key)
        }
      }
      const oldChildren = oldVNode.children || [];
      const newChildren = newVNode.children || [];
      if (typeof newChildren === 'string') {
        if (oldChildren !== newChildren) el.textContent = newChildren;
      } else if (typeof oldChildren === 'string') {
        el.textContent = '';
        newChildren.forEach(c => mount(c, el));
      } else {
        const commonLength = Math.min(oldChildren.length, newChildren.length);
        for (let i = 0; i < commonLength; i++) {
          const oldChild = oldChildren[i], newChild = newChildren[i];
          if (typeof oldChild === 'string' && typeof newChild === 'string') {
            if (oldChild !== newChild) el.childNodes[i].textContent = newChild;
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
        if (newChildren.length > oldChildren.length) newChildren.slice(oldChildren.length).forEach(c => mount(c, el));
        if (newChildren.length < oldChildren.length) {
          for (let i = oldChildren.length - 1; i >= commonLength; i--) el.removeChild(el.childNodes[i]);
        }
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
        return h('div', { className: 'card' }, [
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
      h('div', { className: 'card' }, [
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
