# 第六章：コンポーネントと合成 (Components & Composition)

![figure 6.1](../../website/public/images/ch06_components.png)

## 6.1 巨大な `render` を分割する

ポーは Mini-React で書かれたコードを眺めていた。 `render` 関数は巨大な VNode ツリーを返し、すべての画面要素が混ざり合っている。

**🐼**：師父、今の `render` 関数はどんどん大きくなっています。ナビゲーションバー、サイドバー、コンテンツエリアを含むような複雑なページを作ろうとすると、この関数は何百行もの巨大な塊になってしまい、修正のたびに中を探し回らなければなりません。

**🧙‍♂️**：もし、異なる「UI ブロック」を個別に切り出し、それ自体にレンダリングロジックを管理させて、必要な場所にはめ込むことができたらどうなると思う？

**🐼**：それなら、異なる UI 部分を独立した関数やクラスに分割して、積み木のように組み立てることができますね。

**🧙‍♂️**：その通りだ。React の核心的な設計理念の一つは、UI を技術的な種類ではなく **機能的な関心事** ごとに整理することだ。ボタンの構造、スタイル、振る舞いは、それぞれ HTML、CSS、JavaScript だが、それらは一つのことを処理している。それらをバラバラのファイルに置くよりも、一箇所にまとめる方が合理的だ。

## 6.2 コンポーネントの姿

**🧙‍♂️**：ページを複数の独立したコンポーネントに分割したと仮定しよう。期待される組み合わせ方は、以下のようになるはずだ：

```javascript
function renderApp() {
  return h('div', { id: 'app' }, [
    h(Header, { title: 'マイタスクリスト' }),
    h(TodoList, null, [
      h(TodoItem, { text: 'Learn JavaScript', done: true }),
      h(TodoItem, { text: 'Build Mini-React', done: false })
    ]),
    h(Footer, null)
  ]);
}
```

**🐼**：ちょっと待ってください！ `h()` 関数の第一引数 `tag` は、これまでは HTML タグを表す文字列（例えば `'div'`）を渡してきましたよね。でもここでは、 `Header` や `TodoItem` はクラスや関数そのものですか？

**🧙‍♂️**：そうだ。生の HTML 要素を使うのと同じように、独自のコンポーネントを対等に入れ子にしたり組み合わせたりできる。これは、いつでも新しい「HTML タグ」を創造できるのと同義だ。

**🐼**：でも、私たちのエンジンの底レイヤーは、今のところこれらの「カスタムタグ」を認識できません。 `tag` が文字列でないノードに遭遇したら、 `mount` や `patch` は間違いなくエラーを出すでしょう。

**🧙‍♂️**：それが、私たちが次に解決すべき問題だ。

> 💡 **JSX のヒント**：実際の React プロジェクトでは、JSX を使って `<TodoItem text="Buy Milk" />` と書くだろう。これはコンパイラによって `React.createElement(TodoItem, { text: 'Buy Milk' })` に変換される。つまり、私たちの `h(TodoItem, { text: 'Buy Milk' })` と同じことだ。

## 6.3 エンジンのアップグレード

**🧙‍♂️**：エンジンにコンポーネントを認識させるために、まずは「コンポーネント」とは何かを定義しよう。本質的に、コンポーネントとは独自のレンダリングロジックを持つクラスだ。

```javascript
class Component {
  constructor(props) {
    this.props = props || {};
  }

  render() {
    throw new Error('Component must implement render()');
  }
}
```

**🐼**：この基底クラスがあれば、それを継承して UI コンポーネントを書くことができますね。クラスの本質は関数ですから、 `h()` にコンポーネントクラスを渡すと、 `vnode.tag` の型は `'function'` になります。エンジンはこれを利用して、普通の HTML ノードとコンポーネントノードを区別できるわけですね。

![figure 6.2](../../website/public/images/figure_6_2.png)

### `mount` のアップグレード

**🧙‍♂️**： `mount` の中で、もし `vnode.tag` が `'function'` だったら、どうやってレンダリングすべきだと思う？

**🐼**： `new` を使ってインスタンス化し、同時に `vnode.props` をコンストラクタに渡す必要がありますね。インスタンスができれば、その `render()` メソッドを呼び出して VNode の子ツリーを取得できます。あとは再帰的に `mount` を呼び出して、その子ツリーをページにマウントすればいい。

**🧙‍♂️**：筋道は通っている。だがマウント時には、将来の更新（ `patch` ）に備えておく必要がある。もし後で `patch` がこのコンポーネントを更新する場合、どのような情報が必要になると思う？

