import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../functions/api/minecraft-status.js', import.meta.url), 'utf8');
const statusApi = await import(`data:text/javascript,${encodeURIComponent(source)}`);

function databaseBinding() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async all() { return { results: [] }; }
      };
    }
  };
}

test('Pages status API uses the direct Java ping service binding and reports its result', async () => {
  let calledUrl;
  const result = await statusApi.onRequestGet({
    request: new Request('https://site.test/api/minecraft-status'),
    env: {
      MINECRAFT_STATUS_DB: databaseBinding(),
      STATUS_MONITOR: {
        async fetch(input) {
          calledUrl = String(input);
          return Response.json({
            checkedAt: '2026-10-28T15:00:00.000Z',
            source: 'java-server-ping',
            online: false,
            players: { online: null, max: null },
            version: null,
            motd: '',
            error: 'Minecraft status ping timed out',
            historyAvailable: true,
            history: []
          });
        }
      }
    }
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(calledUrl, 'https://status-monitor/api/minecraft-status');
  assert.equal(body.source, 'java-server-ping');
  assert.equal(body.online, false);
  assert.equal(body.error, 'Minecraft status ping timed out');
  assert.equal(body.historyAvailable, true);
});

test('Pages status API reports missing direct-ping binding rather than calling an external status vendor', async t => {
  t.mock.method(console, 'error', () => {});
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('External fetch must not be used by Minecraft status');
  };
  try {
    const result = await statusApi.onRequestGet({
      request: new Request('https://site.test/api/minecraft-status'),
      env: {}
    });
    const body = await result.json();

    assert.equal(result.status, 502);
    assert.match(body.error, /temporarily unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
