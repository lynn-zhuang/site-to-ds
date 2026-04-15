---
name: site-to-ds
description: 从参考网站深度提取完整 UI 设计系统（Style Foundations + 组件结构 + 交互行为），自动验证提取完整性，并基于提取的 foundations 自动生成覆盖 Web App 常规场景的完整组件库。内置 Brand Customizer 面板支持实时替换品牌色/字体/图标库。触发场景："提取这个网站的设计系统"、"我想参考 X 网站的风格"、"帮我分析这个网站的 UI 组件"、"复刻这个网站的设计"、"harvest this site" 等。
---

# Site-to-DS Skill

从目标网站深度提取完整 UI 设计系统，分三层输出：

1. **Style Foundations** — design tokens, color, typography, spacing, motion
2. **Extracted Components** — 从目标网站实际提取的组件结构、样式、交互状态
3. **Generated Components** — 基于 foundations 自动推导生成的完整 Web App 组件库
4. **Brand Customizer** — 实时替换品牌色、字体、图标库、中性色调的交互面板

---

## 核心差异（vs design-extractor）

| 问题 | 本 skill 的解决方案 |
|------|-------------------|
| 组件靠 class 名匹配导致漏检 | DOM 结构 + computed styles 双重发现 |
| 每种组件只取第一个 | 取所有变体（最多 8 个），含 computed styles |
| 没有验证闭环 | **强制完整性检查循环** — 必须对照截图逐区验证 |
| 只读 styleSheets | 同时读 computed styles（兼容 CSS-in-JS / Tailwind） |
| 单页提取 | 支持多页爬取 |
| 没有组件生成 | 基于 foundations 自动生成缺失组件 |
| 提取后无法调整品牌 | **Brand Customizer 面板** — 实时修改品牌色/字体/图标/色调 |

---

## Phase 0: 连接方式选择

### 优先级 1: Chrome DevTools MCP（最佳 — 可访问已登录页面）

尝试调用 `mcp__chrome-devtools__list_pages` 检测是否可用：

- 如可用 → 使用 Chrome DevTools MCP 直连浏览器
- 用户已在浏览器中登录 → 可直接提取需要认证的页面
- 通过 `mcp__chrome-devtools__evaluate_script` 执行 `scripts/audit-template.js` 中的审计函数
- 通过 `mcp__chrome-devtools__take_screenshot` 截图
- 通过 `mcp__chrome-devtools__click` 触发弹出层
- 通过 `mcp__chrome-devtools__hover` 提取 hover 状态

**Chrome DevTools 模式的执行流程：**

1. `mcp__chrome-devtools__navigate_page` 导航到目标 URL
2. `mcp__chrome-devtools__take_screenshot` 全页截图
3. `mcp__chrome-devtools__evaluate_script` 执行 audit-template.js 的 `fullUIAudit()` 函数
4. **⚠️ 必须主动触发隐藏组件** — 对 `popoverTriggers` 结果中的每个触发器：
   - `mcp__chrome-devtools__take_snapshot` 获取 a11y tree 找到 uid
   - `mcp__chrome-devtools__click` 点击触发
   - 等待 300ms
   - `mcp__chrome-devtools__take_screenshot` 截图弹出内容
   - `mcp__chrome-devtools__evaluate_script` 提取弹出层的 computed styles（bg, border, radius, shadow, width, padding, z-index）
   - `mcp__chrome-devtools__press_key` 按 Escape 关闭
   - **重点触发对象**：`aria-haspopup="dialog"` 的按钮（可能是 Modal/Popover）、`aria-haspopup="menu"` 的按钮（Dropdown Menu）、用户头像按钮（Profile Menu）、通知铃铛（Notification Panel）
   - 注意区分：popover（锚定在触发器旁边）vs full-screen modal（居中+遮罩层）vs dropdown menu（菜单项列表）
5. 对关键交互元素提取 hover 状态：
   - `mcp__chrome-devtools__evaluate_script` 记录 default styles
   - `mcp__chrome-devtools__hover` 触发 hover
   - `mcp__chrome-devtools__evaluate_script` 记录 hover styles，计算 diff
6. 自动发现导航链接，逐页重复 2-5
7. **空状态提取**：导航到列表/搜索页面，如果页面显示空状态（"No results"、"No items"），提取空状态的图标（通常是放大的 Lucide 图标 + 降低透明度）、标题、描述文案的样式

### 优先级 2: Playwright 自动模式

如 Chrome DevTools MCP 不可用，回退到 Playwright：

```bash
node site-to-ds/scripts/setup.js    # 首次安装
node site-to-ds/scripts/harvest.js <URL>
```

### 优先级 3: 手动模式

如 Playwright 也无法安装，引导用户在 DevTools Console 中运行 `scripts/audit-template.js` 中的 `fullUIAudit()` 函数，复制 JSON 结果。

---

## Phase 1: 自动化提取

### Playwright 模式命令

```bash
# 标准模式
node site-to-ds/scripts/harvest.js <URL>

# 多页爬取
node site-to-ds/scripts/harvest.js <URL> --pages=5

# 带认证
node site-to-ds/scripts/harvest.js <URL> --auth="cookie_string_here"
```

### 输出结构

```
site-to-ds-output/
├── harvest-raw.json         ← 完整提取数据（组件、交互状态、图标、子页面）
├── computed-tokens.json     ← 频率排序的 computed styles（颜色/字体/间距/阴影/圆角/毛玻璃/渐变）
├── site.css                 ← CSS 变量 + 规则 + @keyframes
├── icons/                   ← 提取的 SVG 图标和插画文件
│   ├── icon-00.svg ~ icon-29.svg
│   └── illustration-00.svg ~ illustration-09.svg
└── screenshots/
    ├── 00-fullpage.png
    ├── hover-*.png
    ├── sections/            ← 逐屏截图（每个 viewport 高度一张）
    │   ├── section-00.png
    │   ├── section-01.png
    │   └── ...
    ├── components/          ← 逐组件截图
    │   ├── button-0.png
    │   ├── card-0.png
    │   └── ...
    └── subpage-*.png        ← 子页面截图
```

