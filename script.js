(function () {
  'use strict';

  /* ── CONFIG ── */
  const API_BASE = 'https://astralyxpvp.chessmrbeaston.workers.dev/api/';
  const SERVER_IP = 'java.astralyxpvp.int.yt';
  const STATUS_INTERVAL = 20_000; // ms between server status polls

  /* ── UTILS ── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const escapeHtml = (s) =>
    (s ?? '').toString().replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ── CURSOR PRELOAD ── */
  (function preloadCursor() {
    const img = new Image();
    img.onload = () => console.log('[Cursor] Sword cursor loaded ✓');
    img.onerror = () => console.warn('[Cursor] Cursor image missing — check Assets/cursor-sword.png');
    img.src = '/Assets/cursor-sword.png';
  })();

  /* ── SERVER STATUS ── */
  async function fetchServerStatus() {
    try {
      const res = await fetch(`${API_BASE}?serverStatus=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { online: false };
    }
  }

  async function updateNavStatus() {
    const pill = document.getElementById('nav-status');
    if (!pill) return;
    const data = await fetchServerStatus();
    if (data.online) {
      pill.className = 'server-pill online';
      pill.textContent = `🟢 ${data.current}/${data.max} Online`;
    } else {
      pill.className = 'server-pill offline';
      pill.textContent = '🔴 Offline';
    }
  }

  async function updateHeroStatus() {
    const valEl = document.getElementById('heroPlayers');
    const subEl = document.getElementById('heroStatusText');
    if (!valEl) return;
    const data = await fetchServerStatus();
    if (data.online) {
      valEl.textContent = `${data.current}/${data.max}`;
      if (subEl) subEl.textContent = 'Players in arena right now';
    } else {
      valEl.textContent = 'Offline';
      if (subEl) subEl.textContent = 'Server is currently offline';
    }
  }

  /* ── NAVBAR ── */
  async function initNavbar() {
    const container = document.getElementById('navbar-placeholder');
    if (!container) return;

    try {
      const res = await fetch('/Assets/navbar.html');
      if (!res.ok) throw new Error('Navbar fetch failed');
      container.innerHTML = await res.text();
    } catch (err) {
      console.error('[Navbar]', err);
      return;
    }

    const nav = $('nav', container);
    const navLinks = $('#navLinks', container);
    const hamburger = $('#mobileToggle', container);
    const mobileClose = $('.mobile-close', container);
    const backdrop = $('.nav-backdrop', container);
    const mainContent = $('.page-content');

    if (!nav || !navLinks) return;

    /* Active link */
    const cur = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    $$('.nav-links a', container).forEach((a) => {
      const href = (a.getAttribute('href') || '').replace(/\.html$/, '');
      if (href === `/${cur}` || href === cur || (cur === 'index' && href === '/')) {
        a.classList.add('active');
      }
    });

    /* Open / close drawer */
    function openMenu() {
      navLinks.classList.add('active');
      backdrop && backdrop.classList.add('active');
      hamburger && hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      navLinks.classList.remove('active');
      backdrop && backdrop.classList.remove('active');
      hamburger && hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger && hamburger.addEventListener('click', () =>
      navLinks.classList.contains('active') ? closeMenu() : openMenu()
    );
    mobileClose && mobileClose.addEventListener('click', closeMenu);
    backdrop && backdrop.addEventListener('click', closeMenu);

    /* Close on any nav link click (mobile) */
    $$('.nav-links a', container).forEach((a) =>
      a.addEventListener('click', () => { if (window.innerWidth <= 860) closeMenu(); })
    );

    /* Escape key closes menu */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('active')) closeMenu();
    });

    /* Scroll glass effect */
    function checkScroll() {
      nav.classList.toggle('nav-scrolled', window.scrollY >= 20);
    }
    window.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();

    /* Padding for fixed nav */
    function adjustPadding() {
      if (mainContent) mainContent.style.paddingTop = nav.offsetHeight + 'px';
    }
    new ResizeObserver(adjustPadding).observe(nav);
    adjustPadding();

    /* Status poll */
    updateNavStatus();
    setInterval(updateNavStatus, STATUS_INTERVAL);
  }

  /* ── FOOTER ── */
  async function initFooter() {
    const container = document.getElementById('footer');
    if (!container) return;

    try {
      const res = await fetch('/Assets/footer.html');
      if (!res.ok) throw new Error('Footer fetch failed');
      container.innerHTML = await res.text();
    } catch {
      container.innerHTML = `<footer style="text-align:center;padding:20px;color:var(--muted)">
        &copy; ${new Date().getFullYear()} AstralyxPvP. All rights reserved.
      </footer>`;
      return;
    }

    /* Highlight active footer link */
    const cur = location.pathname.split('/').pop() || 'index.html';
    $$('.footer-links a', container).forEach((a) => {
      if (a.getAttribute('href') === cur) a.classList.add('active');
    });

    const yearEl = container.querySelector('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* ── COPY IP ── */
  window.copyServerIP = function () {
    const ipSpan = document.getElementById('server-ip');
    if (!ipSpan) return;

    const ip = SERVER_IP;
    navigator.clipboard.writeText(ip).catch(() => {});

    /* Visual feedback */
    const btn = ipSpan.closest('.hero-btn');
    const copyIcon = btn ? btn.querySelector('.btn-copy-icon, .fa-copy, .fa-play') : null;

    ipSpan.textContent = 'Copied!';
    btn && btn.classList.add('copied');

    if (copyIcon) {
      copyIcon.className = copyIcon.className.replace(/fa-(play|copy)/, 'fa-check');
    }

    setTimeout(() => {
      ipSpan.textContent = ip;
      btn && btn.classList.remove('copied');
      if (copyIcon) {
        copyIcon.className = copyIcon.className.replace('fa-check', 'fa-copy');
      }
    }, 2000);
  };

  /* ── CONTEXT MENU ── */
  function initContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const x = e.clientX + 230 > window.innerWidth ? e.clientX - 230 : e.clientX;
      menu.style.left = `${Math.max(0, x)}px`;
      menu.style.top = `${Math.max(0, e.clientY)}px`;
      menu.style.display = 'block';
      requestAnimationFrame(() => {
        menu.classList.remove('hide');
        menu.classList.add('show');
      });
    });

    function closeCtx() {
      if (!menu.classList.contains('show')) return;
      menu.classList.remove('show');
      menu.classList.add('hide');
      setTimeout(() => {
        menu.style.display = 'none';
        menu.classList.remove('hide');
      }, 180);
    }

    window.addEventListener('click', closeCtx);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });

    /* Context menu copy button */
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu-copy]')) window.copyServerIP();
    });
  }

  /* ── BACK TO TOP ── */
  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
  }

  window.scrollToTop = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── CHAT DOCK ── */
  window.toggleChatDock = function () {
    const dock = document.getElementById('chatDock');
    if (dock) dock.classList.toggle('open');
  };

  /* ── LEADERBOARD ── */
  async function initLeaderboard() {
    const select = document.getElementById('gm');
    if (!select) return;

    try {
      const res = await fetch(`${API_BASE}?gamemodes=true`);
      const data = await res.json();
      const gms = data?.gamemodes || [];

      if (gms.length > 0) {
        select.innerHTML = gms.map((gm) => `<option value="${gm}">${gm}</option>`).join('');
        const urlGm = new URLSearchParams(location.search).get('gamemode');
        if (urlGm && gms.includes(urlGm)) select.value = urlGm;
      } else {
        select.innerHTML = '<option disabled selected>No gamemodes available</option>';
        const out = document.getElementById('lb');
        if (out) out.innerHTML = '<div style="text-align:center;padding:14px 0">No gamemodes found.</div>';
      }
    } catch (err) {
      console.error('[LB] Gamemode load error:', err);
    }

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

      const rankClass = (i) => ['rank gold', 'rank silver', 'rank bronze'][i] || 'rank';

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
    } catch {
      out.innerHTML = '<div class="lb-error">Error loading leaderboard. Try refreshing.</div>';
    }
  }

  /* ── PAGE TRANSITIONS ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || a.target === '_blank' || a.hostname !== location.hostname || a.hash) return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => { location.href = a.href; }, 180);
  });

  /* ── INIT ── */
  onReady(() => {
    initNavbar();
    initFooter();
    initContextMenu();
    initBackToTop();
    initLeaderboard();
    updateHeroStatus();
  });

})();
