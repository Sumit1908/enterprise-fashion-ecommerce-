/* eslint-disable no-console */
import 'dotenv/config';
/**
 * Seed baseline data every environment needs:
 *   - RBAC roles + permissions
 *   - a super admin account
 *   - the full category tree from the brand brief
 *   - tax classes, a warehouse, shipping zone/rate
 *   - store settings, navigation menus, homepage sections
 *   - a handful of demo brands / products so the storefront renders
 *
 * Safe to run repeatedly (uses upserts).
 *
 *   pnpm db:seed
 */
import { randomBytes, scryptSync } from 'node:crypto';
import {
  PrismaClient,
  Prisma,
  Gender,
  AgeGroup,
  ProductStatus,
  HomeSectionType,
} from '@prisma/client';

/**
 * Neon (and most serverless Postgres) drop idle connections aggressively, which
 * surfaces mid-script as P1017 "Server has closed the connection". Retry the
 * handful of transient connection errors so a long seed run survives them.
 */
const baseClient = new PrismaClient();
const RETRYABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const prisma = baseClient.$extends({
  query: {
    async $allOperations({ args, query }) {
      for (let attempt = 1; ; attempt++) {
        try {
          return await query(args);
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (attempt >= 6 || !code || !RETRYABLE_CODES.has(code)) throw err;
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }
    },
  },
});

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const RESOURCES = [
  'product', 'category', 'brand', 'collection', 'inventory', 'order', 'return',
  'customer', 'coupon', 'promotion', 'review', 'banner', 'homeSection', 'menu',
  'page', 'blog', 'lookbook', 'report', 'setting', 'integration', 'role', 'user',
  'auditLog', 'notification',
];
const ACTIONS = ['read', 'create', 'update', 'delete', 'export'];

const ROLES: Record<string, { description: string; permissions: 'ALL' | string[] }> = {
  Admin: { description: 'Full store management except role/permission editing.', permissions: 'ALL' },
  'Inventory Manager': {
    description: 'Products, variants, stock and purchase flow.',
    permissions: ['product:*', 'category:read', 'brand:read', 'inventory:*', 'report:read'],
  },
  'Order Manager': {
    description: 'Orders, fulfilment, shipments and returns.',
    permissions: ['order:*', 'return:*', 'customer:read', 'report:read', 'notification:*'],
  },
  'Marketing Manager': {
    description: 'Coupons, promotions, banners, pages, blog and homepage.',
    permissions: [
      'coupon:*', 'promotion:*', 'banner:*', 'homeSection:*', 'page:*', 'blog:*',
      'lookbook:*', 'collection:*', 'menu:*', 'report:read',
    ],
  },
  'Customer Support Manager': {
    description: 'Customers, orders (read + limited actions), reviews and returns.',
    permissions: ['customer:*', 'order:read', 'order:update', 'return:*', 'review:*', 'notification:*'],
  },
};

const CATEGORY_TREE: Array<{
  name: string;
  gender?: Gender;
  ageGroup?: AgeGroup;
  children?: Array<{ name: string; children?: string[] }>;
}> = [
  {
    name: 'Men', gender: Gender.MEN, ageGroup: AgeGroup.ADULT,
    children: ['Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Shorts', 'Jackets', 'Hoodies', 'Ethnic Wear', 'Blazers'].map((n) => ({ name: n })),
  },
  {
    name: 'Women', gender: Gender.WOMEN, ageGroup: AgeGroup.ADULT,
    children: ['Tops', 'Dresses', 'Kurtis', 'Suits', 'Sarees', 'Jeans', 'Leggings', 'Jackets', 'Co-ord Sets', 'Ethnic Wear'].map((n) => ({ name: n })),
  },
  {
    name: 'Kids', ageGroup: AgeGroup.KIDS,
    children: [
      { name: 'Boys', children: ['T-Shirts', 'Shirts', 'Jeans', 'Shorts', 'Trousers', 'Jackets', 'Ethnic Wear'] },
      { name: 'Girls', children: ['Dresses', 'Tops', 'Skirts', 'Jeans', 'Leggings', 'Ethnic Wear', 'Party Wear'] },
      { name: 'Baby Collection', children: ['Rompers', 'Bodysuits', 'Sleepwear', 'Winter Wear', 'Baby Sets'] },
      { name: 'Teen Collection', children: ['Teen Boys Fashion', 'Teen Girls Fashion'] },
    ],
  },
  {
    name: 'Footwear',
    children: ['Sneakers', 'Formal Shoes', 'Casual Shoes', 'Sports Shoes', 'Sandals', 'Slippers'].map((n) => ({ name: n })),
  },
  { name: 'Watches' },
  { name: 'Bags' },
  { name: 'Belts' },
  { name: 'Wallets' },
  { name: 'Sunglasses' },
  { name: 'Accessories' },
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function seedRbac() {
  const permissionRecords = RESOURCES.flatMap((resource) =>
    ACTIONS.map((action) => ({ key: `${resource}:${action}`, resource, action })),
  );
  for (const p of permissionRecords) {
    await prisma.permission.upsert({ where: { key: p.key }, create: p, update: {} });
  }
  const allPermissions = await prisma.permission.findMany();

  const matches = (key: string, patterns: string[]) =>
    patterns.some((pat) => {
      if (pat === key) return true;
      const [res, act] = pat.split(':');
      const [kRes, kAct] = key.split(':');
      return (res === '*' || res === kRes) && (act === '*' || act === kAct);
    });

  for (const [name, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name), description: def.description, isSystem: true },
      update: { description: def.description, isSystem: true },
    });
    const perms =
      def.permissions === 'ALL'
        ? allPermissions
        : allPermissions.filter((p) => matches(p.key, def.permissions as string[]));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`  RBAC: ${permissionRecords.length} permissions, ${Object.keys(ROLES).length} roles`);
}

