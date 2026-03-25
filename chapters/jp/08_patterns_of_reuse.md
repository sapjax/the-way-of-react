# 第八章：再利用の苦境 (Patterns of Reuse)

![figure 8.1](../../website/public/images/ch08_reuse.png)

## 8.1 再利用のニーズ

ポーは第七章で Timer を構築した。今度は別のコンポーネントでマウスの位置を追跡したいと考えている。

**🐼**：師父、マウスの座標を追跡して表示するコンポーネントを書きたいです。

**🧙‍♂️**：やってみるがいい。

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

**🐼**：なかなか良い感じです！ ですが、今度はまた別のコンポーネント——マウスに付いてくる円を作りたいのです。それもマウス位置を追跡する必要がありますが、表示の仕方は全く違います。

**🧙‍♂️**：では、どうするつもりだ？

**🐼**：うーん……一番手っ取り早いのは、マウス追跡のコードを **もう一度書く** ことでしょうか？

```javascript
class MouseCircle extends Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };       // 👈 全く同じ
    this._onMouseMove = (e) => {
      this.setState({ x: e.clientX, y: e.clientY });
    };
  }

  componentDidMount() {
    window.addEventListener('mousemove', this._onMouseMove);  // 👈 全く同じ
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this._onMouseMove); // 👈 全く同じ
  }

  render() {
    // ここだけが違う
    return h('div', {
      style: `position:fixed; left:${this.state.x}px; top:${this.state.y}px;
              width:30px; height:30px; border-radius:50%; background:#0066cc;
              transform:translate(-50%,-50%); pointer-events:none;`
    }, []);
  }
}
```

**🐼**：二つのコンポーネントの中の `constructor` 、 `componentDidMount` 、 `componentWillUnmount` がほぼ一字一句同じです。違うのは `render()` だけ。もし将来、マウス追跡のロジックを変えたい——例えばスロットリング (throttle) を入れたいとなったら、 **二箇所** 直さなければなりません。マウスを追跡したいコンポーネントが10個あったら、 **ほぼ同じコードが10個** も存在することになります。

**🧙‍♂️**：痛みを感じ始めたな。プログラミングにおいて、これは **DRY 原則 (Don't Repeat Yourself)** の違反と呼ばれる。同じロジックが複数の場所に散らばっていると、コンポーネントの数に比例してメンテナンスコストが増大していくのだ。

**🐼**：なら、マウス追跡のロジックを抜き出して、一つの「機能モジュール」のようにして、どんなコンポーネントでも使えるようにできないでしょうか？

**🧙‍♂️**：それこそが React コミュニティが10年にわたって探求し続けてきた問いだ。クラスコンポーネントの時代、人々はそれを解決するために三つの異なるパターンを発明した。後のものほど洗練されているが、それぞれに欠点もある。一つずつ体験してみよう。

## 8.2 Mixins：ロジックを混ぜ込む (2013-2015)

**🧙‍♂️**：React の最初期、 `React.createClass` を使っていた頃には **Mixin** という概念があった。その発想は非常に素朴だ——複数のコンポーネントで同じロジックが必要なら、そのロジックを一つのオブジェクトにまとめ、各コンポーネントに「混ぜ込む (mix in)」というものだ。

**🐼**：「混ぜ込む」とはどういう意味ですか？

**🧙‍♂️**： **「コピペ」をフレームワークが自動で行ってくれる** と考えればいい。お前が `mixins: [MouseMixin]` と書くと、 `React.createClass` は `MouseMixin` オブジェクトにあるすべてのメソッド—— `getInitialState` 、 `componentDidMount` 、 `_onMouseMove` など——を、 **お前のコンポーネントにマージしてくれる**。まるでお前が自分でそれらをコンポーネントに書いたかのように動作するのだ。

単純に例えるならこうだ：

```javascript
// Mixin の本質 ≈ オブジェクトの属性をコンポーネントにマージすること
Object.assign(YourComponent.prototype, MouseMixin);
// その後、YourComponent は MouseMixin のすべてのメソッドを持つことになる
```

実際の Mixin は以下のようだった：

```javascript
// 初期の React.createClass の Mixin (現在は廃止)
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

使うときは、 `mixins` 配列に並べるだけだ：

```javascript
const MouseTracker = React.createClass({
  mixins: [MouseMixin],  // フレームワークが MouseMixin の全メソッドを自動で「混ぜ込む」
  render: function() {
    // ここで直接 this.state.x と this.state.y が使える
    // それらは MouseMixin の getInitialState から提供されたものだ
    return h('p', null, ['Position: ' + this.state.x + ', ' + this.state.y]);
  }
});
```

**🐼**：なるほど！ `MouseTracker` 自身は `componentDidMount` を書いていませんが、 `MouseMixin` が混ぜ込まれたことでその `componentDidMount` を「継承」し、フレームワークがマウント時に自動で呼んでくれるわけですね。これでマウス追跡のコードを手動で各コンポーネントにコピペしなくて済みます。

**🧙‍♂️**：そうだ。便利に見えるが、Mixin には致命的な欠点がある。仮に二つの Mixin を同時に混ぜ込んだとしよう。どちらも `this.state.x` を定義していたら——一つはマウス座標、もう一つはスクロール位置だ。何が起こると思う？

**🐼**：ええと……後から混ぜ込まれた方が前の方を上書きしてしまう？ そうなると、片方の機能が完全に壊れてしまいますね！ これが **名前の衝突** ですね。

**🧙‍♂️**：そうだ。次に **隠れた依存関係** だ。コンポーネントの中に突如として `this.state.x` が現れるが、コンポーネント自身では定義していない。コードを読む人はそれがどこから来たのか分からず、すべての Mixin のソースコードを漁る羽目になる。

**🐼**：確かに、一つのコンポーネントが5つの Mixin を使っていたら、問題を探すのは砂漠で針を探すようなものです。それにすべてのメソッドが同じ `this` に詰め込まれて、めちゃくちゃになりそうです。

**🧙‍♂️**：それを **雪だるま式** 効果と呼ぶ。これらの問題があるため、後に React 公式は有名なブログ記事 [『Mixins Considered Harmful (Mixin は有害と見なされる)』](https://legacy.reactjs.org/blog/2016/07/13/mixins-considered-harmful.html) を発表し、ES6 Class の時代に Mixin を廃止したのだ。



## 8.3 高階コンポーネント：コンポーネントを関数で包む (2015-2018)

**🧙‍♂️**：Mixin がダメならと、賢い開発者たちは別の方法を考え出した。 **コンポーネントを受け取り、新しい「強化された」コンポーネントを返す関数** を使うのだ。これが **高階コンポーネント (Higher-Order Component, HOC)** だ。

```javascript
function withMouse(WrappedComponent) {
  // 新しいコンポーネントクラスを返す
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
      // マウスの位置を props としてラップされたコンポーネントに渡す
      return h(WrappedComponent, {
        ...this.props, // ⚠️ 注意：オブジェクトスプレッド構文 ({ ...obj }) は ES2018 の機能
        mouse: { x: this.state.x, y: this.state.y }
      }, []);
    }
  };
}

