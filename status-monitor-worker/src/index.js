import { connect } from 'cloudflare:sockets';
import { getMotdText, pingMinecraftServer, resolveMinecraftSrv } from './minecraft-ping.js';

const XP_STATUS_URL = 'https://astralyx-xp-bot.indiancoder3.workers.dev/api/leaderboard?limit=1';
const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const MINECRAFT_HOST = 'play.astralyxpvp.org';

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getMinecraftStatus() {
  let target;
  try {
    target = await resolveMinecraftSrv(MINECRAFT_HOST);
  } catch (error) {
    return {
      source: 'java-server-ping',
      online: null,
      playersOnline: null,
      playersMax: null,
      version: null,
      motd: '',
      error: error instanceof Error ? error.message : 'Minecraft SRV lookup failed'
    };
  }

  try {
    const payload = await pingMinecraftServer({
      ...target,
      serverAddress: MINECRAFT_HOST,
      connect
    });
    return {
      source: 'java-server-ping',
      online: true,
      playersOnline: Number.isFinite(payload.players?.online) ? payload.players.online : null,
      playersMax: Number.isFinite(payload.players?.max) ? payload.players.max : null,
      version: typeof payload.version?.name === 'string' ? payload.version.name : null,
      motd: getMotdText(payload.description),
      hostname: target.hostname,
      port: target.port
    };
  } catch (error) {
    return {
      source: 'java-server-ping',
      online: false,
      playersOnline: null,
      playersMax: null,
      version: null,
      motd: '',
      error: error instanceof Error ? error.message : 'Minecraft status ping failed'
    };
  }
}

async function recordMinecraftStatus(env, scheduledAt) {
  const status = await getMinecraftStatus();
  const checkedAt = scheduledAt.toISOString();
  const sampleBucket = Math.floor(scheduledAt.getTime() / SAMPLE_INTERVAL_MS);
  await env.STATUS_DB.prepare(`
    INSERT INTO minecraft_status_checks
      (checked_at, source, online, players_online, players_max, version)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM minecraft_status_checks
      WHERE CAST(strftime('%s', checked_at) AS INTEGER) / 300 = ?
    )
  `).bind(
    checkedAt,
    status.source,
    Number(status.online),
    status.playersOnline,
    status.playersMax,
    status.version,
    sampleBucket
  ).run();
  console.log(`Minecraft status sampled: ${status.online ? 'online' : 'offline'} via ${status.source}.`);
}

async function recordXpStatus(env, scheduledAt) {
  let online = null;
  try {
    const payload = await fetchJson(XP_STATUS_URL, 'AstralyxXP API');
    if (!Array.isArray(payload.leaderboard)) throw new Error('AstralyxXP returned an invalid leaderboard response');
    online = true;
  } catch (error) {
    console.error('AstralyxXP health check failed; recording unknown status.', error);
  }

  const checkedAt = scheduledAt.toISOString();
  const sampleBucket = Math.floor(scheduledAt.getTime() / SAMPLE_INTERVAL_MS);
  await env.STATUS_DB.prepare(`
    INSERT INTO astralyx_xp_status_checks (checked_at, sample_bucket, source, online)
    VALUES (?, ?, 'astralyx-xp', ?)
    ON CONFLICT(sample_bucket) DO UPDATE SET
      checked_at = excluded.checked_at,
      source = excluded.source,
      online = excluded.online
  `).bind(checkedAt, sampleBucket, online === null ? null : Number(online)).run();
  console.log(`AstralyxXP status sampled: ${online === null ? 'unknown' : 'online'}.`);
}

async function pruneOldHistory(env, scheduledAt) {
  const cutoff = new Date(scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    env.STATUS_DB.prepare('DELETE FROM minecraft_status_checks WHERE checked_at < ?').bind(cutoff).run(),
    env.STATUS_DB.prepare('DELETE FROM astralyx_xp_status_checks WHERE checked_at < ?').bind(cutoff).run()
  ]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/api/minecraft-status') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    try {
      const status = await getMinecraftStatus();
      return Response.json({
        checkedAt: new Date().toISOString(),
        source: status.source,
        online: status.online,
        players: {
          online: status.playersOnline,
          max: status.playersMax
        },
        version: status.version,
        motd: status.motd,
        error: status.error || null
      }, {
        headers: {
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Direct Minecraft status request failed.', error);
      return Response.json({ error: 'Minecraft status is temporarily unavailable' }, { status: 502 });
    }
  },
  async scheduled(controller, env) {
    const scheduledAt = new Date(controller.scheduledTime || Date.now());
    const results = await Promise.allSettled([
      recordMinecraftStatus(env, scheduledAt),
      recordXpStatus(env, scheduledAt),
      pruneOldHistory(env, scheduledAt)
    ]);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      for (const failure of failures) console.error('Scheduled status sample failed.', failure.reason);
      throw new Error(`${failures.length} status sample(s) failed.`);
    }
  }
};
