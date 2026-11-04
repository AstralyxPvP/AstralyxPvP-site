import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const lookupSource = await readFile(new URL('../functions/api/maintenance-lookup.js', import.meta.url), 'utf8');
const lookupModule = await import(`data:text/javascript,${encodeURIComponent(lookupSource)}`);

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function context(url, env = { BOT_KEY: 'test-token' }) {
  return { request: new Request(url), env };
}

test('knowledge catalog lists every news heading, forum hierarchy/thread heading, and recent Discord heading', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    calls.push({ url, options });
    if (url.endsWith('/news-api')) {
      return response([
        { id: 21, title: 'Release update', tags: ['Release'], created_at: '2030-01-03' },
        { id: 22, title: 'Patch notes', tags: ['Release', 'Patch'], created_at: '2030-01-02' }
      ]);
    }
    if (url.endsWith('/api/categories')) {
      return response([{
        id: 'cat1',
        name: 'Announcements',
        subcategories: [
          { id: 'sub1', name: 'Game Updates', description: 'Game news' },
          { id: 'sub2', name: 'Guides', description: '' }
        ]
      }]);
    }
    if (url.endsWith('/api/subcategories/sub1/threads')) {
      return response([{ id: 'thread1', title: 'Server opening', content: 'Full thread' }]);
    }
    if (url.endsWith('/api/subcategories/sub2/threads')) {
      return response([{ id: 'thread2', title: 'Combat guide', content: 'Full guide' }]);
    }
    if (url.includes('discord.com/api/v10/channels/')) {
      assert.equal(options.headers.Authorization, 'Bot test-token');
      return response([{
        id: '123456789012345678',
        content: '# Launch news\nDetails in the announcement',
        timestamp: '2030-01-01T10:00:00.000Z'
      }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await lookupModule.onRequestGet(context('https://site.test/api/maintenance-lookup?source=catalog'));
  const data = await result.json();

  assert.equal(result.status, 200);
  assert.deepEqual(data.news.map(item => item.title), ['Release update', 'Patch notes']);
  assert.deepEqual(data.newsTags, ['Patch', 'Release']);
  assert.equal(data.forums[0].name, 'Announcements');
  assert.deepEqual(data.forums[0].subcategories.map(item => item.name), ['Game Updates', 'Guides']);
  assert.deepEqual(data.forums[0].subcategories.flatMap(item => item.threads.map(thread => thread.title)), [
    'Server opening',
    'Combat guide'
  ]);
  assert.equal(data.discord[0].title, 'Launch news');
  assert.deepEqual(data.checkedSources, ['News', 'Forums', 'Discord Announcements']);
  assert.deepEqual(data.unavailableSources, []);
  assert.equal(calls.length, 5);
});

test('knowledge lookup returns full content for a selected News item', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.equal(String(input), 'https://site.test/news-api?id=21');
    return response({ id: 21, title: 'Release update', content: 'Full News article text.' });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await lookupModule.onRequestGet(context(
    'https://site.test/api/maintenance-lookup?source=news&id=21'
  ));
  const data = await result.json();

  assert.equal(result.status, 200);
  assert.equal(data.source, 'News');
  assert.equal(data.content, 'Full News article text.');
});

test('knowledge lookup fetches and returns the selected full Forum thread', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.equal(String(input), 'https://api.astralyxpvp.workers.dev/api/subcategories/sub1/threads');
    return response([
      { id: 'thread1', title: 'Server opening', content: 'Full thread content and details.' },
      { id: 'thread2', title: 'Another thread', content: 'Other content.' }
    ]);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await lookupModule.onRequestGet(context(
    'https://site.test/api/maintenance-lookup?source=forums&subcategoryId=sub1&id=thread1'
  ));
  const data = await result.json();

  assert.equal(result.status, 200);
  assert.equal(data.title, 'Server opening');
  assert.equal(data.content, 'Full thread content and details.');
  assert.equal(data.subcategoryId, 'sub1');
});

test('knowledge lookup fetches the selected full Discord announcement', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    assert.equal(
      String(input),
      'https://discord.com/api/v10/channels/1477033205017346259/messages/123456789012345678'
    );
    assert.equal(options.headers.Authorization, 'Bot test-token');
    return response({
      id: '123456789012345678',
      content: '# Launch status\nThe server release is delayed.',
      timestamp: '2030-01-03T10:00:00.000Z'
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await lookupModule.onRequestGet(context(
    'https://site.test/api/maintenance-lookup?source=discord&id=123456789012345678'
  ));
  const data = await result.json();

  assert.equal(result.status, 200);
  assert.equal(data.source, 'Discord Announcements');
  assert.equal(data.title, 'Launch status');
  assert.match(data.content, /server release is delayed/i);
});

test('knowledge lookup validates IDs and reports unknown Forum threads', async t => {
  const invalid = await lookupModule.onRequestGet(context(
    'https://site.test/api/maintenance-lookup?source=forums&subcategoryId=bad%2Fpath&id=thread1'
  ));
  assert.equal(invalid.status, 400);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response([]);
  t.after(() => { globalThis.fetch = originalFetch; });
  const missing = await lookupModule.onRequestGet(context(
    'https://site.test/api/maintenance-lookup?source=forums&subcategoryId=sub1&id=missing'
  ));
  assert.equal(missing.status, 404);
});
