# 第十三章：副作用と護岸 —— 時間の秩序を再構築する (Effects and Memoization)

![figure 13.1](../../website/public/images/ch13_effects.png)

ポーは前章で書き上げた `useState` の実装を眺めながら、師父の最後の言葉を頭の中で反芻していた —— *"関数の中のすべては、状態が変化するたびに最初から実行し直されるのだ。"*

## 13.1 副作用の苦境

**🐼**：師父、第七章の `Timer` タイマーを関数コンポーネントに書き換えようと思います！ `useState` があれば、簡単ですよね？

```javascript
// 試行 1：致命的な間違い
function Timer() {
  const [time, setTime] = useState(0);

  // レンダリング中、直接タイマーを起動？！
  setInterval(() => {
    setTime(t => t + 1);
  }, 1000);

  return h('div', null, ['Time: ', time]);
}
```

**🧙‍♂️**：慌てるな。このコードを実行すると何が起こるか分かっているか？

**🐼**：コンポーネントが最初にレンダリングされ、 `setInterval` が起動します。1秒後、 `setTime` が呼ばれます。するとコンポーネントが **再レンダリング** されます……あっ！ 再レンダリングとは「完全再実行」でしたね。関数全体がもう一度実行されます！

**🧙‍♂️**：その通りだ。二回目のレンダリング時、コードは再び `setInterval` を実行し、お前は **二つ目** のタイマーを起動することになる。三回目は三つ目……十秒もしないうちに、お前のブラウザのメインスレッドは何千というタイマーに埋め尽くされ、クラッシュするだろう。

これはタイマーだけの問題ではない。レンダリングの過程でネットワークリクエストを送ったり、グローバル変数を書き換えたり、あるいは DOM を直接操作したりしようとする行為は、すべて災難を招く。関数型プログラミングにおいて、純粋な計算から外れ、外部世界に変化を及ぼすこれらのコードは、 **副作用 (Side Effects)** と呼ばれている。

**🐼**：クラスの時代には、それらを `componentDidMount` や `componentDidUpdate` に書いていました。関数コンポーネントではどうすればいいのですか？

## 13.2 副作用を Commit 以降に隔離する

**🧙‍♂️**：Fiber アーキテクチャについて議論したとき、私たちは **Render Phase** （いつでも中断され、複数回実行される可能性がある）と **Commit Phase** （一気に完了し、実際の DOM を変更する）を明確に区別したな。

お前は、副作用はどのフェーズで発生すべきだと思う？

**🐼**：Render Phase では絶対にダメです！ 中断されてやり直されるかもしれないので、API リクエストがあれば重複して何度も送られてしまいます。また、副作用が DOM 操作に関わるもの（ノードの幅を取得するなど）であれば、ページが実際に更新し終わるまで待つ必要があります。ですから、 **副作用は必ず Commit Phase の後でなければなりません！**

**🧙‍♂️**：非常に正確だ。それこそが `useEffect` という Hook が存在する理由だ。 **それは純粋関数のための護岸 (ほとり) なのだ。** それは、「このコードを今すぐ実行するな。 Fiber ノードに一旦預けておき、 **すべての DOM 更新が完了した (Commit Phase が終わった) 後** で、まとめて実行してくれ」とお前に宣言させるためのものだ。

私たちの極小エンジンで、それをどう実装するか見てみよう：

```javascript
function useEffect(callback, dependencies) {
  // useState と同じように、以前にマウントされた hook を探す
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // 依存関係の配列が変化したかチェックする（渡されなかった場合は常に変化したと見なす）
  let hasChanged = true;
  if (oldHook && oldHook.dependencies) {
    hasChanged = dependencies.some(
        (dep, i) => !Object.is(dep, oldHook.dependencies[i])
      );
  }

  // ⚠️ ここに tag フィールドがあることに注目！
  // hooks 配列には useState の hook と useEffect の hook が混在することになる。
  // commitEffects は tag を使って、effect タイプの hook だけを処理し、
  // useState の hook を副作用として実行しないように区別する必要がある。
  const hook = {
    tag: 'effect',
    callback,
    dependencies,
    hasChanged,
    cleanup: oldHook ? oldHook.cleanup : undefined
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
}
```

