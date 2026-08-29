# Setup guide

Written for someone who has not run a Node.js project before. Follow it top to bottom.

---

## 1. Install the tools (one time)

| Tool | Why | Download |
| --- | --- | --- |
| **Node.js 22 LTS** | Runs the apps | <https://nodejs.org/en/download> — pick the "LTS" installer for your OS |
| **pnpm 9** | Installs dependencies | After Node is installed, open a terminal and run `npm install -g pnpm` |
| **Docker Desktop** | Runs the database, Redis and search locally | <https://www.docker.com/products/docker-desktop> |
| **Git** (optional but recommended) | Version control | <https://git-scm.com/downloads> |
| **VS Code** (optional) | Code editor | <https://code.visualstudio.com> |

Verify everything is installed — each should print a version number:

```bash
node -v      # v22.x
pnpm -v      # 9.x
docker -v    # Docker version 27.x
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

## 3. Start the infrastructure

```bash
pnpm infra:up
```

This starts, in Docker:

| Service | Port | Purpose |
| --- | --- | --- |
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache, sessions, queues |
| Elasticsearch | 9200 | Product search (Phase 2) |
| MinIO | 9000 / 9001 | Local stand-in for AWS S3 |
| Adminer | 8080 | Web UI to inspect the database |

Stop them later with `pnpm infra:down`. Data is kept between restarts.

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

## 7. Production deployment (summary)

1. **Database** — managed PostgreSQL (AWS RDS, Neon, Supabase). Put its URL in
   `DATABASE_URL` and `DIRECT_URL`, then run `pnpm db:deploy`.
2. **Redis** — managed Redis (AWS ElastiCache, Upstash). Set `REDIS_URL`.
3. **Search** — managed Elasticsearch / OpenSearch. Set `ELASTICSEARCH_NODE`.
4. **Media** — create an S3 bucket + CloudFront distribution. Set the `AWS_*` and
   `S3_*` variables.
5. **Apps** — deploy `apps/web` and `apps/admin` to Vercel (or Docker), `apps/api` to
   AWS ECS / Fly.io / Render as a Docker container. `Dockerfile`s are added in Phase 2.
6. **Payments & shipping** — paste live keys into `.env` *and* toggle the provider to
   live mode in Admin → Settings → Integrations. Point each provider's webhook at
   `https://api.yourdomain.com/api/v1/webhooks/<provider>`.
7. **DNS** — `www` → storefront, `admin` → admin console, `api` → API.

See `docs/ARCHITECTURE.md` for the full picture.
