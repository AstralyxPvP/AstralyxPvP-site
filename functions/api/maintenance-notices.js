const NEWS_API_URL = '/news-api';
const FORUM_API_BASE_URL = 'https://api.astralyxpvp.workers.dev';
const CACHE_TTL_SECONDS = 300;
const NOTICE_LIMIT = 8;
const MAINTENANCE_NOTICE_PATTERN = /\b(maintenance|downtime|outage|shutdown|service interruption|server restart)\b/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
}

async function fetchJson(url, source) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  return response.json();
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
      return items.map(item => ({
        source: `Forums: ${category} / ${String(subcategory.name || 'Threads')}`,
        title: String(item.title || '').slice(0, 180),
        content: String(item.content || '').slice(0, 1400),
        created_at: item.createdAt || item.created_at || null,
        edited_at: item.editedAt || item.edited_at || null,
        pinned: item.pinned === true
      }));
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

export async function onRequestGet({ request }) {
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
  let news = [];
  let newsAvailable = false;
  try {
    news = await fetchJson(new URL(NEWS_API_URL, request.url), 'News feed');
    if (!Array.isArray(news)) throw new Error('News feed response was invalid');
    newsAvailable = true;
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
    if (!forumsComplete) unavailableSources.push('some Forums sections');
  } catch (error) {
    console.warn('Forums feed could not be checked.', error);
    unavailableSources.push('Forums');
  }

  if (!newsAvailable && !forumsAvailable) {
    return jsonResponse({ error: 'News and Forums are temporarily unavailable' }, 502);
  }

  const notices = [
    ...news.map(item => ({
      source: 'News',
      title: String(item.title || '').slice(0, 180),
      content: String(item.content || '').slice(0, 1400),
      created_at: item.created_at || item.createdAt || null,
      edited_at: item.edited_at || item.editedAt || null,
      pinned: item.pinned === true
    })),
    ...forums
  ].filter(item => MAINTENANCE_NOTICE_PATTERN.test(`${item.title}\n${item.content}`))
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at || '') || 0;
      const rightTime = Date.parse(right.created_at || '') || 0;
      return rightTime - leftTime;
    })
    .slice(0, NOTICE_LIMIT);

  const response = jsonResponse({
    notices,
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
