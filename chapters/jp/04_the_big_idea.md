# 第四章：偉大な構想 —— UI は状態の関数である (The Big Idea)

![figure 4.1](../../website/public/images/ch04_big_idea.png)

## 4.1 簡素化への渇望

ポーは疲れ果てて椅子の背もたれに寄りかかっていた。前回の MVC パターンは確かに正確だったが、複雑に絡み合ったイベントリスナーに息が詰まりそうだったのだ。

**🐼**：師父、いわゆる「正確な更新」のために、私たちは大量の `on('change')` コードを手書きしなければなりませんでした。新機能を追加するたびに、慎重にイベントをバインドし、解除し……。もう疲れました。
第二章の「テンプレートエンジン」が恋しいです。パフォーマンスや体験は良くなかったですが、本当にシンプルでした。データが変われば、 `renderApp()` をもう一度呼び出すだけでよかったのですから。

**🧙‍♂️**：お前は問題の本質に気づいたようだな。
MVC では、パフォーマンス（部分的な DOM 更新）のために、開発の簡潔さ（依存関係の手動管理）を犠牲にした。
テンプレート時代には、開発の簡潔さ（全量更新）を手に入れたが、パフォーマンスと体験を犠牲にした。

**🐼**：両方の良いとこ取りはできないのでしょうか？
テンプレートのようにコードを書きたい（宣言型）けれど、動作は MVC のように速くあってほしい（細粒度の更新）。

言い換えれば、ある関数が欲しいのです。現在の状態を渡せば、インターフェースがどうあるべきかを直接教えてくれるような関数です。

**🧙‍♂️**：お前は今、フロントエンドフレームワークの歴史において最も重要な思想の転換を一言で要約したな。公式で表すとこうなる：

$$ UI = f(state) $$

2011年、Facebook のエンジニアも同じ苦境に直面し、全く同じことを考えたのだ。後にこの思想は React フレームワークの核心へと進化した。そして私たちが次に行うのは、この思想を自らの手で実装することだ。

## 4.2 「更新」を再考する

**🧙‍♂️**：ポーよ、理想の世界を想像してみろ。ブラウザの DOM 操作が極めて高速で、無視できるほどだとしたら、お前はどうコードを書く？

**🐼**：それなら `innerHTML` で毎回ページ全体を書き換えますよ！それが一番簡単ですし、 `Model` もリスナーも必要ありませんから。

**🧙‍♂️**：その通りだ。残念ながら、第二章で見たように全量再描画の代償は大きい。パフォーマンスが悪いだけでなく、DOM ツリー全体を破壊するため、入力欄のフォーカスが失われ、ユーザーの状態が消えてしまう。問題はどこにあると思う？

**🐼**：実際の DOM を直接操作していることでしょうか。毎回全量を再構築するのは無駄が多すぎます。

**🧙‍♂️**：では、実際の DOM を直接操作しないとしたらどうだ？ 一歩下がって考えてみろ。実際に手を下す前に、まず「演習」をしてみることはできないか？

**🐼**：「演習」ですか？ つまり……頭の中で何を直すか決めてから、手を動かすということですか？

**🧙‍♂️**：近いな。だが「頭の中」ではない。JavaScript の中だ。UI を実際の DOM としてレンダリングするのではなく、普通の **JavaScript オブジェクト** としてレンダリングしたらどうなる？

**🐼**：JavaScript オブジェクト？ つまり、ページの構造を記述するオブジェクト…… `{ tag: 'div', children: [...] }` のようなものですか？

**🧙‍♂️**：その通りだ。これらは単なる普通の JS オブジェクトであり、作成するのに時間はほとんどかからん。さて、前回のレンダリングで作ったオブジェクトツリーがあり、新しく生成したオブジェクトツリーもあるとしよう。次にお前は何をする？

**🐼**：二つのツリーを比較して……どこが違うかを見つけます！

**🧙‍♂️**：それから？

