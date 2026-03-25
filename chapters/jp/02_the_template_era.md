# 第二章：テンプレート時代 —— UI は文字列である (The Template Era)

![figure 2.1](../../website/public/images/ch02_template.png)

## 2.1 指令ではなく記述

ポーは再び師父の部屋を訪れた。その表情は前回よりもいくらか晴れやかだったが、依然として困惑の色も混じっていた。

**🐼**：師父、前回「インターフェースを一つのテキストと見なす」とおっしゃいましたよね。戻ってから試してみましたが、HTML 文字列を直接繋ぎ合わせる方が、ノードを一つ一つ作成するよりもずっと早いことに気づきました。例えば第一章のレンダリングロジックですが：

```javascript
function renderApp() {
  let html = '<h1>My Todo List</h1>'
           + '<input type="text" id="todo-input" placeholder="Add a task">'
           + '<button onclick="addTodo()">Add</button>'
           + '<ul>';
  
  for (let i = 0; i < todos.length; i++) {
    html += '<li>' + todos[i] + '</li>';
  }
  
  html += '</ul>';
  app.innerHTML = html;
}
```

これで一度 `innerHTML` を呼び出すだけで済みます！

**🧙‍♂️**：現場監督のようにレンガ一つ一つの行方を指示しなくて済むようになったわけだが、気分はどうだ？

**🐼**：自由になった気分です。「どうやって作るか」ではなく、「どう見えるべきか」だけに集中すればいいのですから。ただ……。

**🧙‍♂️**：ただ？

**🐼**：コードがとても見にくいです。引用符やプラス記号があちこちに飛び交っていて。

**🧙‍♂️**：それはお前がまだ原始的な言語を使っているからだ。もっと単純な **テンプレート (Template)** 構文を作って、データが骨組みの中に収まるようにしてみよう。

## 2.2 単純なテンプレートエンジン

**🧙‍♂️**：まず、データを入れるための「穴」が開いた文字列テンプレートと、いくつかのデータを受け取り、データを流し込んだ HTML を返す関数が必要だ。

**🐼**：このような感じでしょうか？

```javascript
const template = '<li>{{content}}</li>';
const data = { content: 'Buy Milk' };
// 期待される結果: <li>Buy Milk</li>
```

**🧙‍♂️**：その通り。それを実装してみるのだ。

ポーは少し考え、正規表現に基づいた単純な実装を書き上げた。

```javascript
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    return data[key] || '';
  });
}

// 使用例
const task = { content: 'Learn React' };
const html = render('<li>{{content}}</li>', task);
console.log(html); // <li>Learn React</li>
```

**🧙‍♂️**：よろしい。これがテンプレートエンジンの核心的な原理だ。テンプレートの「穴」をデータで埋める。ES6 のテンプレートリテラル (Template Literals) も実際にはこれと同じ概念だが、言語レベルでサポートされているため、より便利だ。

```javascript
// 我々の render 関数：
render('<li>{{content}}</li>', { content: task })

// ES6 テンプレートリテラル（本質は同じだが、構文がより簡潔）：
`<li>${task}</li>`
```

**🐼**：なるほど！テンプレートリテラルは、言語に組み込まれたテンプレートエンジンなのですね。

**🧙‍♂️**：そうだ。では、その考え方で ToDo リストをリファクタリングしてみろ。もう `document.createElement` も `appendChild` も必要ない。

## 2.3 テンプレートで ToDo リストを書き換える

**🐼**：わかりました！