---

## Phase 2: 生成设计系统文件

读取所有提取数据 + 截图，生成以下文件。

### ⚠️ 关键规则：必须逐项执行，不允许跳过或合并

生成顺序严格如下，每个文件生成后立即写入磁盘：

### 文件 1: `foundations.json`

Style Foundations — 整个设计系统的基础层。

```json
{
  "meta": {
    "source": "URL",
    "extractedAt": "ISO date",
    "designLanguage": "描述（如 minimal, editorial, data-dense）",
    "techStack": "检测到的技术栈"
  },
  "color": {
    "raw": [
      { "value": "#hex", "rgb": "r,g,b", "usage": "背景/文字/边框", "frequency": 42 }
    ],
    "semantic": {
      "brand": { "primary": "", "secondary": "", "accent": "" },
      "surface": { "background": "", "card": "", "elevated": "", "overlay": "" },
      "text": { "primary": "", "secondary": "", "muted": "", "inverse": "", "link": "" },
      "border": { "default": "", "subtle": "", "strong": "", "focus": "" },
      "state": { "success": "", "warning": "", "error": "", "info": "" },
      "interactive": { "hover": "", "active": "", "selected": "", "disabled": "" }
    },
    "darkMode": "如果可推断，填写对照映射；否则标注 inferred"
  },
  "typography": {
    "fontFamily": { "heading": "", "body": "", "mono": "", "display": "" },
    "fontSize": { "xs": "", "sm": "", "base": "", "md": "", "lg": "", "xl": "", "2xl": "", "3xl": "", "4xl": "" },
    "fontWeight": { "light": "", "regular": "", "medium": "", "semibold": "", "bold": "", "extrabold": "" },
    "lineHeight": { "tight": "", "snug": "", "normal": "", "relaxed": "" },
    "letterSpacing": { "tight": "", "normal": "", "wide": "" }
  },
  "spacing": {
    "baseUnit": "4px 或 8px",
    "scale": { "0": "0", "px": "1px", "0.5": "", "1": "", "1.5": "", "2": "", "3": "", "4": "", "5": "", "6": "", "8": "", "10": "", "12": "", "16": "", "20": "", "24": "" }
  },
  "radius": { "none": "0", "sm": "", "md": "", "lg": "", "xl": "", "2xl": "", "full": "9999px" },
  "shadow": { "sm": "", "md": "", "lg": "", "xl": "" },
  "border": { "width": { "default": "", "thick": "" }, "style": "solid" },
  "motion": {
    "duration": { "instant": "", "fast": "", "normal": "", "slow": "", "slower": "" },
    "easing": { "standard": "", "enter": "", "exit": "", "spring": "" }
  },
  "opacity": { "disabled": "", "hover": "", "overlay": "", "muted": "" },
  "zIndex": { "dropdown": "", "sticky": "", "modal": "", "toast": "", "tooltip": "" },
  "breakpoints": { "sm": "", "md": "", "lg": "", "xl": "", "2xl": "" },
  "container": { "maxWidth": "", "padding": "" },
  "glassEffect": {
    "backdropBlur": "",
    "background": "",
    "border": "",
    "borderRadius": ""
  },
  "gradient": [
    { "value": "linear-gradient(...)", "usage": "描述" }
  ],
  "iconography": {
    "source": "inline-svg / icon-font / img",
    "library": "检测到的图标库名（如 Lucide, Font Awesome, Material Icons）",
    "dominantStyle": "outline / filled / duotone",
    "sizes": { "sm": "", "md": "", "lg": "" },
    "colorBehavior": "currentColor / fixed / multi-color",
    "colorAdaptable": "百分比（使用 currentColor 的比例）",
    "strokeWidth": "如果是 outline 风格，标注线宽"
  },
  "illustration": {
    "style": "flat / isometric / hand-drawn / 3d / line-art / 描述",
    "colorPalette": "使用的颜色范围",
    "sources": ["SVG 内联", "img 引用"]
  }
}
```

生成规则：
- **颜色**：先从 `computed-tokens.json` 的 frequency 排序取实际使用的颜色，再与 `site.css` 的 CSS 变量交叉验证，最后看截图确认
- **间距**：从 `computed-tokens.json` 的 spacings 提取高频值，推导出 base unit
- **圆角/阴影**：直接从 computed-tokens 按频率取
- 不确定的值标注 `"inferred": true`
- **所有值必须有来源**：CSS 变量 / computed style / 截图推断，标注来源

---

### 文件 2: `palette.md`

完整颜色文档。

必须包含：
- **原始色板**：所有颜色（色块名 / HEX / RGB / 出现频率 / 用途描述）
- **语义映射表**：每个语义 token → 原始色值
- **Light/Dark 模式对照**（如可推断）
- **颜色组合规则**：哪些颜色可以叠加使用，哪些禁止
- **渐变色**：如有检测到 gradient，列出具体值

---

### 文件 3: `design-system.md`

完整设计规范。章节覆盖三大分组：Foundations（9 章）、Visual Assets（Iconography + Illustrations）、Component Styles。

**强化规则：**

