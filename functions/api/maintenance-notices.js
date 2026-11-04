const NEWS_API_URL = '/news-api';
const FORUM_API_BASE_URL = 'https://api.astralyxpvp.workers.dev';
const DISCORD_ANNOUNCEMENTS_CHANNEL_ID = '1477033205017346259';
const CACHE_TTL_SECONDS = 300;
const SOURCE_FETCH_TIMEOUT_MS = 60_000;
const NEWS_POST_LIMIT = 10;
const FORUM_POST_LIMIT_PER_SUBCATEGORY = 3;
const DISCORD_POST_LIMIT = 20;
const AI_INPUT_POST_LIMIT = 60;

function sortNewestFirst(items) {
  return items.sort((left, right) => {
    const leftTime = Date.parse(left.created_at || '') || 0;
    const rightTime = Date.parse(right.created_at || '') || 0;
    return rightTime - leftTime;
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
}

async function fetchJson(url, source, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...options.headers }
    });
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function discordMessageContent(message) {
  const parts = [message.content];
  for (const embed of Array.isArray(message.embeds) ? message.embeds : []) {
    parts.push(embed.title, embed.description);
    for (const field of Array.isArray(embed.fields) ? embed.fields : []) {
      parts.push(field.name, field.value);
    }
  }
  return parts.filter(value => typeof value === 'string' && value.trim()).join('\n').slice(0, 2400);
}

function discordMessageTitle(message) {
  const content = typeof message.content === 'string' ? message.content : '';
  const heading = content.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m)?.[1];
  return String(heading || message.embeds?.[0]?.title || '').slice(0, 180);
}

async function fetchDiscordNotices(botKey) {
  if (!botKey) throw new Error('Discord bot credential is not configured');

  const messages = await fetchJson(
    `https://discord.com/api/v10/channels/${DISCORD_ANNOUNCEMENTS_CHANNEL_ID}/messages?limit=50`,
    'Discord Announcements',
    { headers: { Authorization: `Bot ${botKey}` } }
  );
  if (!Array.isArray(messages)
    || messages.some(message => !message || typeof message !== 'object' || Array.isArray(message))) {
    throw new Error('Discord Announcements response was invalid');
  }

  return messages.map(message => ({
    source: 'Discord Announcements',
    title: discordMessageTitle(message),
    content: discordMessageContent(message),
    created_at: message.timestamp || null,
    edited_at: message.edited_timestamp || null,
    pinned: message.pinned === true
  }));
}

async function fetchForumNotices() {
  const categories = await fetchJson(`${FORUM_API_BASE_URL}/api/categories`, 'Forums categories');
  if (!Array.isArray(categories)) throw new Error('Forums categories response was invalid');

  const subcategories = categories.flatMap(category =>
    (Array.isArray(category.subcategories) ? category.subcategories : [])
      .map(subcategory => ({
        category: String(category.name || 'Forums'),
        subcategory
      }))
  );
  const threads = [];
  let complete = true;

  for (let index = 0; index < subcategories.length; index += 4) {
    const batch = subcategories.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async ({ category, subcategory }) => {
      const items = await fetchJson(
        `${FORUM_API_BASE_URL}/api/subcategories/${encodeURIComponent(subcategory.id)}/threads`,
        `Forums ${category}/${subcategory.name || 'threads'}`
      );
      if (!Array.isArray(items)) throw new Error('Forum thread response was invalid');
      const posts = items.map(item => ({
        source: `Forums: ${category} / ${String(subcategory.name || 'Threads')}`,
        title: String(item.title || '').slice(0, 180),
        content: String(item.content || '').slice(0, 1400),
        tags: Array.isArray(item.tags)
          ? item.tags.filter(tag => typeof tag === 'string').map(tag => tag.slice(0, 80)).slice(0, 12)
          : [],
        created_at: item.createdAt || item.created_at || null,
        edited_at: item.editedAt || item.edited_at || null,
        pinned: item.pinned === true
      }));
      return sortNewestFirst(posts).slice(0, FORUM_POST_LIMIT_PER_SUBCATEGORY);
    }));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        threads.push(...result.value);
      } else {
        complete = false;
        console.warn('A Forums subcategory could not be checked.', result.reason);
      }
    }
  }

  return {
    notices: threads,
    complete
  };
}

export async function onRequestGet({ request, env }) {
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL('/api/maintenance-notices', request.url));
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (error) {
      console.warn('Maintenance notices cache read failed; refreshing feeds.', error);
    }
  }

  const unavailableSources = [];
  const checkedSources = [];
  let news = [];
  let newsAvailable = false;
  try {
    news = await fetchJson(new URL(NEWS_API_URL, request.url), 'News feed');
    if (!Array.isArray(news)) throw new Error('News feed response was invalid');
    newsAvailable = true;
    checkedSources.push('News');
  } catch (error) {
    console.warn('News feed could not be checked.', error);
    unavailableSources.push('News');
  }

  let forums = [];
  let forumsComplete = false;
  let forumsAvailable = false;
  try {
    const forumResult = await fetchForumNotices();
    forums = forumResult.notices;
    forumsComplete = forumResult.complete;
    forumsAvailable = true;
    checkedSources.push('Forums');
    if (!forumsComplete) unavailableSources.push('some Forums sections');
  } catch (error) {
    console.warn('Forums feed could not be checked.', error);
    unavailableSources.push('Forums');
  }

  let discord = [];
  let discordAvailable = false;
  try {
    discord = await fetchDiscordNotices(env?.BOT_KEY);
    discordAvailable = true;
    checkedSources.push('Discord Announcements');
  } catch (error) {
    console.warn('Discord Announcements could not be checked.', error);
    unavailableSources.push('Discord Announcements');
  }

  if (!newsAvailable && !forumsAvailable && !discordAvailable) {
    return jsonResponse({
      error: 'News, Forums, and Discord Announcements are temporarily unavailable',
      unavailableSources
    }, 502);
  }

  const newsPosts = sortNewestFirst(news.map(item => ({
    source: 'News',
    title: String(item.title || '').slice(0, 180),
    content: String(item.content || '').slice(0, 1400),
    tags: Array.isArray(item.tags)
      ? item.tags.filter(tag => typeof tag === 'string').map(tag => tag.slice(0, 80)).slice(0, 12)
      : [],
    created_at: item.created_at || item.createdAt || null,
    edited_at: item.edited_at || item.editedAt || null,
    pinned: item.pinned === true
  }))).slice(0, NEWS_POST_LIMIT);

  const notices = [
    ...newsPosts,
    ...forums,
    ...discord.slice(0, DISCORD_POST_LIMIT)
  ];

  const recentPosts = sortNewestFirst(notices).slice(0, AI_INPUT_POST_LIMIT);

  const response = jsonResponse({
    notices: recentPosts,
    checkedSources,
    unavailableSources,
    checkedAt: new Date().toISOString()
  });
  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn('Maintenance notices cache write failed.', error);
    }
  }
  return response;
}
