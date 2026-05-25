(async function() {
    const API_BASE = "https://astralyxpvpweb.pages.dev/api/";
    const IP = "java.astralyx.int.it";

    const escapeHtml = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

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

    async function initNavbar() {
        const container = document.getElementById('navbar-placeholder');
        if (!container) return;
      
        try {
            const response = await fetch('https://astralyxpvp.pages.dev/Assets/navbar.html');
            if (!response.ok) throw new Error('Navbar missing');
            
            const html = await response.text();
            container.innerHTML = html;

            // Active link logic
            const currentPath = window.location.pathname.split("/").pop() || "index.html";
            container.querySelectorAll('.nav-links a').forEach(link => {
                if(link.getAttribute('href') === currentPath) link.classList.add('active');
            });

            // Adjust main content padding so it's not hidden under a fixed nav
            const nav = container.querySelector('nav');
            const mainContent = document.querySelector('.page-content');
            if (nav && mainContent) {
                requestAnimationFrame(() => {
                    mainContent.style.paddingTop = `${nav.offsetHeight}px`;
                });
            }

            updateNavStatus();
        } catch (error) {
            console.error('Navbar error:', error);
        }
    }
    async function initFooter() {
        const container = document.getElementById('footer'); // Ensure your HTML has <div id="footer"></div>
        if (!container) return;
    
        try {
            const response = await fetch('https://astralyxpvp.pages.dev/Assets/footer.html');
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
            // Fallback content in case the fetch fails
            container.innerHTML = `<footer style="text-align:center; padding:20px; color:var(--muted);">
                &copy; ${new Date().getFullYear()} AstralyxPvP. All rights reserved.
            </footer>`;
        }
    }

    async function updateNavStatus() {
        const el = document.getElementById('nav-status');
        if (!el) return;

        try {
            const response = await fetch(`${API_BASE}?serverStatus=true`);
            const data = await response.json();

            if (data.online) {
                el.className = 'server-pill online';
                el.textContent = `🟢 ${data.current}/${data.max} Online`;
            } else {
                el.className = 'server-pill offline'; el.textContent = '🔴 Offline';
            }
        } catch (error) {
            el.className = 'server-pill offline'; el.textContent = '🔴 Offline';
        }
    }

    async function initLeaderboard() {
        const select = document.getElementById('gm');
        if (!select) return;

        try {
            const res = await fetch(`${API_BASE}?gamemodes=true`);
            const data = await res.json();
            const gms = data?.gamemodes || [];

            if (gms.length > 0) {
                select.innerHTML = gms.map(gm => `<option value="${gm}">${gm}</option>`).join('');
                const urlGm = new URLSearchParams(window.location.search).get('gamemode');
                if (urlGm && gms.includes(urlGm)) select.value = urlGm;
            }
        } catch (err) { console.error("GM Load Error:", err); }

        select.addEventListener('change', refreshLB);
        refreshLB();
    }

    async function refreshLB() {
        const gmSelect = document.getElementById('gm');
        const out = document.getElementById('lb');
        if (!gmSelect || !out) return;

        out.innerHTML = '<div style="text-align:center;color:var(--muted);padding:14px 0">Loading...</div>';

        try {
            const res = await fetch(`${API_BASE}?leaderboard=${encodeURIComponent(gmSelect.value)}`);
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                out.innerHTML = '<div style="text-align:center;padding:14px 0">No data found.</div>';
                return;
            }

            let html = '<table><thead><tr><th>Rank</th><th>Player</th><th>ELO</th></tr></thead><tbody>';
            data.slice(0, 100).forEach((p, i) => {
                html += `<tr>
                    <td class="rank">#${i + 1}</td>
                    <td>
                      <img src="https://minotar.net/helm/${encodeURIComponent(p.username)}/24.png" style="vertical-align:middle;margin-right:10px;border-radius:3px" loading="lazy">
                      ${escapeHtml(p.username)}
                    </td>
                    <td>${escapeHtml(p.elo)}</td>
                  </tr>`;
            });
            out.innerHTML = html + '</tbody></table>';

            const u = new URL(location.href);
            u.searchParams.set('gamemode', gmSelect.value);
            history.replaceState({}, '', u.toString());
        } catch (err) {
            out.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:14px 0">Error loading leaderboard.</div>';
        }
    }

    document.body.classList.add('page-enter');
    

    setInterval(updateNavStatus, 20000);

    document.body.classList.add('page-enter');
    
    Promise.all([
        initNavbar(),
        initFooter(),
        initLeaderboard()
    ]).catch(err => console.error("Init failed:", err));

    // Refresh server status every 20s
    setInterval(updateNavStatus, 20000);

    // Smooth Page Transitions
    document.addEventListener('click', e => {
        const a = e.target.closest('a');
        // Ignore external links, target="_blank", or anchors
        if(!a || a.target === '_blank' || a.hostname !== window.location.hostname || a.hash) return;
        
        e.preventDefault();
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = a.href; }, 180);
    });
})();