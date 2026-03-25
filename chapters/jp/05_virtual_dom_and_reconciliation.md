# 第五章：仮想 DOM と調整 (Virtual DOM & Reconciliation)

![figure 5.1](../../website/public/images/ch05_virtual_dom.png)

## 5.1 全体的なメンタルモデル

ポーは前回のレッスンで生成された `vdom` オブジェクトを眺めながら、考え込んでいた。

**🐼**：師父、 `UI = f(state)` という理念が美しいことは認めます。ですが、状態が変わるたびに新しいノードツリーを丸ごと生成して、さらに差分を比較するなんて、DOM を直接操作するよりも遅くなるのではないでしょうか？

**🧙‍♂️**：それはよくある疑問だ。ポーよ、ブラウザにおいて、 `div` 要素（実際の DOM）を作成するのと、普通の JavaScript オブジェクト（仮想 DOM）を作成するのとでは、どちらのコストが大きいと思う？

**🐼**：実際の DOM の方でしょうね。ブラウザのあらゆる属性、スタイル、イベントリスナー、そしてレイアウト計算を背負っていますから。

**🧙‍♂️**：その通りだ。実際の DOM ノードは一つ一つが極めて巨大だが、JavaScript オブジェクトは非常に軽量だ。仮想 DOM (Virtual DOM) とは、実際の DOM を軽量に記述したものに過ぎん。巨大な DOM ツリーを丸ごと破壊して再構築するよりも、JavaScript の中で二つの軽量なオブジェクトの差分を比較し、その結果に基づいて実際の DOM を「正確に」更新する方が、かえって効率的なのだ。

**🐼**：計算とレンダリングの分離というわけですね。ですが、コードの詳細に入る前に、システム全体がどのように動くのか教えていただけますか？

**🧙‍♂️**：いいだろう。仮想 DOM を動かすには、三つの核心的なメカニズムが必要だ。推論してみろ。 `state` があるとき、まず最初に何をすべきだ？

**🐼**： `state` をあの軽量な JavaScript オブジェクトツリーに変換する関数が必要ですね。それを `render` と呼びましょう。

**🧙‍♂️**：よろしい。仮想 DOM ツリーを手に入れたら、次は？

**🐼**：もしそれがページの最初の読み込みなら、その仮想ツリーを実際の DOM に「翻訳」して、ページにマウントする必要があります。このプロセスは `mount` と呼べますね。

**🧙‍♂️**：続けろ。では、ユーザーがボタンをクリックして `state` が変わったときは？

**🐼**：もう一度 `render` を呼び出して **新しい** 仮想 DOM ツリーを生成します。そして、**新ツリー** と **旧ツリー** の差分を比較し、その差分だけを既存の実際の DOM に適用する関数が必要です。これは `patch` と呼ぶべきでしょう。

**🧙‍♂️**：その通り。これが React が動作する全体的なメンタルモデルだ：

```javascript
// --- 1. VDOM をどう生成するか定義する ---
function render(state) {
  // UI を記述する JavaScript オブジェクトを返す
}

// --- 2. 初期化 ---
let state = { count: 0 };
let prevVNode = render(state);                        // 初代仮想 DOM ツリーを生成
mount(prevVNode, document.getElementById('app'));     // 実際の DOM にマウント

// --- 3. 状態更新 ---
function update() {
  state.count++;
  const newVNode = render(state);   // 新しい仮想 DOM ツリーを生成
  patch(prevVNode, newVNode);       // 新旧の差分を比較し、実際の DOM を正確に更新
  prevVNode = newVNode;             // 新しいツリーを次回の比較の基準にする
}
```

**🐼**：全容が見えました。 `render` が UI を記述し、 `mount` が初回作成を担当し、 `patch` が効率的な更新を担うのですね。

---

## 5.2 UI を記述する：`h` 関数

**🧙‍♂️**：まず第一歩を実装しよう。仮想ノードを素早く構築するためのヘルパー関数が必要だ。コミュニティでは一般的に `h` (Hyperscript) や `createElement` と呼ばれている。

**🐼**：それはあの軽量な JavaScript オブジェクトを返すためのものですよね？

```javascript
function h(tag, props, children) {
  return {
    tag,
    props: props || {},
    children: children || []
  };
}

// これを使って VDOM ツリーを構築する
const vnode = h('div', { id: 'app' }, [
  h('h1', null, ['Hello World']),
  h('p',  null, ['This is a VNode'])
]);
```

**🧙‍♂️**：そうだ。二つのルールに注意しろ：第一に、 `children` は常に **配列** であること。第二に、配列の要素は文字列（テキストノード）か、別の VNode オブジェクトであることだ。

> 💡 **JSX の予告**：この `h()` 関数こそが JSX コンパイルの到達点だ。React で `<button onClick={fn}>Add</button>` と書くと、コンパイラ（Babel など）はそれを `React.createElement('button', { onClick: fn }, 'Add')` に変換する。核心となる原理は我々の `h` と全く同じだ。

---

## 5.3 初回レンダリング：`mount` 関数

