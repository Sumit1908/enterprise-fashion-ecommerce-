# Slay Jeans

Enterprise fashion e-commerce platform — premium storefront, admin dashboard, and a
database-driven API. Products, categories, collections, banners, homepage sections,
coupons, blog posts, landing pages and store settings are all managed as **data**, not code.

```
slay-jeans/
├─ apps/
│  ├─ web/      Customer storefront          (Next.js 15, Tailwind 4)   → http://localhost:3000
│  ├─ admin/    Admin & Super Admin console  (Next.js 15)               → http://localhost:3001
│  └─ api/      Backend API                  (NestJS 11, Prisma 6)      → http://localhost:4000
├─ packages/
│  ├─ db/       Prisma schema + client + seed  (the single source of truth)
│  └─ config/   Validated environment loader
├─ docker-compose.yml   Postgres, Redis, Elasticsearch, MinIO (S3), Adminer
└─ docs/        Architecture, setup and roadmap
```

## What's built today (Phase 1)

| Area | Status |
| --- | --- |
| Full database schema — 70+ models covering catalog, variants, inventory, orders, payments, shipments, returns, coupons, promotions, loyalty, CMS, blog, RBAC, settings, audit log | ✅ complete |
| Monorepo, Docker infra, environment validation, seed data | ✅ complete |
| API: auth (register/login/refresh/JWT), catalog browsing, product detail, homepage composition, search, admin overview/products/orders/customers, Swagger docs | ✅ working |
| Storefront: homepage (dynamic sections), category pages with filters/sort/pagination, product detail page with schema.org markup, sitemap/robots | ✅ working |
| Admin: login, dashboard KPIs, product list + publish toggle, orders, customers | ✅ working |
| Coupons UI, page builder, reports, settings/RBAC screens, payment/shipping integrations | ⏳ scaffolded — see [docs/ROADMAP.md](docs/ROADMAP.md) |

## Quick start

You need three things installed first (see [docs/SETUP.md](docs/SETUP.md) for exact download links):

1. **Node.js 22** — <https://nodejs.org>
2. **pnpm 9** — after Node: `npm install -g pnpm`
3. **Docker Desktop** — <https://www.docker.com/products/docker-desktop>

Then, in a terminal opened in this folder:

```bash
pnpm install                 # install all dependencies
cp .env.example .env          # (Windows PowerShell: copy .env.example .env)
pnpm infra:up                 # start Postgres, Redis, Elasticsearch in Docker
pnpm db:generate              # generate the database client
pnpm db:migrate               # create the database tables
pnpm db:seed                  # load roles, categories, settings + demo products
pnpm dev                      # start all three apps together
```

Open:

- Storefront → <http://localhost:3000>
- Admin → <http://localhost:3001> (sign in with the seeded super-admin — the email and
  password are printed by `pnpm db:seed`; default password `ChangeMe!2026`)
- API docs → <http://localhost:4000/api/docs>

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run storefront + admin + API with hot reload |
| `pnpm build` | Production build of everything |
| `pnpm db:studio` | Open Prisma Studio — a visual database browser |
| `pnpm db:migrate` | Apply a new schema change to your database |
| `pnpm db:seed` | Re-run the seed (safe; uses upserts) |
| `pnpm infra:up` / `pnpm infra:down` | Start / stop the Docker services |
| `pnpm typecheck` | Type-check all packages |

## Going to production

`docs/SETUP.md` covers deploying with real infrastructure: managed Postgres, Redis and
Elasticsearch, AWS S3 for media, and live keys for Razorpay / Stripe / PhonePe / PayU and
Shiprocket / Delhivery / Blue Dart. Every integration reads from `.env` and the `Integration`
table — no code changes to switch providers or go from test to live mode.