**🧙‍♂️**：ここで私たちがしているのは、依存関係 (deps) を比較し、変化したか ( `hasChanged` ) を判断し、渡された `callback` 関数をそのまま **保存して** `wipFiber` に置くだけだ、ということに気づいたか。ここではまだ実行していない。

**🐼**：では、いつ呼び出されるのですか？

**🧙‍♂️**：以前書いた `commitRoot()` 関数（つまり DOM が超高速で同期的に書き換えられた後）の中だ。すべてが落ち着いた後で、すべての Fiber を探索し、 `hasChanged` が `true` になっている effect を一斉に呼び出すのだ：

```javascript
// 第十一章で書いた commitRoot 関数の最後のステップを修正：
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  
  // 🌟 新規追加：すべての DOM 作業が終わった後で、副作用をトリガーする！
  commitEffects(wipRoot.child);

  currentRoot = wipRoot;
  wipRoot = null;
}

// ツリー全体を走査し、 effect を見つけて実行する
function commitEffects(fiber) {
  if (!fiber) return;
  
  if (fiber.hooks) {
    fiber.hooks.forEach(hook => {
      // tag === 'effect' で、 useState の hook をスキップし effect タイプのみ処理する
      if (hook.tag === 'effect' && hook.hasChanged) {
        // まず、前回の副作用が残した「クリーンアップ関数」があれば実行する
        if (hook.cleanup) hook.cleanup();
        // 新しい副作用を実行し、その戻り値を次回のクリーンアップ用として保存する
        hook.cleanup = hook.callback(); 
      }
    });
  }

  commitEffects(fiber.child);
  commitEffects(fiber.sibling);
}
```

**🐼**：なるほど。ツリー全体のレンダリングが終わり、DOM のマウントが済んだ後で、わざわざ担当者を一人派遣してすべての「護岸」を点検し、トリガーすべきものをトリガーして回るわけですね。

### クリーンアップ関数のタイミング：副作用の「遺言」

**🐼**： `hook.cleanup` とは何ですか？ なぜ `callback()` の戻り値を保存しておく必要があるのでしょう？

**🧙‍♂️**：これは `useEffect` で最も混乱しやすい部分だが、非常に重要なので丁寧に説明しよう。まずは例を見てみろ：

```javascript
useEffect(() => {
  const timer = setInterval(() => setTime(t => t + 1), 1000);
  // 「クリーンアップ関数」を返す
  return () => clearInterval(timer);
}, []);
```

お前の effect は一つの関数を返した —— この関数がクリーンアップ関数だ。エンジンはそれを `hook.cleanup` に保存する。次にこの effect が再び実行される前に、エンジンはまずこのクリーンアップ関数を呼び出すのだ。

タイムラインで全過程を見てみよう：

```
初回レンダリング（count = 0）：
  └─ commitEffects が effect A を実行
       └─ タイマーを起動、1秒ごとに +1
       └─ クリーンアップ関数 a を返す（このタイマーを解除する役割）
       └─ hook.cleanup = クリーンアップ関数 a

count が変化し、再レンダリング（count = 1）：
  └─ commitEffects が effect B を実行すべきだと判断（hasChanged = true）
       └─ まず hook.cleanup（= クリーンアップ関数 a）を呼び出す → 古いタイマーを解除 ✓
       └─ 新しい effect B を実行
       └─ 新しいタイマーを起動
       └─ hook.cleanup = クリーンアップ関数 b

コンポーネントのアンマウント：
  └─ hook.cleanup（= クリーンアップ関数 b）を呼び出す → 最後のタイマーを解除 ✓
```

**🐼**：ああ！ つまりクリーンアップ関数は「アンマウント時だけに動く」のではなく、 **副作用が再実行されるたびに、その直前で** 一度動いて、前回の足跡を消してくれるのですね？

**🧙‍♂️**：その通りだ。だからタイマーが積み重なることはない —— 新しい副作用が始まる前に、必ず古いものは解除されるからだ。

