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
            
            function openMenu() {
                hamburger.classList.add('active');
                if (window.innerWidth <= 860) {
                    document.body.appendChild(navLinks);
                }
                requestAnimationFrame(() => {
                    navLinks.classList.add('active');
                    if (backdrop) backdrop.classList.add('active');
                });
            }
            
            function closeMenu() {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
                setTimeout(() => {
                    if (window.innerWidth <= 860 && navLinks.parentNode !== container.querySelector('nav')) {
                        const nav = container.querySelector('nav');
                        if (nav) nav.appendChild(navLinks);
                    }
                }, 300);
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
                mobileClose.addEventListener('click', closeMenu);
            }
            if (backdrop && navLinks) {
                backdrop.addEventListener('click', closeMenu);
            }

            // Group dropdowns
            container.querySelectorAll('.nav-dropdown').forEach(dropdown => {
                const dropdownToggle = dropdown.querySelector('.nav-dropdown-toggle');
                const dropdownMenu = dropdown.querySelector('.nav-dropdown-menu');
                if (!dropdownToggle || !dropdownMenu) return;
                dropdownToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isOpen = dropdown.classList.toggle('open');
                    dropdownToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });
                dropdownMenu.querySelectorAll('a').forEach(item => {
                    item.addEventListener('click', () => {
                        dropdown.classList.remove('open');
                        dropdownToggle.setAttribute('aria-expanded', 'false');
                        if (window.innerWidth <= 1024) closeMenu();
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

            window.addEventListener('resize', checkWrap);
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

    // Discord live presence
    const DISCORD_INVITE = "u8BFrpRwEg";
    async function updateDiscordCount() {
        const el = document.getElementById('heroDiscordCount');
        if (!el) return;
        try {
            const res = await fetch(`https://discord.com/api/v9/invites/${DISCORD_INVITE}?with_counts=true`);
            const data = await res.json();
            const count = data?.approximate_presence_count;
            if (typeof count === 'number') el.textContent = count;
        } catch (error) {
            el.textContent = "—";
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

        // If no modes exist in the backend, don't show any buttons
        if (activeModes.length === 0) {
            container.innerHTML = '';
            if (out) out.innerHTML = '<div class="lb-empty">No active gamemodes found.</div>';
            return;
        }

        const urlGm = new URLSearchParams(window.location.search).get('gamemode');
        const urlMatch = activeModes.find(gm => gm.toLowerCase() === (urlGm || '').toLowerCase());
        const initialActive = urlMatch || activeModes[0];

        container.innerHTML = '';
        activeModes.forEach(gm => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gm-btn';
            btn.classList.toggle('active', gm === initialActive);
            btn.dataset.gm = gm;
            btn.innerHTML = `<span class="gm-label">${escapeHtml(formatGMLabel(gm))}</span><span class="gm-status">LIVE</span>`;
            
            btn.addEventListener('click', () => selectGM(gm));
            container.appendChild(btn);
        });

        selectGM(initialActive);
    }

    function selectGM(gm) {
        lbActive = gm;
        document.querySelectorAll('.gm-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.gm === gm);
        });
        refreshLB();
    }

    async function refreshLB() {
        const out = document.getElementById('lb');
        if (!out || !lbActive) return;

        out.innerHTML = '<div class="lb-loading">Loading standings...</div>';

        try {
            const res = await fetch(`${API_BASE}?leaderboard=${encodeURIComponent(lbActive)}`);
            const json = await res.json();

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
            u.searchParams.set('gamemode', lbActive);
            history.replaceState({}, '', u.toString());
        } catch (err) {
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