- 每个章节必须引用 `foundations.json` 中的具体 token 名
- Component Styles 章节必须涵盖**所有**在 `harvest-raw.json` 中发现的组件类型
- 每个组件必须有：视觉规格 / 所有交互状态 / token 引用 / HTML 骨架
- Animations 章节必须包含所有从 keyframes 和 transitions 提取的动效
- **Iconography 章节**（在 Visual Assets 分组下）：图标来源 / 图标库名 / 风格（outline/filled/duotone）/ 尺寸体系 / 颜色行为（currentColor vs fixed）/ 图标使用规范
- **Illustrations 章节**（在 Visual Assets 分组下）：插画风格描述 / 颜色范围 / 使用场景 / 来源（内联 SVG / img 引用）/ **如果产品使用放大图标作为插画，必须记录这一设计模式**
- **Glass Effects 章节**（如适用）：backdrop-blur 值 / 背景色透明度 / 边框样式 / 使用场景

---

### 文件 4: `components.md`

组件结构文档。

**对每个在 harvest-raw.json 中发现的组件类型：**

```markdown
## [组件名] (extracted: N variants)

### 变体一
- **来源选择器**: `selector`
- **位置**: x, y (相对页面)
- **尺寸**: W × H
- **Computed Styles**: backgroundColor, color, borderRadius, padding, boxShadow, fontSize, fontWeight
- **HTML 骨架**（简化版，去除业务内容）
- **交互状态**: default / hover / active / focus / disabled
- **Token 引用**: 使用了哪些 foundation tokens

### 变体二（如有差异）
...
```

---

### 文件 5: `preview.html`

**核心原则：preview 本身必须使用提取的 UI 样式来渲染自己。** 这不是一个"关于设计系统的文档页面"，而是一个"用目标设计系统构建的真实应用页面"。

纯 HTML + CSS + 少量 JS，无外部依赖（字体除外），必须遵循以下规范：

---

#### 全局样式规则

preview.html 的所有样式必须来自提取的 foundations：

```css
:root {
  /* 直接使用 foundations.json 中的 tokens */
  --color-brand-primary: /* 提取值 */;
  --color-surface-background: /* 提取值 */;
  --color-text-primary: /* 提取值 */;
  --font-family-body: /* 提取值 */;
  --font-family-heading: /* 提取值 */;
  --radius-md: /* 提取值 */;
  --shadow-md: /* 提取值 */;
  --spacing-4: /* 提取值 */;
  /* ... 所有 tokens 定义为 CSS 变量 ... */

  /* Glow 动画颜色 — 从品牌色派生，用于 motion 动效演示 */
  --glow-color-dim: rgba(品牌色RGB, 0.12);
  --glow-color-bright: rgba(品牌色RGB, 0.35);
}

[data-theme="dark"] {
  /* dark mode 覆盖 */
  --color-surface-background: /* dark 值 */;
  --color-text-primary: /* dark 值 */;
  /* ... */
}
```

页面上所有元素（Topbar、Sidebar、Card、Button...）必须引用这些 CSS 变量，禁止硬编码颜色/字体/间距。

**⚠️ Dark Mode 关键规则：**
- Semantic color chips 的色块必须使用 CSS 变量（如 `background:var(--color-surface-bg)`），不能硬编码 hex 值，否则 dark mode 下无法正确变化
- `.semantic-chip-dot` 的 border 必须使用 `var(--color-border-subtle)`，不能用 `rgba(0,0,0,0.08)`
- 所有需要跟随主题变化的颜色值，在 JS 中设置时必须检查 `data-theme` 属性

---

#### 页面布局（三栏式应用布局）

```
┌──────────────────────────────────────────────────────────────────┐
│  Logo + Title                [✏ Customize] [EN|中] [🌙]          │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│   Sidebar    │           Main Content Area                       │
│              │                                                   │
│  ┌────────┐  │                                                   │
│  │Foundations│ │                                                   │
│  │ Color   │  │                                                   │
│  │ Type    │  │                                                   │
│  │ ...     │  │                                                   │
│  ├────────┤  │                                                   │
│  │Visual   │  │                                                   │
│  │ Icons   │  │                                                   │
│  │ Illust  │  │                                                   │
│  ├────────┤  │                                                   │
│  │Components│ │                                                   │
│  │ Button  │  │                                                   │
│  │ Card    │  │                                                   │
│  │ ...     │  │                                                   │
│  └────────┘  │                                                   │
├──────────────┴───────────────────────────────────────────────────┤
```

---

#### Topbar 规范

- **左侧**：Logo SVG + 设计系统名称（如 "Stripe Design System"），使用提取的 heading 字体 + brand color
- **右侧工具栏** `topbar-actions`，从左到右依次排列：
  1. **Brand Customizer 按钮**：文字+图标按钮样式（画笔/编辑图标 + "Customize" 文字），带边框，点击打开右侧面板。**必须在 actions 区的最左边**
  2. **语言切换**：组合按钮组 `[EN|中]`，合并为一个带外框的 button group，选中项用品牌色填充高亮（`background: var(--color-brand-primary); color: #fff`），整体感更强
  3. **Light/Dark 模式切换**：图标按钮（☀️/🌙），点击切换 `[data-theme]` 属性
- **所有 Topbar 按钮必须有 tooltip**（CSS `::after` 伪元素实现）
  - Customize 按钮：tooltip "Brand Customizer"
  - 语言组合按钮：tooltip "Switch Language"
  - 主题按钮：tooltip 动态显示 "Dark Mode" 或 "Light Mode"（根据当前主题状态）
- **最右边按钮的 tooltip 使用右对齐**（`right:0; transform:none`），避免被浏览器窗口右边界裁切

