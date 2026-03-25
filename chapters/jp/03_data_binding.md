# 第三章：データバインディングの夜明け (The Dawn of Data Binding)

![figure 3.1](../../website/public/images/ch03_data_binding.png)

## 3.1 均衡を探して

ポーは机に向かい、前回書いた「文字列結合」のコードをいじりながら、眉をひそめていた。

**🐼**：師父、板挟みになってしまいました。
生の DOM 操作（第一章）を使えばパフォーマンスは良いですが、メンテナンスが困難です。
文字列テンプレート（第二章）を使えばコードは明快ですが、ページ全体を再描画しなければならず、ユーザー体験は最悪です。
その中間の道はないのでしょうか？ 楽しく書けて、かつ変更された部分だけを更新できるような道が。

**🧙‍♂️**：お前が求めているのは **「正確さ」** だ。
想像してみろ。このお茶が冷めたとき、お前はお茶だけを温め直したいはずだ。部屋全体の空気を温め直すのではなく。

**🐼**：その通りです！データの中の `count` が変わったら、画面に表示されている数字の `<span>` だけを更新したい。他の場所には一切触れずに。

**🧙‍♂️**：それを実現するためには、データはもはや沈黙する死物であってはならん。データは **「叫び」** を学ぶ必要がある。

**🐼**：叫ぶ？

**🧙‍♂️**：データが変化したとき、自ら大声で叫ぶのだ。「私は変わったぞ！私を気にしている者は誰だ、早く更新しに来い！」と。これが **オブザーバーパターン (Observer Pattern)** だ。これを基盤として、初期の MVC フレームワークが誕生した。

## 3.2 「喋る」データ

**🧙‍♂️**：今我々に必要なのは、新しいデータモデルだ。データが変化したとき、それを気にしているすべての者に **自動的に通知** できるモデル。言い換えれば、「喋る」データだ。

**🐼**：自動通知？つまり、私が手動で更新関数を呼び出すのではなく、データ自身に「叫ばせる」ということですか？

**🧙‍♂️**：その通り。それが **オブザーバーパターン (Observer Pattern)** の核心だ。発行者 (Publisher) は状態変化時に通知を出し、購読者 (Subscriber) は通知を受け取って対応する更新を実行する。この「叫ぶ」仕組みを、どう実装すればいいと思う？

**🐼**：二つのものが必要だと思います。一つは「誰かがあなたの変化を気にしている」と言わせるための「監視の登録」機能。もう一つは、データ変化時に気にしているすべての人に伝える「通知のトリガー」機能です。基底クラスを書いてみます。

```javascript
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== callback);
  }

  emit(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(payload));
    }
  }
}

class Model extends EventEmitter {
  constructor(data) {
    super();
    this.data = data;
  }

  set(key, value) {
    if (this.data[key] !== value) {
      this.data[key] = value;
      // データが変わった。大声で叫べ！
      this.emit('change', { key, value });
      this.emit(`change:${key}`, value);
    }
  }

  get(key) {
    return this.data[key];
  }
}
```

**🐼**：このコード、わかりました。 `Model` は「自ら喋る」データの器になり、誰かがそれを購読していれば、データ変動時に通知を送るわけですね。

## 3.3 MVC で ToDo リストを書き換える

**🧙‍♂️**：よろしい。では、この `Model` を使って ToDo リストを書き換えてみよう。「正確な更新」の感触を味わってみるのだ。

**🐼**：わかりました。ToDo のデータを Model に入れ、データが変化したときに、対応する DOM ノードを正確に更新します。

```javascript
// === Model ===
const todoModel = new Model({
  todos: [
    { id: 1, text: 'Learn JavaScript', done: true }, 
    { id: 2, text: 'Learn Templates', done: false }
  ],
  inputValue: '',
});

// === View ===
const listEl = document.getElementById('todo-list');
const inputEl = document.getElementById('todo-input');
const statsEl = document.getElementById('stats');

// === Binding: View → Model ===
inputEl.addEventListener('input', (e) => {
  todoModel.set('inputValue', e.target.value);
});

document.getElementById('add-btn').addEventListener('click', () => {
  const value = todoModel.get('inputValue');
  if (!value) return;
  const todos = todoModel.get('todos').slice();
  todos.push({ id: Date.now(), text: value, done: false });
  todoModel.set('todos', todos);
  todoModel.set('inputValue', '');
});

// === Binding: Model → View ===
// Model が変化したとき、表示の更新をトリガーする

// リストが変更されたとき、リストエリア全体を更新
todoModel.on('change:todos', () => renderFullList());

// 入力値が変更されたとき、入力欄を【正確に更新】
todoModel.on('change:inputValue', (v) => {
  inputEl.value = v;                      
});

// DOM 作成の詳細である renderFullList 関数は省略し、バインディング関係に注目しよう
renderFullList();
```

