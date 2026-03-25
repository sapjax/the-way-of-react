# 第十五章：並行からサーバーへ —— React の究極の形態 (Concurrent & Server Components)

![figure 15.1](../../website/public/images/ch15_concurrent_and_server.png)

## 15.1 最後のパズル

ポーは長い旅路を歩んできた。生の DOM からテンプレートへ、データバインディングから Virtual DOM へ、クラスコンポーネントから Hooks へ、Prop Drilling から Fiber ベースの Context へ……。

**🐼**：師父、モダン React の核心はすべて構築し終えた気がします！ Fiber アーキテクチャでエンジンを書き換え、純粋関数に記憶を持たせ、階層を超えた状態管理も解決しました。まだ何か足りないものはありますか？

**🧙‍♂️**：第九章と第十章で、なぜ私たちが多大な犠牲を払ってまで単純な再帰を捨て、複雑な Fiber 連結リストへと書き換えたのか、覚えているか？

**🐼**： 「ブラウザの停滞」というパフォーマンス危機を解決するためでした。レンダリングを中断可能な Render Phase と、超高速で同期的な Commit Phase に分けたのですよね。

**🧙‍♂️**：そうだ。この「レンダリングを中断し、メインスレッドを譲る」能力は、 React チームによって **Concurrent Mode（並行モード）** と呼ばれている。これまでの章では、巨大なページでブラウザが固まるのを防ぐために使ってきたが、実は「中断可能」という特性は、フロントエンド UI 開発において業界を十年間悩ませてきた二つの究極の難題を解き明かす鍵なのだ。

この章ではさらにブラウザを飛び出し、レンダリングがクライアントサイドに限定されなくなったとき、 Fiber の設計がどのような新しい可能性をもたらすのかを見ていこう。

## 15.2 並行と優先度スケジューリング

**🧙‍♂️**：想像してみろ。お前の ToDo リストに 10,000 件のデータがあり、ちょうどネットワークリクエストが戻ってきてツリー全体の更新が始まったとする。そのまさにその時、ユーザーが入力欄に一文字打ち込んだ。お前のコードはどう動く？

**🐼**：旧バージョン (Stack Reconciler) だと、ネットワークリクエストによる 10,000 ノードのレンダリングでメインスレッドが完全にロックされ、ユーザーのタイピングは 150ミリ秒ほどカクついてしまいます。でも、私たちの Fiber アーキテクチャなら、 `workLoop` が各フレームの終わりに制御権をブラウザに返しますから、入力欄が固まることはありません！

**🧙‍♂️**：正確には、ブラウザがユーザーのタイピングイベントに応答する機会を得る、ということだ。だが、ここにはより深い問題がある。タイピングイベントもまた `setState` をトリガーする。今、エンジンの中には **二つのタスク** が存在することになるのだ：

1. メインリストの更新（巨大、時間がかかる）
2. 入力欄の文字の更新（極小、だがユーザーは遅延に極めて敏感）

お前がスケジューラなら、どうする？

**🐼**：もし順番通りにやって、 10,000 ノードを少しずつ処理し終えてから入力欄を更新したとしたら……たとえブラウザが固まっていなくても、表示される文字はワンテンポ遅れて出てくることになりますね！ 私なら、リストのレンダリングを **中断** して、 **優先的に** 入力欄の文字をレンダリングします！

**🧙‍♂️**：それが React 18 の並行機能の核心だ： **優先度スケジューリング (Priority Scheduling)** 。 React は `useTransition` という Hook を提供し、開発者が「どの更新は急がないか」を明示できるようにしたのだ：

```javascript
function SearchPage() {
  const [query, setQuery] = useState('');       // 入力欄の状態 —— 高優先度
  const [results, setResults] = useState([]);   // 検索結果 —— 低優先度

  const [isPending, startTransition] = useTransition();

  function handleInput(e) {
    // 入力欄を直接更新：高優先度。 startTransition で包まない
    setQuery(e.target.value);

    // 検索結果の更新：「中断可能な低優先度タスク」としてマークする
    startTransition(() => {
      setResults(heavySearch(e.target.value)); // 時間のかかる巨大リストの更新
    });
  }

  return h('div', null,
    h('input', { value: query, oninput: handleInput }),
    // isPending が true の間はリストがバックグラウンドでレンダリング中であることを示し、待機状態を表示できる
    isPending
      ? h('p', null, '検索中…')
      : h('ul', null, results.map(r => h('li', null, r)))
  );
}
```

底レイヤーの Fiber アーキテクチャがあるからこそ、 React は Render Phase において低優先度の長いタスク（ `startTransition` 内のリスト更新）をいつでも中断し、高優先度のタスク（入力欄の文字）に切り替えて Render + Commit を迅速に終わらせ、それからまた低優先度のタスクに戻ることができるのだ。これが可能なのは、各 Fiber ノードが完全なコンテキスト状態を保存しており、中断してもいつでもその地点から再開できるからに他ならない。

## 15.3 Suspense：エレガントな待機

**🧙‍♂️**：二つ目の世紀の難題 —— **非同期データ** だ。旧時代、データを取得するコードは通常こうだった：

```javascript
function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { // 護岸の中の副作用： Commit の後にリクエストを送る
    fetchUser().then(data => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return h('p', null, '読み込み中…');
  return h('div', null, ['こんにちは、' + user.name]);
}
```

**🐼**：これの何が問題なのですか？ 標準的なやり方ですよね。

**🧙‍♂️**：三つの致命的な痛みがある。

**問題一：ウォーターフォール（滝状）リクエスト** —— `useEffect` は Commit 段階の後に実行される。つまり、コンポーネントが一旦画面に表示されない限り、リクエストは始まらない。もしページがこのように重なっていたら：

```
<App>
  └── <UserProfile>   ← useEffect でリクエスト。待機中…
        └── <PostList>  ← UserProfile のリクエストが完了してレンダリングされた後で初めて、
                             PostList の useEffect がリクエストを開始する
```

