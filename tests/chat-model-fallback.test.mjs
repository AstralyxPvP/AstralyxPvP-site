import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.crypto ||= webcrypto;

const chatSource = await readFile(new URL('../functions/chat.js', import.meta.url), 'utf8');
const chatModule = await import(`data:text/javascript,${encodeURIComponent(chatSource)}`);

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createSessionToken(secret) {
  const data = `session_${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const hash = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${data}.${hash}`;
}

test('website chat retries a fallback model after a model rate limit', async t => {
  const secret = 'test-secret';
  const sessionToken = await createSessionToken(secret);
  const modelUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    modelUrls.push(url);
    if (modelUrls.length === 1) return response({ error: { message: 'Quota exceeded' } }, 429);
    return response({ candidates: [{ content: { parts: [{ text: 'The server is coming soon.' }] } }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await chatModule.onRequestPost({
    request: new Request('https://site.test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'When is the server coming?' }],
        model: 'unsupported-model',
        sessionToken
      })
    }),
    env: { TURNSTILE_SECRET_KEY: secret, GEMINI_API_KEY: 'test-key' }
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(modelUrls.length, 2);
  assert.match(modelUrls[0], /gemma-3-27b-it/);
  assert.match(modelUrls[1], /gemma-3-4b-it/);
  assert.ok(modelUrls.every(url => /\/models\/(?:gemma-3-(?:27|4)b-it|gemini-(?:3\.1|2\.5)-flash-lite):/.test(url)));
  assert.equal(body.candidates[0].content.parts[0].text, 'The server is coming soon.');
});
