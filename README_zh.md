# site-to-ds

**[English](./README.md)** | **[中文](./README_zh.md)**

---

**网站 → 设计系统。** 使用 [Claude Code](https://claude.ai/claude-code) 提取、预览并自定义任何网站的设计系统。

一个 Claude Code 技能（Skill），能从任意目标网站深度提取完整的 UI 设计系统 —— 设计令牌（Design Tokens）、组件结构、交互行为 —— 并生成可交互的预览页面，内置 Brand Customizer 面板支持实时主题定制。

## 功能概览

1. **提取** — 连接目标网站（通过 Chrome DevTools MCP、Playwright 或手动模式），扫描所有元素的 computed styles，截图，收集 SVG 图标
2. **生成** — 输出完整设计系统：`foundations.json`（令牌）、`design-system.md`（规范）、`components.md`（组件结构）、`preview.html`（交互预览）
3. **自定义** — 内置 Brand Customizer 面板，实时替换品牌色、字体、图标库和中性色调
4. **验证** — 强制完整性检查，对照截图逐区验证，确保不遗漏组件
5. **扩展** — 基于已提取的 Style Foundations 自动生成缺失组件（按钮、卡片、弹窗等）

## 输出文件

```
site-to-ds-output/
├── foundations.json          # 设计令牌（颜色、字体、间距、动效等）
├── palette.md                # 颜色文档
├── design-system.md          # 完整设计规范
├── components.md             # 组件结构与变体
├── preview.html              # 交互式预览 + Brand Customizer
├── icons/                    # 提取的 SVG 图标
└── screenshots/              # 全页、逐屏、逐组件截图
```

### preview.html 亮点

- 三栏布局：侧边导航 + 主内容区 + Brand Customizer 面板
- **Brand Customizer**：替换颜色（主色/辅色/强调色）、字体（预载 14 款 Google Fonts）、图标库（Lucide/Heroicons/Phosphor/Tabler/Remix）、中性色调（暖色/冷色）
- Light/Dark 模式切换，完整主题感知
- 中/英文界面切换
- 点击复制所有颜色值、渐变和代码块
- 滚动监听导航高亮
- 组件状态演示（Default / Hover / Active / Focus / Disabled / Loading）
- 导出自定义主题为 CSS 变量

## 安装

### 快速安装

```bash
git clone https://github.com/lynn-zhuang/site-to-ds.git
cd site-to-ds
./install.sh
```

### 手动安装

```bash
git clone https://github.com/lynn-zhuang/site-to-ds.git ~/.claude/skills/site-to-ds
```

## 使用方法

打开 Claude Code，输入以下任意指令：

- "提取这个网站的设计系统 https://example.com"
- "我想参考 https://app.example.com 的风格"
- "帮我分析这个网站的 UI 组件"
- "复刻这个网站的设计"
- "Extract the design system from https://example.com"

### 连接方式

| 方式 | 适用场景 | 设置 |
|------|---------|------|
| Chrome DevTools MCP | 需要登录的页面（最佳） | 在 Claude Code 中配置 MCP 服务器 |
| Playwright | 公开页面，全自动 | 先运行 `node scripts/setup.js` |
| 手动模式 | 兜底方案 | 在浏览器 DevTools 中粘贴审计脚本 |

### 提取完成后

- 在浏览器中打开 `site-to-ds-output/preview.html`
- 点击顶栏的 **Customize** 按钮打开 Brand Customizer 面板
- 调整颜色、字体、图标以匹配你的品牌
- 点击 **Export CSS** 导出自定义的设计令牌

## 系统要求

- [Claude Code](https://claude.ai/claude-code) CLI 或 IDE 扩展
- Node.js 16+（Playwright 模式需要）
- Chrome DevTools MCP 服务器（可选，效果最佳）

## 许可证

MIT