親のリクエストが終わり、レンダリングされて、ようやく子のリクエストが始まる —— リクエストが滝のように一段ずつ流れ落ち、並列化できたはずの時間を無駄にしてしまう。

**問題二：Loading 状態の爆発** —— すべてのコンポーネントに `if (loading) return ...` を書かなければならず、コードベースが重複したロード判定で溢れかえる。

**問題三：レースコンディション（競合状態）** —— ユーザーが頻繁に切り替えを行うと、先に送った遅いリクエストが、後から送った速いリクエストの後に戻ってきてしまい、最新のデータを古いデータで上書きしてしまう可能性がある。

**🧙‍♂️**： Suspense の思想は破壊的だ。 **「コンポーネントは Render Phase において、データがまだ準備できていないことに気づいたら、 Promise を例外として直接 throw する！」** というものだ。

```javascript
// fetch を Suspense が読める「リソース」としてラップする
function createResource(fetchFn) {
  let status = 'pending';
  let result;
  // すぐにリクエストを開始（注意： useEffect 内ではなく、モジュールのロード時に）
  let promise = fetchFn().then(
    data => { status = 'success'; result = data; },
    error => { status = 'error'; result = error; }
  );

  return {
    read() {
      if (status === 'pending') throw promise;   // 🔥 データがまだ？ Promise を直接 throw！
      if (status === 'error')   throw result;    // エラー？ エラーを throw
      return result;                             // 準備完了。正常に返す
    }
  };
}

const userResource = createResource(() => fetch('/api/user').then(r => r.json()));

function UserProfile() {
  const user = userResource.read(); // まだなら throw。ここを通るならデータは必ず存在する
  return h('div', null, ['こんにちは、' + user.name]); // if (loading) の判定は不要！
}
```

**🐼**： Promise を例外として外に投げるのですか？ 誰がそれを受け取るのですか？

### エンジンは「投げられた Promise」をどう捕まえるのか

**🧙‍♂️**：答えは自分たちで書いた `updateFunctionComponent` の中にある。コンポーネント関数を実行する場所に、 `try/catch` を入れるだけでいい：

```javascript
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  try {
    // 正常系：コンポーネント関数を実行し、子要素を得る
    const children = [fiber.type(fiber.props)].flat();
    reconcileChildren(fiber, children);
  } catch (e) {
    // 🔥 Suspense の核心：投げられた Promise をキャッチする
    if (e instanceof Promise) {
      // 1. まずは fallback UI で場所を確保（ユーザーに「読み込み中」を見せる）
      const fallback = fiber.props.fallback || '⏳ 読み込み中…';
      reconcileChildren(fiber, [h('span', null, fallback)]);

      // 2. Promise が resolve したら、この子ツリーのレンダリングを再スケジュールする
      e.then(() => {
        wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
        deletions = [];
        workInProgress = wipRoot;
      });
    } else {
      throw e; // Promise でなければ本物のエラー。さらに上へ投げる
    }
  }
}
```

**🐼**：なるほど！ Promise を `try/catch` して、 fallback を表示させ、 Promise が解決したらもう一度レンダリングをやり直す —— データが揃っていれば `read()` はもう throw しないので、コンポーネントが正常にレンダリングされる、というわけですね！

**🧙‍♂️**：お前は完全に理解したな。そしてエンジンが Suspense の境界を見つける方法を思い出してみろ —— どこかで見覚えがないか？ Promise をキャッチした後、エンジンは `return` ポインタを辿って、 `fallback` を持っている親コンポーネントを探しに行き、その階層の UI を fallback に差し替える。これは `useContext` が Provider を探しに上へ登るのと全く同じ仕組みだ： **Fiber の `return` チェーンを上に辿る** のだ。

お前は今、 Fiber の「中断可能 / 再開可能」アーキテクチャの究極の応用を理解したのだ。

## 15.4 SPA の限界

**🧙‍♂️**：ポーよ、これまでに私たちが構築してきたもの —— 仮想 DOM から Hooks 、状態管理から並行レンダリングまで —— はすべて **一つの場所** で動いていたな。

**🐼**：ブラウザ、ですか？

**🧙‍♂️**：そうだ。ユーザーがサイトにアクセスしたとき、ブラウザは一つの HTML ファイルをダウンロードし、それから JavaScript を読み込み、 JavaScript がブラウザの中でゼロから UI 全体を構築する。このパターンを **SPA (Single-Page Application, シングルページアプリケーション)** と呼ぶ。

**🐼**：それこそが私たちがずっとやってきたことですよね。 `ch05.html` を開けば、 JavaScript がすべてを牛耳っています。

**🧙‍♂️**：そうだ。では今、その ToDo リストをインターネットに公開したとしよう。一人のユーザーがページを開いたとき、彼のブラウザはまず何を受け取る？

**🐼**：一つの HTML ファイルですね。中身は空っぽの `<div id="app"></div>` と、一つの `<script>` タグでしょうか？

**🧙‍♂️**：その通りだ。 JavaScript が読み込まれ実行されるまで、ユーザーは何を見ることになる？

**🐼**：……真っ白な画面、ですか？

**🧙‍♂️**：そうだ。 **白屏（ホワイトアウト）** だ。 JavaScript のサイズやユーザーの通信環境にもよるが、この空白は 1〜3秒続くかもしれない。ではもう一つの問いだ。 Google の検索エンジンのクローラーがお前のページを訪れたとき、彼には何が見える？

**🐼**：やはり空の `<div id="app">` でしょうか。クローラーが必ずしも JavaScript を実行してくれるとは限りませんから……。

**🧙‍♂️**：SPA の抱える三つの致命的な問題が見えてきたな：

