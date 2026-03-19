# 第七章：类组件与生命周期 (Class Components & Lifecycle)

![figure 7.1](../../website/public/images/ch07_lifecycle.png)

## 7.1 给组件赋予记忆

Po 试着用上一课的组件做一个计时器，但很快陷入了困境。

**🐼**：Shifu，我想做一个计时器组件，每秒钟数字加一。但我发现目前的组件没有“记忆”能力。Props 是从外面传进来的，组件自己没有办法保存和修改自己的数据。

**🧙‍♂️**：在框架出现之前，开发者已经在用各种方式让“组件”拥有记忆了。如果是你，会怎么做？

**🐼**：如果它是一个普通的类（class），最自然的方式应该是**把它存在类的实例属性（instance properties）上**吧？比如我给实例加一个 `this._count = 0`，每次需要加一的时候就 `this._count++`。

**🧙‍♂️**：对。这是面向对象编程中标准的做法。但这引出了一个新问题：当你执行了 `this._count++` 之后，控制台里的数字变了，屏幕上的数字变了吗？

**🐼**：没有。我只修改了数据，还没有写代码去更新 DOM。难道我还要手动去调用类似 `document.getElementById('counter').innerText = this._count` 这样的代码？

**🧙‍♂️**：这正是早期前端开发的痛点。数据变了，必须手动去寻找对应的 DOM 节点并修改。一旦状态变多，很容易忘记更新某处 DOM，或者更新错了。

**🐼**：那样太折磨人了。我们需要让框架来接管。当组件的数据发生变化时，UI 应该自动重新渲染。

**🧙‍♂️**：是的。为了让框架能“感知”到数据的变化，我们不能再简单粗暴地直接修改 `this._count`。我们需要引入 **State**。你觉得它和 Props 有什么区别？

**🐼**：**Props** 像是组件的**外部参数**，由父组件传入并控制，当前组件不应该直接修改它。而 **State** 应该是组件的**内部记忆**，由组件自己拥有的数据。

## 7.2 实现 `setState`

**🧙‍♂️**：精确。当组件内部的 State 变化时，UI 应该自动更新。假设我们提供一个 API 叫 `setState`，你觉得应该怎么用它来更新状态？

**🐼**：我觉得应该是这样：我调用 `this.setState({ count: 1 })`，组件内部就会合并新旧状态，然后自动触发重新渲染。

**🧙‍♂️**：没错。那我们就来实现这个 API。思考一下，如果让你来写 `setState` 的内部逻辑，需要哪几个步骤？

**🐼**：首先肯定是把传进来的新状态和旧状态合并，存到 `this.state` 里。接着……因为要更新界面，所以得调用 `this.render()` 生成新的 VNode 树？

**🧙‍♂️**：继续。生成了新的 VNode 树之后呢？

**🐼**：然后我需要拿到旧的 VNode 树，调用上一章我们写的 `patch(oldVNode, newVNode)` 去对比并更新真实的 DOM。

**🧙‍♂️**：逻辑非常清晰。把它写成代码看看。

**🐼**：好的，我给 `Component` 基类加上这些逻辑：

```javascript
class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }

  setState(newState) {
    // 1. 合并状态（浅合并）
    this.state = Object.assign({}, this.state, newState);
    // 2. 触发更新
    this._update();
  }

  _update() {
    const oldVNode = this._vnode;
    const newVNode = this.render();
    patch(oldVNode, newVNode);
    // 3. 记住新的 VNode
    this._vnode = newVNode;
  }

  render() {
    throw new Error('Component must implement render()');
  }
}
```

**🧙‍♂️**：这把我们之前所有的成果都串联起来了：`setState` → `render()` → `patch()` → 更新变化的 DOM。

> 💡 **简化说明：同步 vs. 批量合并**
>
> 我们的简化版 `setState` 是 **同步** 的——每次调用立即触发重新渲染。但真实 React 的 `setState` 是 **批量合并 (Batching)** 的：在同一个事件处理函数中连续调用多次 `setState`，React 只会触发 **一次** 重渲染。
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

## 7.3 生命周期 (Lifecycle)

**🐼**：有了 `setState`，我可以让计时器更新数字了。但我遇到了一个实际问题——我需要用 `setInterval` 每秒调用一次 `setState`。可是，这个 `setInterval` 应该写在哪里？

**🧙‍♂️**：你觉得写在 `render()` 里可以吗？

**🐼**：不行，每次重新渲染都会调用 `render()`，那就会不断创建新的定时器，全乱套了。写在 `constructor` 里也不对，那时候组件还没被挂载到页面上。

**🧙‍♂️**：是的。`setState` 解决了“如何更新”，但你还缺少一个“何时启动”的时机。你的 `setInterval` 需要在组件挂载到 DOM **之后**才启动。

**🐼**：等等，我还想到一个问题。如果用户切换了页面，这个计时器组件被从 DOM 中移除了，但 `setInterval` 还在后台跑。它会不断调用一个已经不存在的组件的 `setState`，这会造成内存泄漏吧？