**🐼**：うーん……まずはこのコンポーネントのインスタンスですね。そうすれば props を更新して再び `render()` を呼び出せます。次に、新しい子ツリーと比較するための古い VNode 子ツリーも必要です。

**🧙‍♂️**：その通り。インスタンスを `vnode._instance` に、古い子ツリーを `instance._vnode` に保存しておけばいい。最後に、 `patch` が実際の DOM を操作するときに必要となるあの架け橋、 `vnode.el` を忘れてはならん。

**🐼**：でも、普通のノードには自身の DOM 要素がありますが、コンポーネント自体は単なるロジックで、対応する実際の DOM タグは持っていませんよね？

**🧙‍♂️**：考えてみろ。コンポーネントがページ上で占める物理的な位置は、何によって決まる？

**🐼**：内部でレンダリングされた子ツリーによって決まります！ だから、コンポーネントの `vnode.el` は、その子ツリーのルートノードの DOM を借りてくればいいのですね。

**🧙‍♂️**：正解だ。そのロジックをコードにしてみろ。

```javascript
  function mount(vnode, container) {
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      container.appendChild(document.createTextNode(vnode));
      return;
    }

    // コンポーネントノードの処理
    if (typeof vnode.tag === 'function') {
      const instance = new vnode.tag(vnode.props); // コンポーネントをインスタンス化
      vnode._instance = instance;                  // インスタンスを保存
      const subTree = instance.render();           // 内部の VNode 子ツリーを取得
      instance._vnode = subTree;                   // 旧子ツリーを保存
      mount(subTree, container);                   // 子ツリーを再帰的にマウント
      vnode.el = subTree.el;                       // 子ツリーの DOM を自分の位置識別用として借りる
      return;
    }

    // 普通の HTML タグノードのマウントロジック（前章と同じ）
    // ...
  }
```

### `patch` のアップグレード

**🧙‍♂️**：次は更新の処理だ。 `patch` が二つのコンポーネントノードに遭遇したとき、もし新旧ノードの `tag` が同じコンポーネントクラスでなければ（例えば `TodoItem` が `Header` に変わったら）、全く異なるノードと見なして、既存のロジックで置換する。前後で同じコンポーネントクラスなら、どう更新する？

**🐼**：さっき `mount` で構築した構造を再利用できます：
1. `oldVNode` から旧インスタンスを取得し（ `const instance = oldVNode._instance` ）、 `newVNode` に引き継いで再利用します。
2. インスタンスの属性をリフレッシュします： `instance.props = newVNode.props` 。
3. 更新されたインスタンスで再び `render()` を呼び出し、新しい VNode 子ツリーを取得します。
4. `instance._vnode` から旧子ツリーを取得し、新旧の子ツリーを `patch` に渡して再帰的に処理させます。

**🧙‍♂️**：そうだ。コンポーネントの更新メカニズムは、巧妙に更新作業を底レイヤーの `patch` ロジックへと委ねているのだ。

```javascript
  function patch(oldVNode, newVNode) {
    // コンポーネントノードの処理
    if (typeof newVNode.tag === 'function') {
      if (oldVNode.tag === newVNode.tag) {
        // 同一タイプのコンポーネント：インスタンスを再利用し、props を更新して再描画
        const instance = (newVNode._instance = oldVNode._instance);
        instance.props = newVNode.props;
        const oldSubTree = instance._vnode;
        const newSubTree = instance.render();
        instance._vnode = newSubTree;
        patch(oldSubTree, newSubTree);  // 底レイヤーの処理に再帰的に委ねる
        newVNode.el = newSubTree.el;
      } else {
        // 異なるタイプのコンポーネント：直接置換
        const parent = oldVNode.el.parentNode;
        mount(newVNode, parent);
        parent.replaceChild(newVNode.el, oldVNode.el);
      }
      return;
    }

    // ---- 普通の HTML ノードを処理するロジック（前章と同じ） ----
    // ...
  }
```

![figure 6.3](../../website/public/images/figure_6_3.png)

## 6.4 Props：コンポーネント間の架け橋

**🧙‍♂️**：さて、挨拶を表示する `Greeting` コンポーネントを作りたいとしよう：

```javascript
class Greeting extends Component {
  render() {
    return h('h2', null, ['Hello, Alice!']);
  }
}
```

