import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.crypto ||= webcrypto;

const chatSource = await readFile(new URL('../functions/chat.js', import.meta.url), 'utf8');
const audioSource = await readFile(new URL('../functions/audio.js', import.meta.url), 'utf8');
const chatModule = await import(`data:text/javascript,${encodeURIComponent(chatSource)}`);
const audioModule = await import(`data:text/javascript,${encodeURIComponent(audioSource)}`);

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

test('audio transcription uses only the allowed Flash-Lite model', async t => {
  const secret = 'test-secret';
  const sessionToken = await createSessionToken(secret);
  const originalFetch = globalThis.fetch;
  let calledUrl;
  globalThis.fetch = async input => {
    calledUrl = String(input);
    return response({ candidates: [{ content: { parts: [{ text: 'Hello there.' }] } }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await chatModule.onRequestPost({
    request: new Request('https://site.test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        model: 'unsupported-model',
        transcribeAudio: 'AAAA',
        mimeType: 'audio/webm'
      })
    }),
    env: { TURNSTILE_SECRET_KEY: secret, GEMINI_API_KEY: 'test-key' }
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.match(calledUrl, /models\/gemini-2\.5-flash-lite:generateContent/);
  assert.equal(body.transcription, 'Hello there.');
});

test('realtime audio is explicitly unavailable rather than invoking a disallowed model', async () => {
  const secret = 'test-secret';
  const sessionToken = await createSessionToken(secret);
  const result = await audioModule.onRequest({
    request: new Request(`https://site.test/api/audio?sessionToken=${encodeURIComponent(sessionToken)}`, {
      headers: { Upgrade: 'websocket' }
    }),
    env: { TURNSTILE_SECRET_KEY: secret }
  });
  const body = await result.json();

  assert.equal(result.status, 503);
  assert.match(body.error, /outside the configured Gemma and Flash-Lite set/);
  assert.doesNotMatch(audioSource, /models\/gemini-[^"]*(?:flash(?!-lite)|pro)/i);
});
