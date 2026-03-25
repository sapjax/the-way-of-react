# 付録 A：Mini-React vs React —— 私たちが簡略化したもの

![figure A.1](../../website/public/images/ch_appendix.png)

この本の中で、私たちは最初期の同期的な再帰構築（Stack Reconciler）から一歩ずつエンジンを成長させ、最終的に約 **400行** のモダンな Fiber & Hooks エンジンへと進化させました。それは Virtual DOM、タイムスライシング (Time Slicing)、 Fiber 調整 (Reconciliation)、一括コミット (Commit)、そして核心的な Hooks を網羅しています。

本物の React もまた、全く同じ痛みから出発し、現在のような数十万行に及ぶ巨大な Fiber アーキテクチャへと進化しました。この付録では、私たちが構築した `mini-react` の最終的なソースコードを掲載するとともに、以下のことを理解する手助けをします： **この最終的な Fiber モデルにおいて、私たちはあえてどの部分を簡略化したのか、そして本物の React は核心的なアーキテクチャをどのように処理しているのか。**

---

## 本物の React は他に何を処理しているのか？（差異の比較）

私たちはモダンな Fiber の骨格を手に入れましたが、 400行という読みやすさを維持するために、数十万行に及ぶプロダクションコードと比較して、本物の React は大量の詳細や高度なアーキテクチャを処理しています：

### 1. スケジューラ (Scheduler) と優先度モデル

私たちはブラウザの生の API である `requestIdleCallback` を使って「手抜き」をしました。

**React の現状**： `requestIdleCallback` はすべてのブラウザでサポートされているわけではなく、また動作が不安定です。そのため React チームは、 `MessageChannel` をベースにした独自の中核ライブラリ `scheduler` を開発しました。 React 17/18 で導入された並行モードには、さらに「レーンモデル (Lane Model)」があります。これはビットマスク (bitmasks) を使って異なるタスクに優先順位をつけるものです。例えば、ユーザーの入力（高優先度）が、ネットワークリクエストの結果のレンダリング（低優先度）を中断させる、といった制御を行います。我々の `workLoop` には優先度は一種類しかなく、先入れ先出し (FIFO) でスケジュールされています。

### 2. ダブルバッファリングメカニズムにおけるパフォーマンスの回収

私たちは `setState` が呼ばれるたびに、新しい `wipRoot` ツリーを作成していました：

```js
wipRoot = { dom: currentRoot.dom, alternate: currentRoot, ... }
```

**React の現状**： React は極限までパフォーマンスを絞り出すために、実際の Fiber ノードを再利用します。厳密に対応する `current` ツリーと `workInProgress` ツリーを保持しており、レンダリング更新のたびに新しい Fiber オブジェクトを作成するのではなく、前回のレンダリング時に旧ツリーの同じ階層にあったオブジェクトインスタンスを使い回します。これにより JavaScript エンジンのガベージコレクション (GC) の負荷を大幅に軽減しています。

### 3. 合成イベントシステム (SyntheticEvent)

我々のコードでは、イベントに遭遇すると直接このようにマウントしていました：

```javascript
dom.addEventListener(eventType, nextProps[name]);
```

**React の現状**：実際のコンポーネントにおける `onClick` は、このようにバインドされているわけではありません。各ブラウザでイベントオブジェクトの挙動が異なることへの対策や、メモリパフォーマンス向上のために、 React はアプリの最上位（コンテナレベル）に一つのグローバルなイベントリスナーを設置しています。子コンポーネントで発生したすべてのイベントは最上位までバブリングして React にキャッチされ、ブラウザ間の互換性を持たせた `SyntheticEvent` オブジェクトに包まれた後で、我々のコールバックが実行される仕組みになっています。

### 4. Diff アルゴリズムの計算量保証

 `reconcileChildren` において、私たちは配列のインデックス `index` だけを使って新しい VNode と対応する旧 Fiber ノードを比較していました。