### 依存関係配列の三つの書き方

**🐼**： `useEffect` の第二引数には、配列を渡したり、空配列だったり、あるいは何も渡さなかったりすることがありますよね。どんな違いがあるのですか？

**🧙‍♂️**：これは初心者が最も陥りやすい落とし穴の一つだ。三つの書き方で意味が全く異なる：

| 書き方 | 意味 | 典型的な用途 |
|------|------|----------|
| `useEffect(fn, [a, b])` | `a` または `b` の値が変わった時に実行 | 特定のデータの変化に反応する（ `userId` が変わったらデータを再取得するなど） |
| `useEffect(fn, [])` | コンポーネントの **初回マウント時** に一度だけ実行 | 初期化操作（購読、コネクションの確立など） |
| `useEffect(fn)` | **レンダリングのたびに** 毎回実行 | ほとんど使われない。ほぼ間違いなくバグの原因になる |

**🐼**：わかりました！ 依存関係配列の仕組みがあれば、たとえコンポーネントが1秒間に60回再レンダリングされたとしても、依存関係が変わらない限り、複雑なリクエストや重い DOM クエリが繰り返されることはないわけですね。

## 13.3 リアクティブの檻から逃れる (useRef)

**🐼**：もう一つ小さな質問です。時々、再レンダリングをトリガーしたくない場合があります。単に参照（例えば実際の DOM ノードや、普通のカウンタなど）を保持しておきたいだけで、それを修正したときに **コンポーネントを再描画させたくない** のです。 `useState` は `set` を呼んだ瞬間に再レンダリングが始まってしまいます。

**🧙‍♂️**：それには、波風を立てない「ブラックボックス」が必要だな。それを `useRef` と呼ぶ。その実装は極めてシンプルだ：

```javascript
function useRef(initialValue) {
  // 本質的には単なる useState だが、その ref オブジェクトだけを取り出し、
  // 決してその setState を呼び出すことはない。
  // お前が直接 ref.current = 新しい値 と書き換えても、エンジンは知る由もないので、
  // 当然再レンダリングもトリガーされない。
  const [ref] = useState({ current: initialValue });
  return ref;
}
```

 `ref.current` を修正しても再レンダリングが起きないのは、 `useState` が返した状態だけを取り出し、 `setState` を全く使っていないからだ。

**🐼**： `useRef` は具体的にどんな用途がありますか？

**🧙‍♂️**：大きく分けて二つある。一つ目は **再描画を必要としない変数を保存する** こと。例えばレンダリング回数を記録するなどだ：

```javascript
function App() {
  const renderCount = useRef(0);
  renderCount.current++; // 直接修正。再レンダリングは起きない
  return h('p', null, `レンダリング回数: ${renderCount.current}`);
}
```

二つ目は、こちらの方がより一般的だが、 **実際の DOM ノードを保持する** ことだ。コンポーネントがマウントされた後に、入力欄に自動でフォーカスを当てたいと想像してみろ：

```javascript
function SearchBox() {
  const inputRef = useRef(null);

  useEffect(() => {
    // Commit Phase が終わった後、 inputRef.current には実際の DOM ノードが入っている
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []); // 初回マウント時に一度だけ実行

  // ref を実際の DOM ノードにバインドする（React は commit 段階でこの代入を完了させる）
  return h('input', { ref: inputRef, placeholder: '検索...' });
}
```

**🐼**：なるほど。 `useRef` は「完全再実行」モデルから逃れるための非常口なのですね。レンダリングを跨いでデータを保持しつつ、レンダリングサイクルを乱さない、と。

## 13.4 計算結果をキャッシュする (useMemo)

**🐼**：師父、「完全再実行」モデルのもう一つの懸念を思い出しました。もし EC サイトのページがあって、商品リストが非常に長いとしたら……。

**🧙‍♂️**：どんな問題にぶつかったか言ってみろ。

**🐼**：このコードを見てください：

