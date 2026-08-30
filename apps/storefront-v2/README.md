# @slay/storefront-v2

A fresh, standalone **SLAY JEANS** storefront — premium men's fashion design
(red / white / navy system), built to the design brief and driven entirely by
**mock data** (`src/lib/data/*`). No API/database dependency.

- **Local dev:** `pnpm --filter @slay/storefront-v2 dev` → http://localhost:3000
  (also runs via `pnpm dev` at the repo root)
- **Not deployed.** The live site on Render still serves `apps/web`
  (`slay-jeans-web.onrender.com`). This app is for finalising the new design
  before deciding whether it replaces `apps/web`.
- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4,
  lucide-react. Photography is Unsplash placeholder — swap the IDs in
  `src/lib/images.ts` for real SLAY JEANS assets.

## Structure

```
src/
  app/            page.tsx (homepage), layout.tsx, globals.css
  components/
    layout/       AnnouncementBar, Header, MobileNav, Footer
    home/         HeroCarousel, CategoryPills, ShopByPills, BestsellerSection,
                  CategoryRow, DenimBanner, ShopByColor, EditorialGrid,
                  OurStores, AppPromotion, PopularSearches, Newsletter
    ui/           Logo, SectionHeading, ProductCard, CategoryCard
    widgets/      SearchOverlay, CartDrawer, RegistrationModal, Toast,
                  FloatingWidgets (Refer & Earn, Rewards)
  lib/
    store.tsx     cart + wishlist + overlay state (Context, localStorage)
    images.ts     Unsplash helper + verified photo pool
    data/         products, categories, colors, stores, popularSearches, nav, hero
```

## Status

Homepage is complete and polished. Product / shop / cart / checkout **pages**
are the next step (components and mock data are already in place for them).
