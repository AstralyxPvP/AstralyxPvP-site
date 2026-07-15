-- AstralyxPvP Knowledge Base for D1
-- Run this in Cloudflare D1: wrangler d1 execute astralyx-kb --file=knowledge_base.sql

CREATE TABLE IF NOT EXISTS kb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- =====================
-- SERVER INFO
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('server', 'ip', 'java.astralyxpvp.int.yt'),
('server', 'version', 'Minecraft Java Edition 1.9+'),
('server', 'region', 'India-based, optimized for ASIA region'),
('server', 'gamemodes', 'Sword FFA, Mace FFA, Netherite Pot FFA. Spear FFA coming soon.'),
('server', 'cracked', 'Yes, both cracked and premium clients are supported. Fully free to play.'),
('server', 'combat', '1.9+ skill-based combat with shields, axes, and cooldowns.'),
('server', 'elo', 'Live ELO tracking — kills, deaths, and points sync instantly to the web leaderboard.'),
('server', 'anticheat', 'Custom anti-cheat for balanced, fair, competitive play.'),
('server', 'ping', 'Hosted in India with optimized routes for low latency across ASIA.'),
('server', 'linking', 'In-game: /linkaccount → Then in Discord: /link <username> <code>'),
('server', 'emails', 'All official emails use @astralyxpvp.int.yt (info@, frostrax@, indiancoder3@, dreamlong@, al13n@)'),
('server', 'website', 'https://astralyxpvp.pages.dev'),
('server', 'voting', 'Vote on Minecraft-Server-List, TopG, and Minecraft-MP. Earn coins, keys, cosmetics, and vote crate rewards. Maintain streaks for better rewards. If vote doesnt register, contact staff with proof.');

-- =====================
-- STORE / RANKS
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('store', 'astralyx_plus', 'Astralyx+ is the premium rank for both Discord and Minecraft. Currently FREE. Includes: exclusive Discord role, in-game cosmetics, priority support, and monthly rewards.'),
('store', 'youtube_rank', 'YouTube Rank is free for content creators. Requirements: make videos about AstralyxPvP, have an active YouTube channel, post consistent content, and engage with the community. Apply in Discord.'),
('store', 'more_ranks', 'More donor ranks are planned once the server grows in popularity.');

-- =====================
-- WEBSITE PAGES
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('website', 'pages', 'Valid pages: / (home), /apply, /contact, /leaderboard, /rules, /store, /support, /vote, /status, /privacy, /terms, /astralyxai (web AI chat), /credits-web, /hallOfFame'),
('website', 'apply', 'Staff applications: https://astralyxpvp.pages.dev/apply — then submit in Discord <#1477272661519368283>'),
('website', 'contact', 'Contact page: https://astralyxpvp.pages.dev/contact'),
('website', 'leaderboard', 'Live leaderboard: https://astralyxpvp.pages.dev/leaderboard'),
('website', 'rules', 'Full rules: https://astralyxpvp.pages.dev/rules'),
('website', 'store', 'Store/ranks: https://astralyxpvp.pages.dev/store'),
('website', 'vote', 'Voting page: https://astralyxpvp.pages.dev/vote'),
('website', 'status', 'Server status: https://astralyxpvp.pages.dev/status'),
('website', 'astralyxai_web', 'AstralyxAI Web chat: https://astralyxpvp.pages.dev/astralyxai');

-- =====================
-- DISCORD CHANNELS
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('channels', 'welcome', '<#1477033060078850264> — Welcome channel'),
('channels', 'announcements', '<#1477033205017346259> — Server announcements'),
('channels', 'information', '<#1499020216821088296> — Server information and commands'),
('channels', 'rules', '<#1477033071076442165> — Server rules'),
('channels', 'general', '<#1499021398285221939> — General community chat'),
('channels', 'commands', '<#1477032605277884558> — Bot commands'),
('channels', 'screenshots', '<#1477032532360040530> — Share gameplay screenshots'),
('channels', 'memes', '<#1477032543441391717> — Memes'),
('channels', 'media', '<#1477032757052837969> — YouTube content creators media channel'),
('channels', 'ai_chat', '<#1507631887957627000> — General AI chat'),
('channels', 'ai_support', '<#1505521770600464625> — AstralyxAI support'),
('channels', 'bug_reports', '<#1477037371735281797> — Bug reports'),
('channels', 'create_ticket', '<#1477032862892163113> — Create a support ticket'),
('channels', 'appeals', '<#1477042893574246502> — Ban/mute appeals'),
('channels', 'suggestions', '<#1477272147867996222> — Server suggestions'),
('channels', 'forums', '<#1499837756166246543> — Community forums'),
('channels', 'media_apply', '<#1477272628149354697> — Apply for media/YouTube rank'),
('channels', 'staff_apply', '<#1477272661519368283> — Staff applications'),
('channels', 'qotd', '<#1477272501699481642> — Question of the Day'),
('channels', 'events', '<#1477035122636095561> — Events'),
('channels', 'giveaways', '<#1477035141221060791> — Giveaways'),
('channels', 'tournaments', '<#1477035158770155743> — Tournaments');