**🐼**：そして、違う部分だけを実際の DOM に適用します！そうすれば毎回 DOM ツリー全体を再構築しなくて済みます！

**🧙‍♂️**：今、その二つのステップを繋げてみろ。開発者にとって、体験はどうなる？

**🐼**：開発者にとっては、毎回オブジェクトツリー全体を生成し直すだけなので、テンプレートのように簡単に書けます。でもブラウザにとっては、実際に変化したノードだけが更新されるので、パフォーマンスは手動で最適化した MVC に近くなります。唯一の代償は、比較のために少し CPU 計算が増えることですが……。待ってください、これこそが良いとこ取りじゃないですか？！

**🧙‍♂️**：お前が一歩ずつ導き出したものこそが、仮想 DOM (Virtual DOM) の核心思想だ。この「JavaScript オブジェクトツリー」は **仮想 DOM (Virtual DOM)** と呼ばれている。

## 4.3 純粋なマッピング

**🧙‍♂️**：核心思想を導き出したところで、実践してみよう。仮想ノード (VNode) の構造と差分比較に集中するため、一旦 Todo リストから離れて、より単純な Counter でデモをしよう。エンジンが成熟してから Todo リストに戻ればいい。
まず、UI の記述方法を変える必要がある。テンプレート時代には、文字列で UI を記述していたな：
`<li>${todo.text}</li>`

これからは、**データ構造** で UI を記述する。

**🐼**：文字列ではなくオブジェクトで UI を記述するのは、オブジェクトなら階層ごとに差分を比較できるけれど、文字列ではそれが難しいからですよね？

**🧙‍♂️**：その通りだ。オブジェクトは構造化されており、アルゴリズムによる分析に天然に適している。
さあ、状態を受け取り、UI を記述するオブジェクトツリーを返す関数を書いてみろ。

まず、この UI を HTML で記述するとどうなるか考えてみよう：

```html
<div id="app">
  <h1>Count: 0</h1>
  <button onclick="increment()">Add</button>
  <ul>
    <li>Buy Milk</li>
    <li>Learn React</li>
  </ul>
</div>
```

今、これと **全く同じ構造** を JavaScript オブジェクトで記述するのだ。各 HTML タグは `{ tag, props, children }` というオブジェクトになる。

**🐼**：

```javascript
// 状態
const state = {
  count: 0,
  todos: ['Buy Milk', 'Learn React']
};

function render(state) {
  return {
    tag: 'div',
    props: { id: 'app' },
    children: [
      {
        tag: 'h1',
        props: {},
        children: ['Count: ' + state.count]
      },
      {
        tag: 'button',
        props: { onclick: () => { state.count++; } }, // 注意：これは関数への参照であり、文字列ではない！
        children: ['Add']
      },
      {
        tag: 'ul',
        props: {},
        children: state.todos.map(todo => ({
          tag: 'li',
          props: {},
          children: [todo]
        }))
      }
    ]
  };
}

const vdom = render(state);
console.log(vdom);
```

**🧙‍♂️**：見ろ、この `vdom` オブジェクトが現在の状態における UI の **スナップショット (Snapshot)** だ。
二つの重要なポイントに注目しろ：

1. **プロパティ値は JS の値である**： `onclick: increment` は関数の参照であり、文字列ではない。これは安全であり（XSS のリスクがない）、かつ効率的だ（参照が変わったかどうかを `===` で比較できる）。
2. **入れ子構造が UI ツリーをマッピングしている**： このオブジェクトツリーの構造は、DOM ツリーの構造と完全に対応している。

もし `state.count` が 1 に変わったら、もう一度 `render(state)` を呼び出す。すると新しいスナップショットが得られる。

**🐼**：このステップは速いです。単にいくつかの JS オブジェクトを作成しただけで、実際の DOM には触れていませんから。

**🧙‍♂️**：そうだ。次の魔法は、これら二つのスナップショット間の「差分」を、実際の DOM 操作の指令にどう変換するかにある。

## 4.4 データの唯一の真実 (Single Source of Truth)