**🧙‍♂️**：非常敏锐。所以你不仅需要“组件已挂载”的时机，还需要什么？

**🐼**：需要一个“组件即将被移除”的时机，让我能清理掉那些定时器或者其他副作用。

**🧙‍♂️**：这就是 **生命周期方法 (Lifecycle Methods)**。通常我们称它们为 `componentDidMount` 和 `componentWillUnmount`。

**🐼**：我明白了。那我需要在挂载组件的时候调用它。我来修改上一章的 `mount` 函数：

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

> 💡 **简化说明：`componentWillUnmount` 不会被自动调用**
>
> 我们的简化版实现了 `componentDidMount`，但 **`componentWillUnmount` 不会被自动调用**——当组件被 `patch` 替换时，我们只是简单地 `replaceChild`，并没有去调用旧组件的清理函数。为了保持 Demo 的简洁，我们在这个阶段先不实现它。

## 7.4 `this` 的陷阱

**🐼**：Shifu，我这就来写我的计时器组件！

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

**🧙‍♂️**：在你运行之前，预测一下：`setInterval` 的回调每秒触发时，里面的 `this` 指向什么？

**🐼**：因为我是在 `componentDidMount` 里写的，这是组件的方法，所以 `this` 应该就是组件实例吧？

**🧙‍♂️**：试一下。

Po 运行代码后，控制台弹出了红色的错误：`TypeError: this.setState is not a function`。

**🐼**：什么？！为什么 `this` 不是组件实例？`this.setState` 怎么会是 undefined？

**🧙‍♂️**：欢迎来到 JavaScript 最容易掉进去的坑——**`this` 绑定 (this binding)**。`this` 的值不是在函数定义时决定的，而是在函数**被调用时**决定的。

**🐼**：你的意思是，`setInterval` 在调用我的回调时，把它当成了一个普通函数，所以 `this` 变成了全局对象 `window`？

**🧙‍♂️**：完全正确。那你要怎么修复它？

**🐼**：我可以把 `this` 存到一个变量里，比如 `const self = this;`。或者用 `.bind(this)` 把它绑死。但我觉得最简单的是用**箭头函数**，因为它没有自己的 `this`，只会沿用外层作用域的 `this`。

```javascript
  componentDidMount() {
    this.timerId = setInterval(() => {
      this.setState({ seconds: this.state.seconds + 1 });
    }, 1000);
  }
```

**🧙‍♂️**：是的。箭头函数从源头上消除了“这里 `this` 到底指向什么”的问题。在类组件时代，`this` 绑定问题是最常见的 Bug 来源。

**🐼**：这种因为语言机制带来的复杂性真是让人头疼。它和我想实现的业务逻辑一点关系都没有。

**🧙‍♂️**：这被称为 **非本质复杂度 (Accidental Complexity)**。它后来成为了推动 React 转向另一种组件形态的重要原因。

## 7.5 避免浪费：shouldComponentUpdate

**🧙‍♂️**：现在计时器跑起来了。但想想另一个场景：如果父组件重新渲染了，但传给子组件的 Props 完全没变，子组件会发生什么？

**🐼**：按照我们现在的 `patch` 逻辑……只要父组件一重新渲染，就会对子组件调用 `render()`，不管 Props 变没变。

**🧙‍♂️**：如果这是一个有 100 个子组件的列表，只有第 3 个的数据变了呢？

**🐼**：那 100 个组件都会重新执行 `render()`。这太浪费性能了！我们需要一种机制，让组件自己决定要不要更新。

**🧙‍♂️**：对。我们可以给组件加一个“守门人”方法，比如叫 `shouldComponentUpdate`。你觉得它应该放在哪一步进行拦截？

**🐼**：应该在真正调用 `render()` **之前**。在处理组件节点更新的 `patch` 分支里，先问一下组件要不要更新。如果不需要，就直接复用旧的 DOM。

```javascript
// 升级后的 patch（加入 shouldComponentUpdate 检查）
if (oldVNode.tag === newVNode.tag) {
  const instance = (newVNode._instance = oldVNode._instance);
  const nextProps = newVNode.props;
  const nextState = instance.state;

  // 🆕 询问组件：有必要更新吗？
  if (instance.shouldComponentUpdate &&
      !instance.shouldComponentUpdate(nextProps, nextState)) {
    // 组件说“不用更新”——跳过 render
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
}
```

**🧙‍♂️**：准确。注意，即使跳过了渲染，我们仍然要把 `instance.props` 更新为 `nextProps`。为什么？

**🐼**：因为如果之后组件自己的 `state` 发生变化触发了 `setState`，它在 `render` 时需要读到最新的 `this.props`，否则数据就旧了。

**🧙‍♂️**：对。后来的 `React.PureComponent` 和 `React.memo()` 就是对这一模式的封装，它们会自动帮你进行浅比较 (Shallow Comparison) 来拦截不必要的渲染。

## 7.6 上帝组件的困境