**Tooltip CSS 实现：**
```css
[data-tooltip] { position:relative; }
[data-tooltip]::after {
  content:attr(data-tooltip); position:absolute; top:calc(100% + 6px); left:50%;
  transform:translateX(-50%); padding:4px 10px; border-radius:var(--radius-default);
  background:var(--color-text-primary); color:var(--color-surface-bg);
  font-size:11px; white-space:nowrap; pointer-events:none; opacity:0;
  transition:opacity var(--duration-fast); z-index:200;
}
[data-tooltip]:hover::after { opacity:1; }
/* 右侧对齐 — 用于最右边的按钮，防止 tooltip 超出窗口 */
[data-tooltip-end]::after { left:auto; right:0; transform:none; }
```

**语言切换组合按钮 CSS：**
```css
.lang-group { display:flex; border:1px solid var(--color-border-subtle); border-radius:var(--radius-md); overflow:hidden; }
.lang-btn { padding:var(--space-1) var(--space-2); border:none; background:transparent; font-size:var(--fs-xs); color:var(--color-text-muted); cursor:pointer; font-weight:var(--fw-medium); }
.lang-btn:not(:last-child) { border-right:1px solid var(--color-border-subtle); }
.lang-btn:hover { background:var(--color-interactive-hover); }
.lang-btn.active { background:var(--color-brand-primary); color:#fff; }
```

**Customize 按钮 CSS：**
```css
.topbar-cust-btn {
  display:flex; align-items:center; gap:6px; height:32px;
  padding:0 12px 0 10px; border-radius:var(--radius-md);
  border:1px solid var(--color-border-subtle); background:var(--color-surface-bg);
  color:var(--color-text-primary); font-size:var(--fs-xs); font-weight:var(--fw-medium);
  cursor:pointer;
}
.topbar-cust-btn:hover { background:var(--color-interactive-hover); }
```

**语言切换的实现方式：**

```html
<!-- 每个需要翻译的文本用 data-i18n 标注 -->
<h2 data-i18n="color_palette">Color Palette</h2>
<p data-i18n="color_palette_desc">All colors extracted from the target website.</p>
```

```js
const i18n = {
  en: {
    color_palette: "Color Palette",
    customizer_btn: "Customize",
    // ... 所有界面文案
  },
  zh: {
    color_palette: "色彩系统",
    customizer_btn: "自定义",
    // ... 所有界面文案
  }
};
```

---

#### Sidebar 规范

- 宽度：240px-280px，使用提取的 `--color-surface-card` 或 `--sidebar-background` 背景色
- `position: sticky; top: [topbar-height]; height: calc(100vh - [topbar-height]);`
- `overflow-y: auto;` 内容超出时可滚动
- **分三个平级分组**，每组有分组标题：

**分组标题样式规范：**
- 字号：11px，font-weight: medium (500)
- 颜色：使用 `--color-text-placeholder`（比 muted 更淡的灰色），**不是** muted 色
- 文字：uppercase + letter-spacing: 0.06em
- 分组之间：只使用 `margin-top: 32px` 间距分隔，**不使用分割线**（保持侧边栏干净）
- 第一个分组标题的 margin-top 较小（8px）

**分组 1: Foundations**（设计基础层）
```
FOUNDATIONS
├── Overview
├── Color Palette
├── Typography
├── Spacing
├── Border Radius
├── Shadows & Elevation
├── Motion & Transitions
├── Glass Effects（如适用）
└── Breakpoints
```

**分组 2: Visual Assets**（视觉资产层 — Icons 和 Illustrations 独立于 Foundations）
```
VISUAL ASSETS
├── Icons
└── Illustrations
```

**分组 3: Components**（组件层）
```
COMPONENTS
├── Button
├── Input
├── Select
├── Card
├── Badge
├── Avatar
├── Toggle
├── Nav Item
├── Filter Chips
├── Dialog / Modal         ← 必须主动触发提取
├── Dropdown Menu          ← 必须主动触发提取
├── Toast
├── Skeleton
├── Empty State            ← 容易遗漏，需要导航到空列表页提取
├── Notification Bar       ← 全局通知横幅，容易遗漏
├── View Toggle            ← grid/list 切换器
├── Upgrade Banner
├── ... (其他提取到的 + 生成的组件)
└── (generated) 标记生成的组件
```

- 每项是可点击的导航项，点击后：
  - 左侧高亮当前项（用提取的 `--color-interactive-selected` 或 `--color-brand-primary` + 透明度）
  - 右侧主内容区滚动到对应 section
- 当前可视区域的 section 自动高亮对应的 sidebar 导航项（scroll spy）
- 导航项的 hover/active 状态使用提取的交互 tokens

---

#### Main Content Area 规范

`padding` 使用提取的 spacing tokens，`max-width` 使用提取的 container maxWidth。

每个 section 的结构：

```html
<section id="color-palette" class="harvest-section">
  <h2 data-i18n="color_palette">Color Palette</h2>
  <p class="section-desc" data-i18n="color_palette_desc">...</p>

  <!-- Section 具体内容 -->
</section>
```

section 标题使用提取的 heading 字体 + 字阶（`font-family: var(--font-heading)`），段落用 body 字体。

---

#### Foundations Sections 内容规范

**1. Overview**
- 设计系统名称、来源 URL、提取时间
- 设计语言关键词标签（如 minimal / bold / editorial）— 用提取的 Badge 样式渲染
- 技术栈标签
- 设计哲学摘要（3-5 条）

**2. Color Palette**

三个子区：