**🧙‍♂️**：このモデルにおいて、データはどのように流れている？

**🐼**： **一方向** のように見えます。

1. データ (State) が `render` 関数に入る。
2. `render` 関数が 仮想 DOM を出力する。
3. 仮想 DOM が最終的に 実際の DOM になる。

MVC のように View が直接 Model を変え、Model がまた View を変えて……といった混乱がありません。ここでは、UI は常に State の投影です。

**🧙‍♂️**：これこそが私たちが追い求めてきた **唯一の信頼できる情報源 (Single Source of Truth)** だ。

* **MVC/MVVM**： View の入力が直接 Model を修正し、Model がまた View の更新をトリガーするため、データの源泉が曖昧になる。
* **React**： UI は State の純粋関数である。UI を変えたいなら、State（源泉）を変え、UI 全体を生成し直さなければならない。

**🐼**：わかりました。プロジェクターのようなものですね。映像は常にフィルムから来ます。映像を変えたければ、スクリーンを拭くのではなく、フィルムを替えなければなりません。

**🧙‍♂️**：非常に素晴らしい比喩だ。この原則は状態管理を簡素化するだけでなく、将来私たちが複雑な **コンポーネントシステム** を構築するための強固な基礎となる。
重要なのは、これがプログラムを **予測可能 (Predictable)** にするということだ。アプリがどれだけ長く動いていようと、その瞬間の State さえあれば、UI がどうなっているかを確実に知ることができるのだ。

## 4.5 歴史の脚注：React の誕生 (2011-2013)

**🧙‍♂️**：この "UI = f(state)" という考え方は、最初から全員に受け入れられたわけではない。
2011年、Facebook の広告システムはメンテナンスが困難になっていた。エンジニアの **Jordan Walke** は、Facebook 内部で使用されていた PHP 拡張である **XHP** から着想を得た。XHP は PHP コードの中に直接 XML/HTML を記述することを可能にし、テンプレートとコードの境界を曖昧にするものだった。彼はこれをヒントに、内部で React の初期プロトタイプを作成したのだ。

> **背景**：当時は双方向バインディング（Angular, Knockout）が主流だった。Jordan が 2013年の JSConf US で初めて React を公開したとき、会場から歓声は上がらなかった。誰もが「JS の中に HTML を書く」（後の JSX）のは大きな後退だと感じ、「全量再描画」はパフォーマンスが極めて悪いと考えたのだ。

**🧙‍♂️**：だが、それこそが天才の洞察だった。Jordan は、仮想 DOM が十分に速ければ、**開発体験** のために **実行時のパフォーマンス** を少しだけ犠牲にできることに気づいたのだ。

## 4.6 準備は整った

**🧙‍♂️**：React は魔法のような黒魔術ではない。ただ大胆なトレードオフを行っただけだ：
追加の CPU 計算（仮想 DOM の生成、差分比較）とメモリ消費（メモリ内に常に完全な仮想 DOM ツリーを保持する）を導入することで、開発者の認知的負荷の軽減（DOM 更新の手動管理からの解放）を手に入れたのだ。

**🐼**：代償は CPU とメモリで、得られるのは開発効率とメンテナンス性ということですね。現代のデバイスの性能が向上し続けていることを考えれば、この計算は割に合います。

**🧙‍♂️**：だがポーよ、理念だけでは不十分だ。「新旧の差分を比較する」と言ったが、具体的にどうやるのだ？
この `vdom` を実際のインターフェースにするには、 `mount` 関数をどう書けばいい？
状態が変わったとき、 `patch` 関数を使って変化した部分だけを更新するにはどうすればいい？

**🐼**：それは……複雑なアルゴリズムが必要になりそうですね。

**🧙‍♂️**：次回のレッスンでは、ボンネットの中を覗き込み、この核心となるエンジンを自らの手で作り上げていこう。

---

### 📦 やってみよう

