const XP_STATUS_URL = 'https://astralyx-xp-bot.indiancoder3.workers.dev/api/leaderboard?limit=1';
const CACHE_TTL_SECONDS = 60;
const HISTORY_LIMIT = 600;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
}

export async function onRequestGet({ request, env }) {
  const statusDb = env.MINECRAFT_STATUS_DB;
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL('/api/xp-status', request.url));
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (error) {
      console.warn('AstralyxXP status cache read failed; querying upstream.', error);
    }
  }

  let online = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(XP_STATUS_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`AstralyxXP API returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.leaderboard)) {
      throw new Error('AstralyxXP API returned an invalid leaderboard response');
    }
    online = true;
  } catch (error) {
    console.warn('AstralyxXP status is unavailable; recording an unknown check.', error);
  } finally {
    clearTimeout(timeout);
  }

  const checkedAt = new Date().toISOString();
  let history = [];
  if (statusDb) {
    const { results } = await statusDb.prepare(`
      SELECT checked_at, source, online
      FROM astralyx_xp_status_checks
      WHERE checked_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-48 hours')
      ORDER BY checked_at DESC
      LIMIT ?
    `).bind(HISTORY_LIMIT).all();
    history = results.map(row => ({
      checkedAt: row.checked_at,
      source: row.source,
      online: row.online === null ? null : row.online === 1
    }));
  } else {
    console.error('AstralyxXP status history is disabled: database binding is missing.');
  }

  const response = jsonResponse({
    checkedAt,
    source: 'astralyx-xp',
    online,
    historyAvailable: Boolean(statusDb),
    history
  });

  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn('AstralyxXP status cache write failed.', error);
    }
  }
  return response;
}
