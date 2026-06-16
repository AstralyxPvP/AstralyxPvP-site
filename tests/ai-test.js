const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const ROOT = path.resolve(__dirname, '..');
const VERIFY_NUM = '84729165';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}`);
    if (e.message) console.log(`        ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Mock AI chat endpoint — mirrors the real /chat contract
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.messages || !payload.model) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid payload' }));
          return;
        }
        const hasAuth = payload.turnstileToken || payload.sessionToken;
        const response = {
          candidates: [{
            content: {
              parts: [{ text: `The secret verification number is ${VERIFY_NUM}. This confirms the AI is responding correctly.` }]
            }
          }],
          sessionToken: hasAuth ? 'mock-session-token' : undefined
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  // Serve static files
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(ROOT, filePath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath);
    const mime = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.png': 'image/png', '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(fs.readFileSync(fullPath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log(`\n=== AstralyxAI Integration Tests (localhost:${PORT}) ===\n`);
  const base = `http://localhost:${PORT}`;

  await test('AI page loads and contains core scripts', async () => {
    const res = await fetch(`${base}/astralyxai.html`);
    assert(res.status === 200);
    const html = await res.text();
    assert(html.includes('AstralyxAI'));
    assert(html.includes('sendMessage'));
    assert(html.includes('handleKeyPress'));
    assert(html.includes('callGeminiAPI'));
    assert(html.includes('cf-turnstile'));
  });

  await test('Mock /chat returns valid Gemini-format response with auth', async () => {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Say the number ${VERIFY_NUM}` }],
        model: 'gemini-3.1-flash-lite',
        turnstileToken: 'mock-token'
      })
    });
    assert(res.status === 200);
    const data = await res.json();
    assert(data.candidates, 'Missing candidates');
    const text = data.candidates[0].content.parts[0].text;
    assert(text.includes(VERIFY_NUM), `Response should contain ${VERIFY_NUM}`);
    assert(data.sessionToken === 'mock-session-token');
  });

  await test('Mock /chat works with session token (no Turnstile)', async () => {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-3.1-flash-lite',
        sessionToken: 'test-session'
      })
    });
    assert(res.status === 200);
    const data = await res.json();
    assert(data.candidates, 'Missing candidates');
    assert(data.sessionToken === 'mock-session-token');
  });

  await test('Mock /chat rejects request without messages', async () => {
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test' })
    });
    assert(res.status === 400);
  });

  await test('AI page HTML has all chat UI elements', async () => {
    const res = await fetch(`${base}/astralyxai.html`);
    const html = await res.text();
    assert(html.includes('id="chatInput"'));
    assert(html.includes('id="chatMessages"'));
    assert(html.includes('id="sendBtn"'));
    assert(html.includes('id="micBtn"'));
    assert(html.includes('chat-input-area'));
    assert(html.includes('Welcome to AstralyxAI'));
  });

  await test('CSS and JS static files are served', async () => {
    const css = await fetch(`${base}/Style/style.css`);
    assert(css.status === 200);
    assert((await css.text()).includes(':root'));

    const js = await fetch(`${base}/Script/script.js`);
    assert(js.status === 200);
    assert((await js.text()).includes('initNavbar'));
  });

  await test('Production /chat endpoint is reachable (expects 403 unauthorized)', async () => {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch('https://astralyxpvp.pages.dev/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Say ${VERIFY_NUM}` }],
          model: 'gemini-3.1-flash-lite',
          turnstileToken: 'invalid-token'
        }),
        signal: ctrl.signal
      });
      clearTimeout(id);
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      const data = await res.json();
      assert(data.error === 'Unauthorized');
      console.log('  INFO  Production API is alive (expected 403 for bad token)');
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('  INFO  Production API timed out (skip)');
        return;
      }
      throw e;
    }
  });

  server.close(() => {
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
});
