// functions/forum-api.js
// Threads + Replies API
//
// GET  /forum-api?type=threads              → list threads (newest first)
// GET  /forum-api?type=threads&id=N        → single thread
// GET  /forum-api?type=replies&thread=N    → replies for thread
// POST /forum-api?type=threads             → create thread (member JWT)
// POST /forum-api?type=replies&thread=N    → create reply (member JWT)
// DELETE /forum-api?type=threads&id=N      → delete thread (own or staff)
// DELETE /forum-api?type=replies&id=N      → delete reply (own or staff)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status, headers:{ 'Content-Type':'application/json', ...CORS }
  });
}

function parseJSON(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

// ── JWT verify ──────────────────────────────────────────────
async function verifyJWT(token, secret) {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;
    const claims = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    if (claims.exp < Math.floor(Date.now()/1000)) return null;
    return claims;
  } catch { return null; }
}

async function getUser(request, env) {
  const auth = (request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if (!auth) return null;
  return verifyJWT(auth, env.JWT_SECRET);
}

// ── Row helpers ─────────────────────────────────────────────
function threadOut(r) {
  return { ...r, tags: parseJSON(r.tags,[]), pinned: Boolean(r.pinned) };
}

// ── THREADS ─────────────────────────────────────────────────
async function listThreads(url, env) {
  const category = url.searchParams.get('category')||'';
  const search = url.searchParams.get('q')||'';
  let q = 'SELECT * FROM forum_threads';
  const args = [];
  const where = [];
  if (category) { where.push('category = ?'); args.push(category); }
  if (search) { where.push('(title LIKE ? OR content LIKE ?)'); args.push(`%${search}%`,`%${search}%`); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY pinned DESC, created_at DESC LIMIT 100';
  const { results } = await env.DB.prepare(q).bind(...args).all();
  return json(results.map(threadOut));
}

async function getThread(id, env) {
  const row = await env.DB.prepare('SELECT * FROM forum_threads WHERE id=?').bind(Number(id)).first();
  if (!row) return json({ error:'Not found' }, 404);
  return json(threadOut(row));
}

async function createThread(request, env) {
  const user = await getUser(request, env);
  if (!user?.isMember) return json({ error:'Login required' }, 401);
  const b = await request.json().catch(()=>null);
  if (!b?.title?.trim()) return json({ error:'title required' }, 400);
  if (!b?.content?.trim()) return json({ error:'content required' }, 400);
  const category = b.category?.trim() || 'General';
  const r = await env.DB.prepare(`
    INSERT INTO forum_threads (title,content,author_id,author_name,author_avatar,category,tags,pinned,created_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
  `).bind(
    b.title.trim(), b.content.trim(),
    user.userId, user.username, user.avatar||null,
    category,
    JSON.stringify(Array.isArray(b.tags)?b.tags:[]),
    (user.isStaff && b.pinned) ? 1 : 0
  ).run();
  return json({ success:true, id:r.meta.last_row_id }, 201);
}

async function deleteThread(id, user, env) {
  const row = await env.DB.prepare('SELECT author_id FROM forum_threads WHERE id=?').bind(Number(id)).first();
  if (!row) return json({ error:'Not found' }, 404);
  if (row.author_id !== user.userId && !user.isStaff) return json({ error:'Forbidden' }, 403);
  await env.DB.prepare('DELETE FROM forum_replies WHERE thread_id=?').bind(Number(id)).run();
  await env.DB.prepare('DELETE FROM forum_threads WHERE id=?').bind(Number(id)).run();
  return json({ success:true });
}

// ── REPLIES ─────────────────────────────────────────────────
async function getReplies(threadId, env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM forum_replies WHERE thread_id=? ORDER BY created_at ASC'
  ).bind(Number(threadId)).all();
  return json(results);
}

async function createReply(request, threadId, env) {
  const user = await getUser(request, env);
  if (!user?.isMember) return json({ error:'Login required' }, 401);
  const b = await request.json().catch(()=>null);
  if (!b?.content?.trim()) return json({ error:'content required' }, 400);
  // Insert reply
  await env.DB.prepare(`
    INSERT INTO forum_replies (thread_id,content,author_id,author_name,author_avatar,created_at)
    VALUES (?,?,?,?,?,datetime('now'))
  `).bind(Number(threadId), b.content.trim(), user.userId, user.username, user.avatar||null).run();
  // Increment reply count
  await env.DB.prepare('UPDATE forum_threads SET reply_count=reply_count+1 WHERE id=?').bind(Number(threadId)).run();
  return json({ success:true }, 201);
}

async function deleteReply(id, user, env) {
  const row = await env.DB.prepare('SELECT author_id,thread_id FROM forum_replies WHERE id=?').bind(Number(id)).first();
  if (!row) return json({ error:'Not found' }, 404);
  if (row.author_id !== user.userId && !user.isStaff) return json({ error:'Forbidden' }, 403);
  await env.DB.prepare('DELETE FROM forum_replies WHERE id=?').bind(Number(id)).run();
  await env.DB.prepare('UPDATE forum_threads SET reply_count=MAX(0,reply_count-1) WHERE id=?').bind(row.thread_id).run();
  return json({ success:true });
}

// ── Router ───────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
  if (!env.DB) return json({ error:'DB binding missing' }, 500);

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'threads';
  const id = url.searchParams.get('id');
  const threadId = url.searchParams.get('thread');
  const method = request.method.toUpperCase();

  if (type==='threads') {
    if (method==='GET') return id ? getThread(id,env) : listThreads(url,env);
    if (method==='POST') return createThread(request,env);
    if (method==='DELETE') {
      const user = await getUser(request,env);
      if (!user?.isMember) return json({error:'Login required'},401);
      return deleteThread(id,user,env);
    }
  }

  if (type==='replies') {
    if (method==='GET') return getReplies(threadId,env);
    if (method==='POST') return createReply(request,threadId,env);
    if (method==='DELETE') {
      const user = await getUser(request,env);
      if (!user?.isMember) return json({error:'Login required'},401);
      return deleteReply(id,user,env);
    }
  }

  return json({ error:'Bad request' }, 400);
}
