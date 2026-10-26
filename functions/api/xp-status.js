const XP_STATUS_URL = 'https://astralyx-xp-bot.indiancoder3.workers.dev/api/leaderboard?limit=1';
const CACHE_TTL_SECONDS = 60;
const HISTORY_LIMIT = 600;
const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

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
  if (!env.MINECRAFT_STATUS_DB) {
    return jsonResponse({ error: 'Status history database binding is missing' }, 503);
  }

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
  const sampleBucket = Math.floor(Date.now() / SAMPLE_INTERVAL_MS);
  await env.MINECRAFT_STATUS_DB.prepare(`
    INSERT INTO astralyx_xp_status_checks (checked_at, sample_bucket, source, online)
    VALUES (?, ?, 'astralyx-xp', ?)
    ON CONFLICT(sample_bucket) DO UPDATE SET
      checked_at = excluded.checked_at,
      source = excluded.source,
      online = excluded.online
  `).bind(checkedAt, sampleBucket, online === null ? null : Number(online)).run();

  const { results } = await env.MINECRAFT_STATUS_DB.prepare(`
    SELECT checked_at, source, online
    FROM astralyx_xp_status_checks
    WHERE checked_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-48 hours')
    ORDER BY checked_at DESC
    LIMIT ?
  `).bind(HISTORY_LIMIT).all();

  const response = jsonResponse({
    checkedAt,
    source: 'astralyx-xp',
    online,
    history: results.map(row => ({
      checkedAt: row.checked_at,
      source: row.source,
      online: row.online === null ? null : row.online === 1
    }))
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
