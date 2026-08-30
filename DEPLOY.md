# Deploying Slay Jeans to GitHub + Render

Three services get deployed, all from this one repo:

| Service | What it is | URL (after deploy) |
|---|---|---|
| `slay-jeans-api` | Backend API (NestJS) | `https://slay-jeans-api.onrender.com` |
| `slay-jeans-web` | Storefront (what customers see) | `https://slay-jeans-web.onrender.com` |
| `slay-jeans-admin` | Admin dashboard | `https://slay-jeans-admin.onrender.com` |

The database is **Neon** (already created, already has all your data). Render does
not host it — the API just connects to it.

---

## Part 1 — Put the code on GitHub

### A. Create an empty repo on GitHub
1. Go to **https://github.com/new**
2. Repository name: `slay-jeans` (or anything you like)
3. Choose **Private**
4. **Do NOT** tick "Add a README", ".gitignore" or "license" — leave it empty
5. Click **Create repository**
6. Copy the URL shown, e.g. `https://github.com/YOUR-USERNAME/slay-jeans.git`

### B. Push the code
Give that URL to Claude and it will run:
```bash
git remote add origin https://github.com/YOUR-USERNAME/slay-jeans.git
git branch -M main
git push -u origin main
```
A browser window will open once to sign in to GitHub — approve it.

> Your secrets are safe: `.env` is git-ignored and is **not** pushed. Only
> `.env.example` (a blank template) goes up.

---

## Part 2 — Deploy on Render

### A. Connect the repo
1. Go to **https://dashboard.render.com** → sign up / log in (you can use "Sign in
   with GitHub").
2. Click **New +** → **Blueprint**.
3. Pick your `slay-jeans` repo. Render reads `render.yaml` and shows 3 services.
4. Click **Apply**.

### B. Fill in the secret values
Render will ask for the env vars marked "will be set later". Enter:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon **direct/unpooled** connection string (see below) |
| `DIRECT_URL` | the same string as `DATABASE_URL` |
| `SMTP_HOST` | *(optional)* `smtp.gmail.com` — or leave blank for now |
| `SMTP_USER` | *(optional)* `slayjeans@gmail.com` |
| `SMTP_PASSWORD` | *(optional)* a Google **App Password** (not your normal password) |

**Neon connection string:** in the Neon dashboard → your project → *Connection
Details* → choose the **"Direct connection"** (NOT "Pooled") → copy the
`postgresql://...` string. It must **not** contain `-pooler` or `pgbouncer=true`
(the checkout needs a real database session).

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `COOKIE_SECRET` are generated
automatically — you don't touch them.

### C. First deploy
Render builds and starts all 3 services (~5–10 min the first time). When they go
green, open **`https://slay-jeans-web.onrender.com`**.

> If the homepage says "Storefront is warming up", the API just hadn't finished
> starting. Wait ~30 seconds and refresh.

### D. If a service URL got a random suffix
Render adds a suffix (e.g. `slay-jeans-api-x7k2`) if the name is already taken
globally. If that happens:
1. Note the real URLs from the Render dashboard.
2. On **each** service → **Environment**, fix any of these that point to the old
   URLs: `API_URL`, `WEB_URL`, `ADMIN_URL`, `CORS_ALLOWED_ORIGINS`,
   `NEXT_PUBLIC_API_URL`.
3. **Manual Deploy → Clear build cache & deploy** on `slay-jeans-web` and
   `slay-jeans-admin` (they bake the API URL in at build time).

---

## Part 3 — After it's live

1. **Change the admin password.** In the Render dashboard open
   `slay-jeans-api` → **Environment** → add
   `SEED_ADMIN_PASSWORD` = *a strong password*, then open the service **Shell**
   and run `pnpm db:seed`. Log in to the admin with the new password.
   *(Alternatively, change it directly in the database.)*
2. **Add real products & images** in the admin (`/products`, `/homepage`,
   `/catalog`). See the "How to add/edit content" table.
3. **Media uploads:** to store product photos on Render you need S3. In
   `slay-jeans-api` → Environment add `S3_BUCKET`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_PUBLIC_BASE_URL`. Until then, paste
   image URLs from your own host instead of uploading.
4. **Upgrade to always-on.** Free Render services sleep after 15 min idle (first
   visitor then waits ~50s). Before real launch, in `render.yaml` change
   `plan: free` → `plan: starter` for `slay-jeans-api` and `slay-jeans-web`
   (≈ $7/month each), commit, push. `slay-jeans-admin` can stay free.
5. **Custom domain** (optional): each service → **Settings → Custom Domains**.
   Point `www.yourdomain.com` at `slay-jeans-web`, `admin.yourdomain.com` at
   `slay-jeans-admin`, `api.yourdomain.com` at `slay-jeans-api`, then update the
   `*_URL` / `CORS_ALLOWED_ORIGINS` / `NEXT_PUBLIC_API_URL` env vars to the new
   domains and redeploy web + admin.

---

## Ongoing

- **Deploy new changes:** `git push` — Render auto-deploys (`autoDeploy: true`).
- **Database schema changes:** open the `slay-jeans-api` Shell in Render and run
  `pnpm db:deploy`.
- **Payments:** COD only right now. To enable online payments later, add
  `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` to
  `slay-jeans-api` and add `"RAZORPAY"` to the `payment.enabledMethods` store
  setting.

## Required vs optional env vars — quick reference

**Required (API):** `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `API_URL`, `WEB_URL`, `ADMIN_URL`,
`CORS_ALLOWED_ORIGINS` — all handled by `render.yaml` except the two DB URLs.

**Required (web & admin):** `NEXT_PUBLIC_API_URL` — handled by `render.yaml`.

**Optional:** `SMTP_*` / `EMAIL_FROM` (order + newsletter emails),
`S3_*` (admin uploads), `RAZORPAY_*` (online payments), `ELASTICSEARCH_NODE`
(search — Postgres is used otherwise), `REDIS_URL` (unused today).
