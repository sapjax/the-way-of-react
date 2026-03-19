# 第九章：浏览器停摆 —— 性能危机的爆发 (The Browser Freeze)

![figure 9.1](../../website/public/images/ch09_browser_freeze.png)

## 9.1 栈的无底洞

**🐼**：师傅，上一章我加了好多高阶组件来实现逻辑复用。结果测试的时候发现，只要数据稍微大一点，页面在输入时就会卡顿。这是怎么回事？

**🧙‍♂️**：回忆一下，我们在第五章写的 `patch` 函数，遇到一棵包含成千上万个节点的虚拟 DOM 树时，是如何遍历的？

**🐼**：它会对比根节点，然后用 `for` 循环遍历 `children`。如果子节点也是组件，它就会递归调用 `patch` 继续往下对比。

**🧙‍♂️**：是的。这种深度依赖 JavaScript 引擎自身调用栈（Call Stack）的架构，被称为 **栈协调器（Stack Reconciler）**。

**🐼**：递归调用栈有问题吗？一口气把整棵树对比完，然后统一更新真实 DOM，听起来很合理呀。

**🧙‍♂️**：代码逻辑上没有问题。但结合浏览器的运行环境来看呢？前端有几个线程在处理渲染和脚本？

**🐼**：啊！前端是单线程的。JavaScript 执行、页面布局、绘制屏幕，还有处理用户的交互事件，全都挤在同一条主线程（Main Thread）上。

**🧙‍♂️**：正是。那么，为了保持动画和页面的流畅，浏览器通常需要维持怎样的帧率？这意味着每帧留给主线程的时间有多少？

**🐼**：一般是 60 FPS（每秒 60 帧）。也就是说，1000 毫秒除以 60，大约只有 **16 毫秒** 的时间来渲染一帧。

```text
|--- 16ms ---|--- 16ms ---|--- 16ms ---|--- 16ms ---|
  JS + 绘制    JS + 绘制    JS + 绘制    JS + 绘制
```

**🐼**：我懂了！在这 16 毫秒里，浏览器既要执行 JS，又要计算布局和绘制像素。如果 JS 执行耗时过长，就会挤占绘制的时间。

## 9.2 霸道的主线程占用

**🧙‍♂️**：是的。现在把这个机制套用到我们的 `patch` 函数上。如果你有 10,000 个节点，一次递归遍历需要 500 毫秒，会发生什么？

**🐼**：一旦触发 `patch`，JavaScript 就会在调用栈里疯狂压入成百上千个函数。因为递归是同步的，这 500 毫秒内主线程会被彻底锁死。

**🧙‍♂️**：在这漫长的半秒钟里，浏览器处于什么状态？

**🐼**：浏览器就像死机了一样！它既没空重绘屏幕，也无法处理我的键盘输入。哪怕我按下了按键，字母也得等这 500 毫秒的递归跑完才能显示出来。这就是卡顿的真相。

```text
|------------- 500ms 的纯 JS 执行 (React Patch) --------------| -> | 绘制 |
↑                                                          ↑
用户按键                                                  屏幕终于更新
(浏览器无法响应)
```

**🧙‍♂️**：不仅如此。如果页面上有正在播放的 CSS 动画，或者用户正在滚动页面，他们会看到画面直接定格。

## 9.3 试图让出控制权

**🐼**：这也太霸道了。既然 500 毫秒太长，我们能不能把它切碎？比如拆成 50 个 10 毫秒的小块。

**🧙‍♂️**：思路很清晰。每执行完一小块，就把控制权还给浏览器去处理输入和绘制，等闲下来再继续执行下一块。这种技术叫什么？

**🐼**：这应该是操作系统里的“时间切片（Time Slicing）”或者协作式多任务调度吧？

**🧙‍♂️**：是的。但看看我们的 `patch` 代码，你能在一个原生的 `for` 循环和递归中，实现这样的“暂停”和“恢复”吗？

```javascript
// Stack Reconciler 的致命缺陷：
function patch(oldVNode, newVNode) {
  // ... 其他逻辑 ...

  // 一旦进入循环并开始递归，在整棵树遍历完之前，控制权绝对不会交还！
  for (let i = 0; i < children.length; i++) {
    patch(oldChild[i], newChild[i]); // 深度递归
  }
}
```

**🐼**：不行……原生调用栈就像一条滑梯，一旦滑下去就必须滑到底，根本无法在半空中停下来，更别说记住停在哪、等会儿再接着滑了。

**🧙‍♂️**：的确。只要还在使用 JavaScript 的原生调用栈遍历树，时间切片就永远无法实现。

**🐼**：那该怎么办？难道我们要自己模拟一个调用栈，把树的遍历从递归改成某种可以随时停下来的循环迭代？

**🧙‍♂️**：这正是现代 React 的核心转折点。为了解决这个致命的性能危机，React 团队整整花了两年时间，将底层的协调引擎彻底重写。

**🐼**：彻底重写？那原本的树状结构也要改变吗？

**🧙‍♂️**：是的。他们抛弃了原生调用栈，引入了一种专为“可中断”和“时间切片”设计的全新链表架构，也就是 —— **Fiber**。但在那之前，你先在今天的实验里，亲自体会一下主线程被锁死的感觉吧。

---

### 📦 实践一下

将以下代码保存为 `ch09.html`，用浏览器打开，亲身体验由深度递归引发的“主线程被锁死”：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Chapter 9 — The Browser Freeze</title>
  <style>
    body { font-family: sans-serif; padding: 20px; text-align: center; }
    .box { display: inline-block; width: 10px; height: 10px; margin: 1px; background: #0066cc; }
    input { padding: 10px; font-size: 16px; width: 300px; margin: 20px; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    #status { color: #ff4444; font-weight: bold; margin: 10px; }
  </style>
</head>
<body>
  <h1>Browser Freeze Demo</h1>
  <p>1. 尝试在下方的输入框中稳定打字，感受它的流畅。</p>
  <p>2. 点击“触发万级节点渲染”按钮。</p>
  <p>3. <strong>在渲染完成前</strong>（页面卡住时），立刻回到输入框中疯狂打字。</p>
  
  <input type="text" placeholder="在这里打字试试...">
  <br>
  <button id="render-btn">触发万级节点渲染</button>
  <div id="status"></div>
  <div id="app"></div>

  <script>
    // 模拟 Stack Reconciler 的递归渲染
    function renderTree(depth) {
      if (depth === 0) {
        const el = document.createElement('div');
        el.className = 'box';
        // 模拟一些消耗 CPU 的组件逻辑
        let sum = 0;
        for (let i = 0; i < 50000; i++) sum += Math.random();
        return el;
      }
      
      const container = document.createElement('div');
      // 每一层有两个分支，指数级增长
      container.appendChild(renderTree(depth - 1));
      container.appendChild(renderTree(depth - 1));
      return container;
    }

    document.getElementById('render-btn').addEventListener('click', () => {
      const app = document.getElementById('app');
      const status = document.getElementById('status');
      
      status.textContent = 'Rendering... 页面已卡死，赶紧试试打字！';
      
      // 使用 setTimeout 让上面的状态文字能先渲染出来，再开始霸占主线程
      setTimeout(() => {
        const start = performance.now();
        
        // 生成深度为 13 的树，共 8192 个节点，带耗时计算
        const tree = renderTree(13);
        
        app.innerHTML = '';
        app.appendChild(tree);
        
        const time = (performance.now() - start).toFixed(0);
        status.textContent = `Done in ${time} ms. (刚才你按下的键现在才弹出来吧！)`;
      }, 50);
    });
  </script>
</body>
</html>
```