```text
┌──────────────────────────────────────────────────────┐
│  SPA の三つの問題                                      │
│                                                      │
│  1. 初回表示の白屏                                    │
│     空の HTML → JS をダウンロード → JS を実行 → 描画     │
│     待機時間 = 通信遅延 + JS 解析 + レンダリング時間      │
│                                                      │
│  2. SEO に不向き                                      │
│     検索エンジンには空の <div> しか見えず、インデックス不能 │
│                                                      │
│  3. ファイルサイズの膨張                               │
│     すべてのページを一つの JS ファイルに詰め込む           │
│     機能が増える → ファイルが巨大化 → 読み込みが遅くなる   │
└──────────────────────────────────────────────────────┘
```

**🐼**：待ってください…… SPA が普及する前はどうしていたのですか？ 昔のサイトは、サーバーが直接完成した HTML を返していましたよね？ PHP とか Ruby on Rails みたいに。

**🧙‍♂️**：お前は正しい方向に勘が働いているな。

## 15.5 SSR：サーバーに帰る

**🧙‍♂️**：もしサーバーが事前に React コンポーネントを HTML 文字列としてレンダリングし、それをブラウザに送ったとしたらどうなる？

**🐼**：つまり……サーバーの上で私たちの `render` 関数を動かす、ということですか？

**🧙‍♂️**：その通りだ。私たちの `h()` 関数を思い出してみろ。それは普通の JavaScript オブジェクト —— VNode を返しているだけだった。このオブジェクトはブラウザに依存していないため、 Node.js の上でも生成できる。あとは VNode を **HTML 文字列に変換する** 関数が一つあればいい。

ここでの VNode 形式に注意しろ。私たちは一貫して `vnode.type` （タグの種類）と `vnode.props.children` （子ノード）を使ってきたな。

```javascript
// VNode を HTML 文字列に変換する（サーバー / Node.js 環境で実行）
function renderToString(vnode) {
  // テキストノード：エスケープしたテキストをそのまま返す
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return escapeHtml(String(vnode));
  }
  // h 関数で自動ラップされた TEXT_ELEMENT の処理
  if (vnode.type === 'TEXT_ELEMENT') {
    return escapeHtml(String(vnode.props.nodeValue));
  }

  let html = '<' + vnode.type;

  // props の処理（ children とイベントハンドラはスキップ）
  for (const key in vnode.props) {
    if (key === 'children') continue;
    if (key.startsWith('on')) continue; // ⚡ イベントはクライアントのもの。サーバーでは無意味
    html += ' ' + key + '="' + escapeHtml(vnode.props[key]) + '"';
  }
  html += '>';

  // 子ノードを再帰的にレンダリング（子ノードは vnode.props.children にある）
  const children = vnode.props.children || [];
  for (const child of children) {
    html += renderToString(child);
  }

  html += '</' + vnode.type + '>';
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}
```

**🐼**：これが React の `renderToString` ですか？

**🧙‍♂️**：簡易版だが原理は同じだ。さて、流れがどう変わるか見てみろ：

```text
SPA の流れ：
  ブラウザがリクエスト → サーバーが空の HTML を返す → JS ダウンロード → JS 実行 → ユーザーに内容が見える
                                  ↑
                              白屏での待機 (1〜3秒)

SSR の流れ：
  ブラウザがリクエスト → サーバーが renderToString を実行 → 完成した HTML を返す → ユーザーに即座に内容が見える
                                                        ↓（同時に）
                                                   JS ダウンロード → Hydration（インタラクティブ化）
```

**🐼**：ユーザーは即座に内容を見ることができますね！ でも待ってください…… `renderToString` はイベントハンドラ（ `onclick` など）をスキップしますよね。ということは、画面は見えているけれど、ボタンを押しても反応しないのでは？

**🧙‍♂️**：重要な問題だ。そこで SSR における最重要概念 —— **Hydration（ハイドレーション）** が登場する。

サーバーはお前に **骨組み** （HTML 構造）を与えた。クライアント側の JavaScript の読み込みが終わると、既存の DOM に対して **イベントハンドラや状態を付着させ** 、それを生きたものにする。このプロセスを Hydration と呼ぶ —— まるで乾燥した骨に水分を注入し、生命を吹き込むかのように。

```text
サーバー                              クライアント
┌────────────────────────┐         ┌─────────────────────────────────┐
│  renderToString        │         │                                 │
│                        │  HTML   │  ① ユーザーは即座に内容を目にする  │
│  <div>                 │ ──────> │     （ただし、まだ操作はできない）  │
│    <h1>こんにちは</h1>   │         │                                 │
│    <button>+1</button> │         │  ② JS bundle のダウンロード完了   │
│  </div>                │         │                                 │
└────────────────────────┘         │  ③ Hydration：                  │
                                   │     - 既存の DOM を走査する        │
                                   │     - onclick 等のイベントを紐づける │
                                   │     - コンポーネントの状態を復元する │
                                   │                                 │
                                   │  ④ インタラクティブになる！        │
                                   └─────────────────────────────────┘
```

**🐼**：理解しました！ サーバーが「画面」を担当し、クライアントが「魂」を担当するわけですね。でも、それってクライアントの JS Bundle は小さくなっていないということですよね？ すべてのコンポーネントのコードを依然としてクライアントに送る必要があるのでは？

**🧙‍♂️**：SSR の核心的な限界に気づいたな。 SSR には三つの代償がある：

第一に **サーバーへの負荷**。ユーザーのリクエストごとにサーバーでレンダリングを実行しなければならん。 100人が同時にアクセスすれば 100回のレンダリングだ。第二に **TTFB (Time To First Byte) の遅延**。サーバーがレンダリングを終えるまで、レスポンスの最初の1バイトも返せない。第三に、そしてこれが最も重要なのだが —— **全量 Hydration**。クライアントは依然として **すべての** コンポーネントの JavaScript を読み込み、 DOM ツリー全体を走査して各ノードを「自分のもの」として認識し直さなければならない。たとえそのコンポーネントが、一生インタラクションを必要としない静的なものだったとしても、だ。

**🐼**：三番目は特にもったいない気がします。例えばブログ記事の本文なんて、ただの静的なテキストですよね。なぜそのための JS をクライアントに送り、わざわざ Hydration する必要があるのでしょうか？