*Semantic Colors 语义颜色：*（放在最前面）
- 按分组展示：Brand / Surface / Text / State
- 每个 chip：**28×28 色块**（border-radius: var(--radius-md)）+ token 名 + **HEX 色值**
- 色块使用 CSS 变量渲染（如 `background:var(--color-surface-bg)`），**不能硬编码 hex**
- HEX 值通过 JS `getComputedStyle` 动态计算并填充，Light/Dark 切换时自动更新
- 点击 chip → 复制 HEX 值

*Raw Colors 原始色板：*（**不折叠**，直接展示）
- 紧凑网格排列（`minmax(90px, 1fr)`），每个色块高度 40px
- 每个色块：颜色块 + 名称 + HEX
- 点击色块 → 复制 HEX 值 → 显示 "Copied!" toast

*Gradients 渐变色：*
- 展示从网站提取的渐变 + 基于品牌色派生的渐变
- 每个渐变卡片：渐变色块（56px 高）+ 名称 + CSS 值
- 点击复制渐变 CSS 值
- 至少包含：Brand Gradient（primary → secondary）、Brand → Accent、Surface Subtle

**3. Typography**

- 字体家族展示：每种字体一个区块，显示字体名 + 实际渲染文字
- 完整字阶表：每行一个 size，左侧 token 名 + 数值，右侧用该 size 渲染示例文字
- 字重对比：同一段文字用不同 weight 渲染
- 行高对比：同一段文字用不同 lineHeight 渲染

**4. Spacing**
- 可视化间距条：每个 spacing token 一行，左侧名称+数值，右侧对应宽度的色块（用 brand color + 透明度）
- 纵向排列，从小到大

**5. Border Radius**
- 每级圆角一个方块（64×64），背景色用 brand color，展示实际圆角效果
- 下方标注 token 名 + px 值

**6. Shadows & Elevation**
- 每级阴影一个白色卡片（用提取的 card 背景色），展示实际阴影效果
- 下方显示 CSS box-shadow 值（点击可复制）

**7. Opacity**
- 每个透明度值一个色块，背景为 brand color + 对应 opacity
- 标注用途（disabled / hover / overlay）

**8. Motion & Transitions**
- 每个动效一个演示区：点击/hover 触发动画重放
- **glow 动效必须使用 CSS 变量** `--glow-color-dim` / `--glow-color-bright`，这样品牌色变化时 glow 颜色会同步更新
- 显示 duration + easing 值
- 显示 CSS 代码片段（点击复制）

**9. Breakpoints**
- 断点表格：名称 / 值 / 目标设备
- 当前窗口宽度实时显示，高亮命中的断点

---

#### Visual Assets Sections 内容规范

Visual Assets 是独立于 Foundations 和 Components 的第二级分组，包含 Icons 和 Illustrations 两个 section。

**1. Icons**
- 图标概览：来源（inline SVG / icon font / img）、图标库名、总数量
- 风格标签：outline / filled / duotone（用提取的 Badge 样式渲染）
- 尺寸规范：展示 sm / md / lg 各尺寸的实际图标
- 颜色行为：标注是否使用 currentColor（可跟随文字颜色变化）
- **原始提取图标网格**：默认显示从目标网站提取的 SVG 图标
  - 每个图标：实际渲染（使用提取的 currentColor 或原色） + 名称标注
  - 点击复制 SVG 代码
- **自定义图标库切换**：当用户在 Brand Customizer 中选择了其他图标库时，替换显示新图标库的图标（约 50 个）
- Icon Font 图标（如有）：列出检测到的 icon font 库 + 示例

**2. Illustrations**
- **⚠️ 不在插画区展示 Brand Logo** — Logo 属于品牌标识，不是插画
- **⚠️ 关键洞察**：很多现代 SaaS 产品不使用自定义插画，而是采用以下模式：
  - **放大图标模式**：将 Lucide/Heroicons 等图标放大到 48-64px，应用 50% 透明度（如 `text-muted-foreground/50`），作为空状态、引导页的视觉元素
  - 必须识别并记录这种模式，而不是简单报告"没有插画"
- 如果网站确实有自定义插画：
  - 插画风格描述（flat / isometric / hand-drawn / 3d 等）
  - 所有提取的插画 SVG 内联展示（实际渲染，非截图）
  - 如果是 img 引用的插画，展示 URL + 尺寸信息
- 如果网站使用放大图标作为插画：
  - 记录使用的图标名 + 放大尺寸 + 透明度值
  - 展示所有发现的空状态插图模式（如：No results = search-x 48px 50%）
  - 输出设计模式说明卡片（Design Pattern note），解释这一设计策略

---

#### Components Sections 内容规范

每个组件 section 必须包含：

**组件标题区**
```
## Button                                    [extracted] or [generated]
从目标网站提取的 N 个变体 / 基于 foundations 生成
```

**变体展示区**
- 所有变体并排展示（Flex wrap 布局）
- 每个变体是一个"展示卡片"，包含：
  - 组件的实际渲染（**使用提取的样式**，不是截图）
  - 变体名称标签

**状态展示区**
- 每种状态使用 `.state-demo` 容器（`flex-direction:column; align-items:center`），包含组件渲染 + 下方 `.state-label`（10px 大写灰色文字）
- 同一行内横向排列所有状态

**Button 组件必须包含的完整内容：**

1. **Variants**: Primary / Outline / Ghost / Glass / Destructive
2. **Sizes**: Small / Default
3. **Icon Buttons**: SM (32px) / MD (36px) / LG (40px) 三个尺寸 + Disabled 状态
4. **Button Group 组合按钮**:
   - 文字组合：如 `[All | Active | Archived]`，选中项用品牌色高亮
   - 图标组合：如 `[Grid | List]` 视图切换
   - CSS: `.btn-group` 容器，子元素 `border-radius:0`，首尾元素保留圆角，`margin-left:-1px` 合并边框
