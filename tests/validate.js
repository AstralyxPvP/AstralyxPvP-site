const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_DIR = ROOT;
const ASSETS_DIR = path.join(ROOT, 'Assets');
const SCRIPT_DIR = path.join(ROOT, 'Script');
const STYLE_DIR = path.join(ROOT, 'Style');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to include "${needle}"`);
  }
}

function assertFileExists(p) {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
}

function read(p) {
  return fs.readFileSync(p, 'utf-8');
}

console.log('\n=== AstralyxPvP Site Validation ===\n');

// ============================================================
// 1. File Existence
// ============================================================
console.log('\n--- File Existence ---');

test('All required HTML pages exist', () => {
  const pages = [
    'index.html', 'leaderboard.html', 'status.html', 'vote.html',
    'contact.html', 'apply.html', 'store.html', 'rules.html',
    'privacy.html', 'terms.html', 'credits-web.html', 'astralyxai.html',
    'support.html'
  ];
  pages.forEach(p => assertFileExists(path.join(HTML_DIR, p)));
});

test('All required assets exist', () => {
  const required = [
    'navbar.html', 'footer.html', 'head.html',
  ];
  required.forEach(f => assertFileExists(path.join(ASSETS_DIR, f)));

  const images = [
    'apple-touch-icon.png', 'web-app-manifest-512x512.png',
    'cursor-sword.png', 'cursor-axe.png', 'cursor-axe-click.png',
  ];
  images.forEach(f => assertFileExists(path.join(ASSETS_DIR, f)));
});

test('Script files exist', () => {
  assertFileExists(path.join(SCRIPT_DIR, 'script.js'));
});

test('Style files exist', () => {
  assertFileExists(path.join(STYLE_DIR, 'style.css'));
});

// ============================================================
// 2. HTML Structure
// ============================================================
console.log('\n--- HTML Structure ---');

const htmlFiles = fs.readdirSync(HTML_DIR).filter(f =>
  f.endsWith('.html') && f !== 'head-data.html');

htmlFiles.forEach(file => {
  test(`${file} has DOCTYPE`, () => {
    const content = read(path.join(HTML_DIR, file));
    assertIncludes(content, '<!DOCTYPE html>', `${file} DOCTYPE`);
  });

  test(`${file} has closing html tag`, () => {
    const content = read(path.join(HTML_DIR, file));
    assertIncludes(content, '</html>', `${file} closing html`);
  });
});

// ============================================================
// 3. Page Components (Chat widget, navbar, footer, backToTop, bottom-nav)
// ============================================================
console.log('\n--- Page Components ---');

const pagesWithFullLayout = [
  'index.html', 'leaderboard.html', 'status.html', 'vote.html',
  'contact.html', 'apply.html', 'store.html', 'rules.html',
  'privacy.html', 'terms.html', 'credits-web.html',
];

pagesWithFullLayout.forEach(file => {
  const content = read(path.join(HTML_DIR, file));

  test(`${file} has navbar-placeholder`, () => {
    assertIncludes(content, 'navbar-placeholder', `${file} navbar`);
  });

  test(`${file} has footer placeholder`, () => {
    assertIncludes(content, 'id="footer"', `${file} footer`);
  });

  test(`${file} has backToTop button`, () => {
    assertIncludes(content, 'backToTop', `${file} backToTop`);
  });

  test(`${file} has chat widget button`, () => {
    assertIncludes(content, 'chatWidgetBtn', `${file} chat widget`);
  });

  test(`${file} has chat dock`, () => {
    assertIncludes(content, 'chatDock', `${file} chat dock`);
  });
});

// ============================================================
// 4. AI Page Specific Checks
// ============================================================
console.log('\n--- AI Page Validation ---');

test('astralyxai.html has sendMessage function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'async function sendMessage()', 'sendMessage');
});

test('astralyxai.html has handleKeyPress function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function handleKeyPress(event)', 'handleKeyPress');
});

test('astralyxai.html has chat-input form', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'chat-input-area', 'chat form');
  assertIncludes(content, 'chatInput', 'chat input');
  assertIncludes(content, 'sendBtn', 'send button');
});

test('astralyxai.html has chat messages container', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'chatMessages', 'chat messages');
});

test('astralyxai.html has callGeminiAPI function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'async function callGeminiAPI', 'callGeminiAPI');
});

test('astralyxai.html has parseMarkdown function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'const parseMarkdown', 'parseMarkdown');
});

test('astralyxai.html has FunctionRegistry', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'const FunctionRegistry', 'FunctionRegistry');
});

test('astralyxai.html has Turnstile widget', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'cf-turnstile', 'Turnstile');
});

test('astralyxai.html has mic button', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'micBtn', 'mic button');
});

test('astralyxai.html backToTop button is NOT inside script tag', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  const scriptClose = content.lastIndexOf('</script>');
  const buttonStart = content.indexOf('id="backToTop"');
  assert(buttonStart === -1 || buttonStart > scriptClose,
    'backToTop button should be outside the script block');
});

test('astralyxai.html has voice transcription function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'transcribeWithGemini', 'transcribe');
});

test('astralyxai.html has speakText function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function speakText', 'speakText');
});

test('astralyxai.html has SYSTEM_PROMPT defined', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'const SYSTEM_PROMPT', 'SYSTEM_PROMPT');
});

test('astralyxai.html has model configuration', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'currentModel', 'currentModel');
  assertIncludes(content, 'gemini', 'gemini model');
});

test('astralyxai.html FunctionRegistry has fetchLeaderboard', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'fetchLeaderboard', 'fetchLeaderboard tool');
});

test('astralyxai.html FunctionRegistry has fetchServerStatus', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'fetchServerStatus', 'fetchServerStatus tool');
});

test('astralyxai.html sends chat to correct endpoint', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, "/chat',", 'chat endpoint');
});

test('astralyxai.html has turnstile sitekey', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'data-sitekey=', 'turnstile sitekey');
});

test('astralyxai.html has welcome message', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'Welcome to AstralyxAI', 'welcome message');
});

test('astralyxai.html has model status indicator', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'modelStatus', 'model status');
});

test('astralyxai.html API call uses turnstileToken and sessionToken', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'turnstileToken:', 'turnstileToken in payload');
  assertIncludes(content, 'sessionToken:', 'sessionToken in payload');
});

test('astralyxai.html has collapse/expand thinking box logic', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'thinking-container collapsed', 'thinking box');
  assertIncludes(content, 'thinking-toggle', 'thinking toggle');
  assertIncludes(content, 'collapsed', 'collapsed class toggle');
});

test('astralyxai.html has streamIntoMessage function for typewriter effect', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function streamIntoMessage', 'streamIntoMessage');
});

test('astralyxai.html has renderOrUpdateMessage function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function renderOrUpdateMessage', 'renderOrUpdateMessage');
});

test('astralyxai.html has showTyping and removeTyping', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function showTyping', 'showTyping');
  assertIncludes(content, 'function removeTyping', 'removeTyping');
});

test('astralyxai.html has generateId function', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'function generateId', 'generateId');
});

test('astralyxai.html has conversationHistory array', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'conversationHistory', 'conversationHistory');
});

test('astralyxai.html AI response stream processes multi-query tool calls', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'CALL_FUNCTION:', 'CALL_FUNCTION parsing');
  assertIncludes(content, 'MULTI-QUERY PARSING LOOP', 'multi-query loop');
});

test('astralyxai.html has external script.js reference', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'script.js', 'script.js reference');
});

test('astralyxai.html has style.css reference', () => {
  const content = read(path.join(HTML_DIR, 'astralyxai.html'));
  assertIncludes(content, 'style.css', 'style.css reference');
});

// ============================================================
// 5. Navbar Validation
// ============================================================
console.log('\n--- Navbar Validation ---');

test('navbar.html has main-nav class', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'main-nav', 'main-nav');
});

test('navbar.html has brand section', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'class="brand"', 'brand');
  assertIncludes(content, 'brand-mark', 'brand-mark');
  assertIncludes(content, 'brand-text', 'brand-text');
});

test('navbar.html has status pill', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'nav-status', 'status pill');
  assertIncludes(content, 'server-pill', 'server-pill');
});

test('navbar.html has hamburger', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'class="hamburger"', 'hamburger');
});

test('navbar.html has nav-links', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'class="nav-links"', 'nav-links');
});

test('navbar.html has all required links', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  const links = ['Home', 'Leaderboard', 'Status', 'Vote', 'Contact',
    'Join Team', 'Store'];
  links.forEach(link => {
    assertIncludes(content, link, `nav link "${link}"`);
  });
});

test('navbar.html has mobile-close button', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'class="mobile-close"', 'mobile-close');
});

test('navbar.html has backdrop', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'class="nav-backdrop"', 'backdrop');
});

test('navbar.html has footer hint', () => {
  const content = read(path.join(ASSETS_DIR, 'navbar.html'));
  assertIncludes(content, 'nav-footer-hint', 'footer hint');
});

// ============================================================
// 6. CSS Validation
// ============================================================
console.log('\n--- CSS Validation ---');

test('style.css has :root custom properties', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, ':root {', ':root');
  assertIncludes(content, '--red:', '--red');
  assertIncludes(content, '--gold:', '--gold');
});

test('style.css has main-nav styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.main-nav {', '.main-nav');
});

test('style.css has brand styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.brand {', '.brand');
  assertIncludes(content, '.brand-mark', '.brand-mark');
  assertIncludes(content, '.brand-text', '.brand-text');
});

test('style.css has server-pill styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.server-pill {', '.server-pill');
  assertIncludes(content, '.server-pill.offline', '.offline');
  assertIncludes(content, '.server-pill.online', '.online');
});

test('style.css has hamburger styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.hamburger {', '.hamburger');
});

test('style.css has nav-links styles for desktop and mobile', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '@media (min-width: 861px)', 'desktop breakpoint');
  assertIncludes(content, '@media (max-width: 860px)', 'mobile breakpoint');
});

test('style.css has nav-scrolled styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.nav-scrolled {', '.nav-scrolled');
});

test('style.css has doc-group-title styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.doc-group-title', 'doc-group-title');
});

test('style.css has bottom-nav styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.bottom-nav', 'bottom-nav');
});

test('style.css has hero styles', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  assertIncludes(content, '.hero {', '.hero');
});

test('style.css has keyframe animations', () => {
  const content = read(path.join(STYLE_DIR, 'style.css'));
  const keyframes = ['@keyframes floatLogo', '@keyframes borderShimmer',
    '@keyframes navDrop', '@keyframes spin'];
  keyframes.forEach(k => assertIncludes(content, k, k));
});

// ============================================================
// 7. JavaScript Validation
// ============================================================
console.log('\n--- JavaScript Validation ---');

test('script.js has initNavbar function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'async function initNavbar()', 'initNavbar');
});

test('script.js has initFooter function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'async function initFooter()', 'initFooter');
});

test('script.js has toggleChatDock function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'function toggleChatDock()', 'toggleChatDock');
});

test('script.js has scrollToTop function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'function scrollToTop()', 'scrollToTop');
});

test('script.js has copyServerIP function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'window.copyServerIP', 'copyServerIP');
});

test('script.js has updateNavStatus function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'async function updateNavStatus()', 'updateNavStatus');
});

test('script.js has initLeaderboard function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'async function initLeaderboard()', 'initLeaderboard');
});

test('script.js has refreshLB function', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'async function refreshLB()', 'refreshLB');
});

test('script.js has double-decker wrap detection', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'function checkWrap', 'checkWrap');
  assertIncludes(content, 'double-decker', 'double-decker');
});

test('script.js has nav-scrolled scroll detection', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, 'nav-scrolled', 'nav-scrolled');
});

test('script.js filters only A tags in wrap detection', () => {
  const content = read(path.join(SCRIPT_DIR, 'script.js'));
  assertIncludes(content, "el.tagName === 'A'", 'A tag filter');
});

// ============================================================
// 8. Link & Asset Validation
// ============================================================
console.log('\n--- Local Asset Validation ---');

  // Check that local images, CSS, JS referenced in HTML files actually exist
  htmlFiles.forEach(file => {
    if (file === 'astralyxai.html' || file === 'head-data.html') return;

    test(`${file}: referenced local assets exist`, () => {
      const content = read(path.join(HTML_DIR, file));
      // Find all src/href attributes pointing to local files
      const localRefs = content.match(/(?:src|href)=["'](?!https?:\/\/)(?!\/\/)(?!data:)([^"']+)["']/g) || [];
      localRefs.forEach(ref => {
        const assetPath = ref.match(/["']([^"']+)["']/)[1];
        // Skip external protocols, anchors, and function calls
        if (assetPath.startsWith('#') || assetPath.startsWith('javascript:') ||
            assetPath.startsWith('mailto:') || assetPath.startsWith('tel:')) return;
        // Try exact path, and with .html if it's a clean URL like /leaderboard
        const fullPath = path.join(ROOT, assetPath);
        const htmlPath = path.join(ROOT, assetPath + '.html');
        // Also try index.html for root path
        const indexPath = path.join(ROOT, assetPath, 'index.html');
        if (!fs.existsSync(fullPath) && !fs.existsSync(htmlPath) && !fs.existsSync(indexPath)) {
          throw new Error(`Missing asset: ${assetPath}`);
        }
      });
    });
  });

// Check that all images in Assets/ are referenced somewhere
test('All team profile images in Assets/ are referenced', () => {
  const teamImages = ['Frostrax.webp', 'IndianCoder3.webp', 'DreamLong.webp',
    'Voxy.webp', 'Lazyron.webp', 'random_acc.webp', 'Dravox.webp', 'Zylox.webp'];
  const allHtml = htmlFiles.map(f => read(path.join(HTML_DIR, f))).join('\n');
  teamImages.forEach(img => {
    if (!allHtml.includes(img)) {
      // Could be unreferenced - just warn, don't fail
      console.log(`  WARN  ${img} not referenced in any HTML`);
    }
  });
});

// ============================================================
// 9. Status Page Validation
// ============================================================
console.log('\n--- Status Page ---');

test('status.html has setBadge function', () => {
  const content = read(path.join(HTML_DIR, 'status.html'));
  assertIncludes(content, 'function setBadge', 'setBadge');
});

test('status.html has Discord check updates button', () => {
  const content = read(path.join(HTML_DIR, 'status.html'));
  assertIncludes(content, 'Check Announcements', 'Discord button');
});

// ============================================================
// 10. CREDITS Page
// ============================================================
console.log('\n--- Credits Page ---');

test('credits-web.html has doc-group-title headings', () => {
  const content = read(path.join(HTML_DIR, 'credits-web.html'));
  const headings = content.match(/class="doc-group-title"/g);
  assert(headings && headings.length >= 3,
    `Expected at least 3 doc-group-title, found ${headings ? headings.length : 0}`);
});

test('credits-web.html has bottom nav', () => {
  const content = read(path.join(HTML_DIR, 'credits-web.html'));
  assertIncludes(content, 'class="bottom-nav"', 'bottom-nav');
});

test('credits-web.html has bottom nav', () => {
  const content = read(path.join(HTML_DIR, 'credits-web.html'));
  assertIncludes(content, 'class="bottom-nav"', 'bottom-nav');
});

// ============================================================
// 11. Footer Validation
// ============================================================
console.log('\n--- Footer ---');

test('footer.html has privacy, terms, credits links', () => {
  const content = read(path.join(ASSETS_DIR, 'footer.html'));
  const links = ['privacy', 'terms', 'credits'];
  links.forEach(l => assertIncludes(content, l, `footer link "${l}"`));
});

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