**React の現状**：私たちは、配列ノードの順序が入れ替わった際に発生する大規模な DOM の削除と新規作成の問題を無視しました。 React の `reconcileChildrenArray` は `key` 属性に基づいたアルゴリズムを採用しています。単に配列の順序が入れ替わっただけであれば、 React は `key` を識別することで実際の DOM の位置を調整（再構築ではなく移動）できます。長いリストのループで `key` を付けないと警告が出るのは、このためです。

### 4.5 Render Phase の内部的な分担：beginWork と completeWork
私たちは各ノードにおけるすべての作業を `performUnitOfWork` で一括処理しました。

**React の現状**：本物の React は `performUnitOfWork` 内部の責務を二つに分けています —— 
ノードに入っていく（下へ向かう）時に呼ばれる `beginWork` （関数コンポーネントの実行や Reconciliation を担当）、
および、ノードから戻る（上へ遡る）時に呼ばれる `completeWork` （ DOM ノードの作成や、子ノードの flags を親ノードへマージする処理を担当）です。
このように分けることで、並行処理中の中断・再開時に、ノードへの「進入」と「完了」の二つのタイミングを正確に区別できるようになっています。
核心となる深さ優先探索のロジックは、本書と全く同じです。

### 5. Suspense と並行処理

第15章で Suspense について解説し、教育用コードで核心となる `try/catch` メズムを実演しました。

**React の現状**：実際の React Fiber は、強力な「タスクの throw と catch」による復旧メカニズムを備えています。 Render Phase で Promise が投げられると、 React はレンダリングを「サスペンド (Suspend)」して制御権を返します。 Promise が解決した後は、 Fiber が正確な作業状態を保存しているため、中断した場所から精密に実行を再開できるのです。

### 6. SSR (Server-Side Rendering) と RSC

我々の mini-react は完全にブラウザ環境で動作する CSR (クライアントサイドレンダリング) 用の DOM エンジンです。本物の React はホスト環境から独立した Renderer を持っています（これにより `react-native` がモバイル端末のネイティブ UI をレンダリングしたり、 `react-dom/server` が HTML 文字列をレンダリングしたりすることが可能です）。同時に React は底レイヤーのアーキテクチャにおいて Client Component と Server Component を切り分け、オンデマンドなロードと、ユーザーに意識させない Hydration を実現しています。

---

### まとめ：本質から進化を見る

私たちのこの 400行のコードは、 React がパフォーマンス向上や境界条件の処理のために積み上げてきた膨大なロジックを省略しています。しかし、それでもお前は React の「内臓」をその目で見たはずだ： **Fiber はいかにして長いタスクを分散させるのか？ `useState` はどうやって連結リストに付着しているのか？ 副作用 (Effects) はなぜ DOM の構築が終わった後でなければ Commit（提出）されないのか？**

このメンタルモデルをマスターしていれば、奇妙なクロージャの罠に遭遇したときや、 Hooks のエラーが出たときも、記憶を運ぶこの Fiber の鎖を思い出すことができるはずだ。

---

## 完璧な Mini-React (Fiber) ソースコード

以下は、本書の第9章から第15章にかけて段階的に構築してきた、完全な Fiber エンジンです。本物の React のソースコードを読む前の「踏み台」として活用してください。

> **このファイルと各章のデモに関する補足**
>
> 各章の末尾にある「やってみよう」の HTML デモは、ブラウザでそのまま実行できるように書かれているため、 `export` を使用していません。このファイルは独立した ES モジュールとして、公共の API を `export` しています。両者の実装ロジックは完全に一致しています。
>
> また、 `h()` 関数の内部で `createTextElement` という補助関数を使用していますが、各章のデモではこのロジックを `h()` 内に直接埋め込んでいます。効果は全く同じであり、ここではコードの読みやすさを優先して関数に切り出しています。

