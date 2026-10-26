const PRIMARY_STATUS_URL = 'https://api.mcstatus.io/v2/status/java/play.astralyxpvp.org';
const BACKUP_STATUS_URL = 'https://astralyxpvp.chessmrbeaston.workers.dev/api/?serverStatus=true';
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

async function fetchStatus(url, source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
    const payload = await response.json();
    if (typeof payload.online !== 'boolean') {
      throw new Error(`${source} returned an invalid status`);
    }

    const playersOnline = source === 'mcstatus.io' ? payload.players?.online : payload.current;
    const playersMax = source === 'mcstatus.io' ? payload.players?.max : payload.max;

    return {
      source,
      payload,
      online: payload.online,
      playersOnline: Number.isFinite(playersOnline) ? playersOnline : null,
      playersMax: Number.isFinite(playersMax) ? playersMax : null,
      version: typeof payload.version === 'string'
        ? payload.version
        : payload.version?.name_clean || payload.version?.name_raw || payload.version?.name || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.MINECRAFT_STATUS_DB) {
    return jsonResponse({ error: 'Minecraft status database binding is missing' }, 503);
  }

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
    status = await fetchStatus(PRIMARY_STATUS_URL, 'mcstatus.io');
    if (!status.online) {
      try {
        status = await fetchStatus(BACKUP_STATUS_URL, 'backup');
      } catch (backupError) {
        console.warn('Backup Minecraft status API failed; retaining mcstatus.io result.', backupError);
      }
    }
  } catch (primaryError) {
    console.warn('Primary Minecraft status API failed; trying backup.', primaryError);
    try {
      status = await fetchStatus(BACKUP_STATUS_URL, 'backup');
    } catch (backupError) {
      console.error('Both Minecraft status APIs failed.', backupError);
      return jsonResponse({ error: 'Minecraft status is temporarily unavailable' }, 502);
    }
  }

  const checkedAt = new Date().toISOString();
  const stored = await env.MINECRAFT_STATUS_DB.prepare(`
    INSERT INTO minecraft_status_checks
      (checked_at, source, online, players_online, players_max, version)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    checkedAt,
    status.source,
    status.online ? 1 : 0,
    status.playersOnline,
    status.playersMax,
    status.version
  ).run();

  const { results } = await env.MINECRAFT_STATUS_DB.prepare(`
    SELECT checked_at, source, online, players_online, players_max, version
    FROM minecraft_status_checks
    WHERE checked_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-48 hours')
    ORDER BY checked_at DESC
    LIMIT ?
  `).bind(HISTORY_LIMIT).all();

  const response = jsonResponse({
    id: stored.meta?.last_row_id ?? null,
    checkedAt,
    source: status.source,
    online: status.online,
    players: {
      online: status.playersOnline,
      max: status.playersMax
    },
    version: status.version,
    history: results.map(row => ({
      checkedAt: row.checked_at,
      source: row.source,
      online: row.online === 1,
      players: {
        online: row.players_online,
        max: row.players_max
      },
      version: row.version
    }))
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