**🧙‍♂️**：その疑問を覚えておけ。後で答えに辿り着く。

## 15.6 SSG と ISR：静的であることの誘惑

**🐼**：師父、もしページの内容が頻繁に変わらないなら —— 例えばブログの記事のように —— ユーザーのリクエストのたびにレンダリングし直す必要はないですよね？ 事前に HTML を作っておくことはできないのですか？

**🧙‍♂️**：お前は今、 **SSG (Static Site Generation, 静的サイト生成)** を導き出したな。

SSG の発想は、 **ビルド時 (build time)** に `renderToString` を実行して、各ページを `.html` ファイルとして書き出し、それを CDN にデプロイしておく、というものだ。ユーザーがリクエストしたとき、 CDN はただそのファイルを返すだけ。サーバーでの計算は一切不要だ。

```
SSR： ユーザーリクエスト → サーバーがリアルタイムレンダリング → HTML を返す（毎回計算）
SSG： ビルド時にレンダリング → .html ファイルを生成 → CDN へ → ユーザーリクエスト → CDN が即座に返す
```

**🐼**：焼きたてのパンを並べておくのではなく、あらかじめ焼いておいて、客が来たらすぐ渡すようなものですね！ SSR よりずっと速そうです。でも問題が……もしブログの記事を更新したら、サイト全体をビルドし直さないといけないのですか？

**🧙‍♂️**：もしサイトに 10,000 件の記事があって、一つ直すたびに 10,000 ページをリビルドするのは現実的ではないな。それを解決するのが **ISR (Incremental Static Regeneration, 増量静的再生成)** だ。

ISR の発想は、各ページに **有効期限** を設けることだ。最初は静的ファイルとして返すが、期限が切れた後の最初のリクエストには古いバージョンを返しつつ（待たせずに即座に返す）、 **バックグラウンド** で再生成をトリガーする。次の訪問者には新しいバージョンが届く、というわけだ。

**🐼**：パンの賞味期限のようなものですね。期限が切れたらとりあえず古いパンを渡しつつ、裏でこっそり新しいパンを焼いておく、と。

**🧙‍♂️**：非常に的確な比喩だ。ここまで見てきたレンダリング戦略を整理してみよう：

| 戦略 | レンダリングのタイミング | 長所 | 短所 | 適した場面 |
|:-----|:---------|:-----|:-----|:---------|
| **SPA** | クライアント実行時 | 操作が滑らか | 初回表示が遅い、SEO に弱い | 管理画面、Web アプリ |
| **SSR** | リクエストごと | SEO に強い、初回表示が速い | サーバー負荷が高い、TTFB が遅い | 動的コンテンツ（SNS、EC） |
| **SSG** | ビルド時 | 極めて高速、サーバーコストゼロ | 更新には再ビルドが必要 | ブログ、ドキュメント、LP |
| **ISR** | ビルド時 + 定期更新 | 速度と鮮度を両立 | 誰かが古い内容を見ることになる | ニュース、製品紹介ページ |

**🐼**：どの戦略も、前の問題への「パッチ」でありつつ、また新しい問題を生んでいますね。

**🧙‍♂️**：それが技術の進化というものだ。そしてお前は気づいたか —— SSR も SSG も ISR も、共通の遺産を抱えていることに。

**🐼**：全量 Hydration ですね。サーバーで HTML を作っても、クライアントは結局 **全** コンポーネントの JS を読み込んで、 DOM ツリー全体を「再確認」しなきゃいけない。

**🧙‍♂️**：そうだ。では、いよいよその問題を解決しよう。

## 15.7 React Server Components (RSC)

**🧙‍♂️**：全量 Hydration の無駄について考え直してみよう。典型的なブログページを例にするぞ：

```text
BlogPage
├── Header          ← 検索窓がある。操作が必要
├── ArticleBody     ← テキストと画像のみ。完全に静的
│   └── 3000文字の本文
├── CodeBlock       ← シンタックスハイライト。静的
├── CommentList     ← DB から読み込んだコメント一覧。静的
│   └── 100件のコメント
└── LikeButton      ← いいねボタン。操作が必要
```

**🐼**：五つのコンポーネントのうち、本当に JavaScript が必要なのは `Header` と `LikeButton` だけですね。 `ArticleBody` 、 `CodeBlock` 、 `CommentList` は表示するだけです。

**🧙‍♂️**：だが従来の SSR では、五つすべてのコンポーネントの JS がクライアントに送られ、 Hydration の対象になる。あの 3000文字の本文や 100件のコメントのための JS コードが 50KB あったとしよう。クライアントはその 50KB をダウンロードして実行する。ただ「この静的なテキストにはイベントハンドラは不要だ」と確認するためだけに、だ。

**🐼**：あまりにもったいないです。「このコンポーネントはサーバー専用だから、 JS は送らなくていいよ」と React に伝えられたらいいのに。

**🧙‍♂️**：それこそが **React Server Components (RSC)** の核心的な洞察だ。

### Server Component vs Client Component

**🧙‍♂️**： RSC はコンポーネントを二種類に分けた：

```text
┌────────────────────────────────┐     ┌────────────────────────────────┐
│        Server Component        │     │        Client Component        │
│                                │     │                                │
│  ✅ await db.query() ができる   │     │  ✅ useState / useEffect       │
│  ✅ ファイルシステムが読める     │     │  ✅ ユーザーイベントを処理     │
│  ✅ サーバーの秘密鍵にアクセス   │     │  ✅ ブラウザ API にアクセス    │
│                                │     │                                │
│  ❌ useState は使えない         │     │  ❌ データベースに直接アクセス │
│  ❌ useEffect は使えない        │     │  ❌ サーバーのファイルは読めない │
│  ❌ イベントリスナーは置けない   │     │                                │
│                                │     │                                │
│  📦 クライアントへの JS はゼロ   │     │  📦 クライアントへ JS を送る   │
└────────────────────────────────┘     └────────────────────────────────┘
```