// 使用例
class RawDisplay extends Component {
  render() {
    return h('p', null, [
      'Mouse: ' + this.props.mouse.x + ', ' + this.props.mouse.y
    ]);
  }
}

// 強化されたコンポーネント
const MouseDisplay = withMouse(RawDisplay);
```

**🐼**：これは Mixin よりずっといいですね！ 状態は `withMouse` 関数内部のコンポーネントにカプセル化され、props を通じてターゲットのコンポーネントに渡されます。これならターゲットコンポーネントの `this` を直接汚染することはありません。

**🧙‍♂️**：そうだ。だが、もしお前のコンポーネントがマウス追跡だけでなく、ウィンドウサイズ、ユーザー情報、テーマカラーも必要だとしたら？ どう書く？

**🐼**：何層も包むことになりますね。例えば `withMouse(withWindowSize(withUser(withTheme(MyComponent))))` のように。

**🧙‍♂️**：その通りだ。だがそれは **Wrapper Hell (ラッパー地獄)** を引き起こす。開発者ツールで見ると、コンポーネントツリーはタマネギの皮のように何層にも重なっている： `<WithTheme><WithUser><WithWindowSize>...` とな。それだけでなく、Props の衝突問題も依然として残っている。

**🐼**：あっ！ もし `withMouse` が `data` という props を渡し、 `withUser` も `data` という props を渡そうとしたら、やっぱり後の方が前の方を上書きしてしまいますね！

**🧙‍♂️**：そうだ。さらにコードの可読性も悪い。 `MyComponent` のコードだけを見ても、最終的にどんな Props が送られてくるのか全く分からない。外側のラッパーがそれぞれ勝手にデータを注入してくる可能性があるからだ。

## 8.4 Render Props：レンダリングの権利を呼び出し側に委ねる (2017+)

**🧙‍♂️**：HOC の欠点を避けるために、コミュニティはまた新しいパターンを発明した。 **Render Props** だ。その発想は、ユーザーに「レンダリング関数」を渡させ、データの表示方法を外部から制御できるようにする、というものだ。

```javascript
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
    // ユーザーから渡されたレンダリング関数を呼び出し、データを渡す
    return this.props.render(this.state);
  }
}

