const NEWS_API_URL = '/news-api';
const FORUM_API_BASE_URL = 'https://api.astralyxpvp.workers.dev';
const DISCORD_CHANNEL_ID = '1477033205017346259';
const REQUEST_TIMEOUT_MS = 60_000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function fetchJson(url, label, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...options.headers }
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function safeId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function getDiscordTitle(message) {
  const heading = String(message.content || '').match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m)?.[1];
  return String(heading || message.embeds?.[0]?.title || '').slice(0, 180);
}

function getDiscordContent(message) {
  return [
    message.content,
    ...(Array.isArray(message.embeds) ? message.embeds.flatMap(embed => [
      embed.title,
      embed.description,
      ...(Array.isArray(embed.fields) ? embed.fields.flatMap(field => [field.name, field.value]) : [])
    ]) : [])
  ].filter(value => typeof value === 'string' && value.trim()).join('\n');
}

async function fetchNewsDirectory(request) {
  const posts = await fetchJson(new URL(NEWS_API_URL, request.url), 'News');
  if (!Array.isArray(posts)) throw new Error('News returned an invalid response');
  return posts.map(post => ({
    id: post.id == null ? null : String(post.id),
    title: String(post.title || 'Untitled'),
    tags: Array.isArray(post.tags) ? post.tags.filter(tag => typeof tag === 'string') : [],
    createdAt: post.created_at || post.createdAt || null,
    updatedAt: post.edited_at || post.editedAt || null
  }));
}

async function fetchForumsDirectory() {
  const categories = await fetchJson(`${FORUM_API_BASE_URL}/api/categories`, 'Forums categories');
  if (!Array.isArray(categories)) throw new Error('Forums categories returned an invalid response');

  const unavailableSections = [];
  const result = categories.map(category => ({
    id: category.id == null ? null : String(category.id),
    name: String(category.name || 'Forums'),
    subcategories: (Array.isArray(category.subcategories) ? category.subcategories : [])
      .map(subcategory => ({
        id: subcategory.id == null ? null : String(subcategory.id),
        name: String(subcategory.name || 'Untitled'),
        description: String(subcategory.description || ''),
        threads: []
      }))
  }));
  const targets = result.flatMap(category =>
    category.subcategories.map(subcategory => ({ category, subcategory }))
  );

  for (let index = 0; index < targets.length; index += 4) {
    const batch = targets.slice(index, index + 4);
    const fetched = await Promise.allSettled(batch.map(async ({ category, subcategory }) => {
      const threads = await fetchJson(
        `${FORUM_API_BASE_URL}/api/subcategories/${encodeURIComponent(subcategory.id)}/threads`,
        `Forums ${category.name} / ${subcategory.name}`
      );
      if (!Array.isArray(threads)) throw new Error('Forum threads returned an invalid response');
      subcategory.threads = threads.map(thread => ({
        id: thread.id == null ? null : String(thread.id),
        title: String(thread.title || 'Untitled'),
        tags: Array.isArray(thread.tags) ? thread.tags.filter(tag => typeof tag === 'string') : [],
        createdAt: thread.createdAt || thread.created_at || null,
        updatedAt: thread.editedAt || thread.edited_at || null
      }));
    }));
    fetched.forEach((result, batchIndex) => {
      if (result.status === 'rejected') {
        const { category, subcategory } = batch[batchIndex];
        unavailableSections.push(`${category.name} / ${subcategory.name}`);
        console.warn('Forum headings could not be loaded.', result.reason);
      }
    });
  }

  return { categories: result, unavailableSections };
}