**🧙‍♂️**：现在的类组件看起来功能已经很完整了。但是，随着应用变大，你可能会写出这样的代码：

```javascript
class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = { users: [], notifications: [], windowWidth: 0 };
  }

  componentDidMount() {
    this.fetchUsers();
    window.addEventListener('resize', this.handleResize);
    this.ws = new WebSocket('...');
    this.ws.onmessage = (e) => { /* 处理通知 */ };
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.ws.close();
  }

  // ... 各种各样的方法 ...
}
```

**🐼**：这简直是一个大杂烩。它同时管理着用户数据、窗口大小监听和 WebSocket 通知。

**🧙‍♂️**：看出问题在哪了吗？看看 `componentDidMount` 和 `componentWillUnmount` 里面的代码。

**🐼**：相关的逻辑被拆散了！WebSocket 的建立连接和关闭连接，分别在两个不同的生命周期方法里。而 `componentDidMount` 里又塞满了完全不相关的初始化逻辑。

**🧙‍♂️**：是的。类组件是按照 **时间点 (Timing)** 来组织逻辑的——“挂载时做什么”、“卸载时做什么”。但我们的大脑更习惯按 **关注点 (Concerns)** 来组织逻辑——“与数据获取相关的代码”、“与 WebSocket 相关的代码”。

**🐼**：这导致组件越复杂，代码就越割裂。这能解决吗？

**🧙‍♂️**：人们为了在类组件中解决逻辑复用和拆分，发明了高阶组件 (HOC) 和 Render Props 等模式。但它们都带来了新的问题。真正的破局之道，就在不久的将来。

---

> 💡 **深入一点：父子 VNode 引用的问题**
>
> 当组件调用 `setState` 时，我们的 `_update` 会更新组件内部的 `_vnode`。但**父组件**的 VNode 树仍然持有旧子树的引用。这意味着如果父组件之后重渲染，它可能会对比一棵过时的树。在我们的 Demo 中这不是问题，因为父组件不会在子组件状态变化后重渲染。这是我们简化实现的一个边界，真实 React 通过 Fiber 树的双缓冲机制解决了这个问题，后面的章节会讲到。

---

### 📦 实践一下

将以下代码保存为 `ch07.html`，体验类组件内部如何通过 `setState` 管理自身状态并利用生命周期安全地执行副作用：

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

      // ⚠️ 在我们的简化引擎中此方法不会被自动调用，此处仅展示最佳实践
      componentWillUnmount() {
        clearInterval(this.timerId);
      }

      render() {
        const color = this.state.seconds % 2 === 0 ? '#333' : '#0066cc';
        return h('div', { className: 'card' }, [
          h('div', { className: 'timer', style: 'color:' + color }, [
            String(this.state.seconds) + 's'
          ]),
          h('p', { className: 'info' }, [
            'This timer uses setState + patch. Only the number updates, not the whole page.'
          ]),
          h('p', { className: 'info' }, [
            'componentDidMount → starts setInterval | componentWillUnmount → clears it'
          ])
        ]);
      }

    }

    // === shouldComponentUpdate Demo ===

    // Parent: re-renders every second to simulate prop changes
    class Parent extends Component {
      constructor(props) {
        super(props);
        this.state = { tick: 0, important: 0 };
      }
      componentDidMount() {
        this._id = setInterval(() => {
          this.setState({ tick: this.state.tick + 1 });
        }, 1000);
      }
      componentWillUnmount() { clearInterval(this._id); }
      render() {
        return h('div', { className: 'card' }, [
          h('p', { className: 'info' }, [
            'Parent tick: ' + this.state.tick + ' (re-renders every second)'
          ]),
          h('button', { onclick: () => this.setState({ important: this.state.important + 1 }) }, [
            'Change important prop (' + this.state.important + ')'
          ]),
          h(Child, { important: this.state.important, tick: this.state.tick })
        ]);
      }
    }

    // Child: only re-renders when "important" prop changes, ignores "tick"
    class Child extends Component {
      constructor(props) {
        super(props);
        this._renderCount = 0;
      }
      shouldComponentUpdate(nextProps, nextState) {
        // Skip re-render if only "tick" changed
        return nextProps.important !== this.props.important;
      }
      render() {
        this._renderCount++;
        return h('div', { style: 'margin-top:8px; padding:8px; background:#f0f8ff; border-radius:4px;' }, [
          h('p', { className: 'info' }, [
            '✅ Child render count: ' + this._renderCount +
            ' (shouldComponentUpdate blocks tick-only updates)'
          ]),
          h('p', null, ['important = ' + this.props.important])
        ]);
      }
    }

    // === Mount the App ===

    const appVNode = h('div', null, [
      h('h1', null, ['Class Components & Lifecycle']),
      h(Timer, null),
      h('h2', null, ['shouldComponentUpdate Demo']),
      h(Parent, null)
    ]);

    mount(appVNode, document.getElementById('app'));
  </script>
</body>
</html>
```
