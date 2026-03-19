# PRD: The Way of React 在线阅读网站

## 1. 项目概述

为《The Way of React》技术书籍构建一个在线阅读网站，使用 **Next.js** 框架，部署至 **Vercel**。网站需渲染 Markdown 章节内容，支持中英双语切换，并提供优雅的阅读体验。

### 核心目标

| 目标        | 描述                                |
| --------- | --------------------------------- |
| **在线阅读**  | 将 `chapters/zh/` 和 `chapters/en/` 下的 Markdown 渲染为网页 |
| **双语切换**  | 在任意章节页面无缝切换中/英文版本               |
| **优雅排版**  | 参考 [Crafting Interpreters](https://craftinginterpreters.com/hash-tables.html) 的书籍排版风格 |
| **高性能**   | 利用 PPR (Partial Prerendering) 优化加载速度     |
| **SEO 友好** | 每个章节有独立的 title / description          |

---

## 2. 信息架构

```
/                          → 首页（书籍介绍）
/zh/01-the-raw-dom         → 中文第1章
/en/01-the-raw-dom         → 英文第1章
  ...
/zh/appendix-a-mini-react  → 中文附录
/en/appendix-a-mini-react  → 英文附录
/code/ch01                 → 第1章可运行 Demo（独立页面）
  ...
```

### 章节列表（共 16 篇）

| #  | 标识                                     | 中文标题                 |
| -- | -------------------------------------- | -------------------- |
| 1  | `01_the_raw_dom`                       | 原生 DOM              |
| 2  | `02_the_template_era`                  | 模板时代                 |
| 3  | `03_data_binding`                      | 数据绑定                 |
| 4  | `04_the_big_idea`                      | 核心思想                 |
| 5  | `05_virtual_dom_and_reconciliation`    | Virtual DOM 与调和      |
| 6  | `06_components`                        | 组件与组合                |
| 7  | `07_class_lifecycle`                   | Class 组件与生命周期        |
| 8  | `08_patterns_of_reuse`                 | 复用模式                 |
| 9  | `09_the_browser_freeze`                | 浏览器卡顿                |
| 10 | `10_the_fiber_architecture`            | Fiber 架构             |
| 11 | `11_fiber_reconciliation_and_commit`   | 调和与提交                |
| 12 | `12_hooks_memory_of_functions`         | Hooks                |
| 13 | `13_effects_and_memoization`           | Effects 与记忆化         |
| 14 | `14_context_and_state_management`      | 状态管理                 |
| 15 | `15_concurrent_and_server`             | 并发与 Server           |
| A  | `appendix_a_mini_react`                | 附录：Mini-React        |

---

## 3. 页面设计

### 3.1 全局布局

```
┌────────────────────────────────────────────────────────────────┐
│  Navbar: [☰ 侧边栏] [首页]              [GitHub] [🌐] [🌓]     │
├──────────┬──────────────────────────────────┬─────────────────┤
│          │                                  │                 │
│ Sidebar  │          Main Content            │  TOC on Page    │
│ (全书目录) │          (章节正文)                │  (当前章节大纲)  │
│          │                                  │                 │
│          ├──────────────────────────────────┤  · 1.1 标题      │
│          │  [← 上一章]        [下一章 →]      │  · 1.2 标题      │
└──────────┴──────────────────────────────────┴─────────────────┘
```

#### Navbar

| 位置 | 元素               | 行为                       |
| -- | ---------------- | ------------------------ |
| 左侧 | 侧边栏切换按钮（☰）      | PC 端切换侧边栏展开/收起；移动端打开 Drawer |
| 左侧 | 首页 Logo/书名       | 点击跳转首页                   |
| 右侧 | GitHub Icon      | 新窗口打开 GitHub 仓库           |
| 右侧 | 语言切换按钮（🌐 ZH/EN） | 切换语言，**保持当前章节位置**         |

#### Sidebar（左侧边栏 · 全书目录）

- PC 端：**默认展开**，固定在左侧，宽度约 260px
- 移动端：**Drawer 模式**，点击 ☰ 从左侧滑出，带遮罩层
- 内容：按顺序展示所有章节标题，当前章节高亮
- 交互：点击跳转对应章节页面

#### TOC on Page（右侧 · 当前章节大纲）

- 从当前章节的 Markdown 标题（h2、h3）自动提取生成
- **固定定位**（`position: sticky`），随页面滚动保持可见
- 高亮当前阅读位置对应的标题（Scroll Spy）
- 点击标题平滑滚动到对应段落
- 宽度约 200px，仅在 **≥ 1280px** 屏幕上显示
- 移动端 / 平板端隐藏

### 3.2 首页

首页是书籍的介绍页，包含以下区块：

| 区块     | 内容                            |
| ------ | ----------------------------- |
| 封面展示   | 书籍封面图 (`cover.png`) + 书名标题    |
| 引言     | Feynman 引言                   |
| 书籍简介   | 基于 README 的精炼描述（本书讲什么、写作风格、适合谁） |
| 目录     | 可点击的章节列表，跳转到对应章节              |
| 购买链接   | LeanPub 链接                   |
| Credits | 致谢信息                          |

> [!IMPORTANT]
> 首页排版需要精心设计，不能只是简单堆砌信息。封面图应有阴影/立体感，整体布局要有呼吸感。

### 3.3 章节阅读页

#### 正文区域

- **章节头图**：每章顶部展示 `chapters/images/chXX_xxx.png` 头图，宽度占满内容区，作为装饰性视觉元素
- **Markdown 渲染**：渲染章节 Markdown 内容，需支持：
  - 标题层级（h1-h4）
  - 对话格式：**🐼** 和 **🧙‍♂️** 的对话文本需有视觉区分（不同缩进/背景色/左边框色）
  - **代码高亮**：使用 syntax highlighting（推荐 `shiki` 或 `prism`），支持 JavaScript / HTML / CSS
  - 内联图片：`figure_X_X.png` 等插图
  - 引用块、列表、加粗/斜体
  - 行内代码高亮
- **"Try it yourself" 按钮**：章节末尾的可运行 Demo（`📦 实践一下` 段落）附带按钮，点击在新页面打开对应的 `code/chXX.html`

#### 底部导航

```
┌────────────────────────────────────────────┐
│  [← 上一章: 原生 DOM]    [下一章: 模板时代 →]    │
└────────────────────────────────────────────┘
```

- 显示上/下章名称
- 第一章隐藏"上一章"，最后一章隐藏"下一章"

### 3.4 Demo 页面 (`/code/chXX`)

- 独立页面，渲染 `code/chXX.html` 的内容
- 顶部有返回按钮，回到对应章节
- 页面标题包含章节号

---

## 4. 设计规范

> **核心设计原则（源自 [Frontend Design Skill](https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/plugins/frontend-design/skills/frontend-design/SKILL.md)）**
>
> 1. 选定一个**大胆的概念方向**，并以精准的执行力贯穿始终。
> 2. **拒绝「AI 味」通用模板**：不要使用 Inter / Roboto / Outfit / Space Grotesk 等被过度使用的字体，不要使用紫色渐变 + 白底的老套配色，不要使用千篇一律的卡片列表排版。
> 3. 每个设计决策都必须为**「武学修炼 React」这个特定上下文**服务——让人一眼认出这是一本关于内功心法的技术书。

### 4.1 美学方向：「道 · Mystical Neo-Brutalism」

设计灵感参考 query.gg 的独特美学，将"内功修炼"包装为带有一点神秘色彩的复古技术手册风格（Mystical Retro Tech），采用新粗野主义（Neo-brutalism）的排版。

| 维度            | 规范                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **概念关键词**    | 神秘（Mystical）、复古手册（Retro Manual）、手工感（Crafted）。通过实色粗边框和硬阴影营造"印刷品"般的触感。                                   |
| **整体调性**      | **Tactile, Bold, and Playful**。拒绝轻飘飘的弥散阴影和毛玻璃，转而使用充满力量感的实线边框、高对比度色彩和厚实的按钮形状。                      |
| **差异化记忆点**    | 强烈的字体反差（极粗的醒目衬线标题 + 简洁的几何无衬线正文），以及所有组件（卡片、按钮）统一带有的**硬偏移阴影**（Hard-offset Shadow）。             |
| **新粗野风格**     | 抛弃 `backdrop-filter` 模糊效果。使用 2px 的实线黑色/深色边框切割空间，所有悬浮卡片拥有 `4px 4px 0` 这类没有 blur 半径的纯色阴影。              |
| **纹理与颗粒感**    | 全局 `body::before` 使用 CSS 实现细密的**点阵网格（Dot Grid / Halftone）**，营造复古印刷物的质感。                  |

### 4.2 排版引擎 (Typography)

**拒绝 Inter / Roboto / Outfit / Space Grotesk 等被 AI 过度使用的字体。**

选用有个性但不影响阅读的字体组合，标题与正文形成鲜明对比：

| 用途            | 字体                    | 理由                                                   |
| ------------- | --------------------- | ---------------------------------------------------- |
| **标题 / 章节名**  | `Bricolage Grotesque` | 极具表现力和力量感的字体，在 Heavy 字重下有浓重的手工复古海报味。 |
| **正文 / UI 元素** | `Space Grotesk`       | 略带科技感和几何感的无衬线体，和夸张的标题形成完美收放对比。            |
| **代码**         | `JetBrains Mono`      | 保持不变，程序员友好。                                            |
| **中文正文**       | `Noto Sans SC`        | 作为 fallback，确保中文排版质量。如有 `Source Han Sans SC` 可选更佳。 |
| **装饰 / 章节编号** | `Crimson Pro`         | 用于 eyebrow 标签、章节编号等需要优雅衬线点缀的地方。                    |

> [!IMPORTANT]
> 字体对应 CSS 变量分别为 `--font-display`、`--font-body`、`--font-mono`、`--font-accent`。Bricolage 用于标题，Space Grotesk 用于主要阅读文本。

### 4.3 调色板 (Color Palette)

**关键原则**：主色大面积铺陈 + 强调色锐利点缀 > 平均分配的胆怯配色。

#### Light Mode — 温暖纸张与高对比墨色

| 元素              | 色值与处理                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **背景**          | 暖调奶油色/米黄色 `#F2F0D8`，叠加细密的点阵暗纹，带来复古印刷物质感。                                                |
| **表面/卡片**       | 亮白色 `#FFFEF5`，配以 `2px solid #1A1A1A` 的深色粗边框，以及无模糊半径的硬阴影（如 `4px 4px 0 #1A1A1A`）。                |
| **文字**          | 深炭黑 `#3D3929` 到纯黑 `#1A1A1A`。                                                               |
| **强调色**         | 充满活力的黄/金色 `#E8B931`，用于主按钮、关键词高亮，对比强烈但温暖。                                                  |
| **次要强调色**       | 橙色 `#D97706`，作为辅助渐变或状态提示。                                                                    |

#### Dark Mode — 护眼暗室与神秘金光

| 元素              | 色值与处理                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **背景**          | 深邃的炭黑/暗木色 `#141210`，叠加浅色网点阵列。                                                               |
| **表面/卡片**       | 稍亮的深灰/深棕 `#1E1C18`，边框使用偏暖的灰色 `#4A4538`。                                                       |
| **文字**          | 柔和乳白 `#F5F0E8`（标题）与暖灰 `#B8B0A0`（正文）。                                                         |
| **阴影/发光**       | 硬阴影调整为黑色纯不透明色块 `4px 4px 0 rgba(0,0,0,0.4)`，保持体积感。强调色依旧为明亮的金色。                                 |

### 4.4 对话样式 (Dialogue Styling)

书籍内容以 Shifu 🧙‍♂️ 和 Po 🐼 的对话形式展开。视觉上需采用类似 **IM 即时通讯软件的对话框（Chat Bubble）** 样式，增强沉浸感：

| 角色               | 样式                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| 🐼 **Po**        | 头像（🐼）居左侧独立显示，伴随圆形边框与硬阴影。右侧文本气泡框顶部直角（`border-top-left-radius: 4px`），营造聊天气泡的视觉引导，背景与头像一致。 |
| 🧙‍♂️ **Shifu**      | 结构同上，头像（🧙‍♂️）居左侧独立显示。背景与线条由专属的主题色渲染。 |
| **整体气泡盒**      | 两者都使用粗框 `2px solid var(--border)` 和新粗野风格的偏移阴影以区分于普通文本框。 |
| **非对话正文（叙述段落）** | 无包装，正常排版。叙述段落与对话气泡之间使用 `margin: 2.5rem 0` 创造足够的呼吸空间区隔，以避免视线上过于拥挤。 |

### 4.5 空间构成 (Spatial Composition)

**拥抱清晰的边界和模块化带来的秩序感。**

| 页面     | 构成策略                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| **首页 Hero** | 宽敞的呼吸空间。大号极粗标题，卡片采用大圆角（`12px-16px`）配硬边框和位移阴影，Hover 时阴影加深下沉，带来极强的实体按压触感（Tactile feel）。   |
| **章节阅读页** | 正文区域居中控制在 `800px` 左右，对话框边缘由左侧纯色块加厚（4px border），气泡带硬角与大圆角的结合。                |
| **Sidebar** | 悬浮在左侧，拥有自己的完整边框和深色位移阴影（`4px 4px 0`），使其像一个独立的印刷卡片贴在页面上，而不是融入背景。                |
| **按钮风格** | 采用全圆角（Pill shape），内部填充醒目的颜色，伴随着黑色的 2px 边框和 `2px 2px 0` 的小硬阴影。             |

### 4.6 动效设计 (Motion Design)

**原则**：一次精心编排的入场序列 > 到处散落的随机微交互。

| 场景                 | 动效                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **出场动画**           | 使用更快速、有弹性的入场动画（Pop-in / Snappy fade-in-up），减少缓慢漂浮感，让界面有更强的物理干脆度。 |
| **Scroll Trigger** | 章节目录卡片在**首次进入视口时**触发 fade-in-up（使用 `IntersectionObserver`），而非页面加载时立刻播放看不到的动画。                   |
| **Hover 反馈**       | 位移（`translate(-2px, -2px)`）同时加深硬阴影的偏移距离（如变到 `6px 6px`），模拟真实的卡片被"提起来"的物理触感。按下时贴紧（阴影变为 `1px 1px`）。 |
| **页面切换**           | 利用 Next.js `viewTransition` 实验性功能（已开启），在章节间切换时实现元素的平滑过渡。                        |
| **Reduced Motion** | 始终尊重 `prefers-reduced-motion: reduce`，回退到零动效。                                               |

---

## 5. 国际化 (i18n)

| 规则     | 描述                                         |
| ------ | ------------------------------------------ |
| 语言检测   | 首次访问根据浏览器 `Accept-Language` 判断，默认回退到英文    |
| 语言持久化  | 用户手动切换后，存储 preference 到 `localStorage`       |
| 切换行为   | 切换语言时保持当前章节（`/zh/ch05` ↔ `/en/ch05`）       |
| UI 翻译  | Navbar、Sidebar、底部导航等 UI 文案需双语              |
| 路由结构   | `/{locale}/{chapter-slug}`                  |

---

## 6. SEO

| 元素             | 规则                                    |
| -------------- | ------------------------------------- |
| `<title>`      | 每章独立：`{章节名} - The Way of React`       |
| `meta description` | 每章摘要（可取章节前 160 字符）                   |
| Open Graph     | 每章有 `og:title`、`og:description`、`og:image`（章节头图） |
| Sitemap        | 自动生成，包含所有中/英章节 URL                    |
| 语义化 HTML       | 使用 `<article>`、`<nav>`、`<aside>` 等语义标签 |

---

## 7. 性能优化

| 策略                  | 说明                                         |
| ------------------- | ------------------------------------------ |
| **PPR**             | 利用 Next.js Partial Prerendering，静态壳 + 动态内容流式注入 |
| **Static Generation** | 章节内容在构建时预渲染（SSG），CDN 缓存                     |
| **图片优化**            | 使用 `next/image` 自动优化章节头图和插图                |
| **代码分割**            | 代码高亮库按需加载                                  |
| **字体优化**            | 使用 `next/font` 加载 Google Fonts，避免 FOIT       |

---

## 8. 响应式断点

| 断点              | Sidebar        | 正文        | TOC on Page |
| --------------- | -------------- | --------- | ----------- |
| ≥ 1280px（大屏 PC） | 默认展开，固定左侧      | 居中        | **显示**，固定右侧 |
| 1024–1279px（PC）  | 默认展开，固定左侧      | 居中        | **隐藏**      |
| 768–1023px（平板）   | 收起，可点击展开       | 全宽        | 隐藏         |
| < 768px（手机）      | Drawer 模式      | 全宽        | 隐藏         |

---

## 9. 仓库目录调整

```
the-way-of-react/
├── chapters/              # 保持不变
│   ├── zh/
│   ├── en/
│   └── images/
├── code/                  # 保持不变（可运行的 HTML demo）
├── cover.png              # 保持不变
├── README.md
├── README.zh.md
├── AGENTS.md
├── website/               # [NEW] Next.js 项目
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx           # 根布局（Navbar + Sidebar 骨架）
│   │   ├── page.tsx             # 首页
│   │   ├── [locale]/
│   │   │   └── [slug]/
│   │   │       └── page.tsx     # 章节阅读页
│   │   └── code/
│   │       └── [chapter]/
│   │           └── page.tsx     # Demo 页面
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TableOfContents.tsx   # 右侧章节大纲 + Scroll Spy
│   │   ├── ChapterNav.tsx       # 上一章/下一章
│   │   ├── MarkdownRenderer.tsx # Markdown 渲染 + 对话样式
│   │   └── ThemeToggle.tsx      # 暗色模式切换
│   ├── lib/
│   │   ├── chapters.ts          # 章节元数据（标题、slug、顺序）
│   │   ├── markdown.ts          # Markdown 解析逻辑
│   │   └── i18n.ts              # 国际化工具
│   ├── styles/
│   │   └── globals.css
│   └── public/
│       └── (static assets)
└── ...
```

> [!NOTE]
> `website/` 中的 Next.js 项目通过相对路径 `../chapters/` 和 `../code/` 读取书籍内容。构建时将 Markdown 预编译为静态页面。

### 为什么 Monorepo + `website/` 子目录是最佳选择

将 Next.js 项目作为书籍仓库的子目录，是兼顾**内容更新自动部署**和**代码组织清晰**的最优方案：

| 考量           | 分析                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------- |
| **自动部署**     | Markdown 和 Next.js 在同一 repo → 任何 push（无论改了章节还是代码）都会触发 Vercel 重新构建部署，无需配置 webhook 或跨仓库触发 |
| **构建时读取内容**  | Next.js 构建时可通过 `../chapters/` 直接读取 Markdown 文件，无需 submodule、npm 包或 API 等额外机制               |
| **Vercel 子目录部署** | Vercel 原生支持 monorepo：在 Project Settings → General → **Root Directory** 设为 `website/` 即可，Vercel 会自动 `cd website && npm run build` |
| **关注点分离**    | 书籍内容（`chapters/`、`code/`）和网站代码（`website/`）目录清晰分离，互不干扰                                      |
| **Git 历史**   | 书籍内容的 Git 历史不受网站代码影响，反之亦然                                                                    |

> [!IMPORTANT]
> Vercel 部署配置关键步骤：
> 1. Import 仓库后，**Root Directory** 设为 `website`
> 2. Build Command: `npm run build`（默认即可）
> 3. Output Directory: `.next`（默认即可）
> 4. 确保 `next.config.js` 中用相对路径 `path.join(__dirname, '..', 'chapters')` 引用内容目录

---

## 10. 技术栈

| 类目           | 选型                                              |
| ------------ | ----------------------------------------------- |
| 框架           | **Next.js 16** (App Router, Turbopack default)   |
| 语言           | TypeScript                                       |
| 样式           | **Vanilla CSS** (`globals.css`) 用于最大化设计的灵活性与定制化，原生支持 CSS 变量与顶级动效。 |
| Markdown 解析  | `unified` + `remark` + `rehype`                  |
| 代码高亮         | `shiki`（支持 VS Code 主题）                          |
| 部署           | Vercel                                           |
| 字体           | Google Fonts (`Bricolage Grotesque` & `Space Grotesk` & `Crimson Pro`) |

> [!NOTE]
> Next.js 16 的关键特性：Turbopack 成为默认 bundler，`use cache` + PPR 作为 Cache Components 模型，React Compiler 内置支持。
> 样式策略：放弃 TailwindCSS 的 utility 拥挤感，使用纯正的 Vanilla CSS，以精细控制 `backdrop-filter`、`@keyframes` 和复杂的复合阴影，确保设计达到「Premium」级别。

---

## 11. 非功能需求

| 项目     | 说明             |
| ------ | -------------- |
| 首次加载   | LCP < 2s       |
| 可访问性   | 键盘导航、aria 标签   |
| 浏览器兼容  | Chrome / Safari 最新两个版本 |
| 内容更新   | 推送 Markdown 变更到 GitHub 后，Vercel 自动触发重新构建部署 |

---

## 12. 不包含（Out of Scope）

- ❌ 全文搜索
- ❌ 阅读进度追踪
- ❌ 评论/讨论功能
- ❌ 用户登录系统
- ❌ Mermaid 图表渲染（章节中无 Mermaid）
- ❌ 自定义域名（使用 Vercel 默认域名）
