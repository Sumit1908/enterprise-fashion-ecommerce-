# Architecture

## Overview

```
                    ┌───────────────┐        ┌───────────────┐
   shoppers  ─────▶ │  apps/web     │        │  apps/admin   │ ◀──── staff / super admin
                    │  Next.js 15   │        │  Next.js 15   │
                    └───────┬───────┘        └───────┬───────┘
                            │  HTTPS / JSON          │
                            └───────────┬────────────┘
                                        ▼
                              ┌───────────────────┐
                              │   apps/api        │  NestJS 11
                              │   REST /api/v1    │  JWT auth + RBAC
                              └─────────┬─────────┘
              ┌───────────────┬─────────┼──────────┬────────────────┐
              ▼               ▼         ▼          ▼                ▼
        PostgreSQL         Redis   Elasticsearch  AWS S3        Gateways
        (Prisma 6)      cache/queue   search      media    Razorpay/Stripe/…
                                                           Shiprocket/Delhivery/…
```

## Why this shape

- **One database, one schema.** `packages/db/prisma/schema.prisma` is the contract.
  Both Next.js apps talk only to the API; only the API talks to Postgres. This keeps
  business rules (pricing, stock reservation, RBAC) in one place.
- **Content is data.** Homepage layout (`HomeSection`), navigation (`Menu`), banners,
  landing pages (`Page.blocks` JSON), collections, coupons and settings are rows. The
  storefront renders whatever the API returns, so merchandising changes never require a
  deploy.
- **Snapshots on write.** Orders copy the product name, SKU, price, and address at
  purchase time (`OrderItem`, `Order.shippingAddress` JSON) so historical orders stay
  correct even after the catalog changes.
- **Denormalised aggregates.** `Product.ratingAverage`, `soldCount`, `viewCount` etc.
  are stored on the row and refreshed by background jobs, so category listing and
  sorting stay fast at thousands of products.

## Request flow: storefront homepage

1. `apps/web` (server component) calls `GET /api/v1/storefront/home`.
2. API loads active `HomeSection` rows ordered by `position`, plus banners, testimonials,
   featured collections, Instagram posts, lookbooks.
3. For each section it either uses pinned `HomeSectionItem` products or runs the rule for
   that section type (e.g. `BEST_SELLERS` → `orderBy soldCount desc`).
4. Response is cached by Next.js (`revalidate: 30`) and rendered.

## Request flow: authenticated admin action

1. Admin logs in → `POST /api/v1/auth/login` → short-lived access JWT (15 min) +
   rotating refresh token (hashed in `RefreshToken`).
2. Each admin request carries `Authorization: Bearer <access>`.
3. `JwtAuthGuard` verifies the token and loads the user with roles + permissions.
4. `PermissionsGuard` checks the route's `@RequirePermissions(...)` against the user's
   permission set (super admins bypass).
5. Mutations write an `AuditLog` entry (Phase 2 interceptor).

## Roles & permissions

Seeded system roles: **Admin, Inventory Manager, Order Manager, Marketing Manager,
Customer Support Manager**. Permissions are `resource:action` strings
(`product:create`, `order:refund`, …). The Super Admin flag (`User.isSuperAdmin`)
grants everything and is the only role that can edit roles/permissions.

## Background work (Phase 2)

A BullMQ worker (Redis-backed) handles: order confirmation emails/SMS/WhatsApp,
payment webhook reconciliation, shipment tracking polls, Elasticsearch indexing,
abandoned-cart reminders, nightly `DailyMetric` aggregation, loyalty point expiry,
and back-in-stock notifications.

## Integrations

Each external provider has an `Integration` row (`isEnabled`, `isTestMode`, encrypted
`credentials`). Adapters implement a common interface:

- **Payments**: `PaymentProvider` — `createOrder`, `verifySignature`, `refund`,
  `handleWebhook`. Implementations: Razorpay, Stripe, PhonePe, PayU. COD/Wallet/GiftCard
  are internal.
- **Shipping**: `ShippingProvider` — `getRates`, `createShipment`, `trackShipment`,
  `cancelShipment`. Implementations: Shiprocket, Delhivery, Blue Dart.
- **Messaging**: `NotificationChannel` — email (SMTP/SES/Resend), SMS (MSG91/Twilio),
  WhatsApp (Meta/Gupshup).

Switching provider or flipping test→live is a settings change, not a deploy.

## Tech choices

| Layer | Choice | Notes |
| --- | --- | --- |
| Storefront / Admin | Next.js 15 (App Router), React 19, Tailwind 4 | SSR + ISR for SEO and speed |
| API | NestJS 11 | Modules, guards, DI, Swagger |
| ORM | Prisma 6 | Typed queries, migrations |
| DB | PostgreSQL 16 | Relational integrity for orders/inventory |
| Cache / queue | Redis 7 | Sessions, rate limiting, BullMQ |
| Search | Elasticsearch 8 | Instant search, typo tolerance, facets |
| Media | AWS S3 + CloudFront | Signed uploads, CDN delivery |
| Auth | JWT (access + refresh) + OAuth | httpOnly cookies on storefront, bearer on admin |
| Monorepo | pnpm workspaces + Turborepo | Shared `db` and `config` packages |
