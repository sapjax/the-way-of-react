# 第三章：数据绑定的黎明 (The Dawn of Data Binding)

![chapter illustration](../images/ch03_data_binding.png)

## 3.1 寻找平衡

Student 坐在桌前，手里摆弄着上一章写的“字符串拼接”代码，眉头紧锁。

**Student**：Master，我陷入了两难。
用原生 DOM 操作（第一章），性能好但不易维护；
用字符串模板（第二章），代码清晰但每次都要重绘整个页面，体验极差。
难道没有一种中间道路吗？既能写得愉快，又只更新变动的那一部分？

**Master**：你渴望的是 **精确 (Precision)**。
想象一下，当这一杯茶变凉时，你希望我只去加热这杯茶，而不是把整个房间的空气都加热一遍。

**Student**：对！如果数据里的 `count` 变了，我只想更新界面上显示数字的那个 `<span>`，别的地方都不要动。

**Master**：要做到这一点，你的数据必须不再是沉默的死物。它必须学会 **呐喊**。

**Student**：呐喊？

**Master**：当数据发生变化时，它需要大声喊出来：“我变了！谁关心我，快来更新！” 这就是 **观察者模式 (Observer Pattern)**。在此基础上，诞生了早期的 MVC 框架。

## 3.2 会说话的数据

**Master**：我们现在需要的是一种新的数据模型——当数据发生变化时，它能够 **自动通知** 所有关心它的人。换句话说，我们需要一个“会说话”的数据。

**Student**：自动通知？您的意思是，我不再需要手动调用更新函数，而是让数据自己“喊”出来？

**Master**：正是。这就是 **观察者模式 (Observer Pattern)** 的核心——发布者在状态变化时发出通知，订阅者收到通知后执行对应的更新。你觉得该如何实现这个“喊话”的机制？

**Student**：我想我需要两个东西：一个是“注册监听”的能力，让别人说“我关心你的变化”；另一个是“触发通知”的能力，在数据变化时告诉所有关心的人。让我写一个基类。

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
      // 数据变了，大声喊出来！
      this.emit('change', { key, value });
      this.emit(`change:${key}`, value);
    }
  }

  get(key) {
    return this.data[key];
  }
}
```

## 3.3 用 MVC 重写 Todo List

**Master**：很好。现在，用这个 `Model` 来重写我们的 Todo List。让我们体验一下“精准更新”的感觉。

**Student**：好的，我把 Todo 的数据放在 Model 里，当数据变化时，精确更新对应的 DOM 节点。

```javascript
// === Model ===
const todoModel = new Model({
  todos: ['Learn JavaScript', 'Learn Templates'],
  inputValue: ''
});

// === View ===
const listEl = document.getElementById('todo-list');
const inputEl = document.getElementById('todo-input');
const statsEl = document.getElementById('stats');

// 初始化渲染
function renderTodo(text, index) {
  const li = document.createElement('li');
  li.textContent = text;
  li.dataset.index = index;
  // 点击删除
  li.addEventListener('click', () => {
    const todos = todoModel.get('todos').slice();
    todos.splice(index, 1);
    todoModel.set('todos', todos);
  });
  return li;
}

function renderFullList() {
  listEl.innerHTML = '';
  todoModel.get('todos').forEach((text, i) => {
    listEl.appendChild(renderTodo(text, i));
  });
  statsEl.textContent = `总共 ${todoModel.get('todos').length} 项`;
}

// === Binding: View → Model ===
inputEl.addEventListener('input', (e) => {
  todoModel.set('inputValue', e.target.value);
});

document.getElementById('add-btn').addEventListener('click', () => {
  const value = todoModel.get('inputValue');
  if (!value) return;
  const todos = todoModel.get('todos').slice();
  todos.push(value);
  todoModel.set('todos', todos);
  todoModel.set('inputValue', '');
});

// === Binding: Model → View ===
todoModel.on('change:todos', () => {
  renderFullList();                       // 更新列表
  // 注意：focus 不会丢失，因为我们没有重建 input！
});

todoModel.on('change:inputValue', (v) => {
  inputEl.value = v;                      // 精准更新 input
});