async function seedSuperAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'sumitnnnrealtor@gmail.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      kind: 'STAFF',
      status: 'ACTIVE',
      isSuperAdmin: true,
      firstName: 'Store',
      lastName: 'Owner',
      displayName: 'Store Owner',
      passwordHash: hashPassword(password),
      emailVerifiedAt: new Date(),
    },
    update: { isSuperAdmin: true, kind: 'STAFF' },
  });
  const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      create: { userId: user.id, roleId: adminRole.id },
      update: {},
    });
  }
  console.log(`  Super admin: ${email}  (password: ${password})`);
}

const U = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const CATEGORY_IMAGE: Record<string, string> = {
  Men: U('1441984904996-e0b6ba687e04'),
  Women: U('1509631179647-0177331693ae'),
  Kids: U('1518831959646-742c3a14ebf7'),
  Footwear: U('1560769629-975ec94e6a86'),
  Watches: U('1483118714900-540cf339fd46'),
  Bags: U('1490114538077-0a7f8cb49891'),
  Belts: U('1490114538077-0a7f8cb49891'),
  Wallets: U('1490114538077-0a7f8cb49891'),
  Sunglasses: U('1490114538077-0a7f8cb49891'),
  Accessories: U('1490114538077-0a7f8cb49891'),
};

const COLLECTION_IMAGE: Record<string, string> = {
  'New Arrivals': U('1604176354204-9268737828e4'),
  'Premium Collection': U('1584865288642-42078afe6942'),
  Sale: U('1560243563-062bfc001d68'),
  'Summer Edit': U('1582418702059-97ebafb35d09'),
};