```javascript
function ProductPage() {
  const [products] = useState(hugeProductList);  // 10,000 件の商品
  const [keyword, setKeyword] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // ❌ ダークモードを切り替えるたびに、このフィルタリング + 統計が再実行される ——
  //    products と keyword は全く変わっていないのに！
  const filtered = products.filter(p =>
    p.name.includes(keyword) || p.description.includes(keyword)
  );
  const stats = {
    count: filtered.length,
    avgPrice: filtered.reduce((s, p) => s + p.price, 0) / filtered.length,
    maxPrice: Math.max(...filtered.map(p => p.price)),
  };

  // ❌ ProductPage が再実行されるたびに、新しい関数オブジェクトが作成される。
  //    そのせいで ProductList は props が変わったと判断し、再レンダリングされてしまう
  const handleAddToCart = (id) => { /* ... */ };

  return h('div', { className: darkMode ? 'dark' : 'light' }, [
    h(SearchBar, { keyword, setKeyword }),
    h(StatsPanel, { stats }),            // ← stats は新オブジェクト。毎回再レンダリング
    h(ProductList, { items: filtered, onAdd: handleAddToCart }),
    //                                    ↑ filtered は新配列、 onAdd は新関数
    //                                      darkMode を変えただけなのに、ここも全再レンダリング！
  ]);
}
```

ユーザーがただダークモードを切り替えただけで、 `ProductPage` は丸ごと再実行されます。 10,000件の商品が再フィルタリングされ、価格が再計算され、 `handleAddToCart` が再作成され……。 `ProductList` は「新しい」 props を受け取り（参照が変わったため）、 10,000個の子コンポーネントもすべて再レンダリングされてしまいます。

**🧙‍♂️**：お前は「完全再実行」モデルのパフォーマンスコストを正確に描写したな。このような連鎖反応を **雪だるま式再レンダリング** と呼ぶ。これを解決するには、 **依存関係が変わっていないなら、前回の計算結果をそのまま返す** 仕組みが必要だ。それが `useMemo` だ。

そのロジックは `useEffect` の依存関係比較と非常によく似ている。だが決定的な違いは、 `useEffect` がコールバックを Commit 段階まで隠しておくのに対し、 `useMemo` は **Render 段階で同期的に一度だけ実行し、その結果をキャッシュする** 点にある。

```javascript
function useMemo(factory, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  let hasChanged = true;
  if (oldHook && oldHook.deps) {
    hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
  }

  const hook = {
    // 依存関係が変わっていれば、その場で再計算する。変わっていなければ前回の値を返す
    value: hasChanged ? factory() : oldHook.value,
    deps: deps,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return hook.value;
}
```

**🐼**： `useMemo` は `useEffect` とそっくりですね？ どちらも「依存関係の変化をチェックする」ものです。

**🧙‍♂️**：本質的には同じメカニズムだが、働くタイミングと目的が異なるのだ：

| Hook | 依存関係が変化した時にすること | 実行タイミング |
|------|-----------------|----------|
| `useEffect` | 副作用を実行する | Commit 段階の後（非同期） |
| `useMemo` | 返り値を再計算しキャッシュする | Render 段階（同期） |

見えるか？ 依存関係が変わっていなければ、極めて複雑な `factory()` コールバックはスキップされ、前回残しておいた計算結果がそのままお前に返されるのだ。

**🐼**：待ってください……その理屈だと、 `useCallback(fn, deps)` って、 `useMemo(() => fn, deps)` の糖衣構文に過ぎないのでは？ 関数の参照をキャッシュしているだけですから。

**🧙‍♂️**：その通りだ。では、これらの道具を使ってさっきの `ProductPage` を修理してみよう：

```javascript
// ✅ useMemo：依存関係が変わった時だけ再計算する
const filtered = useMemo(
  () => products.filter(p =>
    p.name.includes(keyword) || p.description.includes(keyword)
  ),
  [products, keyword]  // products か keyword が変わった時だけ再フィルタリング
);

const stats = useMemo(
  () => ({
    count: filtered.length,
    avgPrice: filtered.reduce((s, p) => s + p.price, 0) / filtered.length,
    maxPrice: Math.max(...filtered.map(p => p.price)),
  }),
  [filtered]
);

// ✅ useCallback：依存関係が変わった時だけ新しい参照を作る
const handleAddToCart = useCallback(
  (id) => { /* ... */ },
  []  // 依存関係なし。関数は永遠に同じ参照を保つ
);

// ✅ React.memo (高階コンポーネント)： props が実際に変化した時だけ子コンポーネントを再レンダリングする
const ProductList = React.memo(function ProductList({ items, onAdd }) {
  return h('ul', null, items.map(p => h(ProductItem, { ...p, onAdd })));
});
```