**🐼**：素晴らしい！入力欄で文字を打っても、フォーカスが失われません！リストを更新するときに `input` 要素には一切触れていないからです。データが変化したとき、関連する DOM だけが更新されるのですね。

**🧙‍♂️**：注意してほしいのだが、 `renderList` の内部では依然として `listEl.innerHTML = ''` を使ってリストを再構築している。この部分はまだ「破壊と再構築」だ。しかし重要なのは、**入力欄が再作成されていない** ことだ。変化した部分（リスト）だけを再構築し、変化していない部分（入力欄）を維持した。これが「正確な更新」の意味だ。完璧ではないが、第二章の全量再構築よりはずっと良い。

これが **データバインディング (Data Binding)** の魔力だ。Backbone.js、Knockout.js、さらには初期の AngularJS までがこの流派の代表格だ。データに「自ら通知させる」ことで、メスのような正確さで DOM を更新できるようになったのだ。

**🐼**：それに、統計の数字を個別にメンテナンスする必要もなくなりました。 `change:todos` がトリガーされるだけで、統計も自動的に更新されます。第一章のようにあちこちで `updateStats()` を呼ぶよりずっとエレガントです。

## 3.4 複雑さによる反撃 

**🧙‍♂️**：この「正確さ」を今のうちに楽しんでおくがいい、ポーよ。なぜなら間もなく、お前は混乱の泥沼に陥ることになるからだ。

**🐼**：なぜですか？完璧に見えますが。

**🧙‍♂️**：見せてやろう。今、この ToDo リストにいくつかの新機能を追加すると想像してみろ。**「ユーザーが『すべて/完了/未完了』の表示を切り替えられるフィルター機能を追加し、完了した項目のカウントを追加し、さらに下部に『完了した項目をクリア』ボタンを設ける」**のだ。

このコードがどうなるか見てみろ：

```javascript
// Model A: ToDo リスト
const todoModel = new Model({ todos: [...], filter: 'all' });

// Model B: 統計データ（Model A に依存）
const statsModel = new Model({ total: 0, done: 0 });

// View A が更新されたとき → Model B を同期
todoModel.on('change:todos', (todos) => {
  statsModel.set('total', todos.length);
  statsModel.set('done', todos.filter(t => t.done).length);
});

// Model B が変化 → View B (統計パネル) を更新
statsModel.on('change:total', (v) => updateStatsView());
statsModel.on('change:done', (v) => updateStatsView());

// filter が変化 → View A も更新 (リストを再フィルタリング)
todoModel.on('change:filter', () => {
  renderFilteredList();  
});

// ユーザーが View B の「完了した項目をクリア」をクリック → Model A から完了した項目を削除
clearDoneBtn.addEventListener('click', () => {
  const remaining = todoModel.get('todos').filter(t => !t.done);
  todoModel.set('todos', remaining);
  // これが再び change:todos をトリガー → statsModel を更新 → View B を更新 ...
});
```

**🐼**：ちょっと待ってください……数えてみると、Model A が Model B に通知し、Model B が View B を更新し、View B の操作がまた Model A を変え、Model A がまた Model B に通知し……。

**🧙‍♂️**：これが **「ピンポン効果」 (Ping Pong Effect)** だ。双方向バインディング (Two-Way Binding) とイベントの流れが複雑に絡み合うと、一つのデータの変化が一体どれだけの連鎖反応を引き起こすのか、誰にもわからなくなる。そして——。

**🐼**：そしてデバッグのとき、ある View が突然変わったのはわかるけれど、どのイベントチェーンが最初にトリガーされたのかがわからない。

**🧙‍♂️**：さらに隠れた殺し屋がいる。**「ゾンビビュー」 (Zombie Views)** だ。
ページ切り替え時に DOM からリストビューを削除したのに、 `todoModel` への監視解除 `todoModel.off(...)` を忘れたらどうなる？