async function seedCatalogStructure() {
  for (const [i, top] of CATEGORY_TREE.entries()) {
    const image = CATEGORY_IMAGE[top.name] ?? null;
    const parent = await prisma.category.upsert({
      where: { slug: slugify(top.name) },
      create: {
        name: top.name, slug: slugify(top.name), gender: top.gender, ageGroup: top.ageGroup,
        isFeatured: true, sortOrder: i, path: slugify(top.name), imageUrl: image,
      },
      update: { gender: top.gender, ageGroup: top.ageGroup, imageUrl: image },
    });
    for (const [j, child] of (top.children ?? []).entries()) {
      const childCat = await prisma.category.upsert({
        where: { slug: slugify(`${top.name}-${child.name}`) },
        create: {
          name: child.name, slug: slugify(`${top.name}-${child.name}`),
          parentId: parent.id, gender: top.gender, sortOrder: j,
          path: `${slugify(top.name)}/${slugify(child.name)}`,
        },
        update: { parentId: parent.id },
      });
      for (const [k, grand] of (child.children ?? []).entries()) {
        await prisma.category.upsert({
          where: { slug: slugify(`${top.name}-${child.name}-${grand}`) },
          create: {
            name: grand, slug: slugify(`${top.name}-${child.name}-${grand}`),
            parentId: childCat.id, sortOrder: k,
            path: `${slugify(top.name)}/${slugify(child.name)}/${slugify(grand)}`,
          },
          update: { parentId: childCat.id },
        });
      }
    }
  }

  for (const c of [
    { name: 'New Arrivals', isFeatured: true },
    { name: 'Premium Collection', isPremium: true, isFeatured: true },
    { name: 'Sale', isFeatured: true },
    { name: 'Summer Edit', isSeasonal: true },
  ]) {
    const img = COLLECTION_IMAGE[c.name] ?? null;
    await prisma.collection.upsert({
      where: { slug: slugify(c.name) },
      create: { name: c.name, slug: slugify(c.name), isActive: true, imageUrl: img, ...c },
      update: { imageUrl: img },
    });
  }

  for (const t of ['Apparel 5%', 'Apparel 12%', 'Footwear 18%', 'Accessories 18%']) {
    const rate = Number(t.match(/(\d+)%/)?.[1] ?? 5);
    await prisma.taxClass.upsert({
      where: { name: t },
      create: { name: t, rate, type: 'GST', isInclusive: true },
      update: { rate },
    });
  }

  await prisma.warehouse.upsert({
    where: { code: 'WH-MAIN' },
    create: { name: 'Main Warehouse', code: 'WH-MAIN', priority: 100 },
    update: {},
  });

  const zone = await prisma.shippingZone.upsert({
    where: { name: 'India' },
    create: { name: 'India', regions: { countries: ['IN'] }, isActive: true },
    update: {},
  });
  const existingRate = await prisma.shippingRate.findFirst({ where: { zoneId: zone.id, name: 'Standard' } });
  if (!existingRate) {
    await prisma.shippingRate.create({
      data: {
        zoneId: zone.id, name: 'Standard', price: 79, freeAboveAmount: 999,
        minDeliveryDays: 3, maxDeliveryDays: 7, codAvailable: true, codFee: 49,
      },
    });
    await prisma.shippingRate.create({
      data: {
        zoneId: zone.id, name: 'Express', price: 199, minDeliveryDays: 1,
        maxDeliveryDays: 3, codAvailable: false, sortOrder: 1,
      },
    });
  }
  console.log('  Catalog structure: categories, collections, tax classes, warehouse, shipping');
}

