(async function () {

  // =========================
  // CONFIG
  // =========================
  const API_BASE = "https://astralyxpvpweb.pages.dev/api/";

  window.serverContext = { online: false, current: 0, max: 0 };
  window.leaderboardContext = [];

  let conversationHistory = [];
  let currentModel = "gemini-3.1-flash-lite";

  // =========================
  // UTIL
  // =========================
  const escapeHtml = (s) =>
    (s ?? "").toString().replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

  // =========================
  // CONTEXT MENU
  // =========================
  const contextMenu = document.getElementById("contextMenu");

  if (contextMenu) {
    window.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      contextMenu.style.display = "block";

      const x = (e.clientX + 230 > window.innerWidth)
        ? e.clientX - 230
        : e.clientX;

      contextMenu.style.left = `${Math.max(0, x)}px`;
      contextMenu.style.top = `${Math.max(0, e.clientY)}px`;

      requestAnimationFrame(() => {
        contextMenu.classList.add("show");
        contextMenu.classList.remove("hide");
      });
    });

    window.addEventListener("click", () => {
      contextMenu.classList.remove("show");
      contextMenu.classList.add("hide");
      setTimeout(() => contextMenu.style.display = "none", 150);
    });
  }

  // =========================
  // SERVER + LEADERBOARD DATA
  // =========================
  async function updateServerContext() {
    try {
      const res = await fetch(`${API_BASE}?serverStatus=true`);
      const data = await res.json();

      window.serverContext = {
        online: data.online,
        current: data.current,
        max: data.max
      };
    } catch {
      window.serverContext = { online: false, current: 0, max: 0 };
    }
  }

  async function updateLeaderboardContext() {
    try {
      const res = await fetch(`${API_BASE}?leaderboard=global`);
      const data = await res.json();
      window.leaderboardContext = Array.isArray(data) ? data.slice(0, 10) : [];
    } catch {
      window.leaderboardContext = [];
    }
  }

  function buildAIContext() {
    const s = window.serverContext;
    const lb = window.leaderboardContext;

    let text = `LIVE SERVER INFO:\n- Online: ${s.online ? "Yes" : "No"}\n- Players: ${s.current}/${s.max}\n`;

    if (lb.length) {
      text += `\nTOP PLAYERS:\n`;
      lb.forEach((p, i) => {
        text += `${i + 1}. ${p.username} - ${p.elo}\n`;
      });
    }
    return text;
  }

  // =========================
  // NAVBAR
  // =========================
  async function initNavbar() {
    const container = document.getElementById("navbar-placeholder");
    if (!container) return;

    try {
      const res = await fetch("https://astralyxpvp.pages.dev/Assets/navbar.html");
      container.innerHTML = await res.text();
    } catch (e) {
      console.error("Navbar error", e);
    }
  }

  // =========================
  // FOOTER
  // =========================
  async function initFooter() {
    const container = document.getElementById("footer");
    if (!container) return;

    try {
      const res = await fetch("https://astralyxpvp.pages.dev/Assets/footer.html");
      container.innerHTML = await res.text();
    } catch (e) {
      console.error("Footer error", e);
    }
  }

  // =========================
  // NAV STATUS
  // =========================
  async function updateNavStatus() {
    const el = document.getElementById("nav-status");
    if (!el) return;

    try {
      const res = await fetch(`${API_BASE}?serverStatus=true`);
      const data = await res.json();

      if (data.online) {
        el.className = "server-pill online";
        el.textContent = `🟢 ${data.current}/${data.max} Online`;
      } else {
        el.className = "server-pill offline";
        el.textContent = "🔴 Offline";
      }
    } catch {
      el.className = "server-pill offline";
      el.textContent = "🔴 Offline";
    }
  }

  // =========================
  // LEADERBOARD UI
  // =========================
  async function initLeaderboard() {
    const select = document.getElementById("gm");
    const out = document.getElementById("lb");
    if (!select || !out) return;

    try {
      const res = await fetch(`${API_BASE}?gamemodes=true`);
      const data = await res.json();

      if (data?.gamemodes?.length) {
        select.innerHTML = data.gamemodes.map(g =>
          `<option value="${g}">${g}</option>`
        ).join("");
      }
    } catch {}

    select.addEventListener("change", refreshLB);
    refreshLB();
  }

  async function refreshLB() {
    const gm = document.getElementById("gm");
    const out = document.getElementById("lb");
    if (!gm || !out) return;

    out.innerHTML = "Loading...";

    try {
      const res = await fetch(`${API_BASE}?leaderboard=${gm.value}`);
      const data = await res.json();

      if (!Array.isArray(data)) return;

      let html = "<table><tbody>";

      data.slice(0, 50).forEach((p, i) => {
        html += `
          <tr>
            <td>#${i + 1}</td>
            <td>${escapeHtml(p.username)}</td>
            <td>${escapeHtml(p.elo)}</td>
          </tr>
        `;
      });

      out.innerHTML = html + "</tbody></table>";
    } catch {
      out.innerHTML = "Error loading leaderboard";
    }
  }

  // =========================
  // CHAT (AI PART)
  // =========================

  function toggleChatDock() {
    const dock = document.getElementById('chatDock');
    dock.classList.toggle('open');
  }
  async function callAPI(messages) {
    const res = await fetch(`${API_BASE}chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: currentModel })
    });

    if (!res.ok) throw new Error("API failed");
    const data = await res.json();

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  function addMessage(text, isUser = false, thinking = "") {
    const box = document.getElementById("chatMessages");

    const div = document.createElement("div");
    div.className = `message ${isUser ? "user" : "assistant"}`;

    div.innerHTML = `
      <div class="message-sender">${isUser ? "You" : "AstralyxAI"}</div>
      <div class="message-content">
        ${thinking ? `<div class="thinking-container">${thinking}</div>` : ""}
        <div>${text}</div>
      </div>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById("chatInput");
    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, true);
    input.value = "";

    try {
      conversationHistory.push({ role: "user", content: msg });

      await updateServerContext();
      await updateLeaderboardContext();

      const messages = [
        { role: "user", content: "SYSTEM PROMPT HERE" },
        { role: "user", content: buildAIContext() },
        ...conversationHistory
      ];

      const response = await callAPI(messages);

      let answer = response;
      let thinking = "";

      const t = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
      const a = response.match(/<answer>([\s\S]*?)<\/answer>/);

      if (t) thinking = t[1];
      if (a) answer = a[1];

      addMessage(answer, false, thinking);

    } catch (e) {
      addMessage("Error: " + e.message);
    }
  }

  window.sendMessage = sendMessage;

  // =========================
  // INIT EVERYTHING
  // =========================
  document.body.classList.add("page-enter");

  await Promise.all([
    initNavbar(),
    initFooter(),
    initLeaderboard()
  ]);

  setInterval(updateNavStatus, 20000);
  updateNavStatus();

  // smooth transitions
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || a.target === "_blank" || a.hostname !== location.hostname) return;

    e.preventDefault();
    document.body.classList.add("page-exit");

    setTimeout(() => location.href = a.href, 150);
  });

})();