```javascript
/**
 * mini-react.js — The Way of React (Modern Fiber Architecture)
 *
 * 本書の第 9-15 章で段階的に構築した、モダンな Fiber エンジンの完全なソースコードです。
 * Fiber アーキテクチャ、タイムスライシング、および Fiber ノードに紐づく Hooks を含みます。
 * このエンジンは、第 1-8 章で構築した同期的な再帰スタック調整器 (Stack Reconciler) を完全に置き換えるものです。
 */

// ============================================
// 仮想 DOM ファクトリ関数
// ============================================

export function h(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      // .flat() により入れ子の配列を処理（例： children に配列が渡された場合）
      // テキストノードをオブジェクトで包み、 Fiber 探索アルゴリズムが一律に処理できるようにする
      children: children.flat().map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  };
}

// 文字列や数値のテキストを統一された形式の VNode オブジェクトで包む
// 各章のデモではこのロジックを h() 内に直接記述していますが、効果は同じです
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

// ============================================
// グローバル状態変数（エンジンの「ダッシュボード」）
// ============================================

let workInProgress = null; // 探索用カーソル：現在処理待ちの Fiber ノード
let currentRoot = null;    // 完成図：前回コミット済みの Fiber ツリー
let wipRoot = null;        // 下書き用紙：構築中の新しい Fiber ツリーのルート
let deletions = null;      // 削除予定の旧 Fiber ノードのリスト

let wipFiber = null;       // 現在実行中の関数コンポーネントに対応する Fiber ノード
let hookIndex = null;      // 現在処理中の Hook のカウンタ（「何番目の引き出し」か）

// ============================================
// 公開 API
// ============================================

export function render(element, container) {
  // 下書きのルートノードを作成し、旧ツリーと繋ぐ（初回マウント時は currentRoot は null）
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  workInProgress = wipRoot;
}

// ============================================
// ワークループ（タイムスライシングの核心）
// ============================================

function workLoop(deadline) {
  let shouldYield = false;

  // タスクがあり、かつブラウザに空き時間がある間、実行を続ける
  while (workInProgress && !shouldYield) {
    workInProgress = performUnitOfWork(workInProgress);
    shouldYield = deadline.timeRemaining() < 1;
  }

  // カーソルが null になれば Render Phase 終了。同期的に Commit Phase へ入る
  if (!workInProgress && wipRoot) {
    commitRoot();
  }

  // メインスレッドを譲った後、次の空きフレームで再開するようリクエスト
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// 単一の Fiber ノードを処理し、次のノードを返す
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;

  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // 次のノードへのナビゲーション：優先的に child へ、なければ sibling へ、それもなければ上へ戻っておじさんを探す
  if (fiber.child) return fiber.child;

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.return; // ← return ポインタ。親ノードを指す（React 源码の return フィールドに対応）
  }
  return null;
}

// ============================================
// コンポーネントの更新と子ノードの調整
// ============================================

function updateFunctionComponent(fiber) {
  // グローバルポインタをセットし、 useState/useEffect がどの Fiber のどの引き出しを処理しているか分かるようにする
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  // 関数コンポーネントを実行し、子 VNode を得る（配列で返される場合に備えて .flat() を適用）
  const children = [fiber.type(fiber.props)].flat();
  reconcileChildren(fiber, children);
}

function updateHostComponent(fiber) {
  // 生の DOM ノード：実際の DOM を作成する（マウントはせず、 Commit Phase で一括処理）
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

// 子ノードを調整する：新しい VNode と旧 Fiber を比較し、 effectTag という作業指示を貼る
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  // ループ条件：新要素が終わっていない、あるいは旧 Fiber が終わっていない（両方が終わって初めて余分な旧ノードが判明する）
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // type が同じ：旧 DOM を再利用し、 props だけを更新する
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,      // 実際の DOM ノードをそのまま引き継ぐ
        return: wipFiber,       // ← return。親ノードを指す
        alternate: oldFiber,    // 旧 Fiber と繋ぎ、 Commit 時に古い props と比較できるようにする
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      // 新要素はあるが type が異なる（または旧ノードがない）：新規作成
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        return: wipFiber,       // ← return
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      // 旧ノードはあるが対応する新要素がない（または type が異なる）：削除マーク
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) oldFiber = oldFiber.sibling;

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

// ============================================
// Commit Phase (同期的、中断不可。変更を実際の DOM へ書き込む)
// ============================================

function commitRoot() {
  // まず削除を処理（削除される旧 Fiber は新ツリーに含まれないため個別に処理が必要）
  deletions.forEach(commitWork);
  // 次に新規作成と更新を処理
  commitWork(wipRoot.child);
  // DOM の更新がすべて完了した後で、副作用を一斉にトリガー
  commitEffects(wipRoot.child);

  // 新しいツリーを現在の完成図とし、下書きを空にする
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) return;

  // 実際の DOM を持っている最も近い先祖ノードを探す
  // 関数コンポーネントは DOM を持たないため、生のノードが見つかるまで上へ辿る
  let domParentFiber = fiber.return; // ← return
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.return; // ← return
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    // 新規作成： DOM をページに追加する
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    // 更新：変化した属性やイベントリスナーのみを修正する
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    // 削除：旧 DOM を取り除き、即座にリターンする。削除されたノードの子ツリーは探索しない
    // （旧ツリーに古い effectTag が残っている場合、誤って「ゾンビノード」を再挿入してしまう恐れがあるため）
    commitDeletion(fiber, domParent);
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    // 関数コンポーネントには dom がないため、下に向かって実際の DOM ノードを探す
    commitDeletion(fiber.child, domParent);
  }
}

// Fiber ツリー全体を探索し、 DOM 操作がすべて完了したタイミングですべての待機中の副作用を実行する
function commitEffects(fiber) {
  if (!fiber) return;

  if (fiber.hooks) {
    fiber.hooks.forEach(hook => {
      // tag === 'effect' により useEffect の hook と useState の hook を区別する
      if (hook.tag === 'effect' && hook.hasChanged && hook.callback) {
        // まず、前回の副作用が残したクリーンアップ関数を実行する
        if (hook.cleanup) hook.cleanup();
        // 新しい副作用を実行。その戻り値を次回のクリーンアップ用として保存する
        hook.cleanup = hook.callback();
      }
    });
  }

  commitEffects(fiber.child);
  commitEffects(fiber.sibling);
}

// ============================================
// DOM ユーティリティ関数
// ============================================

function createDom(fiber) {
  const dom = fiber.type === "TEXT_ELEMENT"
    ? document.createTextNode("")
    : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props);
  return dom;
}

function updateDom(dom, prevProps, nextProps) {
  // ステップ 1：古い属性やイベントリスナーを削除
  for (const k in prevProps) {
    if (k !== 'children') {
      if (!(k in nextProps) || prevProps[k] !== nextProps[k]) {
        if (k.startsWith('on')) {
          dom.removeEventListener(k.slice(2).toLowerCase(), prevProps[k]);
        } else if (!(k in nextProps)) {
          // 古いものがあり新しいものがない場合：属性をクリア
          if (k === 'className') dom.removeAttribute('class');
          else if (k === 'style') dom.style.cssText = '';
          else dom[k] = '';
        }
      }
    }
  }
  // ステップ 2：新しい属性やイベントリスナーをセット
  for (const k in nextProps) {
    if (k !== 'children' && prevProps[k] !== nextProps[k]) {
      if (k.startsWith('on')) {
        dom.addEventListener(k.slice(2).toLowerCase(), nextProps[k]);
      } else {
        if (k === 'className') dom.setAttribute('class', nextProps[k]);
        else if (k === 'style' && typeof nextProps[k] === 'string') dom.style.cssText = nextProps[k];
        else dom[k] = nextProps[k];
      }
    }
  }
}

// ============================================
// Hooks API
// ============================================

export function useState(initial) {
  // 旧 Fiber の同じ位置にある引き出しから、前回の hook オブジェクトを取得
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: oldHook ? oldHook.queue : [],
    setState: oldHook ? oldHook.setState : null,
  };

  // キューを清算：溜まっているすべての更新を順番に state に適用する
  hook.queue.forEach(action => {
    hook.state = typeof action === 'function'
      ? action(hook.state)  // 関数型更新をサポート：setCount(c => c + 1)
      : action;             // 直接代入もサポート：setCount(5)
  });
  hook.queue.length = 0;

  // 初回レンダリング時に setState を作成（以降は同じ関数の参照を使い回す）
  if (!hook.setState) {
    hook.setState = action => {
      hook.queue.push(action);
      // 新しい wipRoot (下書き) を作成し、新しい Render Phase をトリガーする
      wipRoot = {
        dom: currentRoot.dom,
        props: currentRoot.props,
        alternate: currentRoot,
      };
      workInProgress = wipRoot;
      deletions = [];
    };
  }

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, hook.setState];
}

export function useReducer(reducer, initialState) {
  // useReducer は本質的には useState の糖衣構文：
  // 「どう更新するか」を各 setState の呼び出しから、一つの reducer 純粋関数へと集約したもの
  const [state, setState] = useState(initialState);

  function dispatch(action) {
    setState(prevState => reducer(prevState, action));
  }

  return [state, dispatch];
}

export function useEffect(callback, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // 依存関係配列を比較し、副作用を再実行する必要があるか判断
  let hasChanged = true;
  if (oldHook && deps) {
    hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
  }

  const hook = {
    tag: 'effect',  // ← タグ付け。 commitEffects が useState の hook と区別できるようにする
    callback,
    deps,
    hasChanged,
    cleanup: oldHook ? oldHook.cleanup : undefined,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
}

export function useMemo(factory, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  let hasChanged = true;
  if (oldHook && deps) {
    hasChanged = deps.some((dep, i) => !Object.is(dep, oldHook.deps[i]));
  }

  const hook = {
    // 依存関係が変わっていればその場で再計算。変わっていなければ前回のキャッシュを返す
    value: hasChanged ? factory() : oldHook.value,
    deps,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return hook.value;
}

export function useCallback(callback, deps) {
  // useCallback は関数の参照をキャッシュする useMemo の糖衣構文
  return useMemo(() => callback, deps);
}

export function useRef(initialValue) {
  // useRef は本質的には setState を決して呼ばない useState
  // ref.current を直接書き換えても再レンダリングはトリガーされない
  const [ref] = useState({ current: initialValue });
  return ref;
}

// ============================================
// Context API（第 14 章）
// ============================================

export function createContext(defaultValue) {
  return {
    _currentValue: defaultValue, // Provider で包まれていない時のフォールバック用デフォルト値
  };
}

// ContextProvider は特殊なラッパーコンポーネント：
// 自身は単に children を透過させるだけだが、その Fiber ノードに context と value を保持しており、
// 子孫コンポーネントが useContext で上に辿った際に見つけられるようにする
export function ContextProvider(props) {
  return props.children;
}

export function useContext(contextType) {
  // return ポインタを辿って上へ登り、最も近い ContextProvider を探す
  let currentFiber = wipFiber;
  while (currentFiber) {
    if (
      currentFiber.type === ContextProvider &&
      currentFiber.props.context === contextType
    ) {
      // 見つかった先祖の props から value を取り出す
      return currentFiber.props.value;
    }
    currentFiber = currentFiber.return; // ← return ポインタで上へ
  }
  // ルートまで辿っても Provider が見つからなければ、 createContext 時のデフォルト値を返す
  return contextType._currentValue;
}
```