**🧙‍♂️**：仮想 DOM ツリーができたら、 `mount` 関数を実装する必要がある。例えば `h('h1', { id: 'title' }, ['Hello'])` を受け取ったとき、それを実際の DOM にするためにどのような手順が必要だと思う？

**🐼**：ええと……
1. まず `tag` に基づいて空の `<h1>` タグを作成します。
2. 次に `props` をループして、 `id="title"` をタグに設定します。
3. 続いて `children` を処理します。中身が文字列 `'Hello'` なので、テキストを差し込みます。もし子ノードが別の VNode なら、再帰的に `mount` を呼び出します。
4. 最後に、作成した実際の DOM ノードをページのコンテナに追加します。

**🧙‍♂️**：その通りだ。コードを見てみよう。非常に重要な一行に注目しろ。作成した実際の DOM ノードを VNode オブジェクトに保持させている。

```javascript
function mount(vnode, container) {
  // テキストノードの処理（文字列または数値なら直接テキストを作成）
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    container.appendChild(document.createTextNode(vnode));
    return;
  }

  // ステップ 1：実際の DOM 要素を作成
  // 重要な架け橋：実際の DOM ノードを vnode.el に保存する
  const el = (vnode.el = document.createElement(vnode.tag));

  // ステップ 2：プロパティ (Props) の処理
  for (const key in vnode.props) {
    if (key.startsWith('on')) {
      // イベントリスナー：onclick → click
      el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
    } else if (key === 'className') {
      // React は class の代わりに className を使う
      el.setAttribute('class', vnode.props[key]);
    } else if (key === 'style' && typeof vnode.props[key] === 'string') {
      el.style.cssText = vnode.props[key];
    } else {
      el.setAttribute(key, vnode.props[key]);
    }
  }

  // ステップ 3：子ノードを再帰的に処理
  if (typeof vnode.children === 'string') {
    el.textContent = vnode.children;
  } else {
    vnode.children.forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(child));
      } else {
        mount(child, el); // 子 VNode を再帰的にマウント
      }
    });
  }

  // ステップ 4：コンテナに追加
  container.appendChild(el);
}
```

**🐼**：なぜ実際の DOM ノードを `vnode.el` に保存しておく必要があるのですか？

**🧙‍♂️**：仮想 DOM は単なる記述用のオブジェクトであり、それ自体ではページを変更できないからだ。 `patch` を実行して新旧の VNode を比較したとき、差分が見つかれば、**具体的にどの実際の DOM ノード** を修正すべきかを知る必要がある。 `vnode.el` は仮想世界から現実世界への **唯一の架け橋** なのだ。

---

## 5.4 調整 (Reconciliation) と Diff アルゴリズム

**🧙‍♂️**：さて、核心部分である `patch` 関数だ。状態の変化によって新しい VNode ツリーが生成されたとき、最小限の DOM 操作で新旧の差分を同期させるにはどうすればいい？ このプロセスを **調整 (Reconciliation)** と呼び、差分を探すアルゴリズムを **Diff** と呼ぶ。

**🐼**：もし非常に深くて複雑なツリーがあったら、すべてのノードのすべてのプロパティを全量比較するのは、パフォーマンスが悪くなりませんか？

**🧙‍♂️**：その通りだ。伝統的なツリー比較アルゴリズムの時間計算量は O(n³) だ。React はある経験的な仮説を導入した。もし二つのノードの `tag` タイプが異なれば（例えば `div` が `p` に変われば）、React はそれらの内部構造も完全に変わったと見なし、古いノードを破棄して新しいノードを再構築する。深追いはしない。これにより、計算量を一気に O(n) まで下げたのだ。

**🐼**：もし `tag` が同じだったら？

**🧙‍♂️**：その場合は既存の DOM ノードを再利用し、変更されたプロパティ (Props) だけを更新する。それから、それらの子ノードを再帰的に比較していくのだ。

下のフローチャートは、 `patch` の核心的な意思決定プロセスを示している：

![figure 5.4](../../website/public/images/figure_5_4.png)

### ステップ 1：ノードタイプの変更

**🐼**：タグが違う場合、例えば `h('h1', ...)` が `h('p', ...)` に変わった場合は、おっしゃる通り、ノード全体を直接置き換えるのですね。

**🧙‍♂️**：そうだ。古いノードの親要素を見つけ、新しいノードで置き換える必要がある。新しい VNode にはまだ実際の DOM ノードがないので、一時的なコンテナを使って `mount` させることで生成できる。

```javascript
function patch(oldVNode, newVNode) {
  // 1. ノードタイプが異なる：直接置き換え
  if (oldVNode.tag !== newVNode.tag) {
    const parent = oldVNode.el.parentNode;

    // 一時的なコンテナを使って mount し、newVNode.el を生成
    const tempContainer = document.createElement('div');
    mount(newVNode, tempContainer);

    // 古いノードを新しいノードで置換
    parent.replaceChild(newVNode.el, oldVNode.el);
    return;
  }

  // ...
}
```

### ステップ 2：DOM の再利用と属性の更新

**🐼**：タグが同じなら、実際の DOM を再利用できるということですね。 `oldVNode.el` にある実際の DOM の参照を `newVNode.el` に引き継ぎ、それから `props` を比較します。

