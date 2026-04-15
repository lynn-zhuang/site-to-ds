# site-to-ds

**[English](./README.md)** | **[中文](./README_zh.md)**

---

**Website → Design System.** Extract, preview, and customize any website's design system using [Claude Code](https://claude.ai/claude-code).

A Claude Code skill that deep-extracts a complete UI design system from any target website — design tokens, components, interactions — and generates an interactive preview with a built-in Brand Customizer for real-time theming.

## What it does

1. **Extracts** — Connects to a live website (via Chrome DevTools MCP, Playwright, or manual mode), scans every element's computed styles, captures screenshots, and collects SVG icons
2. **Generates** — Produces a complete design system: `foundations.json` (tokens), `design-system.md` (spec), `components.md` (structure), and an interactive `preview.html`
3. **Customizes** — Built-in Brand Customizer panel lets you swap brand colors, fonts, icon libraries, and neutral tints in real-time
4. **Validates** — Mandatory completeness check compares extracted data against screenshots to catch missed components
5. **Extends** — Auto-generates missing components (buttons, cards, modals, etc.) based on extracted style foundations

## Output

```
site-to-ds-output/
├── foundations.json          # Design tokens (color, type, spacing, motion, etc.)
├── palette.md                # Color documentation
├── design-system.md          # Full design specification
├── components.md             # Component structure & variants
├── preview.html              # Interactive preview + Brand Customizer
├── icons/                    # Extracted SVG icons
└── screenshots/              # Full-page, section, and component screenshots
```

### preview.html highlights

- Three-column layout: sidebar navigation + main content + Brand Customizer panel
- **Brand Customizer**: swap colors (primary/secondary/accent), fonts (14 Google Fonts preloaded), icon libraries (Lucide/Heroicons/Phosphor/Tabler/Remix), neutral tint (warm/cool)
- Light/Dark mode toggle with full theme awareness
- EN/CN language switcher
- Click-to-copy on all color values, gradients, and code blocks
- Scroll spy navigation
- Component state demos (Default/Hover/Active/Focus/Disabled/Loading)
- Export customized theme as CSS variables

## Installation

### Quick install

```bash
git clone https://github.com/lynn-zhuang/site-to-ds.git
cd site-to-ds
./install.sh
```

### Manual install

```bash
git clone https://github.com/lynn-zhuang/site-to-ds.git ~/.claude/skills/site-to-ds
```

## Usage

Open Claude Code and say any of:

- "Extract the design system from https://example.com"
- "I want to reference the style of https://app.example.com"
- "Analyze the UI components of this website"
- "Harvest this site's design"

### Connection modes

| Mode | Best for | Setup |
|------|----------|-------|
| Chrome DevTools MCP | Authenticated pages (already logged in) | Configure MCP server in Claude Code |
| Playwright | Public pages, automated | `node scripts/setup.js` first |
| Manual | Fallback | Paste audit script in browser DevTools |

### After extraction

- Open `site-to-ds-output/preview.html` in a browser
- Click **Customize** in the top bar to open the Brand Customizer
- Tweak colors, fonts, icons to match your brand
- Click **Export CSS** to get your customized design tokens

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI or IDE extension
- Node.js 16+ (for Playwright mode)
- Chrome DevTools MCP server (optional, for best results)

## License

MIT