// 使用例
// h(Mouse, { render: (mouse) => h('p', null, [`Position: ${mouse.x}, ${mouse.y}`]) })
```

**🐼**：これなら使う場所で柔軟に対応できますね。どうやってデータを表示するかを自由に決められます。

**🧙‍♂️**：だが、複数の Render Props を組み合わせる場合はどうなる？

```jsx
// JSX で書いた場合を想像してみろ
<Mouse render={mouse => (
  <WindowSize render={size => (
    <Theme render={theme => (
      <MyComponent mouse={mouse} size={size} theme={theme} />
    )} />
  )} />
)} />
```

**🐼**：なんてこった、これは **Callback Hell (コールバック地獄)** ですね！

**🧙‍♂️**：そうだ。入れ子が深くなるだけでなく、Render Props には隠れた欠点がある。 **パフォーマンスの問題（名無し関数による不要な再レンダリング）** だ。

**🐼**：パフォーマンスの問題？

**🧙‍♂️**：そうだ。もし `render` の中で直接匿名関数を Render Prop として定義すると、親コンポーネントがレンダリングされるたびに、全く新しい関数への参照が作成されることになる。

**🐼**：わかりました！ そうなると、データが変わっていなくても、prop の中の関数の参照が変わってしまうため、子コンポーネントの浅い比較 (Shallow Compare) が効かなくなり、無意味な再レンダリングが繰り返されるわけですね！

**🧙‍♂️**：正解だ。つまり HOC にしろ Render Props にしろ、どのパターンにもそれぞれの限界があるのだ。

## 8.5 比較一覧

| パターン | 長所 | 短所 |
|:-----|:-----|:-----|
| **Mixins** | シンプルで直感的 | 名前の衝突、隠れた依存関係、廃止済み |
| **HOCs** | 合成が柔軟、名前の衝突なし | ラッパー地獄、Props 衝突、デバッグ困難 |
| **Render Props** | 使用時の柔軟性、データ流が明確 | コールバック地獄、入れ子が深い、匿名関数によるパフォーマンス悪化 |

**🐼**：師父、後の二つのパターンはそれぞれ違いますが、どちらにも共通する「違和感」がある気がします。単に「振る舞い」を再利用したいだけなのに、コンポーネントの階層構造をどんどん複雑にしなければならない、という点です。

**🧙‍♂️**：核心を突いたな。私たちはこれまでずっと、「構造」（コンポーネントの積み重ね）を使って「振る舞い」（ロジックの再利用）を解決しようとしてきた。
もし、コンポーネントの階層構造を変えることなく、直接「振る舞い」をコンポーネントに注入できる方法があるとしたら、どう思う？

**🐼**：それって Mixin の考え方ですよね？ でも Mixin には問題があることが証明済みですし……。

**🧙‍♂️**：Mixin の問題は「隠蔽」と「混乱」にあった。だが、Mixin のように直接ロジックを取り入れつつ、関数呼び出しのように **明示的** で **合成可能** で、 `this` に依存せず、名前の衝突も起きない仕組みがあるとしたら？

**🐼**：それは……それぞれの振る舞いが一つの関数呼び出しのようになっていて、コンポーネントの中で直接それを「呼び出す」……普通の JavaScript 関数のようにですか？

**🧙‍♂️**：お前は今、新しい世界への扉を開こうとしている。それこそが **Hooks** の核心思想だ。

**🐼**：なら、さっそく今のエンジンにそれを実装しましょう！

**🧙‍♂️**：残念ながら、現在のエンジン（Stack Reconciler）では **その設計を支えきれん**。考えてみろ。もし単なる普通の関数コンポーネントだとしたら、関数が実行し終わった瞬間に内部の状態は消えてしまう。関数には「記憶」がないのだ。

**🐼**：あっ、そうか……。今のエンジンはただ死物のように同期的に `render()` を再帰呼び出ししているだけで、関数コンポーネントの状態を保存しておく場所がありませんね。

**🧙‍♂️**：ふむ。 その問題を解決する方法は、この後に考えていくことにしよう。

---

### 📦 やってみよう

以下のコードを `ch08.html` として保存しよう。 Mini-React において HOC と Render Props がどのように動作するかを完全に示している：

```html
<!DOCTYPE html>
<html lang="ja">
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
    // === Mini-React Engine (累積) ===
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

    // === HOC パターン：withMouse ===
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

    // HOC を通じてマウスデータを使用する表示コンポーネント
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

    // === Render Props パターン：Mouse ===
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
        // 現在の状態を引数に、ユーザーから渡されたレンダリング関数を呼び出す
        return this.props.render(this.state);
      }
    }

    // === App ===
    const appVNode = h('div', null, [
      h('h1', null, ['Patterns of Reuse']),
      h('p', null, ['マウスを動かして、両方のパターンが動作しているのを確認してください。']),
      
      // HOC バージョン
      h(MouseDisplay, null),
      
      // Render Props バージョン
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
