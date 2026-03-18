# 第三章：数据绑定的黎明 (The Dawn of Data Binding)

![figure 3.1](../images/ch03_data_binding.png)

## 3.1 寻找平衡

Po 坐在桌前，手里摆弄着上一课写的“字符串拼接”代码，眉头紧锁。

**🐼**：Shifu，我陷入了两难。
用原生 DOM 操作（第一章），性能好但不易维护；
用字符串模板（第二章），代码清晰但每次都要重绘整个页面，体验极差。
难道没有一种中间道路吗？既能写得愉快，又只更新变动的那一部分？

**🧙‍♂️**：你渴望的是 **精准**。
想象一下，当这一杯茶变凉时，你希望我只去加热这杯茶，而不是把整个房间的空气都加热一遍。

**🐼**：对！如果数据里的 `count` 变了，我只想更新界面上显示数字的那个 `<span>`，别的地方都不要动。

**🧙‍♂️**：要做到这一点，你的数据必须不再是沉默的死物。它必须学会 **呐喊**。

**🐼**：呐喊？

**🧙‍♂️**：当数据发生变化时，它需要大声喊出来：“我变了！谁关心我，快来更新！” 这就是 **观察者模式 (Observer Pattern)**。在此基础上，诞生了早期的 MVC 框架。

## 3.2 会说话的数据

**🧙‍♂️**：我们现在需要的是一种新的数据模型——当数据发生变化时，它能够 **自动通知** 所有关心它的人。换句话说，我们需要一个“会说话”的数据。

**🐼**：自动通知？您的意思是，我不再需要手动调用更新函数，而是让数据自己“喊”出来？

**🧙‍♂️**：正是。这就是 **观察者模式 (Observer Pattern)** 的核心——发布者在状态变化时发出通知，订阅者收到通知后执行对应的更新。你觉得该如何实现这个“喊话”的机制？

**🐼**：我想我需要两个东西：一个是“注册监听”的能力，让别人说“我关心你的变化”；另一个是“触发通知”的能力，在数据变化时告诉所有关心的人。让我写一个基类。

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

**🐼**：这段代码我懂了，`Model` 成了一个能“主动说话”的数据容器，只要有人订阅了它，数据变动时它就会通知他们。

## 3.3 用 MVC 重写 Todo List

**🧙‍♂️**：很好。现在，用这个 `Model` 来重写我们的 Todo List。让我们体验一下“精准更新”的感觉。

**🐼**：好的，我把 Todo 的数据放在 Model 里，当数据变化时，精确更新对应的 DOM 节点。

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
// Model 变化时，触发视图更新

// 当改变列表时，全量更新列表区域
todoModel.on('change:todos', () => renderFullList());

// 当改变输入值时，【精准更新】输入框
todoModel.on('change:inputValue', (v) => {
  inputEl.value = v;                      
});

// 我们略去创建 DOM 细节的 renderFullList 函数，重点看绑定关系。
renderFullList();
```

**🐼**：太好了！我在输入框打字，焦点不丢了！因为我更新列表的时候根本没碰 `input` 元素。每次数据变化，只有相关的 DOM 被更新。

**🧙‍♂️**：注意，`renderList` 内部仍然使用了 `listEl.innerHTML = ''` 来重建列表——这部分还是“推倒重建”的。但关键在于：**输入框没有被重新创建**。我们只重建了变化的部分（列表），保持了不变的部分（输入框）。这就是“精准更新”的含义——虽然不完美，但比第二章的全量重建好得多。

这就是 **数据绑定** 的魔力。Backbone.js, Knockout.js, 甚至早期的 AngularJS 都是这一流派的杰出代表。通过让数据“主动通知”，我们实现了手术刀般精准的 DOM 更新。

**🐼**：而且统计数字不需要单独维护了。只要 `change:todos` 触发，统计就自动更新了。比第一章里到处调用 `updateStats()` 优雅多了。

## 3.4 复杂度的反噬 

**🧙‍♂️**：享受这一刻的精准吧，Po。因为不久之后，你将陷入混乱的泥潭。

**🐼**：为什么？这看起来很完美啊。

**🧙‍♂️**：让我给你演示一下。想象你现在要给这个 Todo List 增加几个新功能：**允许用户切换“全部/已完成/未完成”的过滤视图，增加已完成数量统计，并在底部提供一个“清除已完成”按钮**。

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

// 用户点击 View B “清除已完成”按钮 → 从 Model A 中移除已完成的项
clearDoneBtn.addEventListener('click', () => {
  const remaining = todoModel.get('todos').filter(t => !t.done);
  todoModel.set('todos', remaining);
  // 这又触发 change:todos → 又更新 statsModel → 又更新 View B ...
});
```

