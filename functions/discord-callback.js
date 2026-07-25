// functions/discord-callback.js
// Handles Discord OAuth2 callback — exchanges code, checks staff role, issues JWT

const GUILD_ID = '1477025023800901766';

const MOD_ROLES = new Set([
  '1477025238784151554', // Owner
  '1477291491003994214', // Co-Owner
  '1502815102716608552', // Chief Manager
  '1497335106074050620', // Sr. Manager
  '1483209618485284964', // Manager
  '1497316294632931358', // Developer
  '1497316250945323070', // Admin
  '1497316120452136960', // Sr. Mod
  '1477025502119334109', // Mod
]);

// ── JWT helpers (Web Crypto, works in CF Workers) ────────────────────────
function b64url(str) {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlEncode(obj) {
  return b64url(JSON.stringify(obj));
}

async function signJWT(payload, secret) {
  const header = b64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode({ ...payload, iat: now, exp: now + 86400 }); // 24h
  const sigInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput));
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${sigInput}.${sigB64}`;
}

// ── Main handler ─────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return Response.redirect(`${origin}/news.html?error=no_code`, 302);
  }

  try {
    // 1. Exchange code for Discord access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/discord-callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.redirect(`${origin}/news.html?error=token_failed`, 302);
    }

    const discordAuth = `Bearer ${tokenData.access_token}`;

    // 2. Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: discordAuth },
    });
    const user = await userRes.json();
    if (!user.id) {
      return Response.redirect(`${origin}/news.html?error=user_failed`, 302);
    }

    // 3. Get guild member to check roles
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: discordAuth } }
    );
    const member = await memberRes.json();

    // 4. Staff check — server-side, no way to bypass from browser
    const roles = member.roles || [];
    const isStaff = roles.some(r => MOD_ROLES.has(r));

    if (!isStaff) {
      return Response.redirect(`${origin}/news.html?error=not_staff`, 302);
    }

    // 5. Build avatar URL
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.id) % 5}.png`;

    // 6. Issue signed JWT — only reachable if genuinely staff
    if (!env.JWT_SECRET) {
      return Response.redirect(`${origin}/news.html?error=no_jwt_secret`, 302);
    }
    const token = await signJWT({
      userId: user.id,
      username: user.global_name || user.username,
      avatar: avatarUrl,
      isStaff: true,
    }, env.JWT_SECRET);

    return Response.redirect(`${origin}/news.html?token=${token}`, 302);

  } catch (err) {
    return Response.redirect(`${origin}/news.html?error=server_error`, 302);
  }
}
