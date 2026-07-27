// functions/discord-callback.js

const GUILD_ID = '1477025023800901766';

// Ordered highest → lowest — first match = display role
const ROLE_MAP = [
  { id: '1477025238784151554', name: 'Owner' },
  { id: '1477291491003994214', name: 'Co-Owner' },
  { id: '1502815102716608552', name: 'Chief Manager' },
  { id: '1497335106074050620', name: 'Sr. Manager' },
  { id: '1483209618485284964', name: 'Manager' },
  { id: '1529483674817532066', name: 'Sr. Developer' },
  { id: '1497316294632931358', name: 'Developer' },
  { id: '1530947152900259930', name: 'Jr. Developer' },
  { id: '1497316250945323070', name: 'Admin' },
  { id: '1497316120452136960', name: 'Sr. Mod' },
  { id: '1477025502119334109', name: 'Mod' },
  { id: '1497316057214484735', name: 'Jr. Mod' },
  { id: '1477025528174219476', name: 'Helper' },
  { id: '1501217374102229185', name: 'Trial' },
];

const STAFF_IDS = new Set(ROLE_MAP.map(r => r.id));

function b64url(str) {
  return btoa(str).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function b64urlEncode(obj) { return b64url(JSON.stringify(obj)); }

async function signJWT(payload, secret) {
  const header = b64urlEncode({ alg:'HS256', typ:'JWT' });
  const now = Math.floor(Date.now()/1000);
  const body = b64urlEncode({ ...payload, iat:now, exp:now+86400 });
  const sigInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) return Response.redirect(`${origin}/news.html?error=no_code`, 302);

  try {
    // 1. Exchange code for token
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
    if (!tokenData.access_token)
      return Response.redirect(`${origin}/news.html?error=token_failed`, 302);

    const discordAuth = `Bearer ${tokenData.access_token}`;

    // 2. Get user info
    const userRes = await fetch('https://discord.com/api/users/@me',
      { headers: { Authorization: discordAuth } });
    const user = await userRes.json();
    if (!user.id)
      return Response.redirect(`${origin}/news.html?error=user_failed`, 302);

    // 3. Get guild member
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
      { headers: { Authorization: discordAuth } }
    );
    const member = await memberRes.json();
    const roles = member.roles || [];

    // 4. Must have at least one known staff role
    const isStaff = roles.some(r => STAFF_IDS.has(r));
    if (!isStaff)
      return Response.redirect(`${origin}/news.html?error=not_staff`, 302);

    // 5. Find highest role for display
    const topRole = ROLE_MAP.find(r => roles.includes(r.id));
    const displayRole = topRole ? topRole.name : 'Staff';

    if (!env.JWT_SECRET)
      return Response.redirect(`${origin}/news.html?error=no_jwt_secret`, 302);

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.id) % 5}.png`;

    // 6. Issue JWT with role included
    const token = await signJWT({
      userId: user.id,
      username: user.global_name || user.username,
      avatar: avatarUrl,
      role: displayRole,
      isStaff: true,
    }, env.JWT_SECRET);

    return Response.redirect(`${origin}/news.html?token=${token}`, 302);

  } catch (err) {
    return Response.redirect(`${origin}/news.html?error=server_error`, 302);
  }
}