**🐼**：ということは、 Server Component のコードは、ユーザーのブラウザに届く JS Bundle には一切含まれないということですか？

**🧙‍♂️**：その通りだ。 `ArticleBody` や `CommentList` を Server Component にすれば、それらはサーバーでレンダリングされて終わりだ。 JS は一文字も送られない。 `Header` と `LikeButton` だけを Client Component にすれば、それらの JS だけがダウンロードされ、 Hydration される。

### RSC は SSR ではない

**🐼**：待ってください、サーバーでレンダリングする……それって SSR と何が違うのですか？

**🧙‍♂️**：そこが最も混同されやすい点だ。最大の違いは **出力形式** にある。並べて見てみろ：

```text
                  SSR                           RSC
          ┌────────────────┐           ┌────────────────────┐
出力形式   │   HTML 文字列   │           │   RSC Payload (JSON) │
          └────────────────┘           └────────────────────┘
          "<div><h1>タイトル</h1>        { type: "article",
           <button>いいね</button>        children: [
           </div>"                         { type: "h1", ... },
                                           { $$typeof: "client-ref",
                                             module: "LikeButton" }  ← 参照を保持
                                         ]
                                       }

クライアント  ツリー全体を Hydrate する     Client Component の部分だけ
がすること   （LikeButton の JS も送る     を Hydrate する
           し、静的テキストも走査する）    （ArticleBody の JS は不要）
```

**🐼**： `h1` タイトルはただのデータとして「インライン化」されているけれど、 `LikeButton` は **参照** として残されている。クライアントは参照されている部分だけ JS を読み込んで Hydrate すればいい、ということですね！

**🧙‍♂️**：正確だ！ これこそが RSC の精髄だ：

1. Server Component の出力は Payload の中に **内包** される（純粋なデータ。 JS はゼロ）。
2. Client Component は **参照** として表現される（「この JS ファイルを読み込め」という指示）。
3. クライアントは Payload を受け取ると、静的部分をそのまま DOM に反映させ、 Client Component の部分だけ JS をロードして Hydrate する。

サーバー上のコンポーネントがどう見えるか、イメージを見てみよう：

```javascript
// サーバーコンポーネント（概念コード。フルスタック環境が必要）
async function BlogPost({ id }) {
  const post = await db.query('SELECT * FROM posts WHERE id = ?', [id]);
  
  return h('article', null,
    h('h1', null, post.title),
    h('p', null, post.content),
    // LikeButton は Client Component。 "client-reference" としてマークされる
    { $$typeof: 'client-reference', module: './LikeButton.js', props: { postId: id } }
  );
}
```

サーバーがこのツリーをレンダリングして生成する RSC Payload（簡略版）は、およそ以下のようになる：

```json
{
  "type": "article",
  "props": {},
  "children": [
    { "type": "h1", "children": ["React Server Components を理解する"] },
    { "type": "p",  "children": ["RSC はコンポーネントを二種類に分け……（3000文字の本文）"] },
    { "$$typeof": "client-reference", "module": "./LikeButton.js", "props": { "postId": 42 } }
  ]
}
```

**🐼**：これなら全量 Hydration は不要ですね！ Client Component とマークされた部分だけが JS を必要とする。

### RSC をシミュレートする考え方

**🧙‍♂️**：単一の HTML ファイルの中で本物の RSC を動かすことはできん —— それにはサーバー環境が必要だからだ。だが、その **核心的な思想をシミュレートする** ことはできる。 Server Component の事前レンダリング → Payload 生成 → クライアントでの消費、という流れだ。

下のコードで使っている VNode 形式（ `node.type` と `node.props` ）に注目してほしい：

```javascript
// === RSC の核心的な流れをシミュレートする ===

// ステップ 1：「サーバーサイド」 —— コンポーネントを RSC Payload に変換（純粋なデータ。 JS 参照は含まない）
function serverRender(componentFn, props) {
  const vnode = componentFn(props);
  return resolveToPayload(vnode);
}

function resolveToPayload(node) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;  // テキストはそのまま
  }
  if (node.$$typeof === 'client-reference') {
    return node;  // Client Component：参照を保持し、サーバーでは展開しない
  }
  // 普通の要素：再帰的に解析。 node.type を使用（ node.tag ではない）
  return {
    type: node.type,                                       // ← 注意： tag ではなく type
    props: Object.keys(node.props).reduce((acc, k) => {
      if (k !== 'children') acc[k] = node.props[k];
      return acc;
    }, {}),
    children: (node.props.children || []).map(c => resolveToPayload(c))
  };
}

// ステップ 2：「クライアントサイド」 —— Payload を消費。 client-reference に遭遇したら対応する Client Component をレンダリング
function payloadToVNode(node, registry) {
  if (typeof node === 'string' || typeof node === 'number') {
    return node;
  }
  if (node.$$typeof === 'client-reference') {
    // レジストリから Client Component 関数を見つけて実行。ここで初めてクライアントで動く
    const componentFn = registry[node.module];
    return componentFn(node.props);
  }
  return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
}
```

**🐼**： `serverRender` がコンポーネントツリーを純粋なデータへと「圧縮」し、 `payloadToVNode` がそのデータを VNode へと「解凍」する。 Client Component はクライアントに届くまで実行されない、ということですね。

**🧙‍♂️**：そうだ。このデモでは「サーバー」と「クライアント」が同じ HTML 内にあるが、データの受け渡し方（関数を共有せず Payload を通す）は、 RSC のメカニズムを忠実にシミュレートしている。

> 💡 **本物の RSC を体験するには**： RSC には Next.js App Router のようなフルスタック環境が必要です。 `npx create-next-app` を実行して App Router を選択すれば、すぐに始められます。 App Router ではデフォルトですべてのコンポーネントが Server Component であり、 `'use client'` と書いたファイルだけが Client Component になります。

**🐼**：ということは、 SSR と RSC は組み合わせて使えるのですか？