**🧙‍♂️**：もしページ上で同時に Alice と Bob に挨拶したい場合、このコンポーネントをどうやって再利用する？

**🐼**：コンポーネントを作成するときに、関数を呼び出すときに引数を渡すのと同じように、外から名前を渡せるようにする必要があります。

**🧙‍♂️**：そうだ。その「コンポーネントへの引数」を **Props (Properties)** と呼ぶ。

```javascript
class Greeting extends Component {
  render() {
    return h('h2', null, ['Hello, ' + this.props.name + '!']);
  }
}

h(Greeting, { name: 'Alice' })  // → Hello, Alice!
h(Greeting, { name: 'Bob' })    // → Hello, Bob!
```

**🐼**： `h(Greeting, { name: 'Alice' })` という書き方は、 HTML ノードを書くときの `h('div', { id: 'app' })` と全く同じですね。HTML タグに対しては第二引数は DOM 属性になり、コンポーネントに対しては Props になるわけですね。

**🧙‍♂️**：その通りだ。 Props には二つの鉄則がある：
1. **読み取り専用 (Read-only)**： コンポーネントは Props を変更してはならない。関数が渡された引数を変更すべきでないのと同じだ。
2. **データは下へと流れる (Data flows down)**： データは親コンポーネントから子コンポーネントへと流れ、その逆はない。

**🐼**：もし子コンポーネントの中に削除ボタンがあって、クリックされたときに子コンポーネントが親コンポーネントに通知したい場合はどうするのですか？

**🧙‍♂️**：文字列や数値以外に、JavaScript においてオブジェクトの属性として渡せるものは何だ？

**🐼**：関数です！ 親コンポーネントが Props を通じてコールバック関数を子コンポーネントに渡し、子コンポーネントがクリックされたときにそれを呼び出すということですね。

**🧙‍♂️**：そうだ。それが **コールバック関数 (Callback)** だ。

```javascript
// 親コンポーネント
class TodoApp extends Component {
  render() {
    return h('div', null, [
      h(TodoItem, { 
        text: 'Buy Milk', 
        onDelete: () => { console.log('Item deleted!'); }  // 👈 コールバックを下へ渡す
      })
    ]);
  }
}

// 子コンポーネント
class TodoItem extends Component {
  render() {
    return h('li', null, [
      this.props.text,
      h('button', { 
        onclick: this.props.onDelete  // 👈 トリガーされたらコールバックを呼ぶ
      }, ['Delete'])
    ]);
  }
}
```

**🐼**：データは Props を通じて下へ流れ、イベントはコールバック関数を通じて上へバブリングする。これにより、データの流れる方向が常に追跡可能になるのですね。

## 6.5 継承より合成

**🧙‍♂️**：注意してほしいのだが、コンポーネントを再利用するために継承は使っていない。 `TodoApp` は `TodoItem` を継承しておらず、それらは **合成 (Composition)** によって組み立てられている。これは React のもう一つの核心理念だ：**継承より合成**。

**🐼**：コンポーネントは、 `div` が他の要素を含めるように、他のコンポーネントを内部のコンテンツとして受け取ることができますか？

**🧙‍♂️**：すべての属性が Props を通じて渡される以上、どんな属性を使って子要素を渡すことができると思う？

**🐼**： `children` のような特別な属性を約束事にして、それをコンポーネント内部でレンダリングするようにすればいいですね：

```javascript
class Card extends Component {
  render() {
    // レンダリング時に、渡された children を自分の子ノードとして扱う
    return h('div', { className: 'card' }, this.props.children);
  }
}

h(Card, { children: [
  h('h2', null, ['タイトル']),
  h('p', null, ['どんな内容でも入れられます！'])
]})
```

**🧙‍♂️**：そうだ。 `Card` のようなラッパーコンポーネントは器を提供することだけを担当し、中身が何であるかを知る必要はない。実際の React では、JSX が入れ子になった内容を自動的に `props.children` に流し込んでくれる。

## 6.6 パズルは半分完成した

**🐼**：全体の姿が見えてきました。エンジンは「コンポーネント」という概念を全く知らず、ただ VNode だけを知っているのですね。 `mount` と `patch` が関数型の `tag` に遭遇したときに、自動的にコンポーネントをエンジンが処理できる VNode 子ツリーへと「翻訳」しているだけだ、と。