これでダークモードを切り替えても、 `filtered` の参照は変わらず → `stats` も変わらず → `handleAddToCart` も変わらず → `ProductList` の props に変化なし、となり、商品リスト全体の再レンダリングは発生しなくなる。

**🐼**：わかりました！ React は毎回関数全体を洗い流すように実行するため、私たちは手動で `useMemo` を使って重い計算を守り、 `useCallback` で子コンポーネントに渡す関数の参照を守り、雪だるま式の再レンダリングを防がなければならないのですね！

**🧙‍♂️**：正解だ。実は React チームも、この認知的負荷があまりに重すぎることを自覚している。そこで彼らは **React Compiler** を開発した。コンパイル段階でこれらのメモ化コードを自動で挿入し、開発者が画面いっぱいに `useMemo` や `useCallback` を書かなくて済むようにするのが目標だ。

## 13.5 百の川が海へ注ぐ

**🧙‍♂️**：これにて、純粋関数は四つの宝を手に入れた：

1. **記憶とトリガー (`useState`)**： 内部状態を掌握し、天地の再描画を引き起こす。
2. **護岸と対話 (`useEffect`)**： 副作用を隔離し、Commit 段階で戦場を片付け、外部システムと交渉する。
3. **避風港 (`useRef`)**： 再描画を起こさない変動データを保存し、または実際の DOM ノードの参照を保持する。
4. **絞り弁 (`useMemo` / `useCallback`)**： 依存関係の比較を通じて、冗長でコストの高い計算や関数の作成を阻止する。

これら四つの宝が存在するのは、すべて同じ前提 —— **「完全再実行」モデル** があるからだ。 React はレンダリングのたびに関数を走らせる。 Hooks という仕組みは、その中で「何を一度だけやるか」「何の計算をスキップするか」「何の値を新しく作り直さないか」を正確に制御するためのものなのだ。

これが、 **Hooks 文芸復興** と呼ばれるものの全貌だ。もうロジックを `componentDidMount` や `componentDidUpdate` といったバラバラのライフサイクルに散らす必要はない。お前のメンタルモデルは最高に純粋で、隔離され、合成可能な状態へと立ち戻ったのだ。

しかし、まだ一つだけ、これら四つの宝でも解決できない問題が残っている —— アプリが大きくなり、状態をコンポーネントの何層にもわたって受け渡す必要が出てきたとき、 Props は「宅配便の悪夢」へと変わる。それが第十四章の出発点だ。

---

### 📦 やってみよう