**🧙‍♂️**：使えるどころか、 Next.js ではまさにそのように動いている。初回リクエスト時：

1. サーバーで RSC が走り、 Server Component から RSC Payload が生成される。
2. SSR がその RSC Payload と Client Component をまとめて HTML 文字列へとレンダリングし、ブラウザへ送る。
3. ブラウザは即座に HTML を表示する（初回表示が速い）。
4. JS のロード後、 Client Component の部分だけが Hydration される（ Bundle が小さい）。

**🐼**：それって、 PHP の時代に戻ったみたいじゃないですか？ サーバーで DB クエリを書いて UI を作るなんて。

**🧙‍♂️**：表面上はサイクルだが、本質的にはスパイラルアップ（螺旋状の進化）だ。 PHP は HTML 文字列を返すが、クライアントはその構造を理解できない。 RSC が返すのは **シリアライズ可能なコンポーネントツリー** だ —— クライアントはそれをインタラクティブな Client Component とシームレスに結合し、ページ遷移のないナビゲーションやストリーミングを実現できる。 20年前のシンプルさを、20年後の技術で再定義したのだ。

## 15.8 旅を振り返って：お前は React を「再発明」した

**🧙‍♂️**：ポーよ、未来について語る前に、この旅でお前が何をしてきたか振り返ってみよう。

```
お前はゼロから、自分自身の手でこれらを構築してきた：

Ch01  document.createElement     → 命令型の苦痛を味わった
Ch02  render(template, data)     → 宣言的なテンプレートを発明した
Ch03  EventEmitter + Model       → オブザーバーパターンのデータバインディングを作った
Ch04  UI = f(state)              → React の核心思想を悟った
Ch05  h() + mount() + patch()    → 仮想 DOM エンジンを実装した
Ch06  Component + Props          → コンポーネントシステムを構築した
Ch07  setState + Lifecycle       → コンポーネントに記憶と時間の感覚を授けた
Ch08  HOC + Render Props         → クラスコンポーネントの再利用の限界を体験した
Ch09  Stack Reconciler           → ブラウザの停滞危機に遭遇した
Ch10  Fiber Architecture         → 中断可能な連結リストエンジンを設計した
Ch11  Render & Commit Phase      → 二段階レンダリングメカニズムを実装した
Ch12  useState (Hooks)           → 関数コンポーネントに記憶力を授けた
Ch13  useEffect & Memoization    → 副作用とリアクティブな依存関係をマスターした
Ch14  createStore & Context      → 階層を超える状態管理を構築した
Ch15  useTransition              → 並行優先度スケジューリングを理解した
      throw Promise              → Suspense を理解した
      renderToString             → SSR を理解した
      RSC Payload                → Server Components を理解した

これこそが、 React の核心だ。
```

**🐼**：…… React は魔法じゃなかったのですね。正しいタイミングで行われた、一連の精巧なエンジニアリング上のトレードオフだったんだ。

## 15.9 終章：道 (Way) と器 (Tool)

**🧙‍♂️** は静かにお茶を啜った。窓の外は日が暮れ始めている。

**🧙‍♂️**：ポーよ、ここへ来た初日、お前は何を学びたいと言ったか覚えているか？

**🐼**：…… React を学びたいと言いました。道具だと思っていたんです。

**🧙‍♂️**：今はどうだ？

**🐼**：今は分かります。 React は単なるライブラリではありません。それは一連の **エンジニアリングの意思決定** の結晶です —— すべての決定は、現実の痛みから生まれていました：

- 命令的すぎて疲れる？ → 宣言的へ。
- 全量再描画が遅い？ → Virtual DOM Diff へ。
- ロジックが `this` に癒着している？ → Hooks へ。
- 階層を超えたデータ渡しが辛い？ → Context / 状態管理へ。
- 同期レンダリングがユーザーを邪魔する？ → 並行スケジューリングへ。
- SPA の初回表示が遅い？ → SSR / SSG へ。
- 全量 Hydration が無駄？ → Server Components へ。

一つの「解決策」が新しい「問題」を生み、その「問題」がまた新しい「解決策」を育む。それが技術の進化の本質なのだと。

**🧙‍♂️**：その通りだ。最高の技術は虚空から生まれるのではない。現実の問題を解決する過程で、自然と生えてくるものなのだ。お前が今日歩んできた道は、過去20年間に数千人のエンジニアが歩んできた道そのものなのだよ。

**🐼**：いつか React がもっと良いものに取って代わられたとしても、大丈夫でしょうか？

**🧙‍♂️**：構わんよ。お前が理解したのは単なる React の API ではなく、 **UI 開発における永遠のトレードオフ** なのだから：

- 宣言型 vs 命令型
- 全量更新 vs 細粒度更新
- 実行時の柔軟性 vs コンパイル時の最適化
- 開発体験 vs 実行性能
- クライアントサイドレンダリング vs サーバーサイドレンダリング

将来どんな名前のフレームワークが現れようとも、これらの次元における選択からは逃れられん。そしてお前は、すでにそれらの次元を自在に往来する能力を身につけている。

**🐼** は深く頭を下げた。

**🐼**：ありがとうございました、師父。

**🧙‍♂️** は微笑んだ。

**🧙‍♂️**：さあ、行け。お前自身の世界を構築するのだ。

---

### 📦 やってみよう

