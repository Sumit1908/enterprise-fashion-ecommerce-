# Setup guide

Written for someone who has not run a Node.js project before. Follow it top to bottom.

---

## 0. Status on this development machine (as of 2026-08-30)

Already done for you on this PC:

| Step | State |
| --- | --- |
| Node.js 24 LTS, pnpm 9, Git 2.55, Docker Desktop 4.88 | ✅ installed |
| WSL2 (needed by Docker) | ✅ installed — **needs one Windows restart to activate** |
| `pnpm install` (all dependencies) | ✅ done |
| `.env` file with the Neon database | ✅ created (git-ignored) |
| Database tables (`prisma migrate`) | ✅ created on Neon |
| Seed data (roles, categories, settings, 6 demo products) | ✅ loaded |
| Storefront / Admin / API | ✅ built and verified running |

**The database is Neon (hosted PostgreSQL)** — so you do *not* need Docker to run the
app for now. Docker is only needed later for local Redis + Elasticsearch (Phase 2);
that is why the pending Windows restart is not urgent.

To start everything right now:

```powershell
pnpm dev
```

Then open <http://localhost:3000> (shop), <http://localhost:3001> (admin —
`sumitnnnrealtor@gmail.com` / `ChangeMe!2026`), <http://localhost:4000/api/docs> (API).

Everything below is the from-scratch reference for a new machine or a teammate.

---

## 1. Install the tools (one time)

| Tool | Why | Download |
| --- | --- | --- |
| **Node.js 22 LTS or newer** | Runs the apps | <https://nodejs.org/en/download> — pick the "LTS" installer for your OS |
| **pnpm 9** | Installs dependencies | After Node is installed, open a terminal and run `npm install -g pnpm@9` |
| **Docker Desktop** | Local Redis + search (Phase 2); not needed if you use a hosted DB | <https://www.docker.com/products/docker-desktop> |
| **Git** | Version control | <https://git-scm.com/downloads> |
| **VS Code** (optional) | Code editor | <https://code.visualstudio.com> |

On Windows you can install all of them in one go with **winget**:

```powershell
winget install OpenJS.NodeJS.LTS Git.Git Docker.DockerDesktop
npm install -g pnpm@9
```

Docker Desktop needs the **WSL2** feature and a restart:

```powershell
wsl --install --no-distribution   # then restart Windows, then launch Docker Desktop once
```

Verify — each should print a version number:

```bash
node -v      # v22.x or v24.x
pnpm -v      # 9.x
git --version
docker -v    # only needed for Phase 2
```

> On Windows, use **PowerShell** or **Windows Terminal**. To copy the env file there:
> `copy .env.example .env`

---

## 2. Configure environment variables

```bash
copy .env.example .env      # Windows
# or: cp .env.example .env  # macOS / Linux
```

Open `.env`. For **local development** the defaults work as-is except two secrets you
should set to random strings:

```
JWT_ACCESS_SECRET=<paste 40+ random characters>
JWT_REFRESH_SECRET=<paste different 40+ random characters>
```

Generate them with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

Fill in the payment / shipping / AWS / email sections only when you're ready to test
those features. The app runs without them.

---

## 3. Choose a database

**Option A — hosted PostgreSQL (what this project uses now).** Neon, Supabase or
RDS. Put the connection string in `.env` as both `DATABASE_URL` (the *pooled* URL)
and `DIRECT_URL` (the *direct / unpooled* URL — used only for migrations). Nothing
to start locally. Skip to step 4.

> Neon note: a free Neon project auto-suspends after ~5 min idle, so the first
> request after a pause can be slow or fail once. The API and the seed script both
> retry connection drops automatically. To remove the pause entirely, disable
> "Scale to zero" in the Neon dashboard.

**Option B — local PostgreSQL in Docker** (needs the Windows restart above):

```bash
pnpm infra:up
```

| Service | Port | Purpose |
| --- | --- | --- |
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache, sessions, queues |
| Elasticsearch | 9200 | Product search (Phase 2) |
| MinIO | 9000 / 9001 | Local stand-in for AWS S3 |
| Adminer | 8080 | Web UI to inspect the database |

Then set `DATABASE_URL` and `DIRECT_URL` to
`postgresql://slay:slay@localhost:5432/slay_jeans?schema=public`.
Stop later with `pnpm infra:down`. Data is kept between restarts.

---

## 4. Set up the database