以下のコードを `ch13.html` として保存しよう。 `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback` の五大核心 Hooks を統合した、完全なデモアプリだ：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 13 — The Power of All Hooks</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { color: #0066cc; }
    button { padding: 8px 16px; font-size: 14px; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
    input { padding: 8px; font-size: 14px; width: 80%; margin-bottom: 10px; }
    .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 20px; max-width: 400px; }
    .log-box { font-family: monospace; background: #282c34; color: #abb2bf; padding: 10px; height: 150px; overflow-y: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    // === 極小 Fiber エンジン (全 Hooks 対応) ===
    function h(type, props, ...children) {
      return {
        type,
        props: {
          ...props,
          children: children.flat().map(child =>
            typeof child === "object" ? child : { type: "TEXT_ELEMENT", props: { nodeValue: child, children: [] } }
          )
        }
      };
    }

    let workInProgress = null, currentRoot = null, wipRoot = null, deletions = null;
    let wipFiber = null, hookIndex = null;

    function render(element, container) {
      wipRoot = { dom: container, props: { children: [element] }, alternate: currentRoot };
      deletions = [];
      workInProgress = wipRoot;
    }

    function workLoop(deadline) {
      let shouldYield = false;
      while (workInProgress && !shouldYield) {
        workInProgress = performUnitOfWork(workInProgress);
        shouldYield = deadline.timeRemaining() < 1;
      }
      if (!workInProgress && wipRoot) commitRoot();
      requestIdleCallback(workLoop);
    }
    requestIdleCallback(workLoop);

    function performUnitOfWork(fiber) {
      const isFunctionComponent = fiber.type instanceof Function;
      if (isFunctionComponent) {
        wipFiber = fiber;
        hookIndex = 0;
        wipFiber.hooks = [];
        const children = [fiber.type(fiber.props)];
        reconcileChildren(fiber, children);
      } else {
        if (!fiber.dom) fiber.dom = createDom(fiber);
        reconcileChildren(fiber, fiber.props.children);
      }

      if (fiber.child) return fiber.child;
      let nextFiber = fiber;
      while (nextFiber) {
        if (nextFiber.sibling) return nextFiber.sibling;
        nextFiber = nextFiber.return;
      }
      return null;
    }

    function createDom(fiber) {
      const dom = fiber.type === "TEXT_ELEMENT" ? document.createTextNode("") : document.createElement(fiber.type);
      updateDom(dom, {}, fiber.props);
      return dom;
    }

    function updateDom(dom, prevProps, nextProps) {
      for (const k in prevProps) {
        if (k !== 'children') {
          if (!(k in nextProps) || prevProps[k] !== nextProps[k]) {
            if (k.startsWith('on')) dom.removeEventListener(k.slice(2).toLowerCase(), prevProps[k]);
            else if (!(k in nextProps)) {
              if (k === 'className') dom.removeAttribute('class');
              else if (k === 'style') dom.style.cssText = '';
              else dom[k] = '';
            }
          }
        }
      }
      for (const k in nextProps) {
        if (k !== 'children' && prevProps[k] !== nextProps[k]) {
          if (k.startsWith('on')) dom.addEventListener(k.slice(2).toLowerCase(), nextProps[k]);
          else {
            if (k === 'className') dom.setAttribute('class', nextProps[k]);
            else if (k === 'style' && typeof nextProps[k] === 'string') dom.style.cssText = nextProps[k];
            else dom[k] = nextProps[k];
          }
        }
      }
    }

    function reconcileChildren(wipFiber, elements) {
      let index = 0, oldFiber = wipFiber.alternate && wipFiber.alternate.child, prevSibling = null;
      while (index < elements.length || oldFiber != null) {
        const element = elements[index];
        let newFiber = null;
        const sameType = oldFiber && element && element.type === oldFiber.type;

        if (sameType) newFiber = { type: oldFiber.type, props: element.props, dom: oldFiber.dom, return: wipFiber, alternate: oldFiber, effectTag: "UPDATE" };
        if (element && !sameType) newFiber = { type: element.type, props: element.props, dom: null, return: wipFiber, alternate: null, effectTag: "PLACEMENT" };
        if (oldFiber && !sameType) { oldFiber.effectTag = "DELETION"; deletions.push(oldFiber); }

        if (oldFiber) oldFiber = oldFiber.sibling;
        if (index === 0) wipFiber.child = newFiber;
        else if (element) prevSibling.sibling = newFiber;
        prevSibling = newFiber;
        index++;
      }
    }

    function commitRoot() {
      deletions.forEach(commitWork);
      commitWork(wipRoot.child);
      commitEffects(wipRoot.child); // DOM 作業完了後に副作用をトリガー
      currentRoot = wipRoot;
      wipRoot = null;
    }

    function commitWork(fiber) {
      if (!fiber) return;
      let domParentFiber = fiber.return;
      while (!domParentFiber.dom) domParentFiber = domParentFiber.return;
      const domParent = domParentFiber.dom;

      if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) domParent.appendChild(fiber.dom);
      else if (fiber.effectTag === "UPDATE" && fiber.dom != null) updateDom(fiber.dom, fiber.alternate.props, fiber.props);
      else if (fiber.effectTag === "DELETION") {
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

    function commitEffects(fiber) {
      if (!fiber) return;
      if (fiber.hooks) {
        fiber.hooks.forEach(hook => {
          // tag === 'effect' で、 useState の hook と useEffect の hook を区別する
          if (hook.tag === 'effect' && hook.hasChanged) {
            if (hook.cleanup) hook.cleanup(); // 前回のクリーンアップ関数を実行
            if (hook.callback) hook.cleanup = hook.callback(); // 新しい副作用を実行し、クリーンアップ関数を保存
          }
        });
      }
      commitEffects(fiber.child);
      commitEffects(fiber.sibling);
    }

    // === Hooks API ===
    function getOldHook() {
      return wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];
    }

    function useState(initial) {
      const oldHook = getOldHook();
      const hook = { 
        state: oldHook ? oldHook.state : initial, 
        queue: oldHook ? oldHook.queue : [],
        setState: oldHook ? oldHook.setState : null
      };
      
      hook.queue.forEach(action => hook.state = typeof action === 'function' ? action(hook.state) : action);
      hook.queue.length = 0;

      if (!hook.setState) {
        hook.setState = action => {
          hook.queue.push(action);
          wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
          workInProgress = wipRoot;
          deletions = [];
        };
      }
      wipFiber.hooks.push(hook);
      hookIndex++;
      return [hook.state, hook.setState];
    }

    function useEffect(callback, deps) {
      const oldHook = getOldHook();
      let hasChanged = true;
      if (oldHook && deps) {
        hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
      }
      // tag: 'effect' により commitEffects が識別できるようにし、 useState の hook をスキップさせる
      const hook = { tag: 'effect', callback, deps, hasChanged, cleanup: oldHook ? oldHook.cleanup : undefined };
      wipFiber.hooks.push(hook);
      hookIndex++;
    }

    function useRef(initial) {
      const [ref] = useState({ current: initial });
      return ref;
    }

    function useMemo(factory, deps) {
      const oldHook = getOldHook();
      let hasChanged = true;
      if (oldHook && deps) {
        hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
      }
      const hook = { value: hasChanged ? factory() : oldHook.value, deps };
      wipFiber.hooks.push(hook);
      hookIndex++;
      return hook.value;
    }

    function useCallback(callback, deps) {
      return useMemo(() => callback, deps);
    }

    // === デモアプリ： useEffect と useMemo の振る舞いを観察する ===
    function App() {
      const [count, setCount] = useState(0);
      const [text, setText] = useState('');
      const renderCount = useRef(0);
      
      // useRef：レンダリング回数を記録。再描画はトリガーしない
      renderCount.current++; 

      // useEffect： count に依存。 count が変わらない時は再実行されない
      useEffect(() => {
        console.log("🌊 Effect: マウント時または count が変わりました ->", count);
        return () => console.log("🧹 Cleanup: count が変わる直前です ->", count);
      }, [count]);

      // useMemo： count に依存。テキストボックスへの入力では再計算されない
      const expensiveValue = useMemo(() => {
        console.log("🧮 重い計算を実行中...");
        return "✨ 重い計算の結果: " + count * 100;
      }, [count]);

      return h('div', { className: 'card' },
        h('h2', null, '総合 Hooks デモ'),
        h('p', null, `ページ総レンダリング回数: ${renderCount.current}`),
        h('p', null, `Count の値: ${count}`),
        h('p', { style: 'color: green;' }, expensiveValue),
        h('button', { onclick: () => setCount(c => c + 1) }, '数字を増やす'),
        h('hr', null),
        h('input', { 
          placeholder: 'タイピングテスト（上の数字や重い計算には影響しません）',
          value: text, 
          oninput: (e) => setText(e.target.value) 
        }),
        h('p', null, `入力内容: ${text}`),
        h('p', { style: 'font-size: 12px; color: gray;' }, 'F12 のコンソールパネルを開き、 useEffect と useMemo がいつトリガーされるか観察してください')
      );
    }

    render(h(App, null), document.getElementById('app'));
  </script>
</body>
</html>
```
