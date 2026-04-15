/**
 * Site-to-DS — Deep Extraction Script
 *
 * vs design-extractor improvements:
 * 1. DOM-walk component discovery (not class-name guessing)
 * 2. Computed style extraction (works with CSS-in-JS, Tailwind)
 * 3. Collects ALL variants of each component type
 * 4. Multi-page crawling support
 * 5. Interactive component triggering (modals, dropdowns, tooltips)
 * 6. Viewport-section scanning with per-section screenshots
 *
 * Usage: node harvest.js <URL> [output-dir] [--pages=3] [--auth="cookie_string"]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── CLI Args ────────────────────────────────────────────
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('-') && !a.startsWith('.')) || args[0];
const outputDir = args.find(a => a.startsWith('.') || a.startsWith('/')) || './site-to-ds-output';
const maxPages = parseInt((args.find(a => a.startsWith('--pages=')) || '').split('=')[1]) || 1;
const authCookie = (args.find(a => a.startsWith('--auth=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '');

if (!url || url.startsWith('-')) {
  console.error('Usage: node harvest.js <URL> [output-dir] [--pages=3] [--auth="cookie"]');
  process.exit(1);
}

// ── Component Discovery Config ──────────────────────────
// Structural detection: identify components by DOM structure, not class names
const COMPONENT_SIGNATURES = {
  navbar: {
    structural: ['header nav', 'nav[role="navigation"]', 'header', '[role="banner"]'],
    heuristic: (el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < 100 && rect.width > window.innerWidth * 0.8 && rect.height < 120;
    }
  },
  sidebar: {
    structural: ['aside', 'nav[aria-label*="side"]', '[role="complementary"]'],
    heuristic: (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.height > window.innerHeight * 0.5 && rect.width < 350 && rect.left < 50;
    }
  },
  card: {
    structural: ['[class*="card"]', '[class*="tile"]', 'article'],
    heuristic: (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 150 && rect.width < 800 && rect.height > 100 && rect.height < 800 &&
        (style.borderRadius !== '0px' || style.boxShadow !== 'none' || style.border !== '')
      );
    }
  },
  button: {
    structural: ['button', '[role="button"]', 'a[class*="btn"]', 'a[class*="button"]', 'input[type="submit"]'],
    heuristic: (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        rect.height >= 28 && rect.height <= 64 && rect.width >= 60 && rect.width <= 400 &&
        (style.cursor === 'pointer') &&
        (style.borderRadius !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)')
      );
    }
  },
  input: {
    structural: ['input:not([type="hidden"])', 'textarea', 'select', '[role="textbox"]', '[role="combobox"]', '[contenteditable="true"]'],
    heuristic: null
  },
  modal: {
    structural: ['[role="dialog"]', '[class*="modal"]', '[class*="dialog"]', 'dialog'],
    heuristic: null
  },
  dropdown: {
    structural: ['[class*="dropdown"]', '[class*="popover"]', '[class*="menu"]', '[role="menu"]', '[role="listbox"]'],
    heuristic: null
  },
  tabs: {
    structural: ['[role="tablist"]', '[class*="tab"]'],
    heuristic: (el) => {
      const children = el.children;
      return children.length >= 2 && children.length <= 12 &&
        [...children].every(c => c.getBoundingClientRect().height === children[0].getBoundingClientRect().height);
    }
  },
  table: {
    structural: ['table', '[role="grid"]', '[role="table"]', '[class*="table"]', '[class*="datagrid"]'],
    heuristic: null
  },
  accordion: {
    structural: ['details', '[class*="accordion"]', '[class*="collapsible"]', '[class*="expand"]'],
    heuristic: null
  },
  badge: {
    structural: ['[class*="badge"]', '[class*="tag"]', '[class*="chip"]', '[class*="label"]'],
    heuristic: (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.height >= 16 && rect.height <= 32 && rect.width >= 20 && rect.width <= 200 &&
        style.borderRadius !== '0px' && (style.backgroundColor !== 'rgba(0, 0, 0, 0)');
    }
  },
  toast: {
    structural: ['[class*="toast"]', '[class*="notification"]', '[class*="snackbar"]', '[role="alert"]', '[role="status"]'],
    heuristic: null
  },
  avatar: {
    structural: ['[class*="avatar"]', 'img[class*="profile"]'],
    heuristic: (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return Math.abs(rect.width - rect.height) < 4 && rect.width >= 24 && rect.width <= 80 &&
        style.borderRadius.includes('50%') || style.borderRadius === '9999px';
    }
  },
  hero: {
    structural: ['[class*="hero"]', '[class*="banner"]', '[class*="jumbotron"]'],
    heuristic: (el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < 200 && rect.height > 300 && rect.width > window.innerWidth * 0.8;
    }
  },
  footer: {
    structural: ['footer', '[role="contentinfo"]', '[class*="footer"]'],
    heuristic: null
  },
  breadcrumb: {
    structural: ['[class*="breadcrumb"]', 'nav[aria-label*="breadcrumb"]', '[role="navigation"][aria-label*="breadcrumb"]'],
    heuristic: null
  },
  pagination: {
    structural: ['[class*="pagination"]', 'nav[aria-label*="page"]', '[role="navigation"][aria-label*="page"]'],
    heuristic: null
  },
  tooltip: {
    structural: ['[class*="tooltip"]', '[role="tooltip"]'],
    heuristic: null
  },
  progress: {
    structural: ['progress', '[role="progressbar"]', '[class*="progress"]', '[class*="loader"]', '[class*="spinner"]', '[class*="skeleton"]'],
    heuristic: null
  },
  toggle: {
    structural: ['[class*="switch"]', '[class*="toggle"]', '[role="switch"]', 'input[type="checkbox"][class*="switch"]'],
    heuristic: null
  },
  divider: {
    structural: ['hr', '[class*="divider"]', '[class*="separator"]', '[role="separator"]'],
    heuristic: null
  },
  list: {
    structural: ['[class*="list-item"]', '[role="listitem"]', 'ul[class]:not(nav ul)', 'ol[class]'],
    heuristic: null
  },
  form: {
    structural: ['form', '[class*="form"]'],
    heuristic: null
  },
  empty_state: {
    structural: ['[class*="empty"]', '[class*="no-data"]', '[class*="placeholder"]', '[class*="zero-state"]'],
    heuristic: null
  }
};


async function harvest() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'screenshots', 'sections'), { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'screenshots', 'components'), { recursive: true });

  console.log(`\n🌾 Site-to-DS — Deep Extraction`);
  console.log(`   Target: ${url}`);
  console.log(`   Pages:  ${maxPages}`);
  console.log(`   Output: ${outputDir}\n`);

  const browser = await chromium.launch({ headless: true });
  const contextOpts = { viewport: { width: 1440, height: 900 } };

  // Auth cookie injection
  if (authCookie) {
    const urlObj = new URL(url);
    const cookies = authCookie.split(';').map(c => {
      const [name, ...val] = c.trim().split('=');
      return { name: name.trim(), value: val.join('=').trim(), domain: urlObj.hostname, path: '/' };
    }).filter(c => c.name && c.value);
    contextOpts.storageState = { cookies, origins: [] };
  }

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: Page Load & Visual Capture
  // ═══════════════════════════════════════════════════════════
  console.log('📄 Phase 1: Loading page...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);

  // Full page screenshot
  await page.screenshot({ path: path.join(outputDir, 'screenshots', '00-fullpage.png'), fullPage: true });

  // Viewport-section scanning: scroll through entire page in viewport-sized chunks
  console.log('📸 Phase 1: Section-by-section screenshots...');
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportH = 900;
  const sections = Math.ceil(totalHeight / viewportH);

  for (let i = 0; i < Math.min(sections, 15); i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * viewportH);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(outputDir, 'screenshots', 'sections', `section-${String(i).padStart(2, '0')}.png`),
      fullPage: false
    });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: Deep CSS Extraction (computed styles, not just styleSheets)
  // ═══════════════════════════════════════════════════════════
  console.log('🎨 Phase 2: Deep CSS extraction...');

  // 2a. CSS Variables (from :root + all custom properties)
  const cssVars = await page.evaluate(() => {
    const vars = {};
    const root = getComputedStyle(document.documentElement);

    // Method 1: from styleSheets
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          (r.cssText.match(/--[\w-]+/g) || []).forEach(v => {
            vars[v] = root.getPropertyValue(v).trim();
          });
        });
      } catch {}
    });

    // Method 2: from inline styles on root/body
    ['', 'body'].forEach(sel => {
      const el = sel ? document.querySelector(sel) : document.documentElement;
      if (!el) return;
      const style = el.getAttribute('style') || '';
      (style.match(/--[\w-]+/g) || []).forEach(v => {
        vars[v] = root.getPropertyValue(v).trim();
      });
    });

    return vars;
  });

  // 2b. Computed styles from ACTUAL elements (catches CSS-in-JS, Tailwind)
  const computedTokens = await page.evaluate(() => {
    const colors = new Map();
    const fontSizes = new Map();
    const fontFamilies = new Map();
    const fontWeights = new Map();
    const lineHeights = new Map();
    const radii = new Map();
    const shadows = new Map();
    const borders = new Map();
    const spacings = new Map(); // paddings & margins
    const transitions = new Set();
    const backgrounds = new Map();
    const opacities = new Map();

    const elements = document.querySelectorAll('*');
    const seen = new Set();

    elements.forEach(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      // Colors
      [style.color, style.backgroundColor, style.borderColor].forEach(c => {
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
          colors.set(c, (colors.get(c) || 0) + 1);
        }
      });

      // Typography
      if (el.textContent?.trim() && !seen.has(style.fontSize + style.fontFamily)) {
        seen.add(style.fontSize + style.fontFamily);
        fontSizes.set(style.fontSize, (fontSizes.get(style.fontSize) || 0) + 1);
        fontFamilies.set(style.fontFamily.split(',')[0].trim().replace(/['"]/g, ''), (fontFamilies.get(style.fontFamily.split(',')[0].trim().replace(/['"]/g, '')) || 0) + 1);
        fontWeights.set(style.fontWeight, (fontWeights.get(style.fontWeight) || 0) + 1);
        lineHeights.set(style.lineHeight, (lineHeights.get(style.lineHeight) || 0) + 1);
      }

      // Radius
      if (style.borderRadius !== '0px') {
        radii.set(style.borderRadius, (radii.get(style.borderRadius) || 0) + 1);
      }

      // Shadows
      if (style.boxShadow !== 'none') {
        shadows.set(style.boxShadow, (shadows.get(style.boxShadow) || 0) + 1);
      }

      // Borders
      if (style.borderWidth !== '0px' && style.borderStyle !== 'none') {
        const b = `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`;
        borders.set(b, (borders.get(b) || 0) + 1);
      }

      // Spacing (paddings, margins, gaps)
      [style.padding, style.margin, style.gap].forEach(s => {
        if (s && s !== '0px') {
          s.split(' ').forEach(v => {
            if (v && v !== '0px') spacings.set(v, (spacings.get(v) || 0) + 1);
          });
        }
      });

      // Transitions
      if (style.transition && style.transition !== 'all 0s ease 0s') {
        transitions.add(style.transition);
      }

      // Backgrounds
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        const type = style.backgroundImage.startsWith('linear-gradient') ? 'linear-gradient'
          : style.backgroundImage.startsWith('radial-gradient') ? 'radial-gradient'
          : 'other';
        backgrounds.set(style.backgroundImage.slice(0, 200), type);
      }

      // Opacity
      if (style.opacity !== '1') {
        opacities.set(style.opacity, (opacities.get(style.opacity) || 0) + 1);
      }
    });

    const mapToSorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([val, count]) => ({ value: val, count }));

    // Glass / Backdrop-blur effects
    const glassEffects = [];
    elements.forEach(el => {
      const style = getComputedStyle(el);
      const bf = style.backdropFilter || style.webkitBackdropFilter;
      if (bf && bf !== 'none') {
        glassEffects.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 200),
          backdropFilter: bf,
          background: style.backgroundColor,
          border: style.border,
          borderRadius: style.borderRadius,
        });
      }
    });

    // Gradients
    const gradients = [];
    elements.forEach(el => {
      const style = getComputedStyle(el);
      const bg = style.backgroundImage;
      if (bg && bg !== 'none' && /gradient/i.test(bg)) {
        gradients.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 200),
          backgroundImage: bg,
        });
      }
    });

    return {
      colors: mapToSorted(colors).slice(0, 60),
      fontSizes: mapToSorted(fontSizes),
      fontFamilies: mapToSorted(fontFamilies),
      fontWeights: mapToSorted(fontWeights),
      lineHeights: mapToSorted(lineHeights).slice(0, 20),
      radii: mapToSorted(radii),
      shadows: mapToSorted(shadows).slice(0, 15),
      borders: mapToSorted(borders).slice(0, 15),
      spacings: mapToSorted(spacings).slice(0, 30),
      transitions: [...transitions].slice(0, 30),
      backgrounds: [...backgrounds.entries()].slice(0, 10).map(([val, type]) => ({ value: val, type })),
      opacities: mapToSorted(opacities),
      glassEffects: glassEffects.slice(0, 10),
      gradients: gradients.slice(0, 15),
    };
  });

  // 2c. CSS rules & keyframes (existing approach, for completeness)
  const cssRules = await page.evaluate(() => {
    return [...document.styleSheets]
      .flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
      .map(r => r.cssText)
      .filter(text =>
        text.includes('--') ||
        /color|font|spacing|radius|shadow|transition|animation|@keyframes|transform|opacity|backdrop|gradient/i.test(text)
      )
      .join('\n');
  });

  const keyframes = await page.evaluate(() => {
    return [...document.styleSheets]
      .flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
      .filter(r => r.type === CSSRule.KEYFRAMES_RULE || r.cssText?.startsWith('@keyframes'))
      .map(r => r.cssText)
      .join('\n\n');
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: Component Discovery (DOM-walk, not class-name guessing)
  // ═══════════════════════════════════════════════════════════
  console.log('🧩 Phase 3: Component discovery...');

  const components = await page.evaluate((signaturesJSON) => {
    const signatures = JSON.parse(signaturesJSON);
    const result = {};

    Object.entries(signatures).forEach(([type, config]) => {
      const found = [];
      const seenHTML = new Set();

      // Method 1: Structural selectors
      if (config.structural) {
        config.structural.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) return;

              const clone = el.cloneNode(true);
              clone.querySelectorAll('img').forEach(img => { img.removeAttribute('src'); img.removeAttribute('srcset'); });
              clone.querySelectorAll('script, style, svg').forEach(e => e.remove());
              const html = clone.outerHTML.slice(0, 5000);

              // Dedup by structure similarity
              const sigKey = el.tagName + el.children.length + el.className?.slice(0, 30);
              if (seenHTML.has(sigKey)) return;
              seenHTML.add(sigKey);

              const style = getComputedStyle(el);
              found.push({
                selector: sel,
                tag: el.tagName.toLowerCase(),
                className: (el.className || '').toString().slice(0, 200),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                computedStyle: {
                  backgroundColor: style.backgroundColor,
                  color: style.color,
                  borderRadius: style.borderRadius,
                  padding: style.padding,
                  boxShadow: style.boxShadow !== 'none' ? style.boxShadow : undefined,
                  border: style.border,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  position: style.position,
                  display: style.display,
                  gap: style.gap,
                },
                html,
                childCount: el.children.length,
                textPreview: el.textContent?.trim().slice(0, 100),
              });
            });
          } catch {}
        });
      }

      if (found.length > 0) {
        result[type] = { count: found.length, variants: found.slice(0, 8) };
      }
    });

    // Bonus: Sticky/fixed elements
    const stickyElements = [];
    document.querySelectorAll('*').forEach(el => {
      const pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 20) {
          stickyElements.push({
            tag: el.tagName.toLowerCase(),
            position: pos,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            className: (el.className || '').toString().slice(0, 100),
          });
        }
      }
    });
    result._stickyElements = stickyElements;

    return result;
  }, JSON.stringify(
    Object.fromEntries(
      Object.entries(COMPONENT_SIGNATURES).map(([k, v]) => [k, { structural: v.structural }])
    )
  ));

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: Component Screenshots
  // ═══════════════════════════════════════════════════════════
  console.log('📸 Phase 4: Component screenshots...');

  for (const [type, data] of Object.entries(components)) {
    if (type.startsWith('_') || !data.variants) continue;
    for (let i = 0; i < Math.min(data.variants.length, 3); i++) {
      const v = data.variants[i];
      try {
        const el = await page.$(v.selector);
        if (el && await el.isVisible()) {
          await el.screenshot({
            path: path.join(outputDir, 'screenshots', 'components', `${type}-${i}.png`),
          });
        }
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 4b: Icon & Illustration Extraction
  // ═══════════════════════════════════════════════════════════
  console.log('🎨 Phase 4b: Icon & illustration extraction...');
  fs.mkdirSync(path.join(outputDir, 'icons'), { recursive: true });

  const iconData = await page.evaluate(() => {
    const icons = [];
    const illustrations = [];
    const iconFonts = [];
    const seenSVG = new Set();

    // ── 1. Inline SVG icons ────────────────────────────────
    document.querySelectorAll('svg').forEach(svg => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const svgHTML = svg.outerHTML;
      // Deduplicate by content hash (first 200 chars)
      const sigKey = svgHTML.slice(0, 200);
      if (seenSVG.has(sigKey)) return;
      seenSVG.add(sigKey);

      const size = Math.max(rect.width, rect.height);
      const style = getComputedStyle(svg);
      const parentStyle = svg.parentElement ? getComputedStyle(svg.parentElement) : null;

      const item = {
        type: size <= 48 ? 'icon' : (size <= 200 ? 'icon-large' : 'illustration'),
        source: 'inline-svg',
        viewBox: svg.getAttribute('viewBox') || '',
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        className: (svg.className?.baseVal || svg.className || '').toString().slice(0, 200),
        parentClassName: (svg.parentElement?.className || '').toString().slice(0, 100),
        fill: svg.getAttribute('fill') || style.fill || '',
        stroke: svg.getAttribute('stroke') || style.stroke || '',
        color: style.color,
        usesCurrentColor: svgHTML.includes('currentColor'),
        childCount: svg.children.length,
        // Detect style: outline (stroke-based), filled (fill-based), duotone (both)
        svgStyle: (() => {
          const hasStroke = svgHTML.includes('stroke') && !svgHTML.includes('stroke="none"');
          const hasFill = svgHTML.includes('fill') && !svgHTML.includes('fill="none"') && !svgHTML.includes('fill="currentColor"');
          if (hasStroke && hasFill) return 'duotone';
          if (hasStroke) return 'outline';
          return 'filled';
        })(),
        svg: svgHTML.length <= 8000 ? svgHTML : svgHTML.slice(0, 8000) + '<!-- truncated -->',
      };

      if (item.type === 'illustration') {
        illustrations.push(item);
      } else {
        icons.push(item);
      }
    });

    // ── 2. Icon fonts (Font Awesome, Material Icons, etc.) ──
    const iconFontSelectors = [
      { pattern: /^fa[srlbtd]?\s|^fa-/, library: 'Font Awesome' },
      { pattern: /^material-icons|^mdi-|^mdi\s/, library: 'Material Icons' },
      { pattern: /^icon-|^ico-/, library: 'custom-icon-font' },
      { pattern: /^bi\s|^bi-/, library: 'Bootstrap Icons' },
      { pattern: /^ri-/, library: 'Remix Icon' },
      { pattern: /^pi\s|^pi-/, library: 'PrimeIcons' },
      { pattern: /^lucide-/, library: 'Lucide' },
      { pattern: /^tabler-/, library: 'Tabler Icons' },
    ];

    document.querySelectorAll('i, span, em').forEach(el => {
      const cls = (el.className || '').toString();
      if (!cls) return;

      for (const { pattern, library } of iconFontSelectors) {
        if (pattern.test(cls)) {
          const style = getComputedStyle(el);
          // Check if element uses a special font or has ::before content
          const beforeContent = getComputedStyle(el, '::before').content;
          if (beforeContent && beforeContent !== 'none' && beforeContent !== 'normal') {
            iconFonts.push({
              className: cls.slice(0, 200),
              library,
              fontSize: style.fontSize,
              color: style.color,
              content: beforeContent.slice(0, 20),
            });
          }
          break;
        }
      }
    });

    // Also detect icon font via @font-face with common icon font names
    const detectedIconFontFamilies = [];
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          if (r.type === CSSRule.FONT_FACE_RULE) {
            const family = r.style.getPropertyValue('font-family').replace(/['"]/g, '').trim().toLowerCase();
            if (/icon|symbol|glyph|fa-|material|lucide|tabler|remix|phosphor|feather/.test(family)) {
              detectedIconFontFamilies.push(family);
            }
          }
        });
      } catch {}
    });

    // ── 3. Image-based icons and illustrations ──────────────
    const imgIcons = [];
    const imgIllustrations = [];

    document.querySelectorAll('img').forEach(img => {
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const src = img.src || img.getAttribute('data-src') || '';
      if (!src) return;

      // Skip photos (usually JPEG, large, and not square-ish)
      const isSVG = src.includes('.svg');
      const isPNG = src.includes('.png');
      const isIcon = (rect.width <= 48 && rect.height <= 48) || isSVG;
      const isIllustration = (rect.width > 48 || rect.height > 48) && (isSVG || isPNG);

      if (isIcon && (isSVG || isPNG)) {
        imgIcons.push({
          src: src.slice(0, 500),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          alt: img.alt || '',
          className: (img.className || '').toString().slice(0, 200),
          format: isSVG ? 'svg' : 'png',
        });
      } else if (isIllustration && (isSVG || isPNG) && rect.width < 800) {
        imgIllustrations.push({
          src: src.slice(0, 500),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          alt: img.alt || '',
          className: (img.className || '').toString().slice(0, 200),
          format: isSVG ? 'svg' : 'png',
        });
      }
    });

    // ── 4. CSS background icons ─────────────────────────────
    const bgIcons = [];
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      const bgImg = style.backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.includes('.svg')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.width <= 64 && rect.height > 0 && rect.height <= 64) {
          const urlMatch = bgImg.match(/url\(["']?(.+?)["']?\)/);
          bgIcons.push({
            src: urlMatch ? urlMatch[1].slice(0, 500) : '',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            className: (el.className || '').toString().slice(0, 200),
          });
        }
      }
    });

    // ── 5. Analyze icon system ──────────────────────────────
    const allIconSizes = icons.map(i => Math.max(i.width, i.height));
    const sizeDistribution = {};
    allIconSizes.forEach(s => { sizeDistribution[s] = (sizeDistribution[s] || 0) + 1; });
    const commonSizes = Object.entries(sizeDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const styleDistribution = {};
    icons.forEach(i => { styleDistribution[i.svgStyle] = (styleDistribution[i.svgStyle] || 0) + 1; });
    const dominantStyle = Object.entries(styleDistribution).sort((a, b) => b[1] - a[1])[0];

    return {
      inlineSvgIcons: icons.slice(0, 50),
      inlineSvgIllustrations: illustrations.slice(0, 20),
      iconFonts: [...new Map(iconFonts.map(i => [i.className, i])).values()].slice(0, 50),
      detectedIconFontFamilies: [...new Set(detectedIconFontFamilies)],
      imgIcons: imgIcons.slice(0, 30),
      imgIllustrations: imgIllustrations.slice(0, 20),
      bgIcons: bgIcons.slice(0, 20),
      analysis: {
        totalInlineSvg: icons.length + illustrations.length,
        totalIconFonts: iconFonts.length,
        totalImgIcons: imgIcons.length,
        totalImgIllustrations: imgIllustrations.length,
        commonSizes: commonSizes.map(([size, count]) => ({ size: parseInt(size), count })),
        dominantStyle: dominantStyle ? { style: dominantStyle[0], count: dominantStyle[1] } : null,
        usesCurrentColor: icons.filter(i => i.usesCurrentColor).length,
        colorAdaptable: icons.length > 0 ? Math.round(icons.filter(i => i.usesCurrentColor).length / icons.length * 100) + '%' : '0%',
      },
    };
  });

  // Save individual SVG icon files (top 30 unique icons)
  const savedIcons = [];
  for (let i = 0; i < Math.min(iconData.inlineSvgIcons.length, 30); i++) {
    const icon = iconData.inlineSvgIcons[i];
    if (icon.svg && !icon.svg.includes('<!-- truncated -->')) {
      const filename = `icon-${String(i).padStart(2, '0')}.svg`;
      fs.writeFileSync(path.join(outputDir, 'icons', filename), icon.svg, 'utf-8');
      savedIcons.push(filename);
    }
  }

  // Save illustrations
  for (let i = 0; i < Math.min(iconData.inlineSvgIllustrations.length, 10); i++) {
    const illust = iconData.inlineSvgIllustrations[i];
    if (illust.svg && !illust.svg.includes('<!-- truncated -->')) {
      const filename = `illustration-${String(i).padStart(2, '0')}.svg`;
      fs.writeFileSync(path.join(outputDir, 'icons', filename), illust.svg, 'utf-8');
    }
  }

  console.log(`   SVG Icons: ${iconData.analysis.totalInlineSvg} found, ${savedIcons.length} saved`);
  console.log(`   Icon Fonts: ${iconData.analysis.totalIconFonts} (${iconData.detectedIconFontFamilies.join(', ') || 'none'})`);
  console.log(`   Img Icons: ${iconData.analysis.totalImgIcons}, Img Illustrations: ${iconData.analysis.totalImgIllustrations}`);
  if (iconData.analysis.dominantStyle) {
    console.log(`   Dominant Style: ${iconData.analysis.dominantStyle.style} (${iconData.analysis.dominantStyle.count} icons)`);
  }
  console.log(`   Color Adaptable (currentColor): ${iconData.analysis.colorAdaptable}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 5: Interactive States (hover, focus)
  // ═══════════════════════════════════════════════════════════
  console.log('🖱️  Phase 5: Interactive states...');

  const interactiveStates = await page.evaluate(() => {
    const results = [];
    const interactiveEls = document.querySelectorAll('button, a, [role="button"], input, select, textarea, [tabindex]');

    interactiveEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (results.length >= 30) return;

      const style = getComputedStyle(el);
      results.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        role: el.getAttribute('role'),
        text: el.textContent?.trim().slice(0, 50),
        defaultStyle: {
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          transform: style.transform,
          opacity: style.opacity,
          cursor: style.cursor,
          transition: style.transition !== 'all 0s ease 0s' ? style.transition : undefined,
        },
      });
    });

    return results;
  });

  // Hover screenshots + style diff on key interactive elements
  const hoverTargets = ['button', 'a[class]', '[role="button"]', '[class*="btn"]', '[class*="card"]', 'nav a'];
  const hoverDiffs = [];

  for (let idx = 0; idx < hoverTargets.length && idx < 6; idx++) {
    try {
      const el = await page.$(hoverTargets[idx]);
      if (el && await el.isVisible()) {
        // Record default styles
        const defaultStyles = await el.evaluate(e => {
          const cs = getComputedStyle(e);
          const s = {};
          ['backgroundColor', 'color', 'borderColor', 'boxShadow', 'transform', 'opacity', 'textDecoration'].forEach(p => s[p] = cs[p]);
          return s;
        });

        await el.hover();
        await page.waitForTimeout(400);

        // Record hover styles and compute diff
        const hoverStyles = await el.evaluate(e => {
          const cs = getComputedStyle(e);
          const s = {};
          ['backgroundColor', 'color', 'borderColor', 'boxShadow', 'transform', 'opacity', 'textDecoration'].forEach(p => s[p] = cs[p]);
          return s;
        });

        const diff = {};
        Object.keys(hoverStyles).forEach(prop => {
          if (hoverStyles[prop] !== defaultStyles[prop]) {
            diff[prop] = { from: defaultStyles[prop], to: hoverStyles[prop] };
          }
        });

        if (Object.keys(diff).length > 0) {
          hoverDiffs.push({ selector: hoverTargets[idx], defaultStyles, hoverStyles, diff });
        }

        await page.screenshot({
          path: path.join(outputDir, 'screenshots', `hover-${idx}.png`),
          fullPage: false,
        });
      }
    } catch {}
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  // ═══════════════════════════════════════════════════════════
  // PHASE 5b: Auto-trigger Popups (modals, dropdowns, tooltips)
  // ═══════════════════════════════════════════════════════════
  console.log('🎯 Phase 5b: Triggering popups...');

  const popoverTriggers = await page.evaluate(() => {
    return [...document.querySelectorAll('[aria-haspopup], [data-state], [class*="trigger"], [class*="dropdown"], [aria-expanded], [popovertarget]')]
      .slice(0, 30)
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100) || '',
        className: (el.className || '').toString().slice(0, 200),
        ariaHaspopup: el.getAttribute('aria-haspopup'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        dataState: el.getAttribute('data-state'),
      }));
  });

  const triggeredPopups = [];
  const untriggeredPopups = [];

  for (let t = 0; t < Math.min(popoverTriggers.length, 15); t++) {
    const trigger = popoverTriggers[t];
    try {
      const selector = trigger.className
        ? `.${trigger.className.split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 2).join('.')}`
        : `${trigger.tag}[aria-haspopup]`;

      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(400);

        await page.screenshot({
          path: path.join(outputDir, 'screenshots', 'components', `popup-${t}.png`),
          fullPage: false,
        });

        const popupContent = await page.evaluate(() => {
          const popups = document.querySelectorAll(
            '[role="dialog"], [role="menu"], [role="listbox"], [data-state="open"], ' +
            '[class*="popover"]:not([data-state="closed"]), [class*="dropdown-content"], ' +
            '[class*="modal"][style*="display"]'
          );
          return [...popups].map(p => {
            const clone = p.cloneNode(true);
            clone.querySelectorAll('img, script, style, svg').forEach(e => e.remove());
            return {
              role: p.getAttribute('role') || '',
              className: (p.className || '').toString().slice(0, 200),
              html: clone.outerHTML.slice(0, 3000),
            };
          });
        });

        if (popupContent.length > 0) {
          triggeredPopups.push({ triggerIndex: t, trigger, popups: popupContent });
        } else {
          untriggeredPopups.push(trigger);
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    } catch {
      untriggeredPopups.push(trigger);
    }
  }
  console.log(`   ✅ Triggered ${triggeredPopups.length} popups, ${untriggeredPopups.length} failed`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 6: Font Detection
  // ═══════════════════════════════════════════════════════════
  console.log('🔤 Phase 6: Font detection...');

  const fonts = await page.evaluate(() => {
    const fontFaces = [];
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          if (r.type === CSSRule.FONT_FACE_RULE) {
            fontFaces.push({
              family: r.style.getPropertyValue('font-family').replace(/['"]/g, '').trim(),
              weight: r.style.getPropertyValue('font-weight'),
              style: r.style.getPropertyValue('font-style'),
            });
          }
        });
      } catch {}
    });
    const googleFonts = [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map(el => el.href);
    return { fontFaces, googleFonts };
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 7: Animation Library Detection
  // ═══════════════════════════════════════════════════════════
  console.log('🎬 Phase 7: Animation detection...');

  const animLibs = await page.evaluate(() => ({
    gsap:         typeof window.gsap !== 'undefined' || typeof window.GSAP !== 'undefined',
    lottie:       typeof window.lottie !== 'undefined' || !!document.querySelector('[data-lottie], lottie-player'),
    framerMotion: typeof window.Motion !== 'undefined' || typeof window.framerMotion !== 'undefined',
    animejs:      typeof window.anime !== 'undefined',
    threejs:      typeof window.THREE !== 'undefined',
    particles:    typeof window.particlesJS !== 'undefined' || typeof window.tsParticles !== 'undefined',
    scrollReveal: typeof window.ScrollReveal !== 'undefined',
    AOS:          typeof window.AOS !== 'undefined',
  }));

  // ═══════════════════════════════════════════════════════════
  // PHASE 8: Multi-page Crawl (optional)
  // ═══════════════════════════════════════════════════════════
  const subpageData = [];
  if (maxPages > 1) {
    console.log(`🔗 Phase 8: Multi-page crawl (${maxPages} pages)...`);

    const links = await page.evaluate((baseUrl) => {
      const origin = new URL(baseUrl).origin;
      return [...new Set(
        [...document.querySelectorAll('a[href]')]
          .map(a => a.href)
          .filter(h => h.startsWith(origin) && !h.includes('#') && h !== baseUrl && !h.match(/\.(png|jpg|pdf|zip)/i))
      )].slice(0, 20);
    }, url);

    for (let i = 0; i < Math.min(links.length, maxPages - 1); i++) {
      try {
        console.log(`   → ${links[i]}`);
        await page.goto(links[i], { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: path.join(outputDir, 'screenshots', `subpage-${i}.png`),
          fullPage: true
        });

        // Quick component scan on subpage
        const subComponents = await page.evaluate(() => {
          const found = {};
          const checks = {
            table: 'table, [role="grid"], [class*="table"]',
            form: 'form, [class*="form"]',
            modal: '[role="dialog"], dialog',
            pagination: '[class*="pagination"], nav[aria-label*="page"]',
            tabs: '[role="tablist"]',
            accordion: 'details, [class*="accordion"]',
            breadcrumb: '[class*="breadcrumb"]',
            empty_state: '[class*="empty"], [class*="no-data"]',
          };
          Object.entries(checks).forEach(([name, sel]) => {
            const el = document.querySelector(sel);
            if (el) {
              const clone = el.cloneNode(true);
              clone.querySelectorAll('img, script, style, svg').forEach(e => e.remove());
              found[name] = clone.outerHTML.slice(0, 4000);
            }
          });
          return found;
        });

        subpageData.push({ url: links[i], components: subComponents });
      } catch {}
    }

    // Navigate back to original
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  }

  await browser.close();

  // ═══════════════════════════════════════════════════════════
  // PHASE 9: Write Output
  // ═══════════════════════════════════════════════════════════
  console.log('\n💾 Phase 9: Writing output...');

  // harvest-raw.json — Complete extraction data
  const rawData = {
    url,
    extractedAt: new Date().toISOString(),
    cssVars,
    computedTokens,
    keyframesCount: (keyframes.match(/@keyframes/g) || []).length,
    fonts,
    animLibs,
    components,
    iconData,
    interactiveStates: interactiveStates.slice(0, 30),
    hoverDiffs,
    popoverTriggers,
    triggeredPopups,
    untriggeredPopups,
    subpageData,
  };
  fs.writeFileSync(path.join(outputDir, 'harvest-raw.json'), JSON.stringify(rawData, null, 2), 'utf-8');

  // site.css — CSS variables + rules + keyframes
  const siteCss = [
    `/* ===== CSS Variables (${Object.keys(cssVars).length}) ===== */\n:root {\n`,
    Object.entries(cssVars).map(([k, v]) => `  ${k}: ${v};`).join('\n'),
    `\n}\n\n/* ===== Design CSS Rules ===== */\n`,
    cssRules,
    `\n\n/* ===== @keyframes ===== */\n`,
    keyframes,
  ].join('');
  fs.writeFileSync(path.join(outputDir, 'site.css'), siteCss, 'utf-8');

  // computed-tokens.json — Frequency-ranked computed styles
  fs.writeFileSync(path.join(outputDir, 'computed-tokens.json'), JSON.stringify(computedTokens, null, 2), 'utf-8');

  // ── Summary ───────────────────────────────────────────
  const compTypes = Object.keys(components).filter(k => !k.startsWith('_'));
  const screenshotFiles = [];
  const walkDir = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
      if (f.isDirectory()) walkDir(path.join(dir, f.name));
      else screenshotFiles.push(f.name);
    });
  };
  walkDir(path.join(outputDir, 'screenshots'));

  console.log('\n✅ Site-to-DS complete!\n');
  console.log(`📁 ${outputDir}/`);
  console.log(`   ├── harvest-raw.json       Complete extraction data`);
  console.log(`   ├── computed-tokens.json   Frequency-ranked computed styles`);
  console.log(`   ├── site.css               CSS variables + rules + keyframes`);
  console.log(`   ├── icons/                 ${savedIcons.length} SVG icons + illustrations`);
  console.log(`   └── screenshots/           ${screenshotFiles.length} images`);
  console.log(`       ├── sections/          ${sections} viewport sections`);
  console.log(`       └── components/        Per-component screenshots`);
  console.log(`\n📊 Summary:`);
  console.log(`   CSS Variables:     ${Object.keys(cssVars).length}`);
  console.log(`   Unique Colors:     ${computedTokens.colors.length}`);
  console.log(`   Font Sizes:        ${computedTokens.fontSizes.length}`);
  console.log(`   Font Families:     ${computedTokens.fontFamilies.length}`);
  console.log(`   Border Radii:      ${computedTokens.radii.length}`);
  console.log(`   Box Shadows:       ${computedTokens.shadows.length}`);
  console.log(`   Spacing Values:    ${computedTokens.spacings.length}`);
  console.log(`   Transitions:       ${computedTokens.transitions.length}`);
  console.log(`   @keyframes:        ${(keyframes.match(/@keyframes/g) || []).length}`);
  console.log(`   Components Found:  ${compTypes.join(', ')}`);
  console.log(`   Component Types:   ${compTypes.length}`);

  console.log(`   Glass Effects:   ${computedTokens.glassEffects.length}`);
  console.log(`   Gradients:       ${computedTokens.gradients.length}`);
  console.log(`   Hover Diffs:     ${hoverDiffs.length}`);
  console.log(`   Popup Triggers:  ${popoverTriggers.length} (triggered: ${triggeredPopups.length}, failed: ${untriggeredPopups.length})`);

  compTypes.forEach(t => {
    console.log(`     └── ${t}: ${components[t].count} instance(s), ${components[t].variants.length} variant(s)`);
  });

  if (subpageData.length) {
    console.log(`   Subpages Scanned:  ${subpageData.length}`);
    subpageData.forEach(sp => {
      const extraComps = Object.keys(sp.components);
      if (extraComps.length) console.log(`     └── ${sp.url}: +${extraComps.join(', ')}`);
    });
  }

  const detectedLibs = Object.entries(animLibs).filter(([, v]) => v).map(([k]) => k);
  if (detectedLibs.length) {
    console.log(`\n⚠️  JS Animation Libraries: ${detectedLibs.join(', ')}`);
  }

  console.log(`\n🌾 Next: Tell Claude "use site-to-ds output to generate design system"\n`);
}

harvest().catch(err => {
  console.error('\n❌ Harvest failed:', err.message);
  process.exit(1);
});
