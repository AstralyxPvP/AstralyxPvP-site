/**
 * /functions/web-announcements.js
 * Cloudflare Pages Function — Web Announcements API
 *
 * GET  /web-announcements          → list all posts (newest first, pinned on top)
 * GET  /web-announcements?id=N     → single post by id
 * POST /web-announcements          → create post  (requires Authorization: Bearer ADMIN_KEY)
 * PATCH /web-announcements?id=N    → edit post    (requires Authorization: Bearer ADMIN_KEY)
 * DELETE /web-announcements?id=N   → delete post  (requires Authorization: Bearer ADMIN_KEY)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function unauthorized() {
  return json({ error: "Unauthorized. Valid ADMIN_KEY required." }, 401);
}

function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === env.ADMIN_KEY;
}

// ── GET ─────────────────────────────────────────────────────────────────────
async function handleGet(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!env.DB) return json({ error: "D1 database binding (DB) is missing." }, 500);

  if (id) {
    const row = await env.DB.prepare(
      "SELECT * FROM web_announcements WHERE id = ?"
    ).bind(Number(id)).first();

    if (!row) return json({ error: "Post not found." }, 404);

    return json(parseRow(row));
  }

  const { results } = await env.DB.prepare(
    "SELECT * FROM web_announcements ORDER BY pinned DESC, created_at DESC LIMIT 100"
  ).all();

  return json(results.map(parseRow));
}

function parseRow(row) {
  return {
    ...row,
    images: safeParseJSON(row.images, []),
    tags:   safeParseJSON(row.tags,   []),
    pinned: Boolean(row.pinned),
  };
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── POST (create) ─────────────────────────────────────────────────────────
async function handlePost(request, env) {
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.DB) return json({ error: "D1 database binding (DB) is missing." }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  const { title, content, author_name, author_role, author_avatar, images, tags, pinned } = body;

  if (!title?.trim()) return json({ error: "title is required." }, 400);
  if (!content?.trim()) return json({ error: "content is required." }, 400);

  const result = await env.DB.prepare(`
    INSERT INTO web_announcements (title, content, author_name, author_role, author_avatar, images, tags, pinned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    title.trim(),
    content.trim(),
    (author_name || "Staff").trim(),
    (author_role || "Staff").trim(),
    author_avatar || null,
    JSON.stringify(Array.isArray(images) ? images : []),
    JSON.stringify(Array.isArray(tags) ? tags : []),
    pinned ? 1 : 0
  ).run();

  return json({ success: true, id: result.meta.last_row_id }, 201);
}

// ── PATCH (edit) ──────────────────────────────────────────────────────────
async function handlePatch(request, env) {
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.DB) return json({ error: "D1 database binding (DB) is missing." }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id query param required." }, 400);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }

  const fields = [];
  const values = [];

  if (body.title   !== undefined) { fields.push("title = ?");         values.push(body.title.trim()); }
  if (body.content !== undefined) { fields.push("content = ?");       values.push(body.content.trim()); }
  if (body.author_name !== undefined) { fields.push("author_name = ?"); values.push(body.author_name.trim()); }
  if (body.author_role !== undefined) { fields.push("author_role = ?"); values.push(body.author_role.trim()); }
  if (body.author_avatar !== undefined) { fields.push("author_avatar = ?"); values.push(body.author_avatar); }
  if (body.images  !== undefined) { fields.push("images = ?");        values.push(JSON.stringify(body.images)); }
  if (body.tags    !== undefined) { fields.push("tags = ?");          values.push(JSON.stringify(body.tags)); }
  if (body.pinned  !== undefined) { fields.push("pinned = ?");        values.push(body.pinned ? 1 : 0); }

  if (fields.length === 0) return json({ error: "Nothing to update." }, 400);

  fields.push("edited_at = datetime('now')");
  values.push(Number(id));

  await env.DB.prepare(
    `UPDATE web_announcements SET ${fields.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return json({ success: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────
async function handleDelete(request, env) {
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.DB) return json({ error: "D1 database binding (DB) is missing." }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id query param required." }, 400);

  await env.DB.prepare("DELETE FROM web_announcements WHERE id = ?")
    .bind(Number(id)).run();

  return json({ success: true });
}

// ── Router ────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  switch (method) {
    case "GET":    return handleGet(request, env);
    case "POST":   return handlePost(request, env);
    case "PATCH":  return handlePatch(request, env);
    case "DELETE": return handleDelete(request, env);
    default:       return json({ error: "Method not allowed." }, 405);
  }
}
