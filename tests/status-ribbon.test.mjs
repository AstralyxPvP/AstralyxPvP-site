import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const statusHtml = await readFile(new URL('../status.html', import.meta.url), 'utf8');

test('Know More reveals the AI summary in place instead of navigating away', () => {
  assert.match(statusHtml, /<button[^>]*id="maintenanceMore"[^>]*aria-controls="maintenanceDetails"[^>]*>Know More<\/button>/);
  assert.doesNotMatch(statusHtml, /<a[^>]*class="maintenance-more"[^>]*href=/);
  assert.match(statusHtml, /id="maintenanceDetails" hidden/);
  assert.match(statusHtml, /maintenanceMoreButton\.setAttribute\('aria-expanded', String\(!expanded\)\)/);
  assert.match(statusHtml, /maintenanceDetails\.hidden = expanded/);
  assert.match(statusHtml, /maintenanceDetails\.textContent = typeof data\.details === 'string'/);
});