**🐼**： `todoModel` が変化したとき、それは依然としてコールバック関数を実行しようとし、もう存在しない DOM 要素を更新しようとしますね。

**🧙‍♂️**：そうだ。これはメモリリークを引き起こし、さらにはエラーの原因にもなる。お前は爆発物処理班のように、コンポーネントを破棄する際にあらゆるイベントバインディングを慎重に解除しなければならん。一つでも忘れれば、アプリは時間の経過とともに重くなり、幽霊のようなバグに悩まされることになる。

## 3.5 歴史の脚注：Backbone.js 

**🧙‍♂️**： **Backbone.js** は、フロントエンドアプリに MVC 構造をもたらした最初のフレームワークの一つだ。

```javascript
// Backbone.js スタイル (2010)
const TodoModel = Backbone.Model.extend({
  defaults: { title: '', done: false }
});

const TodoView = Backbone.View.extend({
  tagName: 'li',
  
  events: {
    'click .toggle': 'toggleDone'
  },

  initialize: function() {
    // 手動バインド：Model が変化 → View を再レンダリング
    this.listenTo(this.model, 'change', this.render);
  },

  toggleDone: function() {
    this.model.set('done', !this.model.get('done'));
  },

  render: function() {
    this.$el.html('<input class="toggle" type="checkbox">' + this.model.get('title'));
    return this;
  }
});
```

**🐼**：とても規律正しいです！ Model、View、イベントバインディングがはっきりと分かれています。

**🧙‍♂️**：そうだが、あの `this.listenTo` と手動の `this.render` に注目しろ。お前はすべての Model-View の関係に対して手動でパイプを繋がなければならず、一つでも漏れればバグになるのだ。

## 3.6 十字路に立つ

**🧙‍♂️**：我々は三つの段階を歩んできた：

1. **生の DOM**：手作業でレンガを運ぶ。疲れるし乱雑。
2. **文字列テンプレート**：すべてを建て直す。爽快だが遅い。
3. **MVC**：精密な手術。だが、状態とイベントが交錯し、メンテナンスの悪夢を招く。

**🐼**：師父、絶望的です。
煩雑（生の DOM）か、乱暴（テンプレート）か、混乱（MVC）か。
「テンプレート」のように簡単に書けて（宣言型）、「データバインディング」のように速く更新でき（高性能）、かつ、あの忌々しいイベント監視を自分で管理しなくて済む方法はないのでしょうか？

**🧙‍♂️**：それは欲張りな願いだ。だが歴史上、常に常識を打ち破ることでその欲に応えようとする賢者が現れる。次からは、その新しい手法を目にすることになるだろう。

---

### 📦 やってみよう

