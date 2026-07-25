// functions/news-api.js
// GET  /news-api          → list posts (public)
// GET  /news-api?id=N     → single post (public)
// POST /news-api          → create (staff JWT required)
// PATCH /news-api?id=N    → edit   (staff JWT required)
// DELETE /news-api?id=N   → delete (staff JWT required)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── JWT verify ───────────────────────────────────────────────────────────
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, sigBytes,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    if (!valid) return null;

    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (claims.exp < Math.floor(Date.now() / 1000)) return null; // expired
    if (!claims.isStaff) return null;
    return claims;
  } catch {
    return null;
  }
}

async function requireStaff(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return verifyJWT(token, env.JWT_SECRET);
}

function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function rowOut(r) {
  return { ...r, images: parseJSON(r.images, []), tags: parseJSON(r.tags, []), pinned: Boolean(r.pinned) };
}

// ── Handlers ─────────────────────────────────────────────────────────────
async function handleGet(request, env) {
  const id = new URL(request.url).searchParams.get('id');
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  if (id) {
    const row = await env.DB.prepare('SELECT * FROM news_posts WHERE id = ?').bind(Number(id)).first();
    if (!row) return json({ error: 'Not found' }, 404);
    return json(rowOut(row));
  }
  const { results } = await env.DB.prepare(
    'SELECT * FROM news_posts ORDER BY pinned DESC, created_at DESC LIMIT 100'
  ).all();
  return json(results.map(rowOut));
}

async function handlePost(request, env) {
  const user = await requireStaff(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  const b = await request.json().catch(() => null);
  if (!b?.title?.trim()) return json({ error: 'title required' }, 400);
  if (!b?.content?.trim()) return json({ error: 'content required' }, 400);

  const result = await env.DB.prepare(`
    INSERT INTO news_posts (title, content, author_id, author_name, author_avatar, images, tags, pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    b.title.trim(), b.content.trim(),
    user.userId, user.username, user.avatar || null,
    JSON.stringify(Array.isArray(b.images) ? b.images : []),
    JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
    b.pinned ? 1 : 0
  ).run();

  return json({ success: true, id: result.meta.last_row_id }, 201);
}

async function handlePatch(request, env) {
  const user = await requireStaff(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);

  const b = await request.json().catch(() => null);
  if (!b) return json({ error: 'Invalid JSON' }, 400);

  const fields = [], vals = [];
  if (b.title   !== undefined) { fields.push('title = ?');   vals.push(b.title.trim()); }
  if (b.content !== undefined) { fields.push('content = ?'); vals.push(b.content.trim()); }
  if (b.images  !== undefined) { fields.push('images = ?');  vals.push(JSON.stringify(b.images)); }
  if (b.tags    !== undefined) { fields.push('tags = ?');    vals.push(JSON.stringify(b.tags)); }
  if (b.pinned  !== undefined) { fields.push('pinned = ?');  vals.push(b.pinned ? 1 : 0); }
  if (!fields.length) return json({ error: 'Nothing to update' }, 400);

  fields.push("edited_at = datetime('now')");
  vals.push(Number(id));

  await env.DB.prepare(`UPDATE news_posts SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ success: true });
}

async function handleDelete(request, env) {
  const user = await requireStaff(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);

  await env.DB.prepare('DELETE FROM news_posts WHERE id = ?').bind(Number(id)).run();
  return json({ success: true });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  switch (request.method) {
    case 'GET':    return handleGet(request, env);
    case 'POST':   return handlePost(request, env);
    case 'PATCH':  return handlePatch(request, env);
    case 'DELETE': return handleDelete(request, env);
    default:       return json({ error: 'Method not allowed' }, 405);
  }
}
