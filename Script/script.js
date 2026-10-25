(async function() {
    const API_BASE = "https://api.astralyxpvp.workers.dev/api";
    const IP = "play.astralyxpvp.org";

    const escapeHtml = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    // Preload custom cursor & log result
    (function preloadCursor() {
        const img = new Image();
        img.onload = () => console.log('[Cursor] Diamond sword cursor loaded successfully');
        img.onerror = () => console.warn('[Cursor] Failed to load cursor image — check path or file format');
        img.src = 'Assets/cursor-sword.png';
    })();

    // Context Menu Handling
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu) {
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            contextMenu.style.display = "block";
        
            const x = (e.clientX + 230 > window.innerWidth) ? e.clientX - 230 : e.clientX;
            const y = e.clientY;
        
            contextMenu.style.left = `${Math.max(0, x)}px`;
            contextMenu.style.top = `${Math.max(0, y)}px`;
        
            requestAnimationFrame(() => {
                contextMenu.classList.remove("hide");
                contextMenu.classList.add("show");
            });
        });

        window.addEventListener("click", () => {
            if (contextMenu.classList.contains("show")) {
                contextMenu.classList.remove("show");
                contextMenu.classList.add("hide");
                setTimeout(() => {
                    contextMenu.style.display = "none";
                }, 200);
            }
        });
    }

    // Dynamic Navbar Initialization
    async function initNavbar() {
        const container = document.getElementById('navbar-placeholder');
        if (!container) return;
      
        try {
            const response = await fetch('Assets/navbar.html');
            if (!response.ok) throw new Error('Navbar missing');
            
            const html = await response.text();
            container.innerHTML = html;

            const hamburger = container.querySelector('.hamburger');
            const navLinks = container.querySelector('.nav-links');
            const mobileClose = container.querySelector('.mobile-close');
            const backdrop = container.querySelector('.nav-backdrop');
            
            const mobileBreakpoint = 1100;
            let menuReturnFocus = false;

            function openMenu() {
                hamburger.classList.add('active');
                hamburger.setAttribute('aria-expanded', 'true');
                hamburger.setAttribute('aria-label', 'Close menu');
                document.documentElement.classList.add('nav-open');
                menuReturnFocus = true;
                if (window.innerWidth <= mobileBreakpoint && navLinks.parentNode !== document.body) {
                    document.body.appendChild(navLinks);
                }
                requestAnimationFrame(() => {
                    navLinks.classList.add('active');
                    if (backdrop) backdrop.classList.add('active');
                    const firstLink = navLinks.querySelector('a, .nav-dropdown-toggle');
                    if (firstLink && window.innerWidth <= mobileBreakpoint) firstLink.focus({ preventScroll: true });
                });
            }

            function closeMenu(returnFocus = false) {
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.setAttribute('aria-label', 'Open menu');
                navLinks.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
                document.documentElement.classList.remove('nav-open');
                navLinks.querySelectorAll('.nav-dropdown.open').forEach(dropdown => {
                    dropdown.classList.remove('open');
                    dropdown.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                });
                if (returnFocus && menuReturnFocus) hamburger.focus({ preventScroll: true });
                setTimeout(() => {
                    const nav = container.querySelector('nav');
                    if (window.innerWidth <= mobileBreakpoint && nav && navLinks.parentNode !== nav) {
                        nav.appendChild(navLinks);
                    }
                }, 280);
            }
            
            if (hamburger && navLinks) {
                hamburger.addEventListener('click', () => {
                    if (navLinks.classList.contains('active')) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                });
            }
            if (mobileClose && navLinks) {
                mobileClose.addEventListener('click', () => closeMenu(true));
            }
            if (backdrop && navLinks) {
                backdrop.addEventListener('click', () => closeMenu(true));
            }
            if (navLinks) {
                navLinks.querySelectorAll(':scope > a').forEach(link => {
                    link.addEventListener('click', () => {
                        if (window.innerWidth <= mobileBreakpoint) closeMenu();
                    });
                });
            }
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && navLinks.classList.contains('active')) closeMenu(true);
            });

            // Group dropdowns
            container.querySelectorAll('.nav-dropdown').forEach(dropdown => {
                const dropdownToggle = dropdown.querySelector('.nav-dropdown-toggle');
                const dropdownMenu = dropdown.querySelector('.nav-dropdown-menu');
                if (!dropdownToggle || !dropdownMenu) return;
                dropdownToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isOpen = !dropdown.classList.contains('open');
                    container.querySelectorAll('.nav-dropdown.open').forEach(openDropdown => {
                        if (openDropdown === dropdown) return;
                        openDropdown.classList.remove('open');
                        openDropdown.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                    });
                    dropdown.classList.toggle('open', isOpen);
                    dropdownToggle.setAttribute('aria-expanded', String(isOpen));
                });
                dropdownMenu.querySelectorAll('a').forEach(item => {
                    item.addEventListener('click', () => {
                        dropdown.classList.remove('open');
                        dropdownToggle.setAttribute('aria-expanded', 'false');
                        if (window.innerWidth <= mobileBreakpoint) closeMenu();
                    });
                });
                if (dropdownMenu.querySelector('.active')) {
                    dropdown.classList.add('active');
                }
            });

            // Active link logic
            const currentPath = (window.location.pathname.split("/").pop() || "index.html").replace(/\.html$/, '');
            container.querySelectorAll('.nav-links a').forEach(link => {
                const href = link.getAttribute('href').replace(/\.html$/, '');
                if (href === '/' + currentPath || href === currentPath) link.classList.add('active');
            });

            // Adjust main content padding
            const nav = container.querySelector('nav');
            const mainContent = document.querySelector('.page-content');
            if (nav && mainContent) {
                requestAnimationFrame(() => {
                    mainContent.style.paddingTop = `${nav.offsetHeight}px`;
                });
            }

            // Double-decker wrap detection
            function checkWrap() {
                var items = Array.from(navLinks.children).filter(function(el) {
                    return el.offsetParent !== null && (el.tagName === 'A' || el.classList.contains('nav-dropdown'));
                });
                var wrapped = false;
                var firstTop = items[0] && items[0].offsetTop;
                for (var i = 1; i < items.length; i++) {
                    if (items[i].offsetTop > firstTop) { wrapped = true; break; }
                }
                if (nav) nav.classList.toggle('double-decker', wrapped);
                if (mainContent && nav) mainContent.style.paddingTop = nav.offsetHeight + 'px';
            }
            var ro = new ResizeObserver(checkWrap);
            if (navLinks) ro.observe(navLinks);
            checkWrap();

            // Glass nav on scroll
            function checkScroll() {
                if (nav) nav.classList.toggle('nav-scrolled', window.scrollY >= 20);
            }
            window.addEventListener('scroll', checkScroll, { passive: true });
            checkScroll();

            window.addEventListener('resize', () => {
                if (window.innerWidth > mobileBreakpoint) {
                    document.documentElement.classList.remove('nav-open');
                    navLinks.classList.remove('active');
                    if (backdrop) backdrop.classList.remove('active');
                    const nav = container.querySelector('nav');
                    if (nav && navLinks.parentNode !== nav) nav.appendChild(navLinks);
                }
                checkWrap();
            });
        } catch (error) {
            console.error('Navbar error:', error);
        }
    }

    // Dynamic Footer Initialization
    async function initFooter() {
        const container = document.getElementById('footer');
        if (!container) return;
      
        try {
            const response = await fetch('Assets/footer.html');
            if (!response.ok) throw new Error('Footer asset could not be fetched');
            
            const html = await response.text();
            container.innerHTML = html;

            const currentPath = window.location.pathname.split("/").pop() || "index.html";
            
            container.querySelectorAll('.footer-links a').forEach(link => {
                const href = link.getAttribute('href');
                if (href === currentPath || (currentPath === 'index.html' && href === '/')) {
                    link.classList.add('active');
                }
            });
            const yearEl = container.querySelector('#year');
            if (yearEl) yearEl.textContent = new Date().getFullYear();

        } catch (error) {
            console.error('Footer error:', error);
            container.innerHTML = `<footer style="text-align:center; padding:20px; color:var(--muted);">
                &copy; ${new Date().getFullYear()} AstralyxPvP. All rights reserved.
            </footer>`;
        }
    }

    // Combined Server Status Updates
    async function updateAllStatus() {
        const navPill = document.getElementById('nav-status');
        const heroPlayers = document.getElementById('heroPlayers');
        const heroStatusText = document.getElementById('heroStatusText');
        const heroPill = document.getElementById('heroServerPill');
        const heroPillText = document.getElementById('heroServerPillText');

        try {
            const response = await fetch(`${API_BASE}?serverStatus=true`);
            const data = await response.json();

            if (data.online) {
                if (navPill) {
                    navPill.className = 'server-pill online';
                    navPill.textContent = `🟢 ${data.current}/${data.max} Online`;
                }
                if (heroPlayers) heroPlayers.textContent = `${data.current} / ${data.max}`;
                if (heroStatusText) {
                    const mode = (data.text || "").includes("Live") ? "Live" : "Fallback Probe";
                    heroStatusText.textContent = `Online • ${data.version || "1.21"} (${mode})`;
                }
                if (heroPill) heroPill.className = 'hero-pill status-pill online';
                if (heroPillText) heroPillText.textContent = `${data.current}/${data.max} Online`;
            } else {
                if (navPill) { navPill.className = 'server-pill offline'; navPill.textContent = '🔴 Offline'; }
                if (heroPlayers) heroPlayers.textContent = "Offline";
                if (heroStatusText) heroStatusText.textContent = "Server is currently offline";
                if (heroPill) heroPill.className = 'hero-pill status-pill offline';
                if (heroPillText) heroPillText.textContent = "Server Offline";
            }
        } catch (error) {
            if (navPill) { navPill.className = 'server-pill offline'; navPill.textContent = '🔴 Offline'; }
            if (heroPlayers) heroPlayers.textContent = "Offline";
            if (heroStatusText) heroStatusText.textContent = "Unable to connect to status API";
            if (heroPill) heroPill.className = 'hero-pill status-pill offline';
            if (heroPillText) heroPillText.textContent = "Status Unavailable";
        }
    }

    // Discord widget data is public; Discord's widget API does not expose a bot flag.
    const DISCORD_GUILD_ID = "1477025023800901766";
    const DISCORD_CHANNEL_GROUPS = [
        { name: 'Welcome', channels: [
            { id: '1477033060078850264', name: '👋 Welcome' },
            { id: '1529028842188967977', name: '🎉 DesiBot Welcomer' },
            { id: '1477033205017346259', name: '📢 Announcements' },
            { id: '1499020216821088296', name: '📝 Information' },
            { id: '1477033071076442165', name: '📜 Rules' },
            { id: '1505240856138088501', name: '🎩 Staff updates' }
        ] },
        { name: 'Community', channels: [
            { id: '1499021398285221939', name: '💬 General' },
            { id: '1477032605277884558', name: '⚙️ Commands' },
            { id: '1477032532360040530', name: '📸 Screenshots' },
            { id: '1477032543441391717', name: '😂 Memes' },
            { id: '1477032757052837969', name: '🎥 Media' },
            { id: '1507631887957627000', name: '💬 AI chat' }
        ] },
        { name: 'Support', channels: [
            { id: '1505521770600464625', name: '💬 AI support' },
            { id: '1477032862892163113', name: '🎫 Create ticket' },
            { id: '1477037371735281797', name: '🐞 Bug reports' },
            { id: '1477042893574246502', name: '⚖️ Appeals' }
        ] },
        { name: 'More', channels: [
            { id: '1499837756166246543', name: '📝 Forums' },
            { id: '1477272147867996222', name: '🧩 Suggestions' },
            { id: '1477272628149354697', name: '🎥 Media application' },
            { id: '1477272661519368283', name: '🛡️ Staff application' },
            { id: '1477272501699481642', name: '🧠 Question of the day' }
        ] },
        { name: 'Events & giveaways', channels: [
            { id: '1477035122636095561', name: '🎉 Events' },
            { id: '1477035141221060791', name: '🎊 Giveaways' },
            { id: '1477035158770155743', name: '🏹 Tournaments' }
        ] },
        { name: 'Voice channels', channels: [
            { id: '1477025025012793409', name: '🎙️ General VC', voice: true },
            { id: '1483463058360893541', name: '🔊 Low Bit VC', voice: true },
            { id: '1477036494890860706', name: '🎮 Gaming VC', voice: true },
            { id: '1535916913534959616', name: '🎤 Group of 2', voice: true },
            { id: '1535917001342586890', name: '🎤 Group of 3', voice: true },
            { id: '1535917057638535248', name: '🎤 Group of 4', voice: true },
            { id: '1535917087791259728', name: '🎤 Group of 5', voice: true },
            { id: '1535917139674927184', name: '🎤 Group of 10', voice: true },
            { id: '1477036566361931829', name: '💤 AFK', voice: true }
        ] }
    ];
    const DISCORD_WIDGET_BOT_NAMES = new Set([
        'appbot', 'astralyxpvp', 'authgg', 'beemo', 'disboard', 'dislucity'
    ]);

    function renderDiscordChannels(apiChannels = []) {
        const container = document.getElementById('discordWidgetChannels');
        if (!container) return;

        const liveChannels = new Map(
            apiChannels.filter(channel => /^\d+$/.test(String(channel.id || '')))
                .map(channel => [String(channel.id), channel])
        );
        container.replaceChildren();

        DISCORD_CHANNEL_GROUPS.forEach((group, groupIndex) => {
            const details = document.createElement('details');
            details.className = 'discord-widget-channel-group';
            if (groupIndex === 0) details.open = true;

            const summary = document.createElement('summary');
            summary.textContent = `${group.name} (${group.channels.length})`;
            details.appendChild(summary);

            const links = document.createElement('div');
            links.className = 'discord-widget-channel-list';
            group.channels.forEach(channel => {
                const liveChannel = liveChannels.get(channel.id);
                const link = document.createElement('a');
                link.className = channel.voice ? 'discord-widget-channel voice' : 'discord-widget-channel';
                link.href = `https://discord.com/channels/${DISCORD_GUILD_ID}/${channel.id}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = (liveChannel?.name || channel.name).replace(/[┃│]/g, ' ').trim();
                links.appendChild(link);
            });
            details.appendChild(links);
            container.appendChild(details);
        });
    }

    async function updateDiscordCount() {
        const countEl = document.getElementById('heroDiscordCount');
        const widget = document.getElementById('discordWidget');
        if (!countEl && !widget) return;

        try {
            const res = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`);
            if (!res.ok) throw new Error(`Discord widget request failed: ${res.status}`);
            const data = await res.json();
            const count = data?.presence_count;
            if (typeof count !== 'number') throw new Error('Discord widget response did not include a presence count');

            if (countEl) countEl.textContent = count.toLocaleString();
            if (!widget) return;

            const serverName = document.getElementById('discordWidgetName');
            const onlineCount = document.getElementById('discordWidgetOnline');
            const membersContainer = document.getElementById('discordWidgetMembers');
            const widgetStatus = document.getElementById('discordWidgetStatus');
            const inviteLink = document.getElementById('discordWidgetInvite');
            const members = Array.isArray(data.members) ? data.members : [];
            const humanMembers = members.filter(member =>
                member.bot !== true && member.is_bot !== true &&
                !DISCORD_WIDGET_BOT_NAMES.has(String(member.username || '').trim().toLowerCase())
            );
            const identifiableBots = members.length - humanMembers.length;
            const visibleOnlineCount = Math.max(0, count - identifiableBots);

            serverName.textContent = data.name || 'AstralyxPvP Discord';
            onlineCount.textContent = `${visibleOnlineCount.toLocaleString()} people online`;
            widgetStatus.textContent = 'Live Discord presence · known bots excluded';
            widget.dataset.state = 'ready';
            if (countEl) countEl.textContent = visibleOnlineCount.toLocaleString();

            if (data.instant_invite) {
                try {
                    const inviteUrl = new URL(data.instant_invite);
                    if (inviteUrl.protocol === 'https:' && ['discord.gg', 'discord.com'].includes(inviteUrl.hostname)) {
                        inviteLink.href = inviteUrl.href;
                    }
                } catch (error) {
                    console.warn('Ignoring invalid Discord invite URL.', error);
                }
            }

            membersContainer.replaceChildren();
            if (humanMembers.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'discord-widget-muted';
                empty.textContent = 'No non-bot members are listed as online right now.';
                membersContainer.appendChild(empty);
            } else {
                humanMembers.slice(0, 8).forEach(member => {
                    const memberItem = document.createElement('div');
                    memberItem.className = 'discord-widget-member';

                    const avatar = document.createElement('span');
                    avatar.className = 'discord-widget-avatar';
                    const avatarUrl = member.avatar_url || member.avatar;
                    if (typeof avatarUrl === 'string') {
                        try {
                            const parsedAvatar = new URL(avatarUrl);
                            if (parsedAvatar.protocol === 'https:' && parsedAvatar.hostname === 'cdn.discordapp.com') {
                                const image = document.createElement('img');
                                image.src = parsedAvatar.href;
                                image.alt = '';
                                image.loading = 'lazy';
                                avatar.appendChild(image);
                            }
                        } catch (error) {
                            console.warn('Ignoring invalid Discord avatar URL.', error);
                        }
                    }
                    if (!avatar.firstChild) avatar.textContent = (member.username || '?').slice(0, 1).toUpperCase();

                    const details = document.createElement('span');
                    details.className = 'discord-widget-member-details';
                    const username = document.createElement('span');
                    username.className = 'discord-widget-username';
                    username.textContent = member.username || 'Discord member';
                    const status = document.createElement('span');
                    const allowedStatuses = ['online', 'idle', 'dnd'];
                    const memberStatus = allowedStatuses.includes(member.status) ? member.status : 'online';
                    status.className = `discord-widget-member-status ${memberStatus}`;
                    status.textContent = memberStatus === 'dnd' ? 'Do not disturb' : memberStatus;
                    details.append(username, status);
                    memberItem.append(avatar, details);
                    membersContainer.appendChild(memberItem);
                });
            }

            renderDiscordChannels(Array.isArray(data.channels) ? data.channels : []);
        } catch (error) {
            console.error('Discord widget unavailable:', error);
            if (countEl) countEl.textContent = '—';
            if (widget) {
                widget.dataset.state = 'error';
                document.getElementById('discordWidgetOnline').textContent = 'Live presence unavailable';
                document.getElementById('discordWidgetStatus').textContent = 'Discord data is temporarily unavailable.';
                document.getElementById('discordWidgetMembers').textContent = 'Member data could not be loaded.';
                renderDiscordChannels();
            }
        }
    }

    // Hero typing tagline
    const TAGLINES = [
        "India-based 1.9+ FFA PvP arena",
        "Climb the live ELO leaderboard",
        "Cracked & free for every player",
        "Fast-paced shield & axe combat",
        "Low-latency pings across Asia"
    ];
    function initHeroTag() {
        const el = document.getElementById('heroTag');
        if (!el) return;
        let line = 0, pos = 0, deleting = false;
        function tick() {
            const current = TAGLINES[line];
            if (!deleting) {
                pos++;
                el.textContent = current.slice(0, pos);
                if (pos === current.length) {
                    deleting = true;
                    setTimeout(tick, 2200);
                    return;
                }
                setTimeout(tick, 55);
            } else {
                pos--;
                el.textContent = current.slice(0, pos);
                if (pos === 0) {
                    deleting = false;
                    line = (line + 1) % TAGLINES.length;
                    setTimeout(tick, 350);
                    return;
                }
                setTimeout(tick, 28);
            }
        }
        setTimeout(tick, 500);
    }

    // Leaderboard System
    let lbActive = null;
    let lbType = 'elo';
    let lbRequestId = 0;

    // Splits and cleans gamemode names (e.g. "swordffa" -> "SWORD FFA")
    function formatGMLabel(name) {
        if (!name) return '';
        let str = name.trim();
        str = str.replace(/(ffa|pvp|pot)/gi, ' $1');
        return str.replace(/\s+/g, ' ').trim().toUpperCase();
    }

    // Formats ISO timestamp cleanly
    function formatTimeAgo(isoString) {
        if (!isoString) return '—';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '—';
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '—';
        }
    }

    async function initLeaderboard() {
        const container = document.getElementById('gm');
        const out = document.getElementById('lb');
        if (!container) return;

        let gms = [];
        try {
            const res = await fetch(`${API_BASE}?gamemodes=true`);
            const data = await res.json();
            gms = data?.gamemodes || [];
        } catch (err) {
            console.error("GM Load Error:", err);
        }

        const activeModes = Array.isArray(gms) ? gms.filter(Boolean) : [];

        container.innerHTML = '';
        const xpButton = document.createElement('button');
        xpButton.type = 'button';
        xpButton.className = 'gm-btn';
        xpButton.dataset.boardType = 'xp';
        xpButton.innerHTML = '<span class="gm-label">XP</span><span class="gm-status">GLOBAL</span>';
        xpButton.addEventListener('click', selectXP);
        container.appendChild(xpButton);

        if (activeModes.length === 0) {
            selectXP();
            return;
        }

        const urlGm = new URLSearchParams(window.location.search).get('gamemode');
        const urlMatch = activeModes.find(gm => gm.toLowerCase() === (urlGm || '').toLowerCase());
        const initialActive = urlMatch || activeModes[0];

        activeModes.forEach(gm => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gm-btn';
            btn.classList.toggle('active', gm === initialActive);
            btn.dataset.boardType = 'elo';
            btn.dataset.gm = gm;
            btn.innerHTML = `<span class="gm-label">${escapeHtml(formatGMLabel(gm))}</span><span class="gm-status">LIVE</span>`;
            
            btn.addEventListener('click', () => selectGM(gm));
            container.appendChild(btn);
        });

        selectGM(initialActive);
    }

    function selectGM(gm) {
        lbType = 'elo';
        lbActive = gm;
        document.querySelectorAll('.gm-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.boardType === 'elo' && b.dataset.gm === gm);
        });
        refreshLB();
    }

    function selectXP() {
        lbType = 'xp';
        lbActive = null;
        document.querySelectorAll('.gm-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.boardType === 'xp');
        });
        refreshLB();
    }

    async function refreshLB() {
        const out = document.getElementById('lb');
        if (!out || (lbType === 'elo' && !lbActive)) return;

        const requestId = ++lbRequestId;
        const requestedType = lbType;
        const requestedMode = lbActive;
        out.innerHTML = `<div class="lb-loading">Loading ${lbType === 'xp' ? 'XP leaderboard' : 'standings'}...</div>`;

        try {
            if (requestedType === 'xp') {
                const res = await fetch('https://astralyx-xp-bot.indiancoder3.workers.dev/api/leaderboard?limit=100');
                if (!res.ok) throw new Error(`XP leaderboard request failed: ${res.status}`);
                const { leaderboard = [] } = await res.json();
                if (requestId !== lbRequestId) return;

                if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
                    out.innerHTML = '<div class="lb-empty">No XP players recorded yet.</div>';
                    return;
                }

                const rankClass = (i) => {
                    if (i === 0) return 'rank gold';
                    if (i === 1) return 'rank silver';
                    if (i === 2) return 'rank bronze';
                    return 'rank';
                };
                const rows = leaderboard.map((player, i) => {
                    const playerName = player.minecraft_name || `Discord user ${player.discord_id}`;
                    const avatar = player.minecraft_name
                        ? `<img src="https://minotar.net/helm/${encodeURIComponent(player.minecraft_name)}/24.png" alt="" loading="lazy">`
                        : '';
                    return `
                      <tr>
                        <td class="${rankClass(i)}">#${i + 1}</td>
                        <td><div class="player-cell">${avatar}<span class="player-name">${escapeHtml(playerName)}</span></div></td>
                        <td><span class="xp-player-level">${Number(player.level).toLocaleString()}</span></td>
                        <td><span class="elo-pill">${Number(player.xp).toLocaleString()} XP</span></td>
                      </tr>
                    `;
                }).join('');

                out.innerHTML = `
                  <div class="lb-meta-bar">
                    <span class="lb-total-count">Top XP Players: <strong>${leaderboard.length}</strong></span>
                  </div>
                  <table>
                    <thead><tr><th>Rank</th><th>Player</th><th>Level</th><th>XP</th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                `;

                const u = new URL(location.href);
                u.searchParams.delete('gamemode');
                history.replaceState({}, '', u.toString());
                return;
            }

            const res = await fetch(`${API_BASE}?leaderboard=${encodeURIComponent(requestedMode)}`);
            const json = await res.json();
            if (requestId !== lbRequestId) return;

            // Matches API response structure: { gamemode: "...", total: 3, top100: [...] }
            let players = Array.isArray(json) ? json : (json?.top100 || []);

            if (!Array.isArray(players) || players.length === 0) {
                out.innerHTML = '<div class="lb-empty">No players recorded for this gamemode yet.</div>';
                return;
            }

            // Ensure ladder is sorted highest to lowest ELO
            players = players.slice().sort((a, b) => (Number(b.elo) || 0) - (Number(a.elo) || 0));

            const rankClass = (i) => {
                if (i === 0) return 'rank gold';
                if (i === 1) return 'rank silver';
                if (i === 2) return 'rank bronze';
                return 'rank';
            };

            let html = `
              <div class="lb-meta-bar">
                <span class="lb-total-count">Active Competitors: <strong>${json?.total ?? players.length}</strong></span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>ELO</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
            `;

            players.slice(0, 100).forEach((p, i) => {
                const numericElo = Number(p.elo);
                const formattedElo = !isNaN(numericElo) ? numericElo.toLocaleString() : escapeHtml(p.elo);

                html += `
                  <tr>
                    <td class="${rankClass(i)}">#${i + 1}</td>
                    <td>
                      <div class="player-cell">
                        <img src="https://minotar.net/helm/${encodeURIComponent(p.username)}/24.png" alt="" loading="lazy">
                        <span class="player-name">${escapeHtml(p.username)}</span>
                      </div>
                    </td>
                    <td><span class="elo-pill">${formattedElo}</span></td>
                    <td class="last-seen-cell">${escapeHtml(formatTimeAgo(p.lastUpdate))}</td>
                  </tr>
                `;
            });

            html += '</tbody></table>';
            out.innerHTML = html;

            const u = new URL(location.href);
            u.searchParams.set('gamemode', requestedMode);
            history.replaceState({}, '', u.toString());
        } catch (err) {
            if (requestId !== lbRequestId) return;
            console.error("Leaderboard fetch error:", err);
            out.innerHTML = '<div class="lb-error">Failed to retrieve leaderboard data.</div>';
        }
    }

    window.refreshLB = refreshLB;

    function onReady(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    onReady(() => {
        Promise.all([
            initNavbar(),
            initFooter(),
            initLeaderboard()
        ]).then(() => {
            updateAllStatus();
            setInterval(updateAllStatus, 20000);
            updateDiscordCount();
            setInterval(updateDiscordCount, 60000);
            initHeroTag();
        }).catch(err => console.error("Init failed:", err));
    });

    // Page Exit Transitions
    document.addEventListener('click', e => {
        const a = e.target.closest('a');
        if(!a || a.target === '_blank' || a.hostname !== window.location.hostname || a.hash) return;
        e.preventDefault();
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = a.href; }, 180);
    });
})();

// AI Chat Dock Toggle
function toggleChatDock() {
    const dock = document.getElementById('chatDock');
    if (dock) dock.classList.toggle('open');
}

// Clipboard IP Copy
window.copyServerIP = function() {
    const serverIP = "play.astralyxpvp.org";
    navigator.clipboard.writeText(serverIP).catch(err => {
        console.error("Failed to copy IP:", err);
    });
};

document.addEventListener('click', e => {
    const btn = e.target.closest('[data-menu-copy]');
    if (btn) window.copyServerIP();
});

// Scroll to Top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('scroll', () => {
    const btn = document.getElementById('backToTop');
    if (btn) {
        if (window.scrollY > 300) btn.classList.add('visible');
        else btn.classList.remove('visible');
    }
}, { passive: true });
