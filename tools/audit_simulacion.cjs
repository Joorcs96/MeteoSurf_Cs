const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const BASE_URL = process.argv[2] || 'http://127.0.0.1:8767';
const OUT_FILE = process.argv[3] || path.join(__dirname, 'audit_report.json');

async function auditPage(browser, pageUrl, isMobile = false) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isMobile: isMobile,
    hasTouch: isMobile
  });

  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));

  const startTime = Date.now();
  let navigationSuccess = true;
  let navError = null;

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e2) {
      navigationSuccess = false;
      navError = e2.message;
    }
  }

  const loadDuration = Date.now() - startTime;

  // Let dynamic elements render (webcam feeds, charts, map)
  await page.waitForTimeout(2000);

  // Evaluate DOM checks according to Web Design Guidelines & WCAG
  const domAudit = await page.evaluate((isMob) => {
    const results = {
      title: document.title,
      metaViewport: document.querySelector('meta[name="viewport"]')?.content || null,
      metaThemeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
      h1Count: document.querySelectorAll('h1').length,
      h1Texts: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
      h2Count: document.querySelectorAll('h2').length,
      headingsHierarchyOk: true,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
      totalButtons: document.querySelectorAll('button, [role="button"], a.btn, input[type="button"], input[type="submit"]').length,
      buttonsLackingAccessibleName: [],
      buttonsTooSmall: [],
      smallTextCount: 0,
      smallTextSamples: [],
      emptyLinks: [],
      inputsLackingLabel: [],
      mediaTags: {
        images: document.querySelectorAll('img').length,
        imagesWithoutAlt: 0,
        videos: document.querySelectorAll('video').length,
        videosWithoutPlaysInline: 0,
        canvases: document.querySelectorAll('canvas').length
      },
      pwaCheck: {
        hasManifest: !!document.querySelector('link[rel="manifest"]'),
        hasSwRegistered: 'serviceWorker' in navigator
      },
      interactiveElementsSummary: []
    };

    // Images
    document.querySelectorAll('img').forEach(img => {
      if (!img.getAttribute('alt') && img.getAttribute('aria-hidden') !== 'true') {
        results.mediaTags.imagesWithoutAlt++;
      }
    });

    // Videos
    document.querySelectorAll('video').forEach(v => {
      if (!v.hasAttribute('playsinline')) {
        results.mediaTags.videosWithoutPlaysInline++;
      }
    });

    // Touch targets & accessible names
    const interactives = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    interactives.forEach(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';

      if (isVisible) {
        // Accessible name check
        const text = (el.innerText || el.textContent || '').trim();
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const hasAccessibleName = !!(text || ariaLabel || title || ariaLabelledBy);

        if (!hasAccessibleName && el.tagName !== 'INPUT') {
          results.buttonsLackingAccessibleName.push({
            tag: el.tagName,
            class: (el.className || '').toString().slice(0, 80),
            html: el.outerHTML.slice(0, 100)
          });
        }

        // Target size check (WCAG 2.5.5 / 2.5.8 recommends >= 44x44 or >= 24x24 minimum)
        if (isMob && (rect.width < 38 || rect.height < 38)) {
          // Exclude inline text links within paragraphs
          if (!(el.tagName === 'A' && el.parentElement && el.parentElement.tagName === 'P')) {
            results.buttonsTooSmall.push({
              tag: el.tagName,
              name: ariaLabel || text || title || '(sin nombre)',
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              class: (el.className || '').toString().slice(0, 50)
            });
          }
        }
      }
    });

    // Check small text (< 12px)
    const allEls = document.querySelectorAll('p, span, div, a, td, th, label, small, b, strong');
    let sampled = 0;
    allEls.forEach(el => {
      if (el.children.length === 0 && (el.textContent || '').trim().length > 1) {
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 12 && fs > 0) {
          results.smallTextCount++;
          if (sampled < 5) {
            results.smallTextSamples.push({
              fontSize: fs + 'px',
              text: el.textContent.trim().slice(0, 40),
              tag: el.tagName
            });
            sampled++;
          }
        }
      }
    });

    // Form inputs without label
    document.querySelectorAll('input, select, textarea').forEach(inp => {
      if (inp.type === 'hidden') return;
      const id = inp.id;
      const hasForLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasParentLabel = !!inp.closest('label');
      const hasAria = !!inp.getAttribute('aria-label') || !!inp.getAttribute('aria-labelledby');
      if (!hasForLabel && !hasParentLabel && !hasAria) {
        results.inputsLackingLabel.push({
          type: inp.type,
          name: inp.name || '(sin name)',
          id: id || '(sin id)'
        });
      }
    });

    return results;
  }, isMobile);

  await context.close();

  return {
    url: pageUrl,
    mode: isMobile ? 'mobile (390x844)' : 'desktop (1440x900)',
    navigationSuccess,
    navError,
    loadDurationMs: loadDuration,
    domAudit,
    consoleMessages,
    pageErrors,
    failedRequests
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  console.log('--- Iniciando Auditoría Completa Playwright ---');
  console.log('Base URL:', BASE_URL);

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: {}
  };

  try {
    console.log('Auditando index.html (Mobile)...');
    report.pages.indexMobile = await auditPage(browser, `${BASE_URL}/index.html`, true);

    console.log('Auditando index.html (Desktop)...');
    report.pages.indexDesktop = await auditPage(browser, `${BASE_URL}/index.html`, false);

    console.log('Auditando votar.html (Mobile)...');
    report.pages.votarMobile = await auditPage(browser, `${BASE_URL}/votar.html`, true);

    console.log('Auditando votar.html (Desktop)...');
    report.pages.votarDesktop = await auditPage(browser, `${BASE_URL}/votar.html`, false);

    fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log('Auditoría guardada en:', OUT_FILE);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('Error durante la auditoría:', err);
  process.exit(1);
});