5. **States — Primary**: Default / Hover / Active / Focus / Disabled / Loading（每个有 state-label）
6. **States — Outline**: Default / Hover / Focus / Disabled / Loading
7. **States — Destructive**: Default / Hover / Disabled
8. **Loading 状态**: `btn-loading` class，`color:transparent` + `::after` 旋转 spinner

**Card 组件必须包含 hover 状态：**
- Default cards: 添加 CSS `transition: transform, box-shadow, border-color`
- Hover effect: `transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--color-brand-primary);`
- States 展示区: 并排展示 Default / Hover（静态模拟上浮+品牌色边框）/ Disabled（opacity:0.5）三种状态

**代码区**
- 显示该组件的 HTML 骨架代码
- 语法高亮（简单的 `<pre><code>` + CSS 着色即可）
- 右上角复制按钮

---

#### Brand Customizer Panel（右侧滑出面板）

**⚠️ 这是 preview.html 的核心交互功能之一。**

面板从右侧滑入，覆盖层 + panel 结构：

```html
<div class="customizer-overlay" onclick="toggleCustomizer()"></div>
<div class="customizer-panel">
  <!-- 1. Logo & Brand Name -->
  <!-- 2. Colors (Primary + Secondary + Accent) -->
  <!-- 3. Typography (Heading + Body font) -->
  <!-- 4. Icon Library -->
  <!-- 5. Neutral Tint -->
  <!-- 6. Live Preview -->
  <!-- 7. Export / Reset -->
</div>
```

**面板 CSS：**
```css
.customizer-panel {
  position:fixed; top:var(--topbar-h); right:0; z-index:100;
  width:360px; max-height:calc(100vh - var(--topbar-h));
  overflow-y:auto; overflow-x:hidden;  /* ⚠️ 必须 overflow-x:hidden 防止内容溢出 */
  transform:translateX(100%); transition:transform var(--duration-slow);
}
.customizer-panel.open { transform:translateX(0); }
```

**面板各区块 (cust-section) 规范：**

每个区块用 `cust-section` class 包裹，内有 `cust-label`（11px 大写标题）。

**1. Logo & Brand Name**
- Logo 上传：点击 logo 预览区触发文件选择器，支持 SVG / PNG / JPG
- SVG 上传后解析内联，PNG/JPG 使用 `URL.createObjectURL`
- Brand Name 文本输入，实时更新 topbar 标题

**2. Colors — Primary + Secondary + Accent**
- 三个独立颜色选择器（color input + hex text input），不互相联动
- Primary 颜色变化时：
  - 使用 HSL 算法生成完整调色板（50-900 共 10 级）
  - 设置 `--color-brand-primary` + `--color-brand-primary-rgb`
  - 更新 `--glow-color-dim` 和 `--glow-color-bright`（motion glow 动效跟随品牌色）
  - 更新页面中所有 `[data-brand-swatch]` 和 `[data-brand-svg]` 元素
- 调色板预览条：一行 10 个小色块展示 primary50 ~ primary900

**3. Typography — Heading + Body Font**
- **使用自定义下拉框（`.font-picker`），不用原生 `<select>`**
- 下拉框每个选项使用该字体自身渲染（`style="font-family:xxx"`），让用户预览字体样式
- 预置 ~14 个 Google Fonts 选项 + 系统字体默认值
- Google Fonts 预加载：页面初始化时动态创建 `<link>` 元素加载所有选项字体
- 选中字体后设置 `--font-heading` 或 `--font-body` CSS 变量
- **trigger 按钮需要 `event.stopPropagation()`** 防止 document click handler 立即关闭
- 下拉选项之间**不要分割线**，保持干净

**4. Icon Library 选择**
- **使用与字体选择器相同的自定义下拉框样式**（`.font-picker`）
- 内置 5 个图标库：Lucide (提取原始)、Heroicons、Phosphor Icons、Tabler Icons、Remix Icons
- 每个库存储约 30-50 个常用图标的内联 SVG 数据
- 选择后页面 Icons section 切换显示新图标库
- **面板内图标预览**：使用 `display:flex; flex-wrap:nowrap; overflow:hidden`，只显示一行，超出隐藏。不要让图标预览导致面板出现水平滚动条
- 预览图标去掉边框和名称，只显示图标本身（紧凑模式）

**5. Neutral Tint（中性色调）**
- 三个按钮：Warm / Neutral / Cool
- Warm：基于品牌色 hue 微调 surface 颜色（saturation 4-6%）
- Cool：使用品牌色互补色 hue
- Neutral：移除 inline style 恢复原始
- **⚠️ 必须感知 dark mode**：`applyNeutralTint()` 必须检查 `data-theme` 属性
  - Light mode：surface lightness 96-98%
  - Dark mode：surface lightness 8-16%
  - 否则会导致 dark mode 下出现白色 surface 的 bug

**6. Live Preview**
- 实时展示当前品牌设置的效果：按钮组 + 渐变条 + 头像 + 卡片预览

**7. Export / Reset**
- Export CSS：生成包含所有自定义 CSS 变量的代码块，复制到剪贴板
- Reset：恢复所有默认值，包括 `--glow-color-dim` / `--glow-color-bright`

---

#### 交互功能清单

1. **Light/Dark 切换**：`document.documentElement.setAttribute('data-theme', 'dark')`，影响所有 CSS 变量。切换后需要：
   - 重新应用 neutral tint（调用 `applyNeutralTint(currentTint)`）
   - 更新 semantic color hex 显示值（调用 `updateSemanticHexValues()`）
   - 更新 theme 按钮的 tooltip 文案（"Dark Mode" ↔ "Light Mode"）