async function seedSettings() {
  const settings: Array<[string, string, unknown, string]> = [
    ['general', 'store.name', 'Slay Jeans', 'Store name'],
    ['general', 'store.tagline', 'Denim, redefined.', 'Tagline'],
    ['general', 'store.supportEmail', 'help@slayjeans.com', 'Support email'],
    ['general', 'store.supportPhone', '+91 90000 00000', 'Support phone'],
    ['general', 'store.currency', 'INR', 'Default currency'],
    ['checkout', 'checkout.guestEnabled', true, 'Allow guest checkout'],
    ['checkout', 'checkout.minOrderAmount', 0, 'Minimum order amount'],
    ['checkout', 'checkout.codEnabled', true, 'Enable Cash on Delivery'],
    ['payment', 'payment.enabledMethods', ['RAZORPAY', 'UPI', 'CARD', 'NETBANKING', 'COD'], 'Enabled payment methods'],
    ['shipping', 'shipping.freeShippingThreshold', 999, 'Free shipping above'],
    ['shipping', 'shipping.defaultProvider', 'shiprocket', 'Default courier aggregator'],
    ['tax', 'tax.pricesIncludeTax', true, 'Displayed prices include tax'],
    ['seo', 'seo.defaultTitleTemplate', '%s | Slay Jeans', 'Title template'],
    ['seo', 'seo.defaultMetaDescription', 'Shop premium denim and fashion at Slay Jeans.', 'Default meta description'],
    ['security', 'security.otpLoginEnabled', true, 'Enable OTP login'],
    ['loyalty', 'loyalty.pointsPerCurrency', 1, 'Points earned per ₹1 spent'],
    ['loyalty', 'loyalty.redeemValue', 0.25, '₹ value of 1 point on redemption'],
  ];
  for (const [group, key, value, label] of settings) {
    await prisma.setting.upsert({
      where: { key },
      create: {
        group, key, label,
        value: value as Prisma.InputJsonValue,
        valueType:
          typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'number' ? 'NUMBER' : Array.isArray(value) || typeof value === 'object' ? 'JSON' : 'STRING',
      },
      update: {},
    });
  }
  console.log(`  Settings: ${settings.length} keys`);
}

async function seedNavigation() {
  const header = await prisma.menu.upsert({
    where: { location: 'header' },
    create: { name: 'Main Nav', location: 'header' },
    update: {},
  });
  const topLevel = ['Men', 'Women', 'Kids', 'Footwear', 'Watches', 'Accessories'];
  for (const [i, label] of topLevel.entries()) {
    const existing = await prisma.menuItem.findFirst({ where: { menuId: header.id, label } });
    if (!existing) {
      await prisma.menuItem.create({
        data: { menuId: header.id, label, url: `/c/${slugify(label)}`, position: i },
      });
    }
  }
  for (const [loc, name, links] of [
    ['footer-1', 'Footer - Shop', [['New Arrivals', '/collections/new-arrivals'], ['Sale', '/collections/sale'], ['Premium', '/collections/premium-collection']]],
    ['footer-2', 'Footer - Help', [['Track Order', '/account/orders'], ['Returns', '/returns'], ['Contact', '/contact'], ['Size Guide', '/size-guide']]],
  ] as const) {
    const menu = await prisma.menu.upsert({
      where: { location: loc }, create: { name, location: loc }, update: {},
    });
    for (const [i, [label, url]] of links.entries()) {
      const existing = await prisma.menuItem.findFirst({ where: { menuId: menu.id, label } });
      if (!existing) await prisma.menuItem.create({ data: { menuId: menu.id, label, url, position: i } });
    }
  }
  console.log('  Navigation: header + footer menus');
}

