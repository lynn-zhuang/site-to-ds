/**
 * Comprehensive UI Audit Template
 *
 * This function is designed to run inside a browser context via:
 * - Chrome DevTools MCP: mcp__chrome-devtools__evaluate_script
 * - Playwright: page.evaluate()
 * - Manual: paste into DevTools Console
 *
 * Returns a comprehensive JSON object with all UI patterns found on the page.
 */
function fullUIAudit() {
  const result = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    cssVariables: {},
    colors: { backgrounds: [], texts: [], borders: [], shadows: [] },
    typography: { fontFaces: [], usedFamilies: [], fontSizes: [], fontWeights: [], lineHeights: [] },
    spacing: [],
    radii: [],
    shadowValues: [],
    glassEffects: [],
    gradients: [],
    buttons: [],
    inputs: [],
    cards: [],
    badges: [],
    links: [],
    icons: [],
    dividers: [],
    popoverTriggers: [],
    animations: { keyframes: [], transitions: [] },
    animLibs: {},
    navLinks: [],
    stickyElements: [],
    allInteractiveElements: [],
    componentSummary: {}
  };

  // ── 1. CSS Variables ──────────────────────────────────────
  try {
    const root = getComputedStyle(document.documentElement);
    const varNames = new Set();
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          const matches = r.cssText.match(/--[\w-]+/g);
          if (matches) matches.forEach(v => varNames.add(v));
        });
      } catch {}
    });
    varNames.forEach(v => {
      const val = root.getPropertyValue(v).trim();
      if (val) result.cssVariables[v] = val;
    });
  } catch {}

  // ── 2. Unique Computed Colors ─────────────────────────────
  try {
    const bgColors = new Set();
    const textColors = new Set();
    const borderColors = new Set();
    const shadowColors = new Set();

    const allElements = document.querySelectorAll('*');
    const sampleSize = Math.min(allElements.length, 2000);
    for (let i = 0; i < sampleSize; i++) {
      const el = allElements[i];
      const cs = getComputedStyle(el);

      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') bgColors.add(bg);

      const color = cs.color;
      if (color) textColors.add(color);

      const bc = cs.borderColor;
      if (bc && bc !== 'rgb(0, 0, 0)' && bc !== 'rgba(0, 0, 0, 0)') borderColors.add(bc);

      const bs = cs.boxShadow;
      if (bs && bs !== 'none') {
        shadowColors.add(bs);
      }
    }

    result.colors.backgrounds = [...bgColors];
    result.colors.texts = [...textColors];
    result.colors.borders = [...borderColors];
    result.colors.shadows = [...shadowColors];
  } catch {}

  // ── 3. Typography ─────────────────────────────────────────
  try {
    // @font-face
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          if (r.type === CSSRule.FONT_FACE_RULE) {
            result.typography.fontFaces.push({
              family: r.style.getPropertyValue('font-family').replace(/['"]/g, '').trim(),
              weight: r.style.getPropertyValue('font-weight') || 'normal',
              style: r.style.getPropertyValue('font-style') || 'normal',
              src: r.style.getPropertyValue('src')
            });
          }
        });
      } catch {}
    });

    // Actual used fonts, sizes, weights, line-heights
    const families = new Set();
    const sizes = new Set();
    const weights = new Set();
    const lineHeights = new Set();

    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,td,th,input,textarea').forEach(el => {
      const cs = getComputedStyle(el);
      families.add(cs.fontFamily);
      sizes.add(cs.fontSize);
      weights.add(cs.fontWeight);
      lineHeights.add(cs.lineHeight);
    });

    result.typography.usedFamilies = [...families].slice(0, 20);
    result.typography.fontSizes = [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b));
    result.typography.fontWeights = [...weights].sort();
    result.typography.lineHeights = [...lineHeights];

    // Google Fonts
    result.typography.googleFontsUrls = [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map(el => el.href);
  } catch {}

  // ── 4. Spacing (padding/margin analysis) ──────────────────
  try {
    const spacingValues = {};
    const sampleEls = document.querySelectorAll('div, section, article, main, aside, header, footer, nav, ul, li, p, h1, h2, h3');
    const sampleCount = Math.min(sampleEls.length, 500);
    for (let i = 0; i < sampleCount; i++) {
      const cs = getComputedStyle(sampleEls[i]);
      ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
       'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
       'gap', 'rowGap', 'columnGap'].forEach(prop => {
        const val = cs[prop];
        if (val && val !== '0px' && val !== 'auto' && val !== 'normal') {
          spacingValues[val] = (spacingValues[val] || 0) + 1;
        }
      });
    }
    result.spacing = Object.entries(spacingValues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([value, count]) => ({ value, count }));
  } catch {}

  // ── 5. Border Radii ───────────────────────────────────────
  try {
    const radiiValues = {};
    const sampleEls = document.querySelectorAll('*');
    const sampleCount = Math.min(sampleEls.length, 1000);
    for (let i = 0; i < sampleCount; i++) {
      const br = getComputedStyle(sampleEls[i]).borderRadius;
      if (br && br !== '0px') {
        radiiValues[br] = (radiiValues[br] || 0) + 1;
      }
    }
    result.radii = Object.entries(radiiValues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }));
  } catch {}

  // ── 6. Shadow Values ──────────────────────────────────────
  try {
    const shadowSet = new Set();
    document.querySelectorAll('*').forEach(el => {
      const bs = getComputedStyle(el).boxShadow;
      if (bs && bs !== 'none') shadowSet.add(bs);
    });
    result.shadowValues = [...shadowSet];
  } catch {}

  // ── 7. Glass / Backdrop-blur Effects ──────────────────────
  try {
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      if (bf && bf !== 'none') {
        result.glassEffects.push({
          tag: el.tagName.toLowerCase(),
          className: el.className?.toString?.().slice(0, 200) || '',
          backdropFilter: bf,
          background: cs.backgroundColor,
          border: cs.border,
          borderRadius: cs.borderRadius,
          html: el.outerHTML.slice(0, 500)
        });
      }
    });
  } catch {}

  // ── 8. Gradients ──────────────────────────────────────────
  try {
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage;
      if (bg && bg !== 'none' && /gradient/i.test(bg)) {
        result.gradients.push({
          tag: el.tagName.toLowerCase(),
          className: el.className?.toString?.().slice(0, 200) || '',
          backgroundImage: bg,
          html: el.outerHTML.slice(0, 300)
        });
      }
    });
  } catch {}

  // ── 9. Buttons ────────────────────────────────────────────
  try {
    document.querySelectorAll('button, [role="button"], [class*="btn"], [class*="button"], a[class*="btn"], a[class*="button"]').forEach(el => {
      const cs = getComputedStyle(el);
      result.buttons.push({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100) || '',
        className: el.className?.toString?.().slice(0, 300) || '',
        styles: {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          border: cs.border,
          borderRadius: cs.borderRadius,
          padding: cs.padding,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          boxShadow: cs.boxShadow,
          cursor: cs.cursor,
          display: cs.display,
          backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || 'none'
        },
        isDisabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        html: el.outerHTML.slice(0, 500)
      });
    });
  } catch {}

  // ── 10. Inputs / Textareas / Selects ──────────────────────
  try {
    document.querySelectorAll('input, textarea, select, [role="textbox"], [role="combobox"], [role="listbox"], [contenteditable="true"]').forEach(el => {
      const cs = getComputedStyle(el);
      result.inputs.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        className: el.className?.toString?.().slice(0, 300) || '',
        placeholder: el.placeholder || '',
        styles: {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          border: cs.border,
          borderRadius: cs.borderRadius,
          padding: cs.padding,
          fontSize: cs.fontSize,
          outline: cs.outline
        },
        html: el.outerHTML.slice(0, 500)
      });
    });
  } catch {}

  // ── 11. Cards / Containers ────────────────────────────────
  try {
    document.querySelectorAll('[class*="card"], [class*="tile"], [class*="panel"], [class*="container"], article').forEach(el => {
      const cs = getComputedStyle(el);
      if (el.children.length < 2) return; // skip trivial containers
      result.cards.push({
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString?.().slice(0, 300) || '',
        childCount: el.children.length,
        styles: {
          backgroundColor: cs.backgroundColor,
          border: cs.border,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
          padding: cs.padding,
          backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || 'none'
        },
        html: el.outerHTML.slice(0, 1000)
      });
    });
  } catch {}

  // ── 12. Badges / Tags / Pills ─────────────────────────────
  try {
    document.querySelectorAll('[class*="badge"], [class*="tag"], [class*="pill"], [class*="chip"], [class*="label"]:not(label)').forEach(el => {
      const cs = getComputedStyle(el);
      result.badges.push({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100) || '',
        className: el.className?.toString?.().slice(0, 200) || '',
        styles: {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          border: cs.border,
          borderRadius: cs.borderRadius,
          padding: cs.padding,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        },
        html: el.outerHTML.slice(0, 300)
      });
    });
  } catch {}

  // ── 13. Popover / Dropdown / Tooltip Triggers ─────────────
  try {
    document.querySelectorAll('[aria-haspopup], [data-state], [class*="trigger"], [class*="dropdown"], [aria-expanded], [popovertarget]').forEach(el => {
      result.popoverTriggers.push({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100) || '',
        className: el.className?.toString?.().slice(0, 200) || '',
        ariaHaspopup: el.getAttribute('aria-haspopup'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        dataState: el.getAttribute('data-state'),
        html: el.outerHTML.slice(0, 500)
      });
    });
  } catch {}

  // ── 14. Links ─────────────────────────────────────────────
  try {
    const linkSample = [...document.querySelectorAll('a[href]')].slice(0, 50);
    linkSample.forEach(el => {
      const cs = getComputedStyle(el);
      result.links.push({
        text: el.textContent?.trim().slice(0, 100) || '',
        href: el.href,
        className: el.className?.toString?.().slice(0, 200) || '',
        styles: {
          color: cs.color,
          textDecoration: cs.textDecoration,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        }
      });
    });
  } catch {}

  // ── 15. Icons (SVGs) ──────────────────────────────────────
  try {
    document.querySelectorAll('svg, [class*="icon"], img[src*="icon"], img[src$=".svg"]').forEach(el => {
      const cs = getComputedStyle(el);
      result.icons.push({
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString?.().slice(0, 200) || el.className?.baseVal?.slice(0, 200) || '',
        width: cs.width,
        height: cs.height,
        viewBox: el.getAttribute?.('viewBox') || '',
        fill: el.getAttribute?.('fill') || cs.fill || '',
        stroke: el.getAttribute?.('stroke') || cs.stroke || ''
      });
    });
    // Deduplicate by className
    const iconMap = new Map();
    result.icons.forEach(icon => {
      const key = icon.className || `${icon.tag}-${icon.width}-${icon.height}`;
      if (!iconMap.has(key)) iconMap.set(key, icon);
    });
    result.icons = [...iconMap.values()].slice(0, 50);
  } catch {}

  // ── 16. Dividers / Separators ─────────────────────────────
  try {
    document.querySelectorAll('hr, [class*="divider"], [class*="separator"], [role="separator"]').forEach(el => {
      const cs = getComputedStyle(el);
      result.dividers.push({
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString?.().slice(0, 200) || '',
        styles: {
          borderTop: cs.borderTop,
          borderBottom: cs.borderBottom,
          backgroundColor: cs.backgroundColor,
          height: cs.height,
          margin: cs.margin
        }
      });
    });
  } catch {}

  // ── 17. Animations & Transitions ──────────────────────────
  try {
    // @keyframes
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          if (r.type === CSSRule.KEYFRAMES_RULE || r.cssText?.startsWith('@keyframes')) {
            result.animations.keyframes.push({
              name: r.name || r.cssText.match(/@keyframes\s+([\w-]+)/)?.[1] || 'unknown',
              cssText: r.cssText.slice(0, 1000)
            });
          }
        });
      } catch {}
    });

    // Transitions in use
    const transitionSet = new Set();
    [...document.styleSheets].forEach(s => {
      try {
        [...s.cssRules].forEach(r => {
          if (r.cssText && /transition|animation/.test(r.cssText)) {
            const matches = r.cssText.match(/(transition|animation)[^;{]+/g);
            if (matches) matches.forEach(m => transitionSet.add(m.trim()));
          }
        });
      } catch {}
    });
    result.animations.transitions = [...transitionSet];
  } catch {}

  // ── 18. JS Animation Libraries ────────────────────────────
  try {
    result.animLibs = {
      gsap: typeof window.gsap !== 'undefined' || typeof window.GSAP !== 'undefined',
      lottie: typeof window.lottie !== 'undefined' || !!document.querySelector('[data-lottie]'),
      framerMotion: typeof window.Motion !== 'undefined' || typeof window.framerMotion !== 'undefined',
      animejs: typeof window.anime !== 'undefined',
      velocity: typeof window.Velocity !== 'undefined' || (typeof window.$ !== 'undefined' && typeof window.$.Velocity !== 'undefined'),
      threejs: typeof window.THREE !== 'undefined',
      particles: typeof window.particlesJS !== 'undefined' || typeof window.tsParticles !== 'undefined'
    };
  } catch {}

  // ── 19. Internal Navigation Links ─────────────────────────
  try {
    const baseUrl = new URL(window.location.href);
    const seen = new Set();
    document.querySelectorAll('nav a, aside a, [class*="sidebar"] a, [class*="menu"] a, header a, [class*="nav"] a').forEach(a => {
      try {
        const url = new URL(a.href, baseUrl);
        if (url.origin === baseUrl.origin && !seen.has(url.pathname)) {
          seen.add(url.pathname);
          result.navLinks.push({
            text: a.textContent?.trim().slice(0, 100) || '',
            href: url.pathname,
            fullUrl: url.href
          });
        }
      } catch {}
    });
  } catch {}

  // ── 20. Sticky / Fixed Elements ───────────────────────────
  try {
    document.querySelectorAll('*').forEach(el => {
      const pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') {
        result.stickyElements.push({
          tag: el.tagName.toLowerCase(),
          className: el.className?.toString?.().slice(0, 200) || '',
          position: pos,
          html: el.outerHTML.slice(0, 1000)
        });
      }
    });
  } catch {}

  // ── 21. All Interactive Elements ──────────────────────────
  try {
    document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex], [onclick], [aria-haspopup], [data-state]').forEach(el => {
      result.allInteractiveElements.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        className: el.className?.toString?.().slice(0, 150) || '',
        text: el.textContent?.trim().slice(0, 80) || '',
        isDisabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        hasHaspopup: !!el.getAttribute('aria-haspopup'),
        dataState: el.getAttribute('data-state') || ''
      });
    });
    // Limit to avoid massive output
    if (result.allInteractiveElements.length > 200) {
      result.allInteractiveElements = result.allInteractiveElements.slice(0, 200);
      result.allInteractiveElementsTruncated = true;
    }
  } catch {}

  // ── 22. Component Summary (quick scan) ────────────────────
  try {
    const checks = {
      header: ['header', 'nav', '[class*="header"]', '[class*="navbar"]', '[class*="nav-"]'],
      footer: ['footer', '[class*="footer"]'],
      sidebar: ['aside', '[class*="sidebar"]', '[class*="side-bar"]'],
      hero: ['[class*="hero"]', '[class*="banner"]', '[class*="jumbotron"]'],
      card: ['[class*="card"]', '[class*="tile"]'],
      grid: ['[class*="grid"]', '[class*="list"]', '[class*="feed"]'],
      modal: ['[class*="modal"]', '[class*="dialog"]', '[role="dialog"]'],
      dropdown: ['[class*="dropdown"]', '[class*="popover"]'],
      tabs: ['[class*="tab"]', '[role="tablist"]'],
      accordion: ['details', '[class*="accordion"]', '[class*="collapse"]'],
      tooltip: ['[class*="tooltip"]', '[role="tooltip"]'],
      form: ['form', 'input', 'textarea', 'select'],
      button: ['button', '[class*="btn"]', '[class*="button"]'],
      toast: ['[class*="toast"]', '[class*="notification"]', '[class*="alert"]'],
      badge: ['[class*="badge"]', '[class*="tag"]', '[class*="chip"]'],
      pagination: ['[class*="pagination"]', '[class*="pager"]'],
      breadcrumb: ['[class*="breadcrumb"]', 'nav[aria-label*="breadcrumb"]'],
      avatar: ['[class*="avatar"]', 'img[class*="profile"]'],
      table: ['table', '[class*="table"]', '[role="grid"]'],
      progress: ['progress', '[class*="progress"]', '[role="progressbar"]'],
      skeleton: ['[class*="skeleton"]', '[class*="shimmer"]', '[class*="placeholder"]'],
      toggle: ['[class*="toggle"]', '[class*="switch"]', '[role="switch"]']
    };

    Object.entries(checks).forEach(([name, sels]) => {
      const found = sels.find(s => document.querySelector(s));
      result.componentSummary[name] = {
        found: !!found,
        selector: found || null,
        count: found ? document.querySelectorAll(found).length : 0
      };
    });
  } catch {}

  return result;
}

// Execute and return
fullUIAudit();
