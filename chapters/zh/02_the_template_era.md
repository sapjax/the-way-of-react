# 第二章：模板时代 —— UI 即字符串 (The Template Era)

![chapter illustration](../images/ch02_template.png)

## 2.1 描述而非指令

Student 再次来到 Master 的房间。他的神情比上次轻松了一些，但依然带着困惑。

**Student**：Master，上次您说"把界面看作一段文本"。回去后我试了一下，直接拼接 HTML 字符串确实比一个一个创建节点要快得多。比如第一章的渲染逻辑：

```javascript
function renderApp() {
  var html = '<h1>My Todo List</h1>'
           + '<input type="text" id="todo-input" placeholder="Add a task">'
           + '<button onclick="addTodo()">Add</button>'
           + '<ul>';
  
  for (var i = 0; i < todos.length; i++) {
    html += '<li>' + todos[i] + '</li>';
  }
  
  html += '</ul>';
  app.innerHTML = html;
}
```

现在只需要一次性调用 `innerHTML`！

**Master**：不再像工头一样指挥每一块砖的去向，感觉如何？

**Student**：感觉自由了。我只需要关心"它看起来应该是什么样"，而不是"怎么把它造出来"。但是……

**Master**：但是？

**Student**：代码变得很难看。各种引号、加号满天飞。

**Master**：那是因为你还在用原始的语言。让我们来创造一种简单的 **模板 (Template)** 语法，让数据填入骨架之中。

## 2.2 简单的模板引擎

**Master**：我们需要一个函数，它接受一个包含“坑位”的字符串模板，和一些数据，然后返回填好数据的 HTML。

**Student**：像这样吗？

```javascript
const template = '<li>{{content}}</li>';
const data = { content: 'Buy Milk' };
// 期望结果: <li>Buy Milk</li>
```

**Master**：正是。试着实现它。

Student 思考片刻，写下了一个基于正则表达式的简单实现。

```javascript
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    return data[key] || '';
  });
}

// 使用
const task = { content: 'Learn React' };
const html = render('<li>{{content}}</li>', task);
console.log(html); // <li>Learn React</li>
```

**Master**：很好。这是模板引擎的核心原理——用数据填充模板中的“坑位”。现在，让我们在 Todo List 里使用这种思想。ES6 的模板字符串 (Template Literals) 实际上就是同样的概念，只是由语言原生支持，更加方便：

```javascript
// 我们的 render 函数：
render('<li>{{content}}</li>', { content: task })

// ES6 模板字符串（本质相同，但语法更简洁）：
`<li>${task}</li>`
```

**Student**：明白了！模板字符串就是语言内置的模板引擎。

**Master**：没错。现在，用这个思路重构你的 Todo List。不再有 `document.createElement`，不再有 `appendChild`。

## 2.3 用模板重写 Todo List

**Student**：好的！

```javascript
const app = document.getElementById('app');
const state = {
  todos: ['Learn JavaScript', 'Learn Templates'],
  inputValue: ''
};

function renderApp() {
  const html = `
    <h1>My Todo List</h1>
    <input type="text" id="todo-input" value="${state.inputValue}" oninput="updateInput(this.value)">
    <button onclick="addTodo()">Add</button>
    <p style="color:#666; font-size:14px;">
      总共 ${state.todos.length} 项
    </p>
    <ul>
      ${state.todos.map(todo => `<li>${todo}</li>`).join('')}
    </ul>
  `;
  
  app.innerHTML = html;
}

// 模拟简单的状态更新
window.updateInput = (value) => {
  state.inputValue = value;
  // 注意：这里有一个巨大的陷阱
  renderApp(); 
};

window.addTodo = () => {
  if (!state.inputValue) return;
  state.todos.push(state.inputValue);
  state.inputValue = '';
  renderApp();
};

// 初始化
renderApp();
```

**Student**：哇，代码量少了一半！而且结构一目了然。我只需要修改数据 `state`，然后调用 `renderApp()`，界面就自动更新了。统计数字也不用手动同步了——它就在模板里，随数据自动变化！

