-- Run this via: wrangler d1 execute astralyx-db --remote --file=web_announcements_migration.sql
-- Or paste into Cloudflare Dashboard > D1 > astralyx-db > Console

CREATE TABLE IF NOT EXISTS web_announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  author_name TEXT    NOT NULL DEFAULT 'Staff',
  author_role TEXT    NOT NULL DEFAULT 'Staff',
  author_avatar TEXT  DEFAULT NULL,
  images      TEXT    NOT NULL DEFAULT '[]',  -- JSON array of image URLs
  tags        TEXT    NOT NULL DEFAULT '[]',  -- JSON array of tag strings
  pinned      INTEGER NOT NULL DEFAULT 0,     -- 1 = pinned to top
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  edited_at   TEXT    DEFAULT NULL
);

-- Optional: seed a welcome post so the page isn't empty on first deploy
INSERT INTO web_announcements (title, content, author_name, author_role, tags, pinned)
VALUES (
  '🎉 Web Announcements Launched!',
  '# Welcome to AstralyxPvP Web Announcements

We now have a **native web announcement system** — no more Discord-only posts!

## What''s New
- ✅ Full **Markdown** support (headers, bold, italic, code blocks, tables…)
- ✅ **No character limit** — post as much as you want
- ✅ **Image embeds** — attach multiple images per post
- ✅ **Tags** — categorize posts (Updates, Events, Maintenance…)
- ✅ **Pin** important posts to the top

Stay tuned for more updates. See you in the arena! ⚔️

*— AstralyxPvP Staff Team*',
  'Frostrax',
  'Owner',
  '["Meta", "Updates"]',
  1
);
