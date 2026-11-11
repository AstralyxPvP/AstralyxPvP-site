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

test('AstralyxAI reads every current ELO leaderboard and the global XP leaderboard', () => {
  assert.match(html, /https:\/\/api\.astralyxpvp\.workers\.dev\/api/);
  assert.match(html, /https:\/\/astralyx-xp-bot\.indiancoder3\.workers\.dev\/api\/leaderboard/);
  assert.match(html, /"function": "fetchAllLeaderboards"/);
  assert.match(html, /"function": "fetchXPLeaderboard"/);
  assert.match(html, /async fetchAllLeaderboards\(\)/);
  assert.match(html, /async fetchXPLeaderboard\(args = \{\}\)/);
  assert.match(html, /gamemodes\.map\(gamemode => fetchLeaderboardForGamemode\(gamemode, 5\)\)/);
  assert.doesNotMatch(html, /astralworker\.chessmrbeaston/);
  assert.doesNotMatch(html, /swordffa1/);
});

test('AstralyxAI uses the full gamemode names', () => {
  for (const name of ['Sword FFA', 'Mace PvP FFA', 'Netherite Pot FFA', 'Lifesteal PvP FFA', 'Crystal PvP FFA', 'Sumo FFA']) {
    assert.ok(html.includes(name), `AstralyxAI should know ${name}`);
  }
  assert.doesNotMatch(html, /Nether Pot FFA|UHC FFA|KOTH FFA/);
});
