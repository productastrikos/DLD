# Deploying to Hostinger

The platform is **one Node process**. Express serves the API under `/api` and
the built React SPA from `/dist` on the same origin — no database, no second
service, no CORS to configure. The CSV datasets in `/data` and the built SPA in
`/dist` both ship with the repository, so **the server installs two packages and
starts. It does not build anything.**

Two constants, whichever way you deploy:

* **Startup file:** `app.js` at the repository root.
* **Port:** the app reads `PORT` (falling back to `API_PORT`, then `5061`).
  Leave `HOST` unset — see [Why HOST stays unset](#why-host-stays-unset).

Health check: `GET /api/health` returns `{"status":"ok", ...}`.

---

## hPanel Node.js application

This is the route for a shared or Cloud plan, and the one to use unless you have
a specific reason not to.

1. **hPanel → Advanced → Node.js → Create application**
   * Node version: **20** (18.18+ works; see `.nvmrc`)
   * Application root: e.g. `dld-platform`
   * Application URL: your domain or subdomain
   * **Application startup file: `app.js`**
2. **Deploy the code** into that application root — hPanel's Git integration
   pointed at `https://github.com/productastrikos/DLD.git`, or SSH/SFTP.
3. **Run NPM Install** from the application panel.
4. **Restart** the application.
5. Open `https://yourdomain/api/health`. You should get JSON.

There is no build step. `/dist` is committed precisely so that this list has
four steps instead of six, and so that nothing has to compile inside a shared
container.

### Environment variables

Set none. The defaults are correct for hPanel:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5061` | Passenger injects this. **Do not set it manually.** |
| `HOST` | *unset* | Leave it unset here. See below. |
| `NODE_ENV` | — | `production` is a reasonable thing to add; nothing depends on it. |

### Why HOST stays unset

Passenger — the runtime behind hPanel's Node.js application — hands the process
its own listening socket and patches `listen()` to use it. The single-argument
form, `app.listen(PORT)`, is the one it intercepts cleanly. Passing an explicit
interface alongside it can leave the app bound somewhere Passenger is not
proxying to, and the front end reports that as a **504**.

So `server/index.js` binds an interface *only* when `HOST` is set in the
environment. Hostinger does not set it, so the app uses the Passenger-friendly
form. With `HOST` unset Node listens on every interface anyway, so nothing loses
reachability — the Docker image and the PM2/systemd units set `HOST=0.0.0.0`
explicitly for their own reasons.

---

## Updating a deployment

```bash
git pull
```

Then **Restart** in hPanel. Run *Run NPM Install* again only if
`package.json` changed.

Because the SPA is a commit artifact, changing anything under `client/` means
rebuilding **on your machine** before pushing:

```bash
npm install
npm run build
git add dist && git commit -m "Rebuild SPA" && git push
```

Forget this and the API updates while the UI stays on the previous version.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| **504 / 502 on every URL** | The Node process is not running or Passenger cannot reach it. Check the application log in hPanel. Usual causes: NPM Install was never run or failed, the startup file is not `app.js`, or a `HOST`/`PORT` variable was set by hand — remove them. |
| `Cannot listen on port … EADDRINUSE` in the log | Another process holds the port. On hPanel this means `PORT` was set manually; unset it and restart. |
| Shell loads, every panel errors | `/api` is not reachable — a static-only deploy with no Node process behind it. Check `/api/health`. |
| `No /dist build found` in the log | `dist/` did not reach the server. It is committed, so this means an incomplete upload — FTP clients routinely skip it. |
| 404 on refresh of a deep link | Express handles the SPA fallback when it serves `dist`. If something else is fronting the files, confirm `dist/.htaccess` was uploaded — it is a dotfile and many FTP clients hide it. |
| Old UI after a deploy | Either `index.html` is cached upstream (the app sends `no-cache`; purge the CDN), or `dist/` was never rebuilt and committed. |

## Data and persistence

`/data/*.csv` is the system of record and is read into memory at startup.
Mutations made through the UI are applied **in memory only** — they are visible
for the life of the process and vanish on restart. That is intentional for a POC
and means a redeploy always returns to the same clean baseline. If a demo needs
to survive restarts, that is the point at which a real database goes in.

---

## Other targets

Not needed for Hostinger shared/Cloud hosting. Kept because they still work.

**VPS with Docker** — `docker compose up -d --build`. The container binds
`127.0.0.1:5061`; put `deploy/nginx.conf` in front of it for TLS
(`certbot --nginx -d YOURDOMAIN`). The image builds the SPA itself, so it does
not depend on the committed `dist/`.

**VPS with PM2** — `npm ci && npm i -g pm2 && pm2 start ecosystem.config.cjs`,
then the same Nginx step. `deploy/dld-platform.service` is the systemd
equivalent and expects the checkout at `/var/www/dld-platform`.

**Static-only** — uploading just `dist/` to `public_html` renders the shell and
then fails to load every screen, because there is no `/api` behind it. Use it to
preview the front end, nothing more.
