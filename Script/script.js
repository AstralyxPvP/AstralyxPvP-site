(async function() {
    const API_BASE = "https://astralyxpvp.chessmrbeaston.workers.dev/api/";
    const IP = "java.astralyx.int.it";

    const escapeHtml = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    // Preload custom cursor & log result
    (function preloadCursor() {
        const img = new Image();
        img.onload = () => console.log('[Cursor] Diamond sword cursor loaded successfully');
        img.onerror = () => console.warn('[Cursor] Failed to load cursor image — check path or file format');
        img.src = '../Assets/cursor-sword.png';
    })();

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
            const response = await fetch('Assets/navbar.html');
            if (!response.ok) throw new Error('Navbar missing');
            
            const html = await response.text();
            container.innerHTML = html;

            // Hamburger menu toggle
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

            // Active link logic
            const currentPath = (window.location.pathname.split("/").pop() || "index.html").replace(/\.html$/, '');
            container.querySelectorAll('.nav-links a').forEach(link => {
              const href = link.getAttribute('href').replace(/\.html$/, '');
              if (href === '/' + currentPath || href === currentPath) link.classList.add('active');
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

            // Double-decker wrap detection + dynamic padding
            function checkWrap() {
              var items = Array.from(navLinks.children).filter(function(el) { return el.tagName === 'A'; });
              var wrapped = false;
              var firstTop = items[0] && items[0].offsetTop;
              for (var i = 1; i < items.length; i++) {
                if (items[i].offsetTop > firstTop) { wrapped = true; break; }
              }
              nav.classList.toggle('double-decker', wrapped);
              mainContent.style.paddingTop = nav.offsetHeight + 'px';
            }
            var ro = new ResizeObserver(checkWrap);
            ro.observe(navLinks);
            checkWrap();

            // Glass nav on scroll — starts transparent at top
            function checkScroll() {
              nav.classList.toggle('nav-scrolled', window.scrollY >= 20);
            }
            window.addEventListener('scroll', checkScroll, { passive: true });
            checkScroll();

            // Re-check wrap on resize (fallback for browsers without ResizeObserver)
            window.addEventListener('resize', checkWrap);
        } catch (error) {
            console.error('Navbar error:', error);
        }
    }
    async function initFooter() {
        const container = document.getElementById('footer'); // Ensure your HTML has <div id="footer"></div>
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
            } else {
            select.innerHTML = '<option disabled selected>No gamemodes available</option>';
            const out = document.getElementById('lb');
            if (out) out.innerHTML = '<div style="text-align:center;padding:14px 0">No gamemodes found.</div>';
            }
        } catch (err) { console.error("GM Load Error:", err); }

        select.addEventListener('change', refreshLB);
        refreshLB();
    }

    async function refreshLB() {
        const gmSelect = document.getElementById('gm');
        const out = document.getElementById('lb');
        if (!gmSelect || !out) return;

        out.innerHTML = '<div class="lb-loading">Loading...</div>';

        try {
            const res = await fetch(`${API_BASE}?leaderboard=${encodeURIComponent(gmSelect.value)}`);
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                out.innerHTML = '<div class="lb-empty">No data found.</div>';
                return;
            }

            const rankClass = (i) => {
                if (i === 0) return 'rank gold';
                if (i === 1) return 'rank silver';
                if (i === 2) return 'rank bronze';
                return 'rank';
            };

            let html = '<table><thead><tr><th>Rank</th><th>Player</th><th>ELO</th></tr></thead><tbody>';
            data.slice(0, 100).forEach((p, i) => {
                html += `<tr>
                    <td class="${rankClass(i)}">#${i + 1}</td>
                    <td>
                      <div class="player-cell">
                        <img src="https://minotar.net/helm/${encodeURIComponent(p.username)}/24.png" alt="" loading="lazy">
                        <span class="player-name">${escapeHtml(p.username)}</span>
                      </div>
                    </td>
                    <td><span class="elo-pill">${escapeHtml(p.elo)}</span></td>
                  </tr>`;
            });
            out.innerHTML = html + '</tbody></table>';

            const u = new URL(location.href);
            u.searchParams.set('gamemode', gmSelect.value);
            history.replaceState({}, '', u.toString());
        } catch (err) {
            out.innerHTML = '<div class="lb-error">Error loading leaderboard.</div>';
        }
    }

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
            setInterval(updateNavStatus, 20000);
        }).catch(err => console.error("Init failed:", err));
    });

    // Smooth Page Transitions
    document.addEventListener('click', e => {
        const a = e.target.closest('a');
        if(!a || a.target === '_blank' || a.hostname !== window.location.hostname || a.hash) return;
        e.preventDefault();
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = a.href; }, 180);
    });
})();

// Some AI Button CSS? YES SIR
function toggleChatDock() {
  const dock = document.getElementById('chatDock');
  dock.classList.toggle('open');
}

window.copyServerIP = function() {
  const ip = document.getElementById('server-ip');
  if (!ip) return;
  navigator.clipboard.writeText(ip.textContent.trim()).catch(() => {});
};

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-menu-copy]');
  if (btn) window.copyServerIP();
});

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