```javascript
const app = document.getElementById('app');
const state = {
  todos: [
    { text: 'Learn JavaScript', done: true },
    { text: 'Learn Templates', done: false }
  ],
  inputValue: ''
};

function renderApp() {
  const html = `
    <div class="card">
      <h3>My Todo List</h3>
      <div>
        <input type="text" id="todo-input" value="${state.inputValue}">
        <button id="add-btn">Add</button>
      </div>
      <p id="stats">合計 ${state.todos.length} 件</p>
      <ul style="padding-left: 0;">
        ${state.todos.map((todo, index) => `
          <li class="${todo.done ? 'done' : ''}">
            <div class="task-content">
              <input type="checkbox" class="toggle-btn" data-index="${index}" ${todo.done ? 'checked' : ''}>
              <span>${todo.text}</span>
            </div>
            <button class="delete-btn" data-index="${index}">×</button>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
  
  // 1. 破壊と再構築
  app.innerHTML = html;

  // 2. ノードを再取得してイベントをバインド（テンプレート時代の痛み！）
  document.getElementById('todo-input').addEventListener('input', (e) => {
    state.inputValue = e.target.value;
    // 入力するたびに表示全体が再描画される
    renderApp(); 
  });

  document.getElementById('add-btn').addEventListener('click', () => {
    if (!state.inputValue) return;
    state.todos.push({ text: state.inputValue, done: false });
    state.inputValue = '';
    renderApp();
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      state.todos.splice(index, 1);
      renderApp();
    });
  });

  document.querySelectorAll('.toggle-btn').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const index = e.target.dataset.index;
      state.todos[index].done = !state.todos[index].done;
      renderApp();
    });
  });
}

// 初期化
renderApp();
```

**🐼**：おお、構造が一目瞭然です。データ `state` を変更して `renderApp()` を呼び出すだけで、画面が自動的に更新されます。統計の数字も手動で同期する必要がありません。テンプレートの中にあり、データに合わせて自動的に変わりますから！

**🧙‍♂️**：お前は素晴らしい点に気づいたな。第一章では、統計の数字を同期させるために手動で `updateStats()` を呼び出す必要があった。だが今は、統計の数字は単なる状態の **派生物** に過ぎない。状態が変われば、テンプレート全体を再レンダリングするだけで、すべてが自動的に同期される。
この書き方は、本質的には **宣言型プログラミング (Declarative Programming)** の雛形だ。「状態に対応する表示がどうあるべきか」を宣言し、状態の変化時にどう表示を更新するかを気にする必要がない。

## 2.4 破壊と再構築 (The Blow-away Problem)

**🧙‍♂️**：だがポーよ、その新しい作品を実際に使ってみろ。入力欄にいくつか文字を打ってみるのだ。

ポーはブラウザでページを開き、入力欄をクリックして文字「A」を入力した。
すると突然、入力欄のフォーカス (Focus) が失われた。次の文字「B」を入力するためには、再び入力欄をクリックしなければならない。再度入力すると、またフォーカスが消えた。

**🐼**：これはどういうことですか？一文字打つたびに、入力欄をもう一度クリックしなきゃいけないなんて。これじゃ使い物になりません！

**🧙‍♂️**：一連の流れを考えてみろ。「A」キーを押した瞬間、何が起きた？

```
"A" を押す
  → input イベントがトリガーされる
    → state.inputValue を更新し renderApp() を呼び出す
      → renderApp() が新しい HTML 文字列を生成する
        → app.innerHTML = html  ← 古い DOM ツリーがすべて破壊される！
          → ブラウザが新しい DOM を古い DOM と置き換える
            → 新しい input にはフォーカスがない → お前が再度クリックしなければならない
```

**🐼**：あっ、わかりました！一文字打つたびに、DOM ツリー全体が破壊され再構築されているのですね！

**🧙‍♂️**：その通りだ。電球を一つ替えるために、家全体を取り壊して建て直しているようなものだ。

* DOM が新しく作成されたため、以前の入力欄要素はすでに「死んで」いる。
* 新しい入力欄は見た目こそ同じだが、全く別の新しい要素だ。
* 全く新しい要素にフォーカスがあるはずもなく、カーソルの位置も失われている。

これが **「破壊と再構築」 (The Destruction and Recreation)** の代償だ。単純で明快だが、ユーザー体験は最悪だ。

## 2.5 セキュリティ上の懸念 (XSS)

**🧙‍♂️**：体験の問題以外に、文字列の中に恐ろしい魔物が潜んでいる。
もし私がこのようなタスクを追加したら、何が起こると思う？

```javascript
state.todos.push('<img src=x onerror=alert("Hacked!")>');
renderApp();
```

**🐼**：テンプレートがそれをそのまま HTML に繋ぎ合わせます……そしてブラウザはそれを本物の `<img>` タグとして実行してしまいます……なんてことだ、私の書いたスクリプトが実行されてしまいました！

**🧙‍♂️**：これが **クロスサイトスクリプティング (XSS)** だ。文字列は愚鈍であり、「ユーザーのテキスト」と「開発者のコード」を区別できない。テンプレート時代には常に警戒し、ユーザー入力を一つ一つ慎重にエスケープしなければならなかった。さもなければ、アプリはハッカーの遊び場になってしまう。

これは単なる「ポップアップが出る」という冗談ではない。現実の世界では、攻撃者は XSS を通じてユーザーの Cookie やセッション（Session Token）を盗み、ユーザーセッションを乗っ取ることができるのだ。

**🐼**：待ってください。第一章では、リスト項目のテキストを設定するのに `textContent` を使っていました。あれならこの問題は起きませんよね？

**🧙‍♂️**：その通りだ！ `textContent` はすべての内容を純粋なテキストとして処理するため、`<img onerror=...>` はそのまま文字として表示され、実行されることはない。しかし、`innerHTML` は文字列を HTML コードとして解析してしまう。これが利便性の代償だ。文字列テンプレートは書くのは簡単だが、攻撃に対して門戸を開いてしまう。

これこそが、後のフレームワーク（React や Vue）が UI の記述に文字列を使わなくなった理由だ。彼らは**構造化されたオブジェクト**を使用する。ユーザー入力は自動的にエスケープされるのだ——明示的に `dangerouslySetInnerHTML` や `v-html` を使わない限りは。

## 2.6 歴史の脚注：Logic-less Templates (2009-2010)

**🧙‍♂️**：我々の単純な `render` 関数は、実はテンプレートエンジンの雛形だ。2009年頃、文字列結合の混乱を解決するために **Mustache.js** が登場した。

> **背景**：Mustache は "Logic-less templates"（ロジックのないテンプレート）を提唱した。テンプレートの中に `if` や `for` といったロジックを入れるべきではなく、すべてのロジックはデータ層で処理されるべきだと考えたのだ。

**🧙‍♂️**：その後、**Handlebars.js (2010)** がさらに多くの機能（Helper functions）を追加し、当時最も人気のあるテンプレートエンジンとなった。人々はデータと HTML 構造を分離することに慣れ始めた。

```html
<!-- Handlebars スタイル -->
<ul>
  {{#each todos}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

**🐼**：`{{each}}` に `{{this}}`……。さっき書いた `render` 関数の `{{key}}` 構文にそっくりです！私たちは知らず知らずのうちにテンプレートエンジンを再発明していたのですね。

**🧙‍♂️**：そうだ。テンプレートの思想は後のフレームワークに深い影響を与えた。だがテンプレート構文がどれほど高度になろうとも、それが最終的に HTML 文字列にコンパイルされ `innerHTML` に代入される限り、「破壊と再構築」の宿命からは逃れられないのだ。

## 2.7 さらなる一歩へ

**🧙‍♂️**：テンプレートは私たちを命令型の泥沼から救い出し、初めて宣言型プログラミングの夜明けを見せてくれた。だが、それは完璧な終着点ではなかった。

1. **パフォーマンスと体験**： `innerHTML` による全量更新が「フォーカスの喪失」とパフォーマンスの浪費を招いた。
2. **セキュリティ**： 文字列結合は天然の XSS 脆弱性を生み出しやすい。

**🐼**：宣言型の簡潔さ（データが変われば画面も再生成される）は欲しいけれど、毎回「建て直し」はしたくない。どうすればいいのでしょうか？
もし、**データのどの部分が変わったのか**を正確に把握して、そこだけを更新できればいいのではないでしょうか？

**🧙‍♂️**：お前は問題の核心に触れたな。それを実現するには、データの変化を監視し、変化が起きたときに正確に「外科手術」のように DOM を更新する仕組みが必要だ。

**🐼**：データに「警報機」を付けるようなものですか？

**🧙‍♂️**：そうだ。それは精巧な設計に満ちた時代であり、同時に複雑さが爆発し始める時代でもあった。

---

### 📦 やってみよう

以下のコードを `ch02.html` として保存し、文字列テンプレートによる宣言的な書き方と、全量描画によるフォーカス喪失、そして潜在的な XSS リスクを体験してみよう：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 2 — Template Engine</title>
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
    const app = document.getElementById('app');
    
    // 1. 状態
    const state = {
      todos: [
        { text: 'Learn JavaScript', done: true },
        { text: 'Learn Templates', done: false }
      ],
      inputValue: ''
    };

    // 2. 単純なテンプレート関数
    // これは極めて簡略化された実装で、主に原理を示すためのものです
    function renderApp() {
      // Diff は一切なく、直接全量 HTML 文字列を生成
      const html = `
        <div class="card">
          <h3>My Todo List</h3>
          <div>
            <input type="text" id="todo-input" value="${state.inputValue}" placeholder="Add a task">
            <button id="add-btn">Add</button>
          </div>
          <p id="stats">合計 ${state.todos.length} 件</p>
          <ul id="todo-list" style="padding-left: 0; margin-bottom: 0;">
            ${state.todos.map((todo, index) => `
              <li class="${todo.done ? 'done' : ''}">
                <div class="task-content">
                  <input type="checkbox" class="toggle-btn" data-index="${index}" ${todo.done ? 'checked' : ''}>
                  <span>${todo.text}</span>
                </div>
                <button class="delete-btn" data-index="${index}">×</button>
              </li>
            `).join('')}
          </ul>
          <p style="color:red; font-size:12px;">ヒント：入力欄で文字を打ってみて、フォーカスの喪失に注目してください</p>
        </div>
        <div class="card">
          <p style="font-size:12px; margin-top: 0;">🔓 <strong>XSS 実験</strong>：下の入力欄に<br>
          <code>&lt;img src=x onerror=alert("Hacked!")&gt;</code><br>と入力して "Inject" をクリックし、何が起こるか観察してください。</p>
          <input type="text" id="xss-input" placeholder="悪意のある HTML を入力...">
          <button id="inject-btn">Inject</button>
        </div>
      `;
      
      // 3. 破壊と再構築：パフォーマンスキラー & 体験キラー
      app.innerHTML = html;

      // 4. DOM 再構築後、すべてのイベントを再バインドしなければならない (痛みの提示)
      const inputEl = document.getElementById('todo-input');
      if (inputEl) {
        inputEl.addEventListener('input', (e) => {
          state.inputValue = e.target.value; 
          renderApp(); // キーを押すたびに再描画！
        });
        // 体験してもらうために、あえてフォーカスを戻すハックは行いません
      }

      const addBtn = document.getElementById('add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          if (!state.inputValue) return;
          state.todos.push({ text: state.inputValue, done: false });
          state.inputValue = '';
          renderApp();
        });
      }

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = e.target.dataset.index;
          state.todos.splice(index, 1);
          renderApp();
        });
      });

      document.querySelectorAll('.toggle-btn').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const index = e.target.dataset.index;
          state.todos[index].done = !state.todos[index].done;
          renderApp();
        });
      });

      // XSS 実験イベントバインド
      const injectBtn = document.getElementById('inject-btn');
      if (injectBtn) {
        injectBtn.addEventListener('click', () => {
          const xssInput = document.getElementById('xss-input');
          if (!xssInput || !xssInput.value) return;
          state.todos.push({ text: xssInput.value, done: false });
          renderApp();
        });
      }
    }

    // 初期レンダリング
    renderApp();
  </script>
</body>
</html>
```