// 初始化
renderFullList();
```

**Student**：太好了！我在输入框打字，焦点不丢了！因为我更新列表的时候根本没碰 `input` 元素。每次数据变化，只有相关的 DOM 被更新。

> 💡 **说明**：在第一章中，我们使用双击（`dblclick`）来删除列表项。这里为了简化改用了单击——MVC 模式的工作方式是一样的。重点是数据绑定如何触发精准的 DOM 更新。

**Master**：注意，`renderList` 内部仍然使用了 `listEl.innerHTML = ''` 来重建列表——这部分还是“推倒重建”的。但关键在于：**输入框没有被重新创建**。我们只重建了变化的部分（列表），保持了不变的部分（输入框）。这就是“精准更新”的含义——虽然不完美，但比第二章的全量重建好得多。

这就是 **数据绑定 (Data Binding)** 的魔力。Backbone.js, Knockout.js, 甚至早期的 AngularJS 都是这一流派的杰出代表。通过让数据“主动通知”，我们实现了手术刀般精准的 DOM 更新。

**Student**：而且统计数字不需要单独维护了。只要 `change:todos` 触发，统计就自动更新了。比第一章里到处调用 `updateStats()` 优雅多了。

## 3.4 复杂度的反噬 (The Complexity Crisis)

**Master**：享受这一刻的精准吧，Student。因为不久之后，你将陷入混乱的泥潭。

**Student**：为什么？这看起来很完美啊。

**Master**：让我给你演示一下。想象你现在要给这个 Todo List 增加一个新功能：**当列表变空时显示提示，并且允许用户切换“全部/已完成/未完成”的过滤视图**。

看一下这段代码会变成什么样子：

```javascript
// Model A: 待办列表
const todoModel = new Model({ todos: [...], filter: 'all' });

// Model B: 统计数据（依赖 Model A）
const statsModel = new Model({ total: 0, done: 0 });

// View A 更新时 → 同步 Model B
todoModel.on('change:todos', (todos) => {
  statsModel.set('total', todos.length);
  statsModel.set('done', todos.filter(t => t.done).length);
});

// Model B 变化 → 更新 View B (统计面板)
statsModel.on('change:total', (v) => updateStatsView());
statsModel.on('change:done', (v) => updateStatsView());

// filter 变化 → 也要更新 View A (重新过滤列表)
todoModel.on('change:filter', () => {
  renderFilteredList();  
});

// 用户点击“清除已完成”按钮 → 从 Model A 中移除已完成的项
clearDoneBtn.addEventListener('click', () => {
  const remaining = todoModel.get('todos').filter(t => !t.done);
  todoModel.set('todos', remaining);
  // 这又触发 change:todos → 又更新 statsModel → 又更新 View B ...
});
```

**Student**：等一下……我数了一下，这里有 Model A 通知 Model B，Model B 更新 View B，View B 的操作又改了 Model A，Model A 又通知 Model B……

**Master**：这就是 **“乒乓效应” (Ping Pong Effect)**。当双向绑定（Two-Way Binding）和事件流变得错综复杂，没人能说得清一个数据的变化究竟会引发多少连锁反应。而且——

**Student**：而且调试的时候，我只看到某个 View 突然变了，却不知道是哪条事件链最先触发的。

**Master**：还有更隐蔽的杀手——**僵尸视图 (Zombie Views)**。
如果你在页面切换时从 DOM 中移除了列表视图，但忘记了解除它对 `todoModel` 的监听（`todoModel.off(...)`），会发生什么？

**Student**：`todoModel` 变化时，它还是会尝试去执行回调函数，更新那个已经不存在的 DOM 元素？

**Master**：是的。这会导致内存泄漏，甚至报错。你必须像拆弹专家一样，小心翼翼地在销毁组件时解绑每一个事件。一旦遗漏一个，你的应用就会随着时间推移变得越来越慢，充满了幽灵般的 Bug。

> 💡 **动手挑战**：试着在本章的 Demo 中增加一个“全部/已完成/未完成”的过滤功能，你将亲身体验到，当多个 Model 互相监听时，代码是如何变得混乱不堪的。

## 3.5 历史的脚注：MVC 群雄并起 (2010-2012)

**Master**：在 2010 年前后，为了拯救 Web 应用从 “面条代码”中解脱，多个框架同时发力。

### Backbone.js (2010) — 结构的觉醒

**Master**：Jeremy Ashkenas 的 **Backbone.js** 是第一批为前端应用带来 MVC 结构的框架之一。

```javascript
// Backbone.js 风格 (2010)
var TodoModel = Backbone.Model.extend({
  defaults: { title: '', done: false }
});

