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

async function fetchStatus(statusMonitor) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await statusMonitor.fetch('https://status-monitor/api/minecraft-status', {
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Direct Minecraft status ping returned HTTP ${response.status}`);
    const payload = await response.json();
    if (typeof payload.online !== 'boolean') {
      throw new Error('Direct Minecraft status ping returned an invalid status');
    }

    return {
      source: 'java-server-ping',
      payload,
      online: payload.online,
      playersOnline: Number.isFinite(payload.players?.online) ? payload.players.online : null,
      playersMax: Number.isFinite(payload.players?.max) ? payload.players.max : null,
      version: typeof payload.version === 'string' ? payload.version : null,
      motd: typeof payload.motd === 'string' ? payload.motd : '',
      error: typeof payload.error === 'string' ? payload.error : null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet({ request, env }) {
  const statusDb = env.MINECRAFT_STATUS_DB;
  const statusMonitor = env.STATUS_MONITOR;
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL('/api/minecraft-status', request.url));
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch (error) {
      console.warn('Minecraft status cache read failed; querying upstream.', error);
    }
  }

  let status;
  try {
    if (!statusMonitor?.fetch) throw new Error('Direct Minecraft status worker binding is not configured');
    status = await fetchStatus(statusMonitor);
  } catch (error) {
    console.error('Direct Minecraft status ping failed.', error);
    return jsonResponse({ error: 'Minecraft status is temporarily unavailable' }, 502);
  }

  const checkedAt = new Date().toISOString();
  let id = null;
  let history = [];
  if (statusDb) {
    const { results } = await statusDb.prepare(`
      SELECT checked_at, source, online, players_online, players_max, version
      FROM minecraft_status_checks
      WHERE checked_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-48 hours')
      ORDER BY checked_at DESC
      LIMIT ?
    `).bind(HISTORY_LIMIT).all();
    history = results.map(row => ({
      checkedAt: row.checked_at,
      source: row.source,
      online: row.online === 1,
      players: {
        online: row.players_online,
        max: row.players_max
      },
      version: row.version
    }));
  } else {
    console.error('Minecraft status history is disabled: database binding is missing.');
  }

  const response = jsonResponse({
    id,
    checkedAt,
    source: status.source,
    online: status.online,
    motd: status.motd,
    error: status.error,
    players: {
      online: status.playersOnline,
      max: status.playersMax
    },
    version: status.version,
    historyAvailable: Boolean(statusDb),
    history: Array.isArray(status.payload.history) && status.payload.history.length > 0
      ? status.payload.history
      : history
  });

  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn('Minecraft status cache write failed.', error);
    }
  }
  return response;
}