**🧙‍♂️**：その通り。コンポーネントは人間が読むための抽象化であり、VNode こそがエンジンが実際に解釈する言語だ。今日お前が構築したこの仕組みは、すでに React のコンポーネントツリーの動作ロジックを支えている。だが、気づいたことはないか？ 私たちのコンポーネントには今、ある限界がある。それは、外部から渡された Props にしか依存できないという点だ。レンダリングのたびに、コンポーネントは真っ白な紙のような状態だ。

**🐼**：コンポーネント自身が状態を持っていないということですか？

**🧙‍♂️**：そうだ。もしボタンが「自分が何回クリックされたか」を覚えておく必要があるとしたら、今のコンポーネントにはそれができない。次回のレッスンでは、コンポーネントに「記憶」を授けよう。それが React の **State (状態)** と **ライフサイクル** へと繋がっていく。

---

### 📦 やってみよう

以下のコードを `ch06.html` として保存しよう。コンポーネントのマウント、Props の伝達、そして親子コンポーネント間の通信を確認できる：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 6 — Components & Composition</title>
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
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    // === Mini-React Engine (第五章までの累積 + 本章のアップグレード) ===

    function h(tag, props, children) {
      return { tag, props: props || {}, children: children || [] };
    }

    class Component {
      constructor(props) { this.props = props || {}; }
      render() { throw new Error('Component must implement render()'); }
    }

    function mount(vnode, container) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        container.appendChild(document.createTextNode(vnode));
        return;
      }
      // 🆕 コンポーネントノード
      if (typeof vnode.tag === 'function') {
        const instance = new vnode.tag(vnode.props);
        vnode._instance = instance;
        const subTree = instance.render();
        instance._vnode = subTree;
        mount(subTree, container);
        vnode.el = subTree.el;
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
          if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
          } else {
            mount(child, el);
          }
        });
      }
      container.appendChild(el);
    }

    function patch(oldVNode, newVNode) {
      // 🆕 コンポーネントノード
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
      const oldProps = oldVNode.props || {};
      const newProps = newVNode.props || {};
      for (const key in newProps) {
        if (oldProps[key] !== newProps[key]) {
          if (key.startsWith('on')) {
            const evt = key.slice(2).toLowerCase();
            if (oldProps[key]) el.removeEventListener(evt, oldProps[key]);
            el.addEventListener(evt, newProps[key]);
          } else {
            if (key === 'className') el.setAttribute('class', newProps[key]);
            else if (key === 'style' && typeof newProps[key] === 'string') el.style.cssText = newProps[key];
            else el.setAttribute(key, newProps[key]);
          }
        }
      }
      for (const key in oldProps) {
        if (!(key in newProps)) {
          if (key.startsWith('on')) el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
          else if (key === 'className') el.removeAttribute('class');
          else if (key === 'style') el.style.cssText = '';
          else el.removeAttribute(key);
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

    // === アプリコンポーネント ===

    // 子コンポーネント：TodoItem
    class TodoItem extends Component {
      render() {
        return h('li', this.props.done ? { className: 'done' } : null, [
          h('div', { className: 'task-content' }, [
            h('input', Object.assign({ type: 'checkbox', onchange: this.props.onToggle }, this.props.done ? { checked: true } : {})),
            h('span', null, [this.props.text])
          ]),
          h('button', { className: 'delete-btn', onclick: this.props.onDelete }, ['×'])
        ]);
      }
    }

    // 親コンポーネント：App
    let state = {
      todos: [
        { text: 'Learn JavaScript', done: true },
        { text: 'Build Mini-React', done: false },
        { text: 'Understand Components', done: false }
      ]
    };

    function renderApp(state) {
      const doneCount = state.todos.filter(t => t.done).length;
      return h('div', { className: 'card' }, [
        h('h3', null, ['My Todo List (Components)']),
        h('p', { id: 'stats' }, [`完了 ${doneCount} / 合計 ${state.todos.length} 件`]),
        h('ul', { style: 'padding-left: 0; margin-bottom: 0;' },
          state.todos.map((todo, i) =>
            h(TodoItem, {
              text: todo.text,
              done: todo.done,
              onToggle: () => { todo.done = !todo.done; update(); },
              onDelete: () => { state.todos = state.todos.filter((_, idx) => idx !== i); update(); }
            })
          )
        )
      ]);
    }

    let prevVNode = null;
    function update() {
      const newVNode = renderApp(state);
      if (!prevVNode) {
        mount(newVNode, document.getElementById('app'));
      } else {
        patch(prevVNode, newVNode);
      }
      prevVNode = newVNode;
    }

    update();
  </script>
</body>
</html>
```