var TodoView = Backbone.View.extend({
  tagName: 'li',
  
  events: {
    'click .toggle': 'toggleDone'
  },

  initialize: function() {
    // 手动绑定：Model 变化 → 重新渲染 View
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

**Student**：看起来很规范！Model、View、事件绑定都分得很清楚。

**Master**：是的，但注意那个 `this.listenTo` 和手动的 `this.render`。你必须为每一个 Model-View 的关系手动建立管道，一旦遗漏，就是 Bug。

### Knockout.js (2010) — 自动化的绑定

**Master**：Steve Sanderson 的 **Knockout.js** 走了另一条路——**自动化**。它引入了 `ko.observable`，让数据变化自动更新 UI。

```javascript
// Knockout.js 风格 (2010)
function AppViewModel() {
  this.name = ko.observable('Student');
  this.greeting = ko.computed(function() {
    return 'Hello, ' + this.name() + '!';
  }, this);
}

ko.applyBindings(new AppViewModel());
```

```html
<!-- HTML 中使用 data-bind 指令 -->
<input data-bind="value: name">
<p data-bind="text: greeting"></p>
```

### AngularJS (2010) — 脏检查的魔法

**Master**：AngularJS 走了最“魔法”的路线——**脏检查 (Dirty Checking)**。它不需要你把数据包装成 `observable`，直接用普通的 JavaScript 对象。

```javascript
// AngularJS 的双向绑定原理（简化）
// Angular 内部维护一个 watcher 列表
var watchers = [];

function $watch(expression, callback) {
  watchers.push({ expr: expression, last: undefined, cb: callback });
}

// 每次"可能有变化"时，遍历所有 watcher
function $digest() {
  let dirty = true;
  while (dirty) {     // 反复检查，直到没有新变化
    dirty = false;
    watchers.forEach(w => {
      const current = w.expr();   // 求值
      if (current !== w.last) {   // 和上次比较
        w.cb(current, w.last);
        w.last = current;
        dirty = true;             // 有变化，需要再检查一轮
      }
    });
  }
}
```

**Student**：所以每次检查变化，AngularJS 要遍历 **所有** 的 watcher？那如果页面上有上千个绑定……

**Master**：性能就会线性下降。这就是为什么 AngularJS 有 “2000 watcher 限制” 的经验法则——超过这个数量，页面就会明显卡顿。


## 3.6 走到十字路口

**Master**：我们走过了三个阶段：

1.  **原生 DOM**：手动搬砖，累且乱。
2.  **字符串模板**：推倒重来，爽但慢。
3.  **MVC / 数据绑定**：精细手术，但由于状态分散和事件交织，导致了维护的噩梦。

**Student**：Master，这太令人绝望了。
要么繁琐（原生），要么粗暴（模板），要么混乱（MVC）。
难道就没有一种方法，既能像“模板”那样写得简单（声明式），又能像“数据绑定”那样更新得快（高性能），同时还不需要我手动管理那些该死的事件监听？

**Master**：这是一个贪心的愿望。但历史上总有天才试图通过打破常规来满足贪心,在后面你将会见识到新的办法。
---

### 📦 目前的成果

将以下代码保存为 `ch03.html`，用浏览器打开即可运行：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 3 — Data Binding Todo List</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 40px auto; }
    .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-top: 15px; }
    .card h3 { margin-top: 0; }
    input[type="text"] { padding: 6px; width: 70%; }
    button { padding: 6px 12px; }
    li { padding: 6px 0; cursor: pointer; border-bottom: 1px solid #eee; }
    li:hover { color: #999; text-decoration: line-through; }
    #log { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 150px; overflow-y: auto; }
    #stats { color: #666; font-size: 14px; }
    #empty-msg { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <h1>Data Binding Todo List</h1>
  <p>这个 Demo 展示了 <strong>Observer Pattern</strong> 的数据绑定。
     输入框的焦点不再丢失，因为只有变化的部分被更新。</p>

  <div class="card">
    <input type="text" id="todo-input" placeholder="Add a task">
    <button id="add-btn">Add</button>
    <p id="stats">总共 0 项</p>
    <p id="empty-msg">暂无数据</p>
    <ul id="todo-list"></ul>
  </div>

  <div class="card">
    <h3>📋 Event Log (Observer Pattern in action)</h3>
    <div id="log"></div>
  </div>

  <script>
    // --- 1. EventEmitter (观察者模式核心) ---
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

    // --- 2. Model (会"呐喊"的数据) ---
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

    // --- 3. 应用逻辑 ---
    const todoModel = new Model({
      todos: ['Learn JavaScript', 'Learn Templates'],
      inputValue: ''
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
      const todos = todoModel.get('todos');
      todos.forEach((text, i) => {
        const li = document.createElement('li');
        li.textContent = text;
        li.addEventListener('click', () => {
          const updated = todoModel.get('todos').slice();
          updated.splice(i, 1);
          todoModel.set('todos', updated);
        });
        listEl.appendChild(li);
      });
      statsEl.textContent = `总共 ${todos.length} 项`;
      emptyEl.style.display = todos.length === 0 ? 'block' : 'none';
    }

    // Binding: View → Model
    inputEl.addEventListener('input', (e) => {
      todoModel.set('inputValue', e.target.value);
    });

    document.getElementById('add-btn').addEventListener('click', () => {
      const value = todoModel.get('inputValue');
      if (!value) return;
      const todos = todoModel.get('todos').slice();
      todos.push(value);
      todoModel.set('todos', todos);
      todoModel.set('inputValue', '');
    });

    // Binding: Model → View (精准更新，input 不会重建！)
    todoModel.on('change:todos', (todos) => {
      renderList();
      log('Model.todos changed → list re-rendered (' + todos.length + ' items)');
    });

    todoModel.on('change:inputValue', (v) => {
      inputEl.value = v; // 只更新 input 的值，不重建元素
      log('Model.inputValue → "' + v + '"');
    });

    // 初始化
    renderList();
    log('App initialized. Input focus will NOT be lost!');
  </script>
</body>
</html>
```

*(下一章：伟大的构想——UI 即状态的函数)*
