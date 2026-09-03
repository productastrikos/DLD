# Deploying to Hostinger

The platform is **one Node process**. Express serves the API under `/api` and
the built React SPA from `/dist` on the same origin, so there is no CORS
configuration, no second service, and no database to provision — the CSV
datasets in `/data` ship with the repository and are read into memory at boot.

That shape decides the hosting: **the app needs a Node runtime.** A pure
static/PHP plan cannot run it (see [Static-only hosting](#static-only-hosting)).

| Hostinger product | Works | How |
|---|---|---|
| **VPS** | ✅ Recommended | [Docker](#option-a-vps-with-docker) or [PM2 + Nginx](#option-b-vps-with-pm2--nginx) |
| **Shared / Cloud with a Node.js app in hPanel** | ✅ | [hPanel Node.js](#option-c-hpanel-nodejs-application) |
| **Shared hosting, static files only** | ⚠️ Partial | [Static-only hosting](#static-only-hosting) |

Whichever route you take, two things are constant:

* **Startup file:** `app.js` at the repository root.
* **Port:** the app reads `PORT` (falling back to `API_PORT`, then `5061`) and
  binds `HOST`, default `0.0.0.0`. Never hard-code a port into a proxy config
  without setting the matching environment variable.

Health check: `GET /api/health` returns `{"status":"ok", ...}`.

---

## Option A — VPS with Docker

Hostinger VPS plans can be provisioned with the Docker or Coolify template.

```bash
git clone https://github.com/productastrikos/DLD.git dld-platform
cd dld-platform
docker compose up -d --build
```

The container binds `127.0.0.1:5061` only, so put Nginx in front of it for TLS:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dld-platform
sudo sed -i 's/your-domain.com/YOURDOMAIN/g' /etc/nginx/sites-available/dld-platform
sudo ln -s /etc/nginx/sites-available/dld-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOURDOMAIN -d www.YOURDOMAIN
```

Redeploy after a push:

```bash
git pull && docker compose up -d --build
```

## Option B — VPS with PM2 + Nginx

No Docker. Install Node 20 (`nvm install 20`), then:

```bash
git clone https://github.com/productastrikos/DLD.git /var/www/dld-platform
cd /var/www/dld-platform
npm ci
npm run build          # writes /dist — required, the SPA is not committed
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

Then the same Nginx + certbot steps as Option A.

`deploy/dld-platform.service` is there if you would rather use systemd than PM2;
it expects the checkout at `/var/www/dld-platform`.

Redeploy: `git pull && npm ci && npm run build && pm2 restart dld-platform`.

## Option C — hPanel Node.js application

If your plan exposes **Advanced → Node.js** in hPanel:

1. **Create application**
   * Node version: **20** (18.18+ works; see `.nvmrc`)
   * Application root: the directory you deploy into, e.g. `dld-platform`
   * Application URL: your domain or subdomain
   * **Application startup file: `app.js`**
2. Deploy the code into the application root — hPanel's Git integration
   pointed at `https://github.com/productastrikos/DLD.git`, or SSH/SFTP.
3. **Run NPM Install** from the application panel.
4. Build the SPA. `/dist` is deliberately not committed, so it must be produced
   on the server: use the panel's *Run JS script* action on **`build`**, or over
   SSH `cd ~/dld-platform && npm run build`.
5. **Restart** the application, then open `https://yourdomain/api/health`.

Notes for this environment:

* Passenger injects `PORT` and intercepts `listen()` — do not set a port
  manually in hPanel's environment variables.
* If the build step runs out of memory, build locally and upload `dist/`
  alongside the code; nothing else about the deployment changes.
* hPanel writes its own `public_html/.htaccess` with the Passenger directives.
  Leave it alone — the `.htaccess` in this repo only ever lands inside `dist/`.

---

## Static-only hosting

You *can* upload just `dist/` to `public_html` on a plain shared plan — the
bundled `.htaccess` handles SPA deep links, compression, and cache headers — but
**understand what breaks**: every screen loads its data from `/api`, so with no
Node process behind it the app renders its shell and then fails to load. The
workflow demos (submitting a participation request, approving one, launching a
campaign) are server-side mutations and cannot work at all.

Use this only to preview the front-end shell. For a working demo, point the
static site at a Node instance running elsewhere, or use Options A–C.

---

## Environment variables

Copy `.env.example` for reference. Nothing is secret; the app has no external
dependencies, no API keys, and no database credentials.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5061` | Listen port. Set by Hostinger/Passenger automatically. |
| `HOST` | `0.0.0.0` | Bind interface. Must stay `0.0.0.0` behind a proxy or in Docker. |
| `NODE_ENV` | — | Set to `production` on a server. |
| `API_PORT` | `5061` | Local development only, used by `npm run dev`. |

## Data and persistence

`/data/*.csv` is the system of record and is read into memory at startup.
Mutations made through the UI are applied **in memory only** — they are visible
for the life of the process and vanish on restart. That is intentional for a POC
and means a redeploy always returns to the same clean baseline. If a demo needs
to survive restarts, that is the point at which a real database goes in.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Shell loads, every panel errors | `/api` is not reachable — the Node process is down, or a static-only deploy. Check `/api/health`. |
| 404 on refresh of a deep link | SPA fallback missing — Express handles it when it serves `dist`; on Apache/LiteSpeed confirm `.htaccess` was uploaded (it is a dotfile; many FTP clients hide it). |
| `No /dist build found` in the logs | `npm run build` has not been run on the server. |
| Old UI after a deploy | `index.html` is being cached upstream. Purge the CDN/browser cache; the app itself sends `no-cache` for the shell. |
| Port already in use | Another process holds `PORT`; on a VPS check `pm2 list` / `docker ps`. |
