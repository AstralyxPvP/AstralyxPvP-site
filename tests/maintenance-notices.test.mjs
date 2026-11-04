import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const noticesPath = new URL('../functions/api/maintenance-notices.js', import.meta.url);
const noticesSource = await readFile(noticesPath, 'utf8');
const noticesModule = await import(`data:text/javascript,${encodeURIComponent(noticesSource)}`);

async function loadSummaryModule() {
  const noticesUrl = `data:text/javascript,${encodeURIComponent(noticesSource)}`;
  const summaryPath = new URL('../functions/api/maintenance-summary.js', import.meta.url);
  const summarySource = (await readFile(summaryPath, 'utf8'))
    .replace("'./maintenance-notices.js'", JSON.stringify(noticesUrl));
  return import(`data:text/javascript,${encodeURIComponent(summarySource)}`);
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installFeedFetch(t, { news = [], categories = [], threads = [], discord = [] } = {}) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    requests.push({ url, options });
    if (url.endsWith('/news-api')) return response(news);
    if (url.endsWith('/api/categories')) return response(categories);
    if (url.includes('/api/subcategories/')) return response(threads);
    if (url.includes('discord.com/api/v10/channels/')) return response(discord);
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  return requests;
}

function requestContext(env = { BOT_KEY: 'test-token' }) {
  return {
    request: new Request('https://site.test/api/maintenance-notices'),
    env
  };
}

test('maintenance feed returns the newest posts from all feeds for semantic AI review', async t => {
  const requests = installFeedFetch(t, {
    news: [{ title: 'We are addressing this', content: 'We expect to resolve it by October 28.', created_at: '2030-05-01T10:00:00.000Z' }],
    categories: [{ name: 'News', subcategories: [{ id: 'web-updates', name: 'Web Updates' }] }],
    threads: [{ title: 'Release notes', content: 'The site changes are now live.', createdAt: '2030-05-01T09:00:00.000Z' }],
    discord: [
      {
        content: '',
        timestamp: '2030-05-01T12:00:00.000Z',
        embeds: [{ title: 'Planned maintenance', description: 'Downtime starts May 4.' }]
      },
      {
        content: 'Community event this weekend.',
        timestamp: '2030-05-01T11:00:00.000Z'
      }
    ]
  });
  const timeoutDelays = [];
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    timeoutDelays.push(delay);
    return originalSetTimeout(callback, delay, ...args);
  });

  const result = await noticesModule.onRequestGet(requestContext());
  const body = await result.json();
  const discordRequest = requests.find(item => item.url.includes('discord.com/'));

  assert.equal(result.status, 200);
  assert.deepEqual(body.checkedSources, ['News', 'Forums', 'Discord Announcements']);
  assert.deepEqual(body.unavailableSources, []);
  assert.equal(body.notices.length, 4);
  assert.ok(body.notices.some(item => item.source === 'News' && item.title === 'We are addressing this'));
  assert.ok(body.notices.some(item => item.source === 'Forums: News / Web Updates'));
  assert.ok(body.notices.some(item => item.source === 'Discord Announcements' && item.title === 'Planned maintenance'));
  assert.equal(body.notices[0].source, 'Discord Announcements');
  assert.match(discordRequest.url, /\/channels\/1477033205017346259\/messages\?limit=50$/);
  assert.equal(discordRequest.options.headers.Authorization, 'Bot test-token');
  assert.equal(JSON.stringify(body).includes('test-token'), false);
  assert.equal(requests.length, 4);
  assert.equal(timeoutDelays.length, requests.length);
  assert.ok(timeoutDelays.every(delay => delay === 60_000));
  assert.ok(requests.every(item => item.options.signal instanceof AbortSignal));
});

test('maintenance feed includes the 20 newest Discord announcements with their headings', async t => {
  const discord = Array.from({ length: 25 }, (_, index) => {
    const announcementNumber = 25 - index;
    return {
      content: `# Announcement ${announcementNumber}\nDetails for announcement ${announcementNumber}.`,
      timestamp: new Date(Date.UTC(2030, 4, 1, announcementNumber)).toISOString()
    };
  });
  installFeedFetch(t, {
    news: [],
    categories: [],
    threads: [],
    discord
  });

  const response = await noticesModule.onRequestGet(requestContext());
  const body = await response.json();
  const discordNotices = body.notices.filter(item => item.source === 'Discord Announcements');

  assert.equal(response.status, 200);
  assert.equal(discordNotices.length, 20);
  assert.equal(discordNotices[0].title, 'Announcement 25');
  assert.ok(discordNotices.some(item => item.title === 'Announcement 6'));
  assert.ok(discordNotices.every(item => item.content.includes('Details for announcement')));
});