**🐼**：等一下……我数了一下，这里有 Model A 通知 Model B，Model B 更新 View B，View B 的操作又改了 Model A，Model A 又通知 Model B……

**🧙‍♂️**：这就是 **“乒乓效应” (Ping Pong Effect)**。当双向绑定（Two-Way Binding）和事件流变得错综复杂，没人能说得清一个数据的变化究竟会引发多少连锁反应。而且——

**🐼**：而且调试的时候，我只看到某个 View 突然变了，却不知道是哪条事件链最先触发的。

**🧙‍♂️**：还有更隐蔽的杀手——**僵尸视图 (Zombie Views)**。
如果你在页面切换时从 DOM 中移除了列表视图，但忘记了解除它对 `todoModel` 的监听`todoModel.off(...)`，会发生什么？

**🐼**：`todoModel` 变化时，它还是会尝试去执行回调函数，更新那个已经不存在的 DOM 元素？

**🧙‍♂️**：是的。这会导致内存泄漏，甚至报错。你必须像拆弹专家一样，小心翼翼地在销毁组件时解绑每一个事件。一旦遗漏一个，你的应用就会随着时间推移变得越来越慢，充满了幽灵般的 Bug。

## 3.5 历史的脚注：Backbone.js 

**🧙‍♂️**：**Backbone.js** 是第一批为前端应用带来 MVC 结构的框架之一。

```javascript
// Backbone.js 风格 (2010)
const TodoModel = Backbone.Model.extend({
  defaults: { title: '', done: false }
});

const TodoView = Backbone.View.extend({
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

**🐼**：看起来很规范！Model、View、事件绑定都分得很清楚。

**🧙‍♂️**：是的，但注意那个 `this.listenTo` 和手动的 `this.render`。你必须为每一个 Model-View 的关系手动建立管道，一旦遗漏，就是 Bug。

## 3.6 走到十字路口

**🧙‍♂️**：我们走过了三个阶段：

1.  **原生 DOM**：手动搬砖，累且乱。
2.  **字符串模板**：推倒重来，爽但慢。
3.  **MVC**：精细手术，但由于状态和事件交织，导致了维护的噩梦。

**🐼**：Shifu，这太令人绝望了。
要么繁琐（原生），要么粗暴（模板），要么混乱（MVC）。
难道就没有一种方法，既能像“模板”那样写得简单（声明式），又能像“数据绑定”那样更新得快（高性能），同时还不需要我手动管理那些该死的事件监听？

**🧙‍♂️**：这是一个贪心的愿望。但历史上总有聪明人试图通过打破常规来满足贪心, 在后面你将会见识到新的办法。

---

### 📦 实践一下

将以下代码保存为 `ch03.html`，体验基于观察者模式的数据绑定如何实现 DOM 的精准手术式更新并解决输入框焦点丢失问题：

```html
<!DOCTYPE html>
<html lang="zh-CN">
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
    <p style="font-size: 12px; color: #666;">这个 Demo 展示了 <strong>Observer Pattern</strong> 的数据绑定。<br>
     输入框的焦点不再丢失，并且增加了简单的 Filter 体验状态同步。</p>
    
    <div>
      <input type="text" id="todo-input" placeholder="Add a task">
      <button id="add-btn">Add</button>
    </div>
    
    <div class="filters" id="filters">
      <button data-filter="all" class="filter-btn active">All</button>
      <button data-filter="active" class="filter-btn">Active</button>
      <button data-filter="completed" class="filter-btn">Completed</button>
    </div>

    <p id="stats">总共 0 项</p>
    <p id="empty-msg">暂无数据</p>
    <ul id="todo-list" style="padding-left: 0; margin-bottom: 0;"></ul>
  </div>

  <div class="card">
    <h3>📋 Event Log</h3>
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

    // --- 2. Model (会“呐喊”的数据) ---
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
      statsEl.textContent = `已完成 ${doneCount} / 总共 ${allTodos.length} 项`;
      emptyEl.style.display = todos.length === 0 ? 'block' : 'none';
      
      // 更新 filter 按钮的 active 状态
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

    // Binding: Model → View (精准更新，input 不会重建！)
    todoModel.on('change:todos', (todos) => {
      renderList();
      log('Model.todos changed → list re-rendered (' + todos.length + ' items)');
    });

    todoModel.on('change:filter', (f) => {
      renderList();
      log('Model.filter changed to ' + f + ' → list re-rendered');
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