以下のコードを `ch15.html` として保存しよう。中断 (Suspense)、サーバーサイドレンダリング (SSR)、そして React Server Components (RSC) の全フローをカバーする、究極の実験だ：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 15 — Concurrent, Suspense, SSR & RSC</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; background: #fafafa; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; background: #fff; }
    .card h3 { margin-top: 0; }
    button { padding: 8px 16px; cursor: pointer; margin: 4px; border-radius: 4px; border: 1px solid #ccc; background: #eee; }
    .user-card { background: #f0f8ff; padding: 10px; border-radius: 4px; margin-top: 10px; border-left: 4px solid #0066cc; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; max-height: 300px; overflow-y: auto; }
    .html-output { background: #e8f5e9; padding: 12px; border-radius: 6px; margin-top: 8px; border: 1px dashed #4caf50; }
    .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .rsc-server { background: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .rsc-client { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0; }
    .arrow { text-align: center; font-size: 24px; color: #999; margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Chapter 15 — The Ultimate React Architecture</h1>
  
  <!-- Demo 1: Suspense on Fiber Engine -->
  <div class="card">
    <h3>1. Suspense: throw Promise パターン</h3>
    <p>ボタンをクリックしてデータの読み込みをシミュレートしてください。 Fiber エンジン下で、コンポーネント内で Promise が投げられた (throw) 場合、現在のレンダリングは中断され fallback UI に切り替わります。データが準備できれば Fiber は自動的に再描画されます。</p>
    <button id="btn-suspense">🔄 ユーザーデータをロード (Suspense)</button>
    <div id="suspense-root" style="margin-top: 10px; min-height: 80px;">
      <p style="color: #999; font-style: italic;">上のボタンをクリックして Fiber のサスペンドを体験してください…</p>
    </div>
  </div>

  <!-- Demo 2: renderToString (SSR) -->
  <div class="card">
    <h3>2. renderToString: サーバーサイドレンダリングのシミュレーション</h3>
    <p>ボタンをクリックして、 VNode がどのように HTML 文字列に変換されるか（SSR の核心）を確認してください。イベントリスナーは意図的にスキップされます（ Hydration を待つため）。</p>
    <button id="btn-ssr">🖥️ renderToString を実行</button>
    <div id="ssr-root"></div>
  </div>

  <!-- Demo 3: RSC Payload -->
  <div class="card">
    <h3>3. RSC Payload: Server Component のシミュレーション</h3>
    <p>RSC の核心的な流れをシミュレートします：サーバーで Server Component をレンダリング → 純粋な RSC Payload (JSON) を生成 → クライアントが受信し Client Component を起動。</p>
    <button id="btn-rsc">🚀 RSC フローをシミュレート</button>
    <div id="rsc-root"></div>
  </div>

  <script>
    // ============================================
    // 1. 底レイヤーエンジン: Mini-React (Fiber + Suspense)
    // ============================================
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

    let workInProgress = null, currentRoot = null, wipRoot = null, deletions = null, wipFiber = null, hookIndex = null;

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
        updateFunctionComponent(fiber);
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

    function updateFunctionComponent(fiber) {
      wipFiber = fiber;
      hookIndex = 0;
      wipFiber.hooks = [];
      
      try {
        // 正常系：コンポーネント関数を実行し子要素を得る
        const children = [fiber.type(fiber.props)].flat();
        reconcileChildren(fiber, children);
      } catch (e) {
        // 🔥 Suspense の核心：投げられた Promise をキャッチする
        if (e instanceof Promise) {
          // 1. fallback UI をレンダリング（待機画面）
          const fallbackMsg = fiber.props.fallback || '⏳ 読み込み中…';
          reconcileChildren(fiber, [h('span', { style: 'color:#999' }, fallbackMsg)]);
          
          // 2. Promise が resolve したら、ツリー全体の再レンダリングをトリガー
          e.then(() => {
            wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot };
            deletions = [];
            workInProgress = wipRoot;
          });
        } else {
          throw e; // Promise でなければ本物のエラー。さらに上へ投げる
        }
      }
    }

    function useState(initial) {
      const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];
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

    // ============================================
    // 2. Demo: Suspense (throw Promise 実演)
    // ============================================
    function createResource(fetchFn) {
      let status = 'pending';
      let result;
      let promise = fetchFn().then(
        data => { status = 'success'; result = data; },
        err => { status = 'error'; result = err; }
      );
      return {
        read() {
          if (status === 'pending') throw promise; // 🔥 準備できていなければ Promise を throw！
          if (status === 'error') throw result;
          return result;
        }
      };
    }

    let userResource = null;

    function UserProfile() {
      // Render Phase でデータを読み込み。準備できていなければ throw Promise
      const user = userResource.read();
      return h('div', { className: 'user-card' },
        h('strong', null, user.name),
        h('p', null, '役割: ' + user.role),
        h('p', null, 'レベル: ' + user.level),
        h('em', { style: 'color: green' }, '✅ データ読み込み完了。 Fiber レンダリングが再開されました！')
      );
    }

    function SuspenseApp() {
      const [started, setStarted] = useState(false);
      
      window.triggerSuspense = () => {
        userResource = createResource(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ name: 'ポー、龍の戦士', role: 'React 探求者', level: 99 }), 1500)
          )
        );
        setStarted(true);
      };

      if (!started) return h('p', { style: 'color: #999; font-style: italic;' }, '上のボタンをクリックして、未準備のデータに遭遇した Fiber がどうサスペンドして fallback を使うか体験してください…');

      // UserProfile 内で throw Promise され、 updateFunctionComponent の try/catch がそれを捕まえます。
      // fallback の文字が表示され、 Promise が解決した後に再レンダリングされます。
      return h(UserProfile, { fallback: '⏳ サーバーからユーザーデータを取得中…（Fiber の実行は一時停止しています）' });
    }

    render(h(SuspenseApp, null), document.getElementById('suspense-root'));

    document.getElementById('btn-suspense').addEventListener('click', () => {
      if (window.triggerSuspense) window.triggerSuspense();
    });

    // ============================================
    // 3. Demo: renderToString (SSR シミュレーション)
    // ============================================
    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 注意：全編を通して使用している vnode.type と vnode.props.children の形式を使用します
    function renderToString(vnode) {
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        return escapeHtml(String(vnode));
      }
      if (vnode.type === 'TEXT_ELEMENT') {
        return escapeHtml(String(vnode.props.nodeValue));
      }
      let html = '<' + vnode.type;
      for (const key in vnode.props) {
        if (key === 'children') continue;
        if (key.startsWith('on')) continue; // ⚡ サーバーサイドではイベントを付着させない
        html += ' ' + key + '="' + escapeHtml(vnode.props[key]) + '"';
      }
      html += '>';
      const children = vnode.props.children || [];
      for (const child of children) {
        html += renderToString(child);
      }
      html += '</' + vnode.type + '>';
      return html;
    }

    const ssrRoot = document.getElementById('ssr-root');
    document.getElementById('btn-ssr').addEventListener('click', () => {
      ssrRoot.innerHTML = '';
      const vnode = h('div', { className: 'card' },
        h('h2', null, 'SSR でレンダリングされたリスト'),
        h('ul', null,
          h('li', null, 'React を学ぶ'),
          h('li', null, 'SSR を理解する')
        ),
        h('button', { onclick: () => alert('SSR された HTML のボタンはまだ Hydration 前なので、クリックしても無駄ですよ！') }, 'まだ生きていないボタン（Hydration が必要）')
      );

      const htmlString = renderToString(vnode);

      ssrRoot.innerHTML += `<p class="label">① VNode データ構造</p><pre>${JSON.stringify(vnode, null, 2)}</pre>`;
      ssrRoot.innerHTML += `<p class="label">② renderToString による純粋な文字列出力</p><pre>${escapeHtml(htmlString.replace(/></g, '>\n<'))}</pre>`;
      ssrRoot.innerHTML += `<p class="label">③ ブラウザがレンダリングした HTML（onclick が剥ぎ取られているためボタンは反応しません）</p><div class="html-output">${htmlString}</div>`;
    });

    // ============================================
    // 4. Demo: RSC Payload (Server Component シミュレーション)
    // ============================================
    const rscRoot = document.getElementById('rsc-root');

    // Server Component：サーバーサイドで実行され、クライアントには送信されません
    function BlogPage(props) {
      const post = { title: 'RSC を理解する', content: 'RSC は生の HTML ではなく JSON Payload を生成します。クライアントは Client Component の部分だけを Hydrate すればよくなります…', author: '師父' };
      return h('article', null,
        h('h2', null, post.title),
        h('p', null, post.content),
        h('p', { style: 'color: #666; font-size: 13px;' }, '著者: ' + post.author),
        // LikeButton は Client Component。参照として残し、サーバーでは展開しません
        { $$typeof: 'client-reference', module: 'LikeButton', props: { postId: props.id } }
      );
    }

    // 「サーバーサイド」：コンポーネントツリーをシリアライズ可能な Payload に変換
    function serverRender(componentFn, props) {
      return resolveToPayload(componentFn(props));
    }

    function resolveToPayload(node) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') return node; // Client Component：参照を保持
      return {
        type: node.type, // ← type を使用。 VNode 形式と一致
        props: Object.keys(node.props).reduce((acc, k) => {
          if (k !== 'children') acc[k] = node.props[k];
          return acc;
        }, {}),
        children: (node.props.children || []).map(c => resolveToPayload(c))
      };
    }

    // 「クライアントサイド」： Payload を VNode に戻す。 client-reference に遭遇した時に Client Component を実行
    function payloadToVNode(node, registry) {
      if (typeof node === 'string' || typeof node === 'number') return node;
      if (node.$$typeof === 'client-reference') {
        // ここで初めて、クライアント側で Client Component が実行されます
        const fn = registry[node.module];
        return fn(node.props);
      }
      return h(node.type, node.props, ...node.children.map(c => payloadToVNode(c, registry)));
    }

    // Client Component： LikeButton (インタラクションがあり、クライアントで State を持ちます)
    function LikeButton(props) {
      const [count, setCount] = useState(0);
      return h('button', { 
        style: 'background:#ff6b6b;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;font-size:14px;',
        onclick: () => setCount(count + 1)
      }, `❤️ いいね (${count})`);
    }

    const clientRegistry = { 'LikeButton': LikeButton };
    let _rscRendered = false;

    document.getElementById('btn-rsc').addEventListener('click', () => {
      if (_rscRendered) return;
      _rscRendered = true;
      rscRoot.innerHTML = '';

      // ステップ 1：サーバー側で Payload を生成
      const rscServerDiv = document.createElement('div');
      rscServerDiv.className = 'rsc-server';
      rscServerDiv.innerHTML = '<strong>🖥️ リモートサーバー</strong>： BlogPage を実行し、 RSC Payload を生成（純粋な JSON。 BlogPage の関数コードは含まない）';
      rscRoot.appendChild(rscServerDiv);

      const payload = serverRender(BlogPage, { id: 42 });
      
      const pLabel1 = document.createElement('p');
      pLabel1.className = 'label';
      pLabel1.innerText = 'RSC Payload (通信データ形態：純粋な JSON。 BlogPage コンポーネント関数はブラウザに送られません)';
      rscRoot.appendChild(pLabel1);

      const pre1 = document.createElement('pre');
      pre1.innerText = JSON.stringify(payload, null, 2);
      rscRoot.appendChild(pre1);
      
      const arrowDiv = document.createElement('div');
      arrowDiv.className = 'arrow';
      arrowDiv.innerText = '⬇️ ネットワーク転送（純粋な JSON。 JS はゼロ）';
      rscRoot.appendChild(arrowDiv);

      // ステップ 2：クライアント側で Payload を消費
      const rscClientDiv = document.createElement('div');
      rscClientDiv.className = 'rsc-client';
      rscClientDiv.innerHTML = '<strong>🌐 ローカルクライアント</strong>： Payload を受信し、 client-reference を発見。対応する LikeButton Client Component をロードし、 Fiber でレンダリング';
      rscRoot.appendChild(rscClientDiv);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'html-output';
      rscRoot.appendChild(wrapper);
      
      // payloadToVNode によりクライアント側で LikeButton が実行されます
      function PayloadRenderer() {
        return payloadToVNode(payload, clientRegistry);
      }
      render(h(PayloadRenderer, null), wrapper);
    });
  </script>
</body>
</html>
```