test('a source request is aborted when its 60-second timeout expires', async t => {
  t.mock.method(console, 'warn', () => {});
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    timers.push({ callback, delay });
    return timers.length;
  });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith('/news-api')) return response([]);
    if (url.endsWith('/api/categories')) return response([]);
    if (url.includes('discord.com/api/v10/channels/')) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const resultPromise = noticesModule.onRequestGet(requestContext());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timers.length, 3);
  assert.ok(timers.every(timer => timer.delay === 60_000));

  timers[2].callback();
  const result = await resultPromise;
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.deepEqual(body.checkedSources, ['News', 'Forums']);
  assert.deepEqual(body.unavailableSources, ['Discord Announcements']);
});

test('Discord failure is reported without hiding available News and Forums', async t => {
  t.mock.method(console, 'warn', () => {});
  const requests = installFeedFetch(t, {
    news: [],
    categories: [{ name: 'General', subcategories: [{ id: 'updates', name: 'Updates' }] }],
    threads: [],
    discord: []
  });
  const discordRequest = requests;
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, options = {}) => {
    if (String(input).includes('discord.com/')) {
      discordRequest.push({ url: String(input), options });
      return response({ message: 'Unavailable' }, 503);
    }
    return originalFetch(input, options);
  };

  const result = await noticesModule.onRequestGet(requestContext());
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.deepEqual(body.checkedSources, ['News', 'Forums']);
  assert.deepEqual(body.unavailableSources, ['Discord Announcements']);
  assert.deepEqual(body.notices, []);
});

test('missing Discord credentials are reported and all-source failure returns 502', async t => {
  t.mock.method(console, 'warn', () => {});
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/news-api')) return response({ error: 'unavailable' }, 503);
    if (url.endsWith('/api/categories')) return response({ error: 'unavailable' }, 503);
    throw new Error(`Unexpected request without Discord credentials: ${url}`);
  };
  const result = await noticesModule.onRequestGet(requestContext({}));
  const body = await result.json();

  assert.equal(result.status, 502);
  assert.deepEqual(body.unavailableSources, ['News', 'Forums', 'Discord Announcements']);
  assert.equal(body.error, 'News, Forums, and Discord Announcements are temporarily unavailable');
});

test('malformed Discord payload is marked unavailable instead of being treated as an empty feed', async t => {
  t.mock.method(console, 'warn', () => {});
  const requests = installFeedFetch(t, {
    news: [],
    categories: [],
    discord: { message: 'Unexpected object response' }
  });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, options = {}) => {
    if (String(input).includes('discord.com/')) {
      requests.push({ url: String(input), options });
      return response({ message: 'Unexpected object response' });
    }
    return originalFetch(input, options);
  };

  const result = await noticesModule.onRequestGet(requestContext());
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.deepEqual(body.checkedSources, ['News', 'Forums']);
  assert.deepEqual(body.unavailableSources, ['Discord Announcements']);
});