```bash
pnpm install         # if you haven't already
pnpm db:generate     # builds the typed database client
pnpm db:migrate      # creates all the tables (name the migration "init" when asked)
pnpm db:seed         # loads roles, permissions, categories, settings + demo products
```

`pnpm db:seed` prints the **super-admin login** at the end. Default:

```
email:    sumitnnnrealtor@gmail.com
password: ChangeMe!2026
```

Change the password after first login (or set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
in `.env` before seeding).

---

## 5. Run the apps

```bash
pnpm dev
```

| App | URL |
| --- | --- |
| Storefront | <http://localhost:3000> |
| Admin dashboard | <http://localhost:3001> |
| API + Swagger docs | <http://localhost:4000/api/docs> |
| Prisma Studio (DB browser) | run `pnpm db:studio` → <http://localhost:5555> |

---

## 6. Making changes without code

Almost everything customer-facing is data:

| To change… | Do this |
| --- | --- |
| Products, prices, stock | Admin → Products (full editor in Phase 2; API + schema ready now) |
| Homepage sections & order | `HomeSection` rows (Admin → Banners & Pages in Phase 3) |
| Navigation menus | `Menu` / `MenuItem` rows |
| Categories & collections | `Category` / `Collection` rows |
| Banners & campaigns | `Banner` rows with `startsAt` / `endsAt` / `countdownEndsAt` |
| Store name, currency, tax, shipping, payment toggles | `Setting` rows |
| Coupons & sales | `Coupon` / `Promotion` rows |

Until every admin screen is built (see `ROADMAP.md`), you can edit these directly in
**Prisma Studio** (`pnpm db:studio`) — a spreadsheet-like editor for every table.

---

## 6a. Product images

- **No setup needed for local dev.** Uploading an image in Admin → Products saves it
  to `apps/api/uploads/` and the API serves it at `/uploads/...`.
- **To use AWS S3** (recommended for production): fill in `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` and (optionally) `S3_PUBLIC_BASE_URL` in `.env`,
  then restart the API. It automatically switches to S3 — no code change. The bucket
  must allow public reads of uploaded objects (or serve them via CloudFront).
- Works with any S3-compatible store (MinIO, Cloudflare R2) via `S3_ENDPOINT` +
  `S3_FORCE_PATH_STYLE=true`.

## 6b. Search

- Default `SEARCH_DRIVER=postgres` — works with no extra services.
- For Elasticsearch: start it (`pnpm infra:up` brings one up on `:9200`), set
  `SEARCH_DRIVER=elasticsearch`, restart the API, then click **Rebuild search index**
  on the Admin → Products page (or `POST /api/v1/admin/search/reindex`).
- If Elasticsearch becomes unreachable, search silently falls back to Postgres — the
  storefront never breaks.

---

## 6c. Docker images (for deployment)

Each app has a Dockerfile built from the repo root:

```bash
docker build -f apps/api/Dockerfile   -t slay-api   .
docker build -f apps/web/Dockerfile   -t slay-web   --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
docker build -f apps/admin/Dockerfile -t slay-admin --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
```

> The web/admin images use Next.js `output: 'standalone'`, which is enabled only
> inside Docker (`BUILD_STANDALONE=1`). Local `pnpm build` on Windows is unaffected.

CI (`.github/workflows/ci.yml`) runs install → prisma generate/validate/migrate →
lint → typecheck → build → test on every push/PR against a throwaway Postgres, then
builds all three Docker images on push.

---

## 7. Production deployment (summary)

1. **Database** — managed PostgreSQL (AWS RDS, Neon, Supabase). Put its URL in
   `DATABASE_URL` and `DIRECT_URL`, then run `pnpm db:deploy`.
2. **Redis** — managed Redis (AWS ElastiCache, Upstash). Set `REDIS_URL`.
3. **Search** — managed Elasticsearch / OpenSearch. Set `ELASTICSEARCH_NODE`.
4. **Media** — create an S3 bucket + CloudFront distribution. Set the `AWS_*` and
   `S3_*` variables.
5. **Apps** — deploy `apps/web` and `apps/admin` to Vercel, or build the Dockerfiles
   (see 6c) and run `apps/api` on ECS / Fly.io / Render.
6. **Payments & shipping** — paste live keys into `.env` *and* toggle the provider to
   live mode in Admin → Settings → Integrations. Point each provider's webhook at
   `https://api.yourdomain.com/api/v1/webhooks/<provider>`.
7. **DNS** — `www` → storefront, `admin` → admin console, `api` → API.

See `docs/ARCHITECTURE.md` for the full picture.