**🧙‍♂️**：正しいロジックだ。コードにしてみろ。

```javascript
  // 2. ノードタイプが同じ：実際の DOM を再利用し、架け橋を引き継ぐ
  const el = (newVNode.el = oldVNode.el);

  const oldProps = oldVNode.props || {};
  const newProps = newVNode.props || {};

  // 新しい属性を追加/更新
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

  // 存在しなくなった古い属性を削除
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

### ステップ 3：子ノードの処理

**🧙‍♂️**：最後は子ノードの比較だ。新旧どちらの子ノードも配列だと仮定して、どうする？

**🐼**：配列なら、インデックスごとに比較すればいいですね。
1. 共通の長さの範囲をループし、同じ位置の子ノードに対して再帰的に `patch` を呼び出す。
2. 新しい配列の方が長ければ、余った新ノードを `mount` して追加する。
3. 古い配列の方が長ければ、余った旧ノードに対応する実際の DOM を削除する。

**🧙‍♂️**：そうだ。実装は以下のようになる：

```javascript
  // 3. 子ノードの処理
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
    // 新旧ともに配列：共通部分を一つずつ比較
    const commonLength = Math.min(oldChildren.length, newChildren.length);
    for (let i = 0; i < commonLength; i++) {
      patch(oldChildren[i], newChildren[i]); // 再帰的に深く比較
    }

    // 新ノードの方が多い：残りをマウント
    if (newChildren.length > oldChildren.length) {
      newChildren.slice(oldChildren.length).forEach(child => mount(child, el));
    }

    // 旧ノードの方が多い：余分なものを削除
    if (newChildren.length < oldChildren.length) {
      for (let i = oldChildren.length - 1; i >= commonLength; i--) {
        el.removeChild(el.childNodes[i]);
      }
    }
  }
```

**🐼**：もしリスト要素の順番が変わったら、例えば `[A, B, C]` が `[C, A, B]` になったら、インデックスによる比較だと `patch` はすべてのノードが変わったと判断して、三つの DOM の内容を無駄に更新してしまいますね。

**🧙‍♂️**：その通りだ。だからこそ、React は `key` 属性を導入した。ノードに一意の `key` を割り当てることで、React の Diff アルゴリズムはインデックスに縛られず、要素の移動を認識できるようになり、実際の DOM ノードの順序を入れ替えるだけで済むようになる。この簡易版では核心的なフローに集中するため `key` の実装は省略しているが、実際の業務ではこれがリストレンダリングのパフォーマンス最適化の鍵となる。

---

### 📦 やってみよう

以下のコードを `ch05.html` として保存しよう。これは私たちが作る、初めて実際に動作する Mini-React のプロトタイプだ。

**実行後に見えるもの**： ページにはカウンターとボタンが表示される。ボタンをクリックするたびに、タイトルの色が青と赤の間で切り替わる。下の **Patch Log** には、Diff アルゴリズムがどのような DOM 操作を行ったかがリアルタイムで記録される。実際に変化した一つの属性だけが更新され、他のノードは全く動いていないことがわかるはずだ。

**注目ポイント**： ボタンを二回クリックして、二つの Patch Log の内容を比較し、Diff アルゴリズムの正確さを実感してみよう。

```html
<!DOCTYPE html>
<html lang="ja">
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
  <h3>Patch Log（Diff が具体的に何をしたか）：</h3>
  <div id="log"></div>

  <script>
    // ── ログツール ──────────────────────────────────────────────
    const logEl = document.getElementById('log');
    function patchLog(msg) {
      const line = document.createElement('div');
      line.textContent = '→ ' + msg;
      logEl.prepend(line);
    }

    // ── h：仮想ノードを生成 ───────────────────────────────────────
    function h(tag, props, children) {
      return { tag, props: props || {}, children: children || [] };
    }

    // ── mount：仮想ノードを実際の DOM に変換してマウント ─────────────────
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

    // ── patch：新旧ノードの差分を比較して DOM を更新 ───────────────────
    function patch(oldVNode, newVNode) {
      // ケース 1：ノードタイプが異なる → 置換
      if (oldVNode.tag !== newVNode.tag) {
        patchLog(`REPLACE <${oldVNode.tag}> → <${newVNode.tag}>`);
        const parent = oldVNode.el.parentNode;
        const tmp = document.createElement('div');
        mount(newVNode, tmp);
        parent.replaceChild(newVNode.el, oldVNode.el);
        return;
      }

      // ケース 2：ノードタイプが同じ → 実際の DOM を再利用し、el 参照を引き継ぐ
      const el = (newVNode.el = oldVNode.el);
      const oldProps = oldVNode.props || {};
      const newProps = newVNode.props || {};

      // 属性を追加/更新
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

      // 古い属性を削除
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

      // ケース 3：子ノードを更新
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

    // ── アプリロジック ──────────────────────────────────────────────
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
        h('p', null, ['Open DevTools → 変化したノードだけが更新されるのを観察してください！'])
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

    update(); // 初回レンダリング
  </script>
</body>
</html>
```