test('summary asks AI to assess recent News, Forums, and Discord posts by meaning', async t => {
  const summaryModule = await loadSummaryModule();
  let modelRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith('/api/minecraft-status')) {
      return response({ online: true, checkedAt: '2030-05-01T12:15:00.000Z', history: [] });
    }
    if (url.endsWith('/news-api')) {
      return response([{
        title: 'We are addressing this',
        content: 'We expect to resolve it by October 28.',
        tags: ['Web'],
        created_at: '2030-05-01T12:00:00.000Z'
      }]);
    }
    if (url.endsWith('/api/categories')) {
      return response([{ name: 'News', subcategories: [{ id: 'web-updates', name: 'Web Updates' }] }]);
    }
    if (url.includes('/api/subcategories/')) {
      return response([{
        title: 'Release notes',
        content: 'The site changes are now live.',
        createdAt: '2030-05-01T11:00:00.000Z'
      }]);
    }
    if (url.includes('discord.com/api/v10/channels/')) {
      assert.equal(options.headers.Authorization, 'Bot test-token');
      return response([{
        content: 'Our web services are experiencing bugs. Target resolution October 28.',
        timestamp: '2030-05-01T10:00:00.000Z'
      }]);
    }
    if (url.includes('generativelanguage.googleapis.com/')) {
      modelRequest = JSON.parse(options.body);
      return response({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          summary: 'The Minecraft server downtime is currently planned for October 28, pending confirmation from upcoming maintenance updates.',
          details: 'The Minecraft server downtime is currently planned for October 28, pending confirmation from upcoming maintenance updates. Please check the latest updates for more information. This extra sentence should be omitted.',
          minecraftInsight: 'The Minecraft Java server is responding normally.',
          expectedResolution: null
        }) }] } }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await summaryModule.onRequestGet({
    request: new Request('https://site.test/api/maintenance-summary'),
    env: { BOT_KEY: 'test-token', GEMINI_API_KEY: 'test-gemini-key' }
  });
  const body = await result.json();
  const prompt = modelRequest.contents[0].parts[0].text;

  assert.equal(result.status, 200);
  assert.match(body.summary, /October 28/);
  assert.ok(body.summary.split(/\s+/).length <= 14);
  assert.equal(body.details.split(/(?<=[.!?…])\s+/).length, 2);
  assert.ok(body.details.split(/(?<=[.!?…])\s+/).every(sentence => sentence.split(/\s+/).length <= 14));
  assert.deepEqual(body.checkedSources, ['News', 'Forums', 'Discord Announcements']);
  assert.deepEqual(body.unavailableSources, []);
  assert.match(prompt, /Discord Announcements/);
  assert.match(prompt, /We are addressing this/);
  assert.match(prompt, /Our web services are experiencing bugs/);
  assert.match(prompt, /Release notes/);
  assert.match(modelRequest.systemInstruction.parts[0].text, /player-facing Minecraft server status update, not a website incident report/);
  assert.match(prompt, /Checked announcement sources: \["News","Forums","Discord Announcements"\]/);
  assert.match(prompt, new RegExp(`Current UTC timestamp: ${new Date().getUTCFullYear()}-`));
  assert.match(prompt, /Live Minecraft Java status and recent history: {"online":true/);
  assert.deepEqual(JSON.parse(prompt.match(/Unavailable announcement sources: (\[[^\n]*\])/)[1]), []);
  assert.equal(body.checkedSources.length, 3);
});

test('summary tells the AI when Discord could not be checked', async t => {
  t.mock.method(console, 'warn', () => {});
  const summaryModule = await loadSummaryModule();
  let modelRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith('/api/minecraft-status')) {
      return response({ online: false, checkedAt: '2030-06-01T00:00:00.000Z', history: [] });
    }
    if (url.endsWith('/news-api')) {
      return response([{ title: 'Scheduled maintenance', content: 'Maintenance begins June 4, 2030.' }]);
    }
    if (url.endsWith('/api/categories')) return response([]);
    if (url.includes('discord.com/api/v10/channels/')) return response({ message: 'Unavailable' }, 503);
    if (url.includes('generativelanguage.googleapis.com/')) {
      modelRequest = JSON.parse(options.body);
      return response({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          summary: 'News reports scheduled maintenance on June 4.',
          details: 'News reports scheduled maintenance on June 4. Discord announcements could not be checked.',
          minecraftInsight: 'The server is offline; notices do not identify a confirmed cause.',
          expectedResolution: null
        }) }] } }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await summaryModule.onRequestGet({
    request: new Request('https://site.test/api/maintenance-summary'),
    env: { BOT_KEY: 'test-token', GEMINI_API_KEY: 'test-gemini-key' }
  });
  const body = await result.json();
  const prompt = modelRequest.contents[0].parts[0].text;

  assert.equal(result.status, 200);
  assert.deepEqual(body.checkedSources, ['News', 'Forums']);
  assert.deepEqual(body.unavailableSources, ['Discord Announcements']);
  assert.match(prompt, /Unavailable announcement sources: \["Discord Announcements"\]/);
});

test('summary retries another AI model after a network failure', async t => {
  t.mock.method(console, 'warn', () => {});
  const summaryModule = await loadSummaryModule();
  const modelUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/api/minecraft-status')) {
      return response({ online: true, checkedAt: new Date().toISOString(), history: [] });
    }
    if (url.endsWith('/news-api')) return response([]);
    if (url.endsWith('/api/categories')) return response([]);
    if (url.includes('discord.com/api/v10/channels/')) return response([]);
    if (url.includes('generativelanguage.googleapis.com/')) {
      modelUrls.push(url);
      if (modelUrls.length === 1) throw new Error('Temporary model connection failure');
      return response({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          summary: 'No active maintenance has been announced.',
          details: 'No active maintenance has been announced. The Java server is responding normally.',
          minecraftInsight: 'The Java server is responding normally.',
          expectedResolution: null
        }) }] } }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await summaryModule.onRequestGet({
    request: new Request('https://site.test/api/maintenance-summary'),
    env: { BOT_KEY: 'test-token', GEMINI_API_KEY: 'test-gemini-key' }
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(modelUrls.length, 2);
  assert.match(modelUrls[0], /gemma-3-27b-it/);
  assert.match(modelUrls[1], /gemma-3-4b-it/);
  assert.ok(modelUrls.every(url => /\/models\/(?:gemma-3-(?:27|4)b-it|gemini-(?:3\.1|2\.5)-flash-lite):/.test(url)));
  assert.match(body.summary, /No active maintenance/);
});