async function seedHomepage() {
  const sections: Array<{ type: HomeSectionType; title?: string; position: number; config?: object }> = [
    { type: 'BANNER', title: 'Hero', position: 0 },
    { type: 'CATEGORY_GRID', title: 'Shop by Category', position: 1 },
    { type: 'NEW_ARRIVALS', title: 'New Arrivals', position: 2, config: { limit: 12 } },
    { type: 'BEST_SELLERS', title: 'Best Sellers', position: 3, config: { limit: 12 } },
    { type: 'FLASH_SALE', title: 'Flash Sale', position: 4, config: { limit: 12 } },
    { type: 'COLLECTION_GRID', title: 'Featured Collections', position: 5 },
    { type: 'TRENDING', title: 'Trending Now', position: 6, config: { limit: 12 } },
    { type: 'LOOKBOOK', title: 'Style Inspiration', position: 7 },
    { type: 'TOP_RATED', title: 'Top Rated', position: 8, config: { limit: 12 } },
    { type: 'TESTIMONIALS', title: 'What Our Customers Say', position: 9 },
    { type: 'INSTAGRAM', title: '@slayjeans', position: 10 },
    { type: 'NEWSLETTER', title: 'Join the List', position: 11 },
  ];
  for (const s of sections) {
    const existing = await prisma.homeSection.findFirst({ where: { type: s.type, position: s.position } });
    if (!existing) {
      await prisma.homeSection.create({
        data: { type: s.type, title: s.title, position: s.position, config: s.config, isActive: true },
      });
    }
  }

  // Populate the "Shop by Category" grid with the top categories.
  const catGrid = await prisma.homeSection.findFirst({ where: { type: 'CATEGORY_GRID' } });
  if (catGrid) {
    const tops = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    });
    await prisma.homeSectionItem.deleteMany({ where: { sectionId: catGrid.id } });
    await prisma.homeSectionItem.createMany({
      data: tops.map((c, position) => ({
        sectionId: catGrid.id,
        label: c.name,
        url: `/c/${c.slug}`,
        imageUrl: c.imageUrl,
        position,
      })),
    });
  }

  const heroData = {
    title: 'Autumn Drop',
    headline: 'The Autumn Denim Drop',
    subheadline: 'New washes. New fits. Limited runs.',
    ctaLabel: 'Shop New In',
    ctaUrl: '/collections/new-arrivals',
    imageUrl:
      'https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=1920&q=80&auto=format&fit=crop',
    isActive: true,
    position: 0,
  };
  const existingHero = await prisma.banner.findFirst({ where: { placement: 'HOME_HERO' } });
  if (existingHero) {
    await prisma.banner.update({ where: { id: existingHero.id }, data: heroData });
  } else {
    await prisma.banner.create({ data: { placement: 'HOME_HERO', ...heroData } });
  }
  console.log(`  Homepage: ${sections.length} sections + hero banner`);
}