2. **中/英切换**：遍历所有 `[data-i18n]` 元素，替换 textContent
3. **Sidebar scroll spy**：`IntersectionObserver` 监听每个 section 的可见性
4. **点击复制**：`navigator.clipboard.writeText()`，显示 toast 反馈
5. **动效重放**：移除再添加 animation class
6. **组件状态交互**：hover/focus 状态通过真实 CSS :hover/:focus 实现
7. **Token 跳转**：点击 token 引用 → `scrollIntoView` 到 Foundations 对应位置
8. **Brand Customizer**：实时替换品牌色/字体/图标/色调

---

#### 性能要求

- 全部内联 CSS + JS，单文件无依赖（Google Fonts link 除外）
- 首次加载无白屏：CSS 在 `<head>` 中，JS 在 `</body>` 前
- 大量色块/组件时使用 `content-visibility: auto` 懒渲染
- 文件体积控制在 500KB 以内（不含字体）— Brand Customizer + 图标库数据会增大体积

---

## Phase 3: ⚠️ 完整性验证（MANDATORY — 不允许跳过）

**这是解决"漏提取"的核心机制。**

生成所有文件后，必须执行以下验证循环：

### 步骤 3.1: 截图逐区扫描

逐张查看 `screenshots/sections/` 中的每张逐屏截图（section-00.png, section-01.png, ...）。

对每张截图，回答：
- 这个区域包含哪些可见的 UI 元素？
- 这些元素是否都已在 `components.md` 中被记录？
- 有没有截图中可见但文档中遗漏的组件？

### 步骤 3.2: 完整性清单对照

对照以下 Web App 常规组件清单，检查哪些**在截图/提取数据中存在但未被记录**：

```
□ Navbar / Header        □ Sidebar / Drawer       □ Footer
□ Hero / Banner          □ Card (所有变体)         □ Button (所有变体+状态)
□ Input / TextField      □ Textarea               □ Select / Dropdown
□ Checkbox / Radio       □ Switch / Toggle         □ Slider / Range
□ Badge / Tag / Chip     □ Avatar                  □ Icon (风格)
□ Toast / Notification   □ Alert / Banner          □ Progress / Loader
□ Skeleton              □ Tooltip / Popover       □ Modal / Dialog
□ Tabs                  □ Accordion / Collapse    □ Table
□ List / List Item      □ Breadcrumb             □ Pagination
□ Menu / Context Menu   □ Command Palette        □ Empty State
□ Divider               □ Form Layout            □ File Upload
□ Date Picker           □ Stat / Metric Card     □ Timeline
□ Button Group          □ Icon Button            □ Loading State
```

**⚠️ 以下组件在实践中最容易遗漏，必须主动排查：**

| 易遗漏组件 | 为什么容易遗漏 | 排查方法 |
|-----------|--------------|---------|
| **Dialog / Modal** | 需要点击触发，审计脚本无法自动发现内容 | 点击所有 `aria-haspopup="dialog"` 按钮 |
| **Dropdown Menu** | 同上 | 点击所有 `aria-haspopup="menu"` 按钮、用户头像、通知铃铛 |
| **Notification Bar** | 全局通知横幅/公告条，容易被当作"业务内容"忽略 | 检查页面顶部是否有 promo banner、countdown、announcement pill |
| **Empty State** | 只在空数据时出现 | 导航到列表页/搜索页，清空筛选条件或搜索无结果关键词 |
| **View Toggle** | Grid/List 视图切换器，UI 小但重要 | 检查列表页是否有视图切换按钮组 |
| **Filter Chips** | 横向滚动的筛选标签，容易被当作普通按钮 | 检查列表页顶部的分类筛选区域 |
| **Collapsible Section** | 折叠/展开区域，静态时看不出来 | 检查 sidebar 和 FAQ 区域的 chevron 按钮 |
| **Illustrations** | 很多产品用放大图标代替自定义插画 | 检查空状态、引导页、error 页面的大尺寸图标 |
| **Button Group** | 组合按钮常被当作独立按钮记录 | 检查 filter/view 切换器、分段控制器 |

### 步骤 3.3: 补全遗漏

如果发现遗漏：

1. **截图中存在但未记录** → 重新分析截图和 harvest-raw.json，补充到 components.md
2. **harvest-raw.json 中有数据但文档未涉及** → 补充到 design-system.md 和 components.md
3. **颜色/字体/间距有值但未纳入 tokens** → 补充到 foundations.json

### 步骤 3.4: 验证报告

输出验证报告给用户：

```
🌾 Site-to-DS — 完整性验证报告

✅ 已覆盖组件 (N 种):
   navbar, card, button (incl. group/icon/states), input, ...

⚠️ 截图中可见但数据有限 (N 种):
   tooltip (需要 hover 触发), modal (需要点击触发)

❌ 常规组件清单中未检测到 (N 种):
   date-picker, file-upload, timeline, ...

📊 Foundations 覆盖度:
   颜色: N 个原始色 → N 个语义 token（覆盖率 X%）
   字体: N 个 fontSize, N 个 fontFamily
   间距: N 个实际值 → 推导出 N 级 scale
   圆角: N 级
   阴影: N 级

🎨 图标 & 插画:
   SVG 图标: N 个（风格: outline/filled/duotone）
   Icon Font: 检测到 / 未检测到（库名）
   插画: N 个（SVG: N, img: N）
   图标尺寸体系: Npx / Npx / Npx
   颜色适配率: X%（使用 currentColor）
   已保存 SVG 文件: N 个（icons/ 目录）

🛠 Brand Customizer:
   可自定义项: 品牌色(3) / 字体(2) / 图标库(5) / 中性色调(3)
   Export CSS: ✅ 支持
```

