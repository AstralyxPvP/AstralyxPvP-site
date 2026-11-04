import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../astralyxai.html', import.meta.url), 'utf8');

test('AstralyxAI can list the knowledge catalog and look up selected full posts', () => {
  assert.match(html, /"function": "fetchKnowledgeCatalog"/);
  assert.match(html, /"function": "lookupKnowledgeItem", "source": "news"/);
  assert.match(html, /"function": "lookupKnowledgeItem", "source": "forums"/);
  assert.match(html, /every News title and tag, every Forums category\/subcategory and thread heading/);
  assert.match(html, /async fetchKnowledgeCatalog\(\)/);
  assert.match(html, /async lookupKnowledgeItem\(args\)/);
  assert.match(html, /lookupRound >= 3/);
});
