# Deploying to Hostinger

The platform is a **static site**. There is no Node process, no port, no
database, and nothing to keep running — `dist/` is a folder of files that any
web host can serve.

That is the whole deployment:

> **Upload the contents of `dist/` into `public_html`.**

`dist/` is committed, so you do not have to build anything to deploy. If you
would rather build it yourself: `npm install && npm run build`.

---

## hPanel File Manager

1. **hPanel → Files → File Manager**, open `public_html`.
2. Delete whatever is in there (typically Hostinger's placeholder `index.html`).
3. Upload **the contents of `dist/`** — `index.html`, `assets/`, `brand/` and
   the dotfile `.htaccess`. Upload the *contents*, not the `dist` folder itself,
   or the site lands at `/dist/`.
4. Open your domain.

The quickest way to move the files is to zip the *contents* of `dist/`, upload
the one zip, and use File Manager's **Extract**.

> `.htaccess` is a dotfile. Many FTP clients hide it by default and silently
> skip it. It is not required for the app to work — see below — but it supplies
> compression and cache headers, so it is worth getting across.

## Over FTP or SSH

Same thing: copy `dist/*` into `public_html`. Nothing else from the repository
needs to be on the server — not `node_modules`, not `data/`, not `client/`.

## Deploying to a subfolder

It works with no changes. The build uses relative asset paths and hash-based
routing, so `public_html/demo/` serves correctly at
`https://yourdomain/demo/`.

---

## Why there is nothing to configure

**No Node runtime.** The API that used to run in Express now runs in the
browser, over datasets bundled into the JavaScript at build time. So there is no
`app.js`, no startup file, no `PORT`, no NPM Install step, and no application to
restart — which also means there is no process that can fail to start and leave
you looking at a 502, 503 or 504.

**No rewrite rules.** Routing lives in the URL hash
(`/#/dld/dashboard`), so every request the host ever sees is for `/index.html`
or a real file in `assets/`. Refreshing a deep link cannot 404, and the app does
not care whether it is at a domain root or in a subfolder.

The `.htaccess` shipped in `dist/` therefore only sets compression, cache
headers and a few security headers. If your plan ignores it, the site still
works.

---

## Updating the site

The build is a commit artifact, so rebuild it whenever anything under `client/`
or `data/` changes:

```bash
npm install
npm run build
```

Then re-upload `dist/`, and commit it so the repository and the live site agree:

```bash
git add dist && git commit -m "Rebuild SPA" && git push
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Hostinger's default placeholder page | `public_html` still holds the stock `index.html`. Delete it and upload the build. |
| Site appears at `/dist/` | The `dist` folder was uploaded instead of its contents. Move the files up one level. |
| Blank page, console 404s for `/assets/...` | Only `index.html` was uploaded. `assets/` has to come too. |
| Styling missing, page otherwise fine | Partial upload — re-upload `assets/` in full. |
| Changes not showing after re-upload | The browser cached the shell. Hard-refresh; `.htaccess` sends `no-cache` for `index.html` when the host honours it. |
| Everything loads but data looks stale | `dist/` was not rebuilt after `data/` changed. The datasets are baked into the bundle at build time. |

## Data and persistence

`/data/*.csv` is the system of record. `npm run generate` writes it, and
`npm run build` inlines it into the bundle.

Every visitor's browser gets its own copy in memory, so the create and approve
workflows are real but private to that tab, and a refresh returns to the clean
baseline. The Express version behaved the same way — it never persisted either,
it just held the copy server-side. If a demo needs mutations to survive a
refresh or be visible to someone else, that is the point at which a real backend
goes in.