**Master**：你察觉到了精妙之处。在第一章里，你需要手动调用 `updateStats()` 来同步统计数字。现在，统计数字只是状态的 **衍生物**——只要状态变了，重新渲染整个模板，一切都自动同步。
你这种写法本质上就是 **声明式编程 (Declarative Programming)** 的雏形——你声明了“状态对应的视图是什么”，而不用关心状态变化时如何去更新视图。

## 2.4 毁灭与重建 (The Blow-away Problem)

**Master**：但是，Student，去试用一下你的新作品。试着在输入框里打几个字。

Student 在浏览器里打开页面，点击输入框，输入了字母 “A”。
突然，输入框失去了焦点（Focus）。他必须重新点击输入框才能输入下一个字母 “B”。再次输入，焦点又丢了。

**Student**：这是怎么回事？每打一个字，我就得重新点一下输入框？这简直没法用！

**Master**：思考一下整条链路。当你按下 “A” 键的那一刻，发生了什么？

```
按下 "A"
  → 触发 oninput="updateInput(this.value)"
    → updateInput() 调用 renderApp()
      → renderApp() 生成新 HTML 字符串
        → app.innerHTML = html  ← 旧的 DOM 树被全部销毁！
          → 浏览器用新 DOM 替代旧 DOM
            → 新 input 没有焦点 → 你必须重新点击
```

**Student**：啊，我明白了！每打一个字，整棵 DOM 树就被销毁重建一次！

**Master**：没错。这就好比因为你要换一个灯泡，所以把整栋房子推倒重建。

*   因为 DOM 是新创建的，之前的输入框元素已经“死”了。
*   新的输入框虽然长得一样，但它是一个全新的元素。
*   全新的元素当然没有焦点，也没有你的光标位置。

这就是 **“毁灭与重建” (The Destruction and Recreation)** 的代价。简单粗暴，但用户体验极差。

## 2.5 安全隐患 (XSS)

**Master**：除了体验问题，还有一个更可怕的魔鬼隐藏在字符串中。
如果我添加这样一个任务，会发生什么？

```javascript
state.todos.push('<img src=x onerror=alert("Hacked!")>');
renderApp();
```

**Student**：模板会把它直接拼接到 HTML 里……然后浏览器会把它当成真的 `<img>` 标签执行……天哪，我的脚本被执行了！

**Master**：这就是 **跨站脚本攻击 (XSS)**。字符串是愚钝的，它分不清“用户的文本”和“开发者的代码”。在模板时代，你必须时刻警惕，小心翼翼地转义每一个用户输入，否则你的应用就是黑客的游乐场。

这不是“弹个窗”的玩笑——在现实世界中，攻击者可以通过 XSS：

*   **窃取用户的 Cookie 和 Session Token**，从而劫持用户会话。
*   **冒充用户发送请求**，比如转账、修改密码。
*   **注入钓鱼页面**，引诱用户输入敏感信息。

**Student**：等等——在第一章里，我们用 `textContent` 来设置列表项的文本。那样不会有这个问题吧？

**Master**：没错！`textContent` 把所有内容当作纯文本处理，所以 `<img onerror=...>` 会被显示为字面文字，而不会被执行。但 `innerHTML` 会把字符串当成 HTML 代码来解析。这就是便利的代价——字符串模板写着方便，却给攻击打开了大门。

这正是后来的框架（React、Vue）不再使用字符串来描述 UI 的原因。它们使用**结构化对象**（就像我们在第四章将要构建的 VNode）。用户输入会被自动转义——除非你显式使用 `dangerouslySetInnerHTML` 或 `v-html`。

## 2.6 历史的脚注：Logic-less Templates (2009-2010)

**Master**：我们的简单的 `render` 函数其实就是模板引擎的雏形。在 2009 年左右，为了解决字符串拼接的混乱，出现了 **Mustache.js**。

> **背景**：Mustache 主张 “Logic-less templates”（无逻辑模板）。它认为模板里不应该有 `if`/`for` 这样的逻辑，所有的逻辑都应该在数据层处理好。

**Master**：后来，**Handlebars.js (2010)** 在此基础上增加了更多的功能（Helper functions），成为了当时最流行的模板引擎。人们开始习惯将数据和 HTML 结构分离。

