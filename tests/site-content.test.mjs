import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const indexHtml = await read('index.html');
const voteHtml = await read('vote.html');
const footerHtml = await read('Assets/footer.html');
const headHtml = await read('Assets/head.html');
const scriptJs = await read('Script/script.js');
const sitemapXml = await read('sitemap.xml');
const llmsTxt = await read('llms.txt');
const termsHtml = await read('terms.html');
const privacyHtml = await read('privacy.html');
const rulesHtml = await read('rules.html');

const voteLinks = [
  'https://topg.org/minecraft-servers/server-687834',
  'https://minecraft-server-list.com/server/524655/',
  'https://minecraft.buzz/server/astralyxpvp',
  'https://minecraft-serverlist.com/server/7063'
];

test('vote page lists every official voting site', () => {
  for (const link of voteLinks) {
    assert.ok(voteHtml.includes(link), `vote.html should link to ${link}`);
    assert.ok(llmsTxt.includes(link), `llms.txt should link to ${link}`);
  }
});

test('vote page uses local provider logos where available', () => {
  for (const logo of [
    'Assets/vote-sites/topg.png',
    'Assets/vote-sites/minecraft-server-list.png',
    'Assets/vote-sites/minecraft-buzz.png',
    'Assets/vote-sites/minecraft-serverlist.png'
  ]) {
    assert.ok(voteHtml.includes(logo), `vote.html should use ${logo}`);
  }
});

test('vote page lists only Cosmetics and Vote Keys as rewards', () => {
  assert.match(voteHtml, /Voting only gives in-game <strong>Cosmetics<\/strong> and <strong>Vote Keys<\/strong>/);
  assert.doesNotMatch(voteHtml, /Coins &amp; keys|Vote crates|Vote streaks/);
});

test('rules page lists all 30 rules with penalties for the latest additions', () => {
  assert.equal((rulesHtml.match(/<tr data-category=/g) ?? []).length, 30);
  assert.match(rulesHtml, /<table class="rules-table">/);
  assert.match(rulesHtml, /<th scope="col">1st offence<\/th>/);
  assert.match(rulesHtml, /<span class="rule-number">29<\/span>No sexual threats/);
  assert.match(rulesHtml, /Permanent blacklist from the entire community/);
  assert.match(rulesHtml, /formal police report/);
  assert.match(rulesHtml, /<span class="rule-number">30<\/span>No offensive or inappropriate structures/);
  assert.match(rulesHtml, /Verbal warning and immediate removal of the structure/);
  assert.match(rulesHtml, /31 day ban/);
  assert.match(rulesHtml, /Permanent ban/);
  assert.match(rulesHtml, /Showing 30 rules/);
});

test('shared head loads the site script only once', () => {
  assert.equal((headHtml.match(/<script src="Script\/script\.js"><\/script>/g) ?? []).length, 1);
});

test('main content clears the fixed navbar including its top offset', () => {
  assert.match(scriptJs, /parseFloat\(getComputedStyle\(nav\)\.top\)/);
  assert.match(scriptJs, /Math\.ceil\(navTop \+ nav\.offsetHeight \+ 24\)/);
});

test('footer publishes all social profiles and the April 2026 founding date', () => {
  for (const link of [
    'https://www.youtube.com/@AstralyxPvP',
    'https://x.com/AstralyxNetwork',
    'https://www.tiktok.com/@astralyxpvp',
    'https://astralyxpvp.org/'
  ]) {
    assert.ok(footerHtml.includes(link), `footer should link to ${link}`);
  }
  assert.match(footerHtml, /Founded in April 2026/);
  assert.match(footerHtml, /id="footerLastCommitLink"/);
});

test('footer last-updated link is populated from the GitHub commits API', () => {
  assert.match(scriptJs, /api\.github\.com\/repos\/AstralyxPvP\/AstralyxPvP-site\/commits/);
  assert.match(scriptJs, /footerLastCommitLink/);
  assert.match(scriptJs, /html_url/);
});

test('leaderboard displays full names for every gamemode', () => {
  const labels = {
    swordffa: 'Sword FFA',
    macepvpffa: 'Mace PvP FFA',
    nethpotffa: 'Netherite Pot FFA',
    uhcffa: 'Lifesteal PvP FFA',
    kothffa: 'Crystal PvP FFA'
  };
  for (const [key, label] of Object.entries(labels)) {
    assert.ok(scriptJs.includes(`${key}: '${label}'`), `leaderboard should map ${key} to ${label}`);
  }
});

test('join picker markup never nests a button inside another button', () => {
  const tagPattern = /<button\b[^>]*>|<\/button>/gi;
  let depth = 0;
  for (const match of indexHtml.matchAll(tagPattern)) {
    if (match[0].toLowerCase().startsWith('</button')) {
      depth -= 1;
      assert.ok(depth >= 0, 'index.html has an unmatched closing </button>');
    } else {
      depth += 1;
      assert.ok(depth <= 1, 'index.html nests a <button> inside another <button>');
    }
  }
  assert.equal(depth, 0, 'index.html has unmatched <button> tags');
  assert.match(indexHtml, /data-copy-server="play\.astralyxpvp\.org"/);
});

test('homepage FAQ explains hosting and legacy server addresses', () => {
  assert.match(indexHtml, /main server infrastructure currently located in <strong>Europe<\/strong>/);
  assert.match(indexHtml, /java\.astralyxpvp\.int\.yt/);
  assert.match(indexHtml, /none-subscribe\.gl\.joinmc\.link/);
  assert.match(indexHtml, /stammer-affilated\.tun\.ply\.gg/);
});

test('sitemap lists indexable pages and skips redirect/noindex pages', () => {
  for (const path of ['', '/announcements', '/leaderboard', '/rules', '/status', '/vote', '/contact', '/support', '/terms', '/privacy', '/credits-web', '/hallOfFame', '/store', '/astralyxai']) {
    assert.ok(sitemapXml.includes(`<loc>https://astralyxpvp.org${path}</loc>`), `sitemap should include ${path || '/'}`);
  }
  for (const path of ['/news', '/forums', '/apply']) {
    assert.ok(!sitemapXml.includes(`<loc>https://astralyxpvp.org${path}</loc>`), `sitemap should not include ${path}`);
  }
});

test('structured data links the same social profiles', () => {
  for (const link of [
    'https://www.youtube.com/@AstralyxPvP',
    'https://x.com/AstralyxNetwork',
    'https://www.tiktok.com/@astralyxpvp'
  ]) {
    assert.ok(indexHtml.includes(link), `index.html structured data should include ${link}`);
  }
  assert.match(indexHtml, /"foundingDate": "2026-04"/);
});

test('legal pages carry the current terms and privacy policy', () => {
  for (const html of [termsHtml, privacyHtml]) {
    assert.match(html, /Last Updated: 5 November 2026/);
    assert.match(html, /NebulaGames/);
    assert.match(html, /admin@astralyxpvp\.org/);
  }
  assert.match(termsHtml, /unregistered community project/);
  assert.match(termsHtml, /International Legal Compliance &amp; Governing Law/);
  assert.match(termsHtml, /No Gambling or Paid Lotteries/);
  assert.match(privacyHtml, /independent development project/);
  assert.match(privacyHtml, /Digital Personal Data Protection Act, 2023/);
  assert.match(privacyHtml, /Federal Decree-Law No\. 45 of 2021/);
  assert.match(privacyHtml, /General Data Protection Regulation \(GDPR\)/);
  assert.doesNotMatch(privacyHtml, /not directed at children under 13/);
  assert.doesNotMatch(termsHtml, /Effective 25 October 2026/);
});