async function seedDemoProducts() {
  const brands = ['Slay Originals', 'Indigo Lab', 'Metro Ave', 'Northbound'];
  const brandRecords = await Promise.all(
    brands.map((name) =>
      prisma.brand.upsert({
        where: { slug: slugify(name) },
        create: { name, slug: slugify(name), isFeatured: true },
        update: {},
      }),
    ),
  );
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-MAIN' } });
  const menJeans = await prisma.category.findUniqueOrThrow({ where: { slug: 'men-jeans' } });
  const womenJeans = await prisma.category.findUniqueOrThrow({ where: { slug: 'women-jeans' } });
  const apparelTax = await prisma.taxClass.findUniqueOrThrow({ where: { name: 'Apparel 5%' } });

  // Curated Unsplash denim photography — clean detail / on-model / folded shots
  // only. No store-rack or lifestyle-flatlay imagery, so cards stay consistent.
  const IMG = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
  const MEN_IMAGES = [
    IMG('1542272604-787c3835535d'), // dark denim, back-pocket detail
    IMG('1548883354-7622d03aca27'), // moody dark denim detail
    IMG('1602293589930-45aad59ba3ab'), // light wash, waist detail
    IMG('1604176354204-9268737828e4'), // folded denim stack
  ];
  const WOMEN_IMAGES = [
    IMG('1475178626620-a4d074967452'), // light blue, on-model
    IMG('1598554747436-c9293d6a588f'), // studio, mom-fit
    IMG('1544022613-e87ca75a784a'), // street style, denim + jacket
    IMG('1602293589930-45aad59ba3ab'), // light wash, waist detail
  ];
  const rotate = <T,>(arr: T[], by: number) => arr.map((_, i) => arr[(i + by) % arr.length]!);

  const demo = [
    {
      name: 'Slim Fit Stretch Jeans - Rinse Wash', cat: menJeans, mrp: 3499, sale: 2099, gender: Gender.MEN,
      flags: { isBestSeller: true, isFeatured: true },
      short: 'Our everyday slim — mid-weight stretch denim in a clean rinse wash.',
      long: '<p>The one you reach for on repeat. Cut close through the thigh with a touch of stretch so it moves with you, finished in a deep rinse wash with tonal stitching and branded hardware.</p><p>Model is 6\'1" and wears a 32.</p>',
    },
    {
      name: 'Tapered Selvedge Jeans - Raw Indigo', cat: menJeans, mrp: 5999, sale: 4499, gender: Gender.MEN,
      flags: { isNewArrival: true, isExclusive: true },
      short: 'Japanese selvedge denim, tapered leg, raw indigo that fades to your life.',
      long: '<p>Woven on shuttle looms for a dense, characterful hand-feel. Left raw so the indigo breaks in around the knees and pockets over time. A tapered leg keeps it modern.</p><p>13.5oz · unwashed · expect ~1" shrink on first wash.</p>',
    },
    {
      name: 'Relaxed Straight Jeans - Mid Blue', cat: menJeans, mrp: 3299, sale: 1899, gender: Gender.MEN,
      flags: { isTrending: true },
      short: 'A roomy straight leg in a soft mid-blue wash. Easy all day.',
      long: '<p>Sits at the natural waist with a relaxed thigh and a straight, unbroken line to the hem. Garment-washed for a lived-in softness from the first wear.</p>',
    },
    {
      name: 'High-Rise Skinny Jeans - Black', cat: womenJeans, mrp: 3199, sale: 1999, gender: Gender.WOMEN,
      flags: { isBestSeller: true },
      short: 'Sculpting high-rise skinny in a true, non-fade black.',
      long: '<p>High-stretch power denim that holds its shape from morning to midnight. A high rise smooths the waist; a skinny leg tucks cleanly into boots.</p>',
    },
    {
      name: 'Wide-Leg Cropped Jeans - Ecru', cat: womenJeans, mrp: 3799, sale: 2499, gender: Gender.WOMEN,
      flags: { isNewArrival: true, isStaffPick: true },
      short: 'Rigid ecru denim, cropped wide leg, a clean raw hem.',
      long: '<p>Architectural and elevated. A firm, non-stretch denim in warm ecru holds a wide, cropped column that hits just above the ankle. Pair with a loafer or a chunky sandal.</p>',
    },
    {
      name: 'Mom Fit Jeans - Vintage Wash', cat: womenJeans, mrp: 3599, sale: 2299, gender: Gender.WOMEN,
      flags: { isTrending: true, isHot: true },
      short: 'The \'90s mom fit — tapered, high-waisted, softly faded.',
      long: '<p>A nostalgic high waist and a relaxed hip taper to a slightly cropped ankle. Authentic vintage-wash denim with subtle whiskering and a worn-in feel.</p>',
    },
  ];

  const sizes = ['28', '30', '32', '34', '36'];
  for (const [i, d] of demo.entries()) {
    const slug = slugify(d.name);
    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        name: d.name, slug, status: ProductStatus.ACTIVE, publishedAt: new Date(),
        brandId: brandRecords[i % brandRecords.length]!.id,
        gender: d.gender, ageGroup: AgeGroup.ADULT,
        shortDescription: d.short,
        description: d.long,
        mrp: d.mrp, salePrice: d.sale, costPrice: Math.round(d.sale * 0.45),
        taxClassId: apparelTax.id,
        fabricDetails: '98% Cotton, 2% Elastane',
        careInstructions: 'Machine wash cold, inside out. Do not tumble dry.',
        originCountry: 'IN', weightGrams: 550,
        ratingAverage: 4.2 + (i % 5) * 0.1, ratingCount: 12 + i * 7,
        soldCount: 40 + i * 25, viewCount: 200 + i * 90,
        ...d.flags,
      },
      update: {
        salePrice: d.sale, mrp: d.mrp, status: ProductStatus.ACTIVE,
        shortDescription: d.short, description: d.long,
      },
    });

    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: d.cat.id } },
      create: { productId: product.id, categoryId: d.cat.id, isPrimary: true },
      update: {},
    });

    const pool = d.gender === Gender.MEN ? MEN_IMAGES : WOMEN_IMAGES;
    const images = rotate(pool, i).slice(0, 3);
    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    await prisma.productMedia.createMany({
      data: images.map((url, position) => ({
        productId: product.id,
        url,
        alt: `${d.name} — view ${position + 1}`,
        position,
        type: 'IMAGE' as const,
      })),
    });

    const sizeOption = await prisma.productOption.upsert({
      where: { productId_name: { productId: product.id, name: 'Size' } },
      create: { productId: product.id, name: 'Size', position: 0 },
      update: {},
    });
    for (const [pos, size] of sizes.entries()) {
      const value = await prisma.productOptionValue.upsert({
        where: { optionId_value: { optionId: sizeOption.id, value: size } },
        create: { optionId: sizeOption.id, value: size, position: pos },
        update: {},
      });
      const sku = `${slug.slice(0, 12).toUpperCase()}-${size}`;
      const variant = await prisma.productVariant.upsert({
        where: { sku },
        create: { productId: product.id, sku, position: pos },
        update: {},
      });
      await prisma.productVariantOptionValue.upsert({
        where: { variantId_optionValueId: { variantId: variant.id, optionValueId: value.id } },
        create: { variantId: variant.id, optionValueId: value.id },
        update: {},
      });
      await prisma.inventoryLevel.upsert({
        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
        create: { variantId: variant.id, warehouseId: warehouse.id, onHand: 25, reserved: 0 },
        update: {},
      });
    }

    // Collection membership (so /collections/<slug> pages have content).
    const flags = d.flags as Record<string, boolean | undefined>;
    const collections: string[] = [];
    if (flags.isNewArrival) collections.push('new-arrivals');
    if (d.sale < d.mrp) collections.push('sale');
    if (d.mrp >= 4000 || flags.isExclusive) collections.push('premium-collection');
    if (i % 2 === 0) collections.push('summer-edit');
    for (const cslug of collections) {
      const col = await prisma.collection.findUnique({ where: { slug: cslug } });
      if (col) {
        await prisma.productCollection.upsert({
          where: { productId_collectionId: { productId: product.id, collectionId: col.id } },
          create: { productId: product.id, collectionId: col.id },
          update: {},
        });
      }
    }
  }
  console.log(`  Demo data: ${brands.length} brands, ${demo.length} products with variants + stock`);
}

async function seedTestimonials() {
  const items = [
    { authorName: 'Aarav S.', quote: 'Best-fitting jeans I have owned. The wash looks even better in person.' },
    { authorName: 'Meera K.', quote: 'Fast delivery and the size guide was spot on. Ordering again.' },
    { authorName: 'Rohan D.', quote: 'Premium quality for the price. The selvedge pair is a staple now.' },
  ];
  for (const [i, t] of items.entries()) {
    const existing = await prisma.testimonial.findFirst({ where: { authorName: t.authorName } });
    if (!existing) await prisma.testimonial.create({ data: { ...t, position: i } });
  }
  console.log(`  Testimonials: ${items.length}`);
}

async function main() {
  console.log('Seeding Slay Jeans...');
  await seedRbac();
  await seedSuperAdmin();
  await seedCatalogStructure();
  await seedSettings();
  await seedNavigation();
  await seedHomepage();
  await seedDemoProducts();
  await seedTestimonials();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => baseClient.$disconnect());
