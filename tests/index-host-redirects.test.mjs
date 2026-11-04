import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const redirects = await readFile(new URL('../_redirects', import.meta.url), 'utf8');
const redirectScript = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(redirectScript, 'index.html should contain its host redirect rules');

function redirectFor(hostname) {
  const redirects = [];
  const window = {
    location: {
      hostname,
      pathname: '/some/path',
      search: '?from=alias',
      hash: '#latest',
      replace: destination => redirects.push(destination)
    }
  };
  vm.runInNewContext(redirectScript, { window });
  return redirects;
}

test('News host aliases redirect to news.html and preserve query/hash', () => {
  for (const host of ['news.astralyxpvp.org', 'news.astralyxpvp.int.yt']) {
    assert.deepEqual(redirectFor(host), [
      'https://astralyxpvp.org/news.html?from=alias#latest'
    ]);
  }
});

test('Status host aliases redirect to the clean status route and preserve query/hash', () => {
  for (const host of ['status.astralyxpvp.org', 'status.astralyxpvp.int.yt']) {
    assert.deepEqual(redirectFor(host), [
      'https://astralyxpvp.org/status?from=alias#latest'
    ]);
  }
});

test('Forums hostnames are left to their DNS handling', () => {
  assert.deepEqual(redirectFor('forums.astralyxpvp.org'), []);
  assert.deepEqual(redirectFor('forums.astralyxpvp.int.yt'), []);
});

test('Join Discord alias and clean status route are configured for Pages', () => {
  assert.match(redirects, /^\/joindc https:\/\/discord\.gg\/u8BFrpRwEg 301$/m);
  assert.match(redirects, /^\/status \/status\.html 200$/m);
});

test('Bedrock connection address and port are published', () => {
  assert.match(indexHtml, /bedrock\.astralyxpvp\.org/);
  assert.match(indexHtml, /8167/);
});

test('Homepage advertises the PvP bots and Crystal PvP arena', () => {
  assert.match(indexHtml, /PvP bot fights/i);
  assert.match(indexHtml, /Crystal PvP/i);
});