以下のコードを `ch03.html` として保存し、オブザーバーパターンに基づいたデータバインディングがどのように DOM の正確な外科手術的更新を実現し、入力欄のフォーカス喪失問題を解決するのかを体験してみよう：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Chapter 3 — Data Binding Todo List</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f9f9f9; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; background: white; }
    .card h3 { margin-top: 0; }
    button { padding: 6px 12px; cursor: pointer; margin: 4px; border-radius: 4px; border: 1px solid #ccc; background: #eee; }
    button.active { background: #007bff; color: white; border-color: #007bff; }
    li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; list-style: none; }
    li .task-content { display: flex; align-items: center; gap: 8px; }
    li.done span { text-decoration: line-through; color: #999; }
    li .delete-btn { background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
    input[type="text"] { padding: 8px; width: 60%; border-radius: 4px; border: 1px solid #ccc; }
    #stats { font-size: 14px; color: #666; margin-top: 10px; }
    #empty-msg { color: #999; font-style: italic; font-size: 14px; margin-top: 10px; }
    #log { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 150px; overflow-y: auto; }
    .filters { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h3>My Todo List</h3>
    <p style="font-size: 12px; color: #666;">このデモは <strong>Observer Pattern</strong> によるデータバインディングを示しています。<br>
     入力欄のフォーカスが失われなくなり、簡単なフィルター機能によって状態同期も体験できます。</p>
    
    <div>
      <input type="text" id="todo-input" placeholder="Add a task">
      <button id="add-btn">Add</button>
    </div>
    
    <div class="filters" id="filters">
      <button data-filter="all" class="filter-btn active">All</button>
      <button data-filter="active" class="filter-btn">Active</button>
      <button data-filter="completed" class="filter-btn">Completed</button>
    </div>

    <p id="stats">合計 0 件</p>
    <p id="empty-msg">データなし</p>
    <ul id="todo-list" style="padding-left: 0; margin-bottom: 0;"></ul>
  </div>

  <div class="card">
    <h3>📋 Event Log</h3>
    <div id="log"></div>
  </div>

  <script>
    // --- 1. EventEmitter (オブザーバーパターンの核心) ---
    class EventEmitter {
      constructor() { this.listeners = {}; }
      on(event, cb) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      }
      off(event, cb) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(f => f !== cb);
      }
      emit(event, payload) {
        if (this.listeners[event]) this.listeners[event].forEach(cb => cb(payload));
      }
    }

    // --- 2. Model (「叫ぶ」データ) ---
    class Model extends EventEmitter {
      constructor(data) { super(); this.data = data; }
      set(key, value) {
        if (this.data[key] !== value) {
          const oldValue = this.data[key];
          this.data[key] = value;
          this.emit('change', { key, value, oldValue });
          this.emit('change:' + key, value);
        }
      }
      get(key) { return this.data[key]; }
    }

    // --- 3. アプリロジック ---
    const todoModel = new Model({
      todos: [
        { id: 1, text: 'Learn JavaScript', done: true }, 
        { id: 2, text: 'Learn Templates', done: false }
      ],
      inputValue: '',
      filter: 'all'
    });

    const listEl = document.getElementById('todo-list');
    const inputEl = document.getElementById('todo-input');
    const statsEl = document.getElementById('stats');
    const emptyEl = document.getElementById('empty-msg');
    const logEl = document.getElementById('log');

    function log(msg) {
      const line = document.createElement('div');
      line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      logEl.prepend(line);
    }

    function renderList() {
      listEl.innerHTML = '';
      const allTodos = todoModel.get('todos');
      const filter = todoModel.get('filter');
      
      const todos = allTodos.filter(t => {
        if (filter === 'active') return !t.done;
        if (filter === 'completed') return t.done;
        return true;
      });

      todos.forEach((todo) => {
        const li = document.createElement('li');
        if (todo.done) li.classList.add('done');

        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.done;
        checkbox.addEventListener('change', () => {
          const updated = todoModel.get('todos').map(t => 
            t.id === todo.id ? { ...t, done: checkbox.checked } : t
          );
          todoModel.set('todos', updated);
        });

        const span = document.createElement('span');
        span.textContent = todo.text;

        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(span);
        li.appendChild(contentDiv);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
          const updated = todoModel.get('todos').filter(t => t.id !== todo.id);
          todoModel.set('todos', updated);
        });
        li.appendChild(deleteBtn);

        listEl.appendChild(li);
      });
      const doneCount = allTodos.filter(t => t.done).length;
      statsEl.textContent = `完了 ${doneCount} / 合計 ${allTodos.length} 件`;
      emptyEl.style.display = todos.length === 0 ? 'block' : 'none';
      
      // フィルターボタンの active 状態を更新
      document.querySelectorAll('#filters button').forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Binding: View → Model
    inputEl.addEventListener('input', (e) => {
      todoModel.set('inputValue', e.target.value);
    });

    document.getElementById('add-btn').addEventListener('click', () => {
      const value = todoModel.get('inputValue');
      if (!value) return;
      const todos = todoModel.get('todos').slice();
      todos.push({ id: Date.now(), text: value, done: false });
      todoModel.set('todos', todos);
      todoModel.set('inputValue', '');
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        todoModel.set('filter', e.target.dataset.filter);
      });
    });

    // Binding: Model → View (正確な更新。input は再構築されない！)
    todoModel.on('change:todos', (todos) => {
      renderList();
      log('Model.todos changed → list re-rendered (' + todos.length + ' items)');
    });

    todoModel.on('change:filter', (f) => {
      renderList();
      log('Model.filter changed to ' + f + ' → list re-rendered');
    });

    todoModel.on('change:inputValue', (v) => {
      inputEl.value = v; // input の値だけを更新。要素は再構築しない
      log('Model.inputValue → "' + v + '"');
    });

    // 初期化
    renderList();
    log('App initialized. Input focus will NOT be lost!');
  </script>
</body>
</html>
```