test('summary stays truthful when every configured AI model is rate-limited', async t => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const summaryModule = await loadSummaryModule();
  const modelUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/api/minecraft-status')) return response({ online: false, error: 'No response' });
    if (url.endsWith('/news-api')) return response([]);
    if (url.endsWith('/api/categories')) return response([]);
    if (url.includes('discord.com/api/v10/channels/')) return response([]);
    if (url.includes('generativelanguage.googleapis.com/')) {
      modelUrls.push(url);
      return response({ error: { message: 'Quota exceeded' } }, 429);
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await summaryModule.onRequestGet({
    request: new Request('https://site.test/api/maintenance-summary'),
    env: { BOT_KEY: 'test-token', GEMINI_API_KEY: 'test-gemini-key' }
  });
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(modelUrls.length, 4);
  assert.equal(body.aiAvailable, false);
  assert.equal(body.expectedResolution, null);
  assert.equal(body.summary, 'Minecraft server is offline.');
  assert.match(body.details, /AI announcement analysis is temporarily unavailable/);
  assert.doesNotMatch(body.summary, /website|web services/i);
});

test('a newer server launch announcement supersedes unrelated website incident details', async t => {
  const summaryModule = await loadSummaryModule();
  let modelRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith('/api/minecraft-status')) {
      return response({
        online: false,
        checkedAt: '2026-10-28T15:00:00.000Z',
        history: [{ checkedAt: '2026-10-28T15:00:00.000Z', online: false }]
      });
    }
    if (url.endsWith('/news-api')) {
      return response([{
        title: 'Web services are experiencing bugs',
        content: 'Several website features are affected.',
        created_at: '2026-10-26 16:37:33'
      }]);
    }
    if (url.endsWith('/api/categories')) return response([]);
    if (url.includes('discord.com/api/v10/channels/')) {
      return response([{
        content: '# ✅ ASTRALYXPVP WEB SERVICES BACK!\n\nThe website issues are fixed. The Minecraft server release is delayed until 2nd November, 2026.',
        timestamp: '2026-10-28T14:54:16.410Z'
      }]);
    }
    if (url.includes('generativelanguage.googleapis.com/')) {
      modelRequest = JSON.parse(options.body);
      return response({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          summary: 'The server release is delayed until November 2, 2026.',
          details: 'The Minecraft server release is delayed until November 2, 2026. The server is not responding yet.',
          minecraftInsight: 'The Minecraft Java server is not responding yet; its latest announced release date is November 2, 2026.',
          expectedResolution: 'November 2, 2026'
        }) }] } }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await summaryModule.onRequestGet({
    request: new Request('https://site.test/api/maintenance-summary'),
    env: { BOT_KEY: 'test-token', GEMINI_API_KEY: 'test-gemini-key' }
  });
  const body = await result.json();
  const prompt = modelRequest.contents[0].parts[0].text;
  const instructions = modelRequest.systemInstruction.parts[0].text;

  assert.equal(result.status, 200);
  assert.match(body.summary, /server release is delayed until November 2, 2026/i);
  assert.match(body.details, /Minecraft server release is delayed until November 2, 2026/i);
  assert.doesNotMatch(body.summary, /website|site UI|web services/i);
  assert.doesNotMatch(body.minecraftInsight, /website|site UI|web services/i);
  assert.equal(body.expectedResolution, 'November 2, 2026');
  assert.ok(prompt.indexOf('2026-10-28T14:54:16.410Z')
    < prompt.indexOf('2026-10-26 16:37:33'));
  assert.match(instructions, /newer resolution or cancellation supersedes older reports/i);
  assert.match(prompt, /Minecraft server release is delayed until 2nd November, 2026/);
  assert.match(prompt, /Web services are experiencing bugs/);
  assert.match(prompt, /Current UTC timestamp:/);
  assert.match(prompt, /Live Minecraft Java status and recent history: {"online":false/);
});