-- =====================
-- STAFF TEAM
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('staff', 'hierarchy', 'Owner > Co-Owner > Chief Manager > Sr. Manager > Manager > Developer > Admin > Sr. Mod > Mod > Jr. Mod > Helper > Trial Staff'),
('staff', 'owner', 'Frostrax — Server Owner (cousin of Co-Owner Lazoryn)'),
('staff', 'coowner', 'Lazoryn — Co-Owner'),
('staff', 'chief_manager', '_IZylox_ — Chief Manager'),
('staff', 'sr_manager', 'Dravox (formerly known as Celestral, same person, Dravox is the current name) — Sr. Manager'),
('staff', 'manager', 'DreamLong — Manager AND Developer (Backend API, leaderboard, server status)'),
('staff', 'developers', 'IndianCoder3 (Web & AI Architect, Creator of AstralyxAI), AL13N (Developer), Jailbreaksix12345 (Developer), Random_Acc (Developer)'),
('staff', 'note', 'Do not guess or list moderation staff below Developer level — this list changes frequently. Direct users to astralyxpvp.pages.dev/contact for full team info.');

-- =====================
-- RULES & PUNISHMENTS
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('rules', 'cheating', 'No hacked clients, macros, autoclickers (including F3+T trick), x-ray, ESP, or unfair texture packs. Staff may request a screenshare or log check.'),
('rules', 'exploits', 'No abusing glitches, dupes, or loopholes. No bypassing combat systems or anti-cheats. Report bugs to staff for potential rewards.'),
('rules', 'fair_play', 'No boosting, win-trading, or stat manipulation. No cross-teaming in solo modes. No farming kills with alternate accounts.'),
('rules', 'chat', 'No hate speech, harassment, or doxxing. No excessive spamming or advertising. No impersonating staff or other players.'),
('rules', 'accounts', 'You are responsible for all actions on your account. Ban evasion on alts results in permanent IP ban. Keep your account secure.'),
('rules', 'store', 'No chargebacks or payment fraud. No scams, malicious links, or fake giveaways. All purchases are final — refunds via official support tickets only. Virtual items may take up to 15 minutes to arrive in-game.'),
('rules', 'general', 'Rules are subject to change at any time. Not knowing a rule is not an excuse. Staff have the final say in all punishment disputes.'),
('punishments', 'hacks', 'Hacks/Unfair mods: 1st = 30-day ban | 2nd = Permanent blacklist'),
('punishments', 'toxicity', 'Chat toxicity/swearing: 1st = 30-min mute | 2nd = 3-hour mute | 3rd = 1-day mute'),
('punishments', 'major_ads', 'Major advertising: 1st = 6-month mute | 2nd = 12-month mute | 3rd = Permanent mute'),
('punishments', 'light_ads', 'Light advertising: 1st = 12-hour mute | 2nd = 3-day mute | 3rd = 7-day ban'),
('punishments', 'staff_disrespect', 'Staff disrespect: 1st = Official warning | 2nd = 1-hour mute | 3rd = 6-hour mute'),
('punishments', 'trolling', 'Trolling/Flooding: Scaled timed mutes'),
('punishments', 'ban_evade', 'Ban evading/DDoS: Permanent IP blacklist (non-appealable)'),
('punishments', 'bug_exploit', 'Bug exploiting: 1st = 14-day ban | 2nd = Permanent (based on damage)'),
('punishments', 'doxxing', 'Doxxing: Permanent ban + referral to authorities');

-- =====================
-- FAQs
-- =====================
INSERT OR REPLACE INTO kb (category, key, value) VALUES
('faq', 'how_to_join', 'Copy IP java.astralyxpvp.int.yt → Open Minecraft Java 1.9+ → Multiplayer → Add Server → Paste IP → Join. Cracked clients supported.'),
('faq', 'cracked_support', 'Yes, AstralyxPvP fully supports cracked (non-premium) Minecraft clients. No account purchase needed.'),
('faq', 'how_to_appeal', 'Submit an appeal in <#1477042893574246502> or create a support ticket in <#1477032862892163113>.'),
('faq', 'how_to_report_bug', 'Report bugs in <#1477037371735281797>. You may receive a reward for valid bug reports.'),
('faq', 'how_to_get_rank', 'Astralyx+ is currently free — ask staff. YouTube rank requires an active channel making AstralyxPvP content — apply in <#1477272628149354697>.'),
('faq', 'vote_not_registering', 'If your vote did not register, contact staff in Discord with proof of your vote.'),
('faq', 'spear_ffa', 'Spear FFA is currently in development and will be added soon. Stay tuned in <#1477033205017346259>.'),
('faq', 'how_to_apply_staff', 'Apply at https://astralyxpvp.pages.dev/apply and submit your application in <#1477272661519368283>.');