async function fetchDiscordDirectory(botKey) {
  if (!botKey) throw new Error('Discord bot credential is not configured');
  const messages = await fetchJson(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=50`,
    'Discord Announcements',
    { headers: { Authorization: `Bot ${botKey}` } }
  );
  if (!Array.isArray(messages)) throw new Error('Discord Announcements returned an invalid response');
  return messages.slice(0, 20).map(message => ({
    id: String(message.id || ''),
    title: getDiscordTitle(message) || 'Discord announcement',
    createdAt: message.timestamp || null
  }));
}

async function getDirectory(request, env) {
  const [news, forums, discord] = await Promise.allSettled([
    fetchNewsDirectory(request),
    fetchForumsDirectory(),
    fetchDiscordDirectory(env?.BOT_KEY)
  ]);
  const unavailableSources = [];
  const data = {};

  if (news.status === 'fulfilled') {
    data.news = news.value;
    data.newsTags = [...new Set(news.value.flatMap(post => post.tags))].sort();
  } else {
    data.news = [];
    data.newsTags = [];
    unavailableSources.push('News');
    console.warn('News headings could not be loaded.', news.reason);
  }

  if (forums.status === 'fulfilled') {
    data.forums = forums.value.categories;
    if (forums.value.unavailableSections.length) {
      unavailableSources.push(...forums.value.unavailableSections.map(section => `Forums: ${section}`));
    }
  } else {
    data.forums = [];
    unavailableSources.push('Forums');
    console.warn('Forums headings could not be loaded.', forums.reason);
  }

  if (discord.status === 'fulfilled') {
    data.discord = discord.value;
  } else {
    data.discord = [];
    unavailableSources.push('Discord Announcements');
    console.warn('Discord headings could not be loaded.', discord.reason);
  }

  return jsonResponse({
    ...data,
    checkedAt: new Date().toISOString(),
    checkedSources: [
      ...(news.status === 'fulfilled' ? ['News'] : []),
      ...(forums.status === 'fulfilled' ? ['Forums'] : []),
      ...(discord.status === 'fulfilled' ? ['Discord Announcements'] : [])
    ],
    unavailableSources
  });
}

async function getNewsItem(request, id) {
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    return jsonResponse({ error: 'News item id must be a positive integer' }, 400);
  }
  const item = await fetchJson(
    new URL(`${NEWS_API_URL}?id=${encodeURIComponent(id)}`, request.url),
    'News item'
  );
  return jsonResponse({ ...item, source: 'News' });
}

async function getForumItem(subcategoryId, id) {
  if (!safeId(subcategoryId) || !safeId(id)) {
    return jsonResponse({ error: 'A valid forum subcategory id and thread id are required' }, 400);
  }
  const threads = await fetchJson(
    `${FORUM_API_BASE_URL}/api/subcategories/${encodeURIComponent(subcategoryId)}/threads`,
    'Forum thread lookup'
  );
  if (!Array.isArray(threads)) throw new Error('Forum thread lookup returned an invalid response');
  const thread = threads.find(item => String(item.id || '') === id);
  if (!thread) return jsonResponse({ error: 'Forum thread was not found in that subcategory' }, 404);
  return jsonResponse({ source: 'Forums', subcategoryId, ...thread });
}

async function getDiscordItem(botKey, id) {
  if (!/^\d{15,22}$/.test(id)) {
    return jsonResponse({ error: 'A valid Discord announcement id is required' }, 400);
  }
  if (!botKey) return jsonResponse({ error: 'Discord bot credential is not configured' }, 503);
  const message = await fetchJson(
    `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${encodeURIComponent(id)}`,
    'Discord announcement',
    { headers: { Authorization: `Bot ${botKey}` } }
  );
  return jsonResponse({
    source: 'Discord Announcements',
    id: String(message.id || id),
    title: getDiscordTitle(message) || 'Discord announcement',
    content: getDiscordContent(message),
    createdAt: message.timestamp || null,
    updatedAt: message.edited_timestamp || null
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'catalog';
  const id = url.searchParams.get('id') || '';

  try {
    if (source === 'catalog') return await getDirectory(request, env);
    if (!id) return jsonResponse({ error: 'An item id is required' }, 400);
    if (source === 'news') return await getNewsItem(request, id);
    if (source === 'forums') {
      return await getForumItem(url.searchParams.get('subcategoryId') || '', id);
    }
    if (source === 'discord') return await getDiscordItem(env?.BOT_KEY, id);
    return jsonResponse({ error: 'Source must be catalog, news, forums, or discord' }, 400);
  } catch (error) {
    console.error('Maintenance knowledge lookup failed.', error);
    return jsonResponse({ error: 'The requested source is temporarily unavailable' }, 502);
  }
}
