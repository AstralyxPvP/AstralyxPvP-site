
[![GitHub license](https://img.shields.io/github/license/AstralyxPvP/AstralyxPvP-site?style=for-the-badge&color=blue&logo=gnu)](LICENSE)
[![Deployment Status](https://img.shields.io/github/check-runs/AstralyxPvP/AstralyxPvP-site/main?style=for-the-badge&label=deployment&logo=github)](https://astralyxpvp.org)
[![Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-orange?style=for-the-badge&logo=cloudflare)](https://astralyxpvp.org)
[![Technologies](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS-green?style=for-the-badge&logo=html5&logoColor=white)](https://astralyxpvp.org)
[![AI Powered](https://img.shields.io/badge/AI%20Powered-Google%20Gemini-red?style=for-the-badge&logo=google&logoColor=white)](https://astralyxpvp.org/astralyxai)
[![Discord](https://img.shields.io/discord/1477025023800901766?style=for-the-badge&logo=discord&logoColor=white&color=7389D8&label=discord)](https://discord.gg/u8BFrpRwEg)
[![YouTube](https://img.shields.io/badge/YouTube-@AstralyxPvP-red?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@AstralyxPvP)
[![Status](https://img.shields.io/website?url=https%3A%2F%2Fastralyxpvp.org%2F&style=for-the-badge&up_message=online&down_message=offline&logo=cloudflarepages)](https://astralyxpvp.org)

[![GitHub Org's stars](https://img.shields.io/github/stars/astralyxpvp?style=for-the-badge&logo=github&link=https%3A%2F%2Fgithub.com%2FAstralyxPvP%2F)](https://github.com/AstralyxPvP/)
---

# AstralyxPvP-site

![AstralyxPvP Logo](https://astralyxpvp.org/Assets/logo.png)

## AstralyxPvP - The Ultimate 1.9+ FFA PvP Battlefield

## ⚔️ About AstralyxPvP

AstralyxPvP is an intense, India-based 1.9+ FFA (Free-For-All) Minecraft PvP server designed for players who crave fast-paced combat and skill-based battles. Step into the arena and prove your dominance with our unique ELO system, live leaderboards, and a vibrant community.

## 🚀 Key Features

* **1.9+ FFA PvP Combat** – Experience dynamic shield and axe combat that puts your skills to the test.
* **ELO System** – Climb the ranks with a skill-based ELO system that tracks every kill and death.
* **Live Leaderboards** – Monitor your performance in real-time with our constantly updated leaderboards.
* **Cracked & Free Access** – Everyone is welcome! Join with any client and jump into FFA action for free.
* **AstralyxAI Chat Assistant** – An integrated AI assistant powered by Google Gemini and secured with Cloudflare Turnstile, built to help players with questions and provide instant information.
* **Discord Integration** – Connected directly with an active Discord community for support, discussions, and server updates.

## 🛠️ Technologies Used

This project leverages a combination of modern frontend web technologies and secure cloud services:

* **Frontend Development:** Vanilla HTML5, CSS3 (including `@media` layouts), and native JavaScript.
* **Hosting & Deployment:** Cloudflare Pages (primary `astralyxpvp.org`). The older `astralyxpvp.int.yt` domain is a legacy redirect only — it is not a game server address.
* **AI Integration:** Google Family of AI Models via the Gemini API (for AstralyxAI feature).
* **Security & Verification:** Cloudflare Turnstile bot protection.
* **Version Control:** Git & GitHub for repository management.

## 💻 Installation and Setup (Local)

To download and run this project locally for testing or development, follow these steps:

1. **Clone the Repository:**
```bash
git clone https://github.com/AstralyxPvP/AstralyxPvP-site.git
cd AstralyxPvP-site
```


2. **Run a Local Server:**
This project is built using static frontend assets and does not require complex backend setups. To view the pages correctly, open the directory using a local web server tool (such as the **Live Server** extension in VS Code). <details><summary>Why use a live server instead of `file://`?</summary>When you use `file://`, the webpage may load, but you may encounter issues such as: Longer load times..., NavBar, footer, and other elements blocked by CORS..., And more... </details> 

- Note that the AI, and some other features will not work on local Environment, as the AI uses environment variables to fetch the API Key. You need to store your key safely and link it into the code.

## Server Status Data

The status page uses a direct Minecraft Java Server List Ping from the Cloudflare status Worker. It resolves the published Minecraft SRV record, connects to its target over TCP, and reads the server's status response; it does not depend on mcstatus.io or display an HTTP request duration as game latency. The Worker samples live status into the `astralyxpvp-minecraft-status` D1 database every five minutes.

AstralyxXP checks are sampled into the same D1 database in five-minute buckets. History starts when the migration is applied, so earlier periods remain unknown rather than being backfilled with invented data. The status-page AI reads recent News posts, all Forums category/subcategory post feeds, and the 20 newest Discord announcements, alongside the exact current UTC/Asia-Kolkata time and direct Minecraft status history. It summarizes Minecraft launch/status updates and ignores unrelated website-only fixes.

The status-page “Know More” control expands a short AI-generated paragraph in place; it does not redirect to News.

AstralyxAI text generation uses only Gemma and Gemini Flash-Lite models. The real-time voice endpoint is unavailable because its supported live model is outside that allowlist.

AstralyxAI can load the full News/Forums/Discord heading catalog, including the complete Forums category and subcategory hierarchy, then make a second lookup for a selected News post, Forum thread, or Discord announcement.

Run the Pages Functions and D1 locally with:

```bash
npx wrangler d1 migrations apply astralyxpvp-minecraft-status --local
npx wrangler pages dev . --port 8787
```

## 🌐 Live Usage

Explore the live platform directly at:

👉 **[https://astralyxpvp.org](https://astralyxpvp.org)**

Minecraft connection details:

* **Java Edition:** `play.astralyxpvp.org:25565`
* **Discord invite:** [https://astralyxpvp.org/joindc](https://astralyxpvp.org/joindc)
* **Service status:** [https://astralyxpvp.org/status](https://astralyxpvp.org/status)

The Pages `_redirects` file maps the clean status route to `status.html` and the
Discord short link to the current invite. The `status.astralyxpvp.org` hostname
also redirects to the clean status route when that hostname is connected to this
Pages project in DNS.

## 🤝 Contributing

We welcome community contributions to help improve the AstralyxPvP website! If you find a bug or want to introduce a feature, feel free to submit a **Pull Request**.

We are currently prioritizing development help in these areas:

* 🎨 **UI Improvements & Core JavaScript**
* 📱 **Mobile & Phone Layout Optimizations** (Crucial)
* 🤖 **Refining AI Interactions & Services**

## 📄 License

This project is licensed under the **GNU GPL v3 License**. Check out the [LICENSE](./LICENSE) file for complete details.

## 📞 Contact & Support

If you have questions, suggestions, or need support, reach out to the development team:

* 📧 **Main contact email:** [info@astralyxpvp.org](mailto:info@astralyxpvp.org). Staff mailboxes are hosted on AstralyxMail at [mail.astralyxpvp.org](https://mail.astralyxpvp.org).

### Status history monitor

The `status-monitor-worker/` Worker writes Minecraft and AstralyxXP health samples to the `astralyxpvp-minecraft-status` D1 database every five minutes and prunes samples older than seven days. Deploy or update the scheduled Worker with:

```sh
npx wrangler deploy --config status-monitor-worker/wrangler.jsonc
```

Its D1 schema is managed by the site migrations in `migrations/`. The Pages project also needs the `MINECRAFT_STATUS_DB` D1 binding configured from the root `wrangler.jsonc`.
* 💬 **Discord Community:** [Join our Discord Server](https://discord.gg/u8BFrpRwEg)

---

© NebulaGames 2026. We are not affilated with Mojang.