以下のコードを `ch04.html` として保存しよう。
この章ではまだ Diff アルゴリズムを実装していないが、**仮想 DOM** が一体どのような姿をしているかを確認できる。次回のレッスンでは、ここでの `innerHTML` を `patch` 関数に置き換えることになる。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 4 — The Big Idea</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 13px; }
    button { padding: 8px 16px; font-size: 16px; margin-top: 10px; cursor: pointer; }
    .note { color: #999; font-size: 13px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>UI = f(state)</h1>
  <p>ボタンをクリックして、Virtual DOM オブジェクトが状態に合わせてどのように変化するか観察してください。
     注意：この章ではまだ innerHTML を使用しています（次回のレッスンで patch に置き換えます）。</p>
  
  <div id="app">
    <!-- UI はここにレンダリングされます -->
  </div>
  
  <h3>現在の Virtual DOM スナップショット：</h3>
  <pre id="vdom-display"></pre>

  <p class="note">💡 ボタンの onclick は VNode の中では関数への参照（文字列ではない）です。
    これはテンプレート時代の <code>onclick="increment()"</code> よりも安全で（XSS リスクがない）、
    かつ効率的（=== で参照を比較できる）です。</p>

  <script>
    // 1. 状態
    const state = {
      count: 0
    };

    let prevSnapshot = null; // 前回の VNode スナップショットを保存

    // 2. これもテンプレートの一種ですが、返すのは JS オブジェクト (Virtual DOM) です
    // これは React.createElement の雛形です
    function render(state) {
      return {
        tag: 'div',
        props: { style: 'border: 1px solid #ccc; padding: 10px;' },
        children: [
          {
            tag: 'h1',
            props: { style: 'color: #333' },
            children: ['Count: ' + state.count]
          },
          {
            tag: 'p',
            props: {},
            children: ['The UI is a function of state.']
          },
          {
            tag: 'button',
            props: { onclick: increment }, // 関数の参照！
            children: ['Add']
          }
        ]
      };
    }

    function increment() {
      state.count++;
      updateApp();
    }

    // 3. レンダリングのシミュレーション 
    // ⚠️ ここではまだ innerHTML を使っています —— 次回の patch がこれに取って代わります
    function updateApp() {
      const vnode = render(state);
      
      // 新旧 VNode の比較を表示（変化をハイライト）
      const display = document.getElementById('vdom-display');
      const newJson = JSON.stringify(vnode, (key, val) => typeof val === 'function' ? '[Function: ' + val.name + ']' : val, 2);
      
      if (prevSnapshot) {
        // diff をハイライト表示
        const oldLines = prevSnapshot.split('\n');
        const newLines = newJson.split('\n');
        let diffHtml = '';
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const ol = oldLines[i] || '';
          const nl = newLines[i] || '';
          if (ol !== nl) {
            diffHtml += '<span style="background:#ffe0e0;text-decoration:line-through;">' + ol.replace(/</g,'&lt;') + '</span>\n';
            diffHtml += '<span style="background:#e0ffe0;font-weight:bold;">' + nl.replace(/</g,'&lt;') + '</span>\n';
          } else {
            diffHtml += nl.replace(/</g,'&lt;') + '\n';
          }
        }
        display.innerHTML = diffHtml;
      } else {
        display.textContent = newJson;
      }
      prevSnapshot = newJson;
        
      // 単純かつ強引に表示を更新 (次回のレッスンで Diff + Patch に置き換えます)
      const appEl = document.getElementById('app');
      appEl.innerHTML = `
        <div style="${vnode.props.style}">
           <h1 style="${vnode.children[0].props.style}">${vnode.children[0].children[0]}</h1>
           <p>${vnode.children[1].children[0]}</p>
           <button id="inc-btn">${vnode.children[2].children[0]}</button>
        </div>
      `;
      // innerHTML が DOM を再構築したため、イベントを再バインドする必要がある
      document.getElementById('inc-btn').addEventListener('click', increment);
    }

    // 初期化
    updateApp();
  </script>
</body>
</html>
```
