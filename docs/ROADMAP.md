# Build roadmap

This is a large platform. Phase 1 (done) is the foundation everything else builds on:
the complete data model, the monorepo, auth + RBAC, and working storefront/admin/API
slices. The phases below turn the remaining schema into features and screens.

Each phase is roughly 2–4 weeks for one full-stack engineer.

---

## Phase 1 — Foundation ✅ (delivered)

- Monorepo (pnpm + Turborepo), Docker infra, env validation
- **Full Prisma schema** — 70+ models, all enums, all relations
- Seed: RBAC, category tree, tax/shipping, settings, menus, homepage, demo products
- API: JWT auth (register/login/refresh/logout/me), rate limiting, Swagger, health
- API: catalog browse + filters + sort + pagination, product detail, homepage, search
- API: admin overview KPIs, product list + status toggle, orders, customers
- Storefront: dynamic homepage, category pages, product detail (+ schema.org), sitemap
- Admin: login, dashboard, products, orders, customers

---

## Phase 2 — Catalog & inventory management

- ✅ Admin catalog write API: products (create/update/soft-delete, options, variants,
  media, categories, collections, tags, SEO), bulk actions, brand + category-tree +
  collection CRUD
- ✅ `AuditLog` interceptor on all admin mutations + `GET /admin/audit`
- ✅ Admin product editor screen + category/brand/collection manager screen
- ✅ CSV product import/export — export one row per variant; import upserts by slug,
  auto-creates brands, resolves categories, per-row error report (`/admin/products/export.csv`,
  `/admin/products/import` + buttons on the admin Products page)
- Product editor extras: variant matrix generator (multi-axis), attributes, size guides,
  related products
- Category tree drag/drop reorder (API `PATCH /admin/categories/reorder` exists); collection
  rules engine (automated collections)
- ✅ Inventory: stock levels list (search + low/out filters), manual adjustments with
  reason + type, movement ledger, low-stock summary, per-variant alert threshold
  (`/admin/inventory*` + admin Inventory screen). TODO: multi-warehouse transfers,
  purchase orders, CSV stock upload
- ✅ Elasticsearch product search (search-as-you-type + fuzziness), auto Postgres
  fallback, reindex on catalog writes + `POST /admin/search/reindex`. TODO: synonyms
  from `SearchTerm`, autosuggest endpoint, search-analytics dashboard
- ✅ Media uploads: S3 (server-side + presigned) with local-disk fallback, admin
  uploader UI. TODO: server-side resize/optimise, blur placeholders, `next/image` loader
- ✅ Dockerfiles for api / web / admin; GitHub Actions CI (install → prisma
  generate/validate/migrate → lint → typecheck → build → test → docker build)

## Phase 3 — Cart, checkout, orders, payments

- Cart service (guest + user, merge on login), mini-cart, save-for-later, coupon apply
- Pricing engine: promotions, coupons, tax, shipping rates, wallet + loyalty redemption
- Checkout: address book, pincode serviceability, shipping method selection
- Payment adapters: Razorpay, Stripe, PhonePe, PayU + webhooks + COD
- Order lifecycle: status machine, fulfilments, packing slips, invoices (PDF)
- Shipping adapters: Shiprocket / Delhivery / Blue Dart — label creation + tracking polls
- Returns/exchanges (RMA) flow + refunds (original / wallet)
- Transactional messaging: email + SMS + WhatsApp templates, per-event triggers
- Customer account area: orders, tracking, returns, addresses, wallet, wishlist, reviews

## Phase 4 — Marketing, CMS, analytics, Super Admin

- Landing page builder (block editor) + campaign/brand/collection pages + scheduling
- Banner manager, homepage section manager, navigation menu editor
- Blog CMS (posts, categories, tags, authors, SEO, related)
- Lookbooks / outfit builder / "complete the look" / shoppable Instagram
- Coupon + promotion builders with analytics
- Loyalty & rewards: points rules, tiers, referrals, birthday rewards, gift cards
- Reports & dashboards: revenue, orders, cohorts, product/category/coupon performance,
  inventory valuation, abandoned carts, conversion — with CSV/Excel export
- Super Admin: staff accounts, roles & permissions editor, all system settings,
  integration credentials, audit log viewer
- Reviews & Q&A moderation queue, verified-purchase badges, media reviews

## Phase 5 — Scale, polish, mobile

- AI recommendations (co-view / co-purchase, "frequently bought together")
- Personalised homepage rails, recently-viewed, back-in-stock automation
- Performance pass: Core Web Vitals, edge caching, DB read replicas, query budgets
- Mobile-app REST/GraphQL surface + push notifications
- Multi-currency / multi-region, i18n
- Load testing (target: thousands of concurrent shoppers), observability (OpenTelemetry),
  error tracking, uptime monitoring, backups + disaster-recovery runbook
- Security review: OWASP pass, dependency scanning, secrets rotation, WAF, PCI scope review

---

## Feature → schema map (already modelled)

| Feature | Models |
| --- | --- |
| Products & variants | `Product`, `ProductVariant`, `ProductOption(Value)`, `ProductMedia`, `Attribute`, `SizeGuide`, `ProductRelation` |
| Inventory | `Warehouse`, `InventoryLevel`, `StockMovement` |
| Merchandising | `Collection`, `HomeSection(Item)`, `Banner`, `Menu(Item)`, `Promotion` |
| Cart & wishlist | `Cart`, `CartItem`, `WishlistItem` |
| Orders | `Order`, `OrderItem`, `OrderStatusEvent`, `Fulfillment`, `Shipment(Event)`, `ReturnRequest`, `ReturnItem` |
| Payments | `Payment`, `Refund`, `GiftCard` |
| Pricing | `Coupon`, `CouponRedemption`, `Promotion*`, `TaxClass`, `ShippingZone`, `ShippingRate`, `ServiceablePincode` |
| Loyalty | `LoyaltyAccount`, `LoyaltyTransaction`, `Referral`, `WalletTransaction` |
| Reviews & Q&A | `Review`, `ReviewMedia`, `Question`, `Answer` |
| CMS & blog | `Page`, `BlogPost`, `BlogCategory`, `BlogTag`, `Lookbook`, `Look`, `LookItem`, `Testimonial`, `InstagramPost` |
| Search & analytics | `SearchQuery`, `SearchTerm`, `ProductView`, `DailyMetric` |
| Notifications | `Notification`, `MessageTemplate`, `StockAlert`, `NewsletterSubscriber` |
| Access & settings | `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Setting`, `Integration`, `AuditLog` |