```html
<!-- Handlebars 风格 -->
<ul>
  {{#each todos}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

**Student**：`{{each}}` 和 `{{this}}`……这和我们刚才写的 `render` 函数的 `{{key}}` 语法很像！原来我们重新发明了模板引擎。

**Master**：是的。模板的思想深深影响了后来的框架。但无论模板语法多高级，只要它最终是编译成 HTML 字符串并赋值给 `innerHTML`，它就逃不脱“毁灭与重建”的宿命。

## 2.7 再往前一步

**Master**：模板让我们从命令式的泥潭中脱身，第一次看见了声明式编程的曙光。但它并非完美的终点。

1.  **性能与体验**：`innerHTML` 的全量更新导致了“失去焦点”和性能浪费。
2.  **安全性**：字符串拼接天然容易导致 XSS。

**Student**：我们既想要声明式的简洁（数据变了就重新生成界面），又不想每次都“推倒重建”，该怎么办呢？
如果我们能知道 **具体是哪一部分数据变了**，只更新那一部分，不就好了吗？

**Master**：你触碰到了问题的核心。为了实现这一点，我们需要一种机制来监听数据的变化，并在变化发生时，精准地手术式更新 DOM。

**Student**：就像给数据装上“报警器”？

**Master**：是的。那是一个充满精巧设计的时代，也是一个复杂度开始爆炸的时代。

---

### 📦 目前的成果

将以下代码保存为 `ch02.html`，用浏览器打开即可运行：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 2 — Template Engine</title>
  <style>
    body { font-family: sans-serif; max-width: 400px; margin: 40px auto; }
    li { list-style: none; padding: 8px; border-bottom: 1px solid #eee; }
    input { padding: 6px; width: 70%; }
    button { padding: 6px 12px; }
  </style>
</head>
<body>
  <div id="app"></div>

  <script>
    const app = document.getElementById('app');
    
    // 1. 状态
    const state = {
      todos: ['Learn JavaScript', 'Learn Templates'],
      inputValue: ''
    };

    // 2. 简单的模板函数
    // 这是一个极简实现，主要演示原理
    function renderApp() {
      // 没有任何 Diff，直接生成全量 HTML 字符串
      const html = `
        <h1>My Todo List</h1>
        <div style="margin-bottom: 10px;">
          <input type="text" id="todo-input" value="${state.inputValue}" 
                 oninput="updateInput(this.value)" placeholder="Add a task">
          <button onclick="addTodo()">Add</button>
        </div>
        <p style="color:#666; font-size:14px;">
          总共 ${state.todos.length} 项
        </p>
        <ul>
          ${state.todos.map(todo => `<li>${todo}</li>`).join('')}
        </ul>
        <p style="color:red; font-size:12px;">提示：尝试在输入框打字，注意焦点的丢失</p>
        <hr>
        <p style="font-size:12px;">🔓 <strong>XSS 实验</strong>：在下方输入框输入<br>
        <code>&lt;img src=x onerror=alert("Hacked!")&gt;</code><br>然后点击 "Inject"，观察发生了什么。</p>
        <input type="text" id="xss-input" style="width:70%;padding:4px" placeholder="输入恶意 HTML...">
        <button onclick="injectXSS()">Inject</button>
      `;
      
      // 3. 毁灭与重建：性能杀手 & 体验杀手
      app.innerHTML = html;
    }

    // 4. 交互逻辑
    window.updateInput = (value) => {
      state.inputValue = value; 
      renderApp(); // 每次按键都重绘！
    };

    window.addTodo = () => {
      if (!state.inputValue) return;
      state.todos.push(state.inputValue);
      state.inputValue = '';
      renderApp();
    };

    // XSS 实验
    window.injectXSS = () => {
      const xssInput = document.getElementById('xss-input');
      if (!xssInput) return;
      state.todos.push(xssInput.value);
      renderApp();
    };

    // 初始化渲染
    renderApp();
  </script>
</body>
</html>
```

*(下一章：数据绑定的黎明——MVC 与观察者模式)*