---

## Phase 4: 组件生成（Optional，用户确认后执行）

基于已提取的 foundations + 已有组件样式，自动生成缺失组件。

### 触发条件

验证报告输出后，询问用户：

> "验证报告显示目标网站缺少以下组件：[list]。是否需要我基于已提取的 Style Foundations 自动生成这些组件？生成的组件将保持与目标网站一致的视觉风格。"

### 生成规则

1. **样式继承**：所有生成组件必须使用 `foundations.json` 中的 tokens
2. **风格推导**：观察已提取组件的设计模式（圆角大小、阴影用法、间距习惯），推导到新组件
3. **完整状态**：每个组件必须包含 default / hover / active / focus / disabled 状态
4. **HTML + CSS**：输出可用的 HTML 骨架 + CSS（使用 CSS 变量引用 foundations tokens）

### 输出文件

`generated-components.md` — 结构同 components.md，但标注 `(generated)` 表示非提取而是生成。

`generated-components.html` — 所有生成组件的可交互预览页，样式引用 foundations tokens。

### 组件生成清单

按以下分类生成（仅生成目标网站未覆盖的）：

**基础 (Primitives)**
- Button: primary / secondary / ghost / danger / icon-only / loading / **button group**
- Input: text / password / search / with-icon / with-addon / error state
- Select / Dropdown: single / multi / searchable
- Checkbox / Radio / Switch / Toggle
- Slider / Range
- Badge / Tag / Chip: color variants / dismissible / with-icon
- Avatar: image / initials / icon / sizes / group

**反馈 (Feedback)**
- Toast / Notification: success / error / warning / info / with-action
- Alert / Banner: inline / full-width
- Progress: bar / circular / skeleton
- Spinner / Loading: sizes
- Empty State: with-icon / with-action
- Tooltip / Popover

**导航 (Navigation)**
- Navbar / Header
- Sidebar / Drawer: expanded / collapsed
- Tabs: horizontal / vertical / with-icon
- Breadcrumb
- Pagination: numbered / simple
- Menu / Dropdown Menu
- Footer

**数据展示 (Data Display)**
- Card: basic / with-image / horizontal / stat — **所有卡片必须有 hover 状态**
- Table: basic / sortable / with-actions
- List / List Item: simple / with-icon / with-action
- Accordion / Collapse
- Stat / Metric Card
- Timeline
- Tree

**覆盖层 (Overlays)**
- Modal / Dialog: basic / confirmation / form
- Sheet / Bottom Sheet
- Command Palette

**表单 (Forms)**
- Form Layout: vertical / horizontal / inline
- File Upload: dropzone / button
- Date Picker
- Autocomplete / Combobox
- Form Validation States

**布局 (Layout)**
- Container / Section
- Divider: horizontal / vertical
- Grid / Flex helpers

---

## 注意事项

- CSS-in-JS 网站：computed-tokens.json 可以捕获实际样式，不依赖 styleSheets
- 颜色不完整时：基于 computed-tokens 的 frequency 排名和截图推断，标注 `"inferred": true`
- **动态组件必须主动触发**：不要只检测 `aria-haspopup` 就跳过 — 必须实际点击每个触发器，截图并提取弹出内容的样式。Modal、Dropdown Menu、Notification Panel 是最常被遗漏的组件
- **空状态必须主动寻找**：导航到列表页（apps、templates 等），观察是否有空状态显示。空状态的图标 + 标题 + 描述 + CTA 按钮是一个完整的组件模式
- **全局通知横幅不要遗漏**：页面顶部的 promo banner、countdown timer、announcement pill 是独立组件，不是"页面内容"
- **插画策略要识别**：如果网站使用放大 Lucide/Heroicons 图标 + 降低透明度作为空状态插图，这本身就是一个值得记录的设计模式（Design Pattern），不要简单报告"没有自定义插画"
- **插画区不要放 Brand Logo** — Logo 属于品牌标识，不属于插画范畴
- 子页面组件：多页爬取的结果会合并到 harvest-raw.json 的 subpageData 中
- 不输出分析过程，直接输出文件内容
- 每个文件生成后立即写入磁盘，不要攒到最后一起写
- **preview.html 侧边栏分组标题**：使用 placeholder 淡灰色（不是 muted），分组间只用间距（32px），不用分割线
- **Brand Customizer 面板 overflow-x:hidden** 是强制规则，防止图标预览等内容导致水平滚动
- **Custom dropdown（font-picker）的 trigger 必须 event.stopPropagation()**，否则 document click handler 会立即关闭下拉框

---

## 文件存储位置

所有输出文件存储在 `site-to-ds-output/` 目录：

```
site-to-ds-output/
├── harvest-raw.json            ← Phase 1 自动提取原始数据
├── computed-tokens.json        ← Phase 1 computed styles
├── site.css                    ← Phase 1 CSS 变量 + 规则
├── foundations.json            ← Phase 2 Style Foundations
├── palette.md                  ← Phase 2 颜色文档
├── design-system.md            ← Phase 2 设计规范
├── components.md               ← Phase 2 组件文档
├── preview.html                ← Phase 2 交互式预览（含 Brand Customizer）
├── generated-components.md     ← Phase 4 生成的组件文档
├── generated-components.html   ← Phase 4 生成的组件预览
├── icons/                      ← Phase 1 提取的 SVG 图标和插画文件
│   ├── icon-00.svg
│   ├── icon-01.svg
│   ├── illustration-00.svg
│   └── ...
└── screenshots/                ← Phase 1 截图
```

后续使用时说 "参考 site-to-ds-output/ 的设计风格"，即可作为设计上下文。
