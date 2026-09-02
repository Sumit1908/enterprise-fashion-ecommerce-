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
    children: ['Jeans', 'Shirts', 'T-Shirts', 'Jackets', 'Trousers', 'Shorts', 'Hoodies', 'Ethnic Wear', 'Blazers', 'Watches', 'Shoes', 'Accessories'].map((n) => ({ name: n })),
  },
  {
    name: 'Women', gender: Gender.WOMEN, ageGroup: AgeGroup.ADULT,
    children: ['Jeans', 'Tops', 'Shirts', 'Kurtis', 'Dresses', 'Suits', 'Sarees', 'Leggings', 'Jackets', 'Co-ord Sets', 'Ethnic Wear', 'Bags', 'Watches', 'Shoes', 'Accessories'].map((n) => ({ name: n })),
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
  const email = process.env.SEED_ADMIN_EMAIL ?? 'sumitaastha@velorhouse.in';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      kind: 'STAFF',
      status: 'ACTIVE',
      isSuperAdmin: true,
      firstName: 'Sumit',
      lastName: 'Aastha',
      displayName: 'SumitAastha',
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

// Consistent, clean editorial imagery. Replace any of these from the admin
// (Categories & Collections -> edit -> image) once real photography exists.
const CATEGORY_IMAGE: Record<string, string> = {
  Men: U('1516257984-b1b4d707412e'),
  Women: U('1495385794356-15371f348c31'),
  Kids: U('1518831959646-742c3a14ebf7'),
  Footwear: U('1549298916-b41d501d3772'),
  Watches: U('1483118714900-540cf339fd46'),
  Bags: U('1548036328-c9fa89d128fa'),
  Belts: U('1490114538077-0a7f8cb49891'),
  Wallets: U('1490114538077-0a7f8cb49891'),
  Sunglasses: U('1511499767150-a48a237f0083'),
  Accessories: U('1490114538077-0a7f8cb49891'),
};

const COLLECTION_IMAGE: Record<string, string> = {
  'New Arrivals': U('1604176354204-9268737828e4'),
  'Premium Collection': U('1584865288642-42078afe6942'),
  Sale: U('1602293589930-45aad59ba3ab'),
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
    ['general', 'store.name', 'Velor House', 'Store name'],
    ['general', 'store.tagline', 'Denim, redefined.', 'Tagline'],
    ['general', 'store.supportEmail', 'velorhouse@gmail.com', 'Support email'],
    ['general', 'store.supportPhone', '+91 93367 91807', 'Support phone / WhatsApp'],
    ['general', 'store.whatsapp', '+919336791807', 'WhatsApp number (E.164)'],
    ['general', 'store.addressLine1', 'Lalganj Ajhara', 'Business address line 1'],
    ['general', 'store.city', 'Pratapgarh', 'City'],
    ['general', 'store.state', 'Uttar Pradesh', 'State'],
    ['general', 'store.pincode', '230132', 'PIN code'],
    ['general', 'store.country', 'India', 'Country'],
    ['general', 'store.currency', 'INR', 'Default currency'],
    ['checkout', 'checkout.guestEnabled', true, 'Allow guest checkout'],
    ['checkout', 'checkout.minOrderAmount', 0, 'Minimum order amount'],
    ['checkout', 'checkout.codEnabled', true, 'Enable Cash on Delivery'],
    // COD + Razorpay online payments. "RAZORPAY" only actually appears at checkout
    // once RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set on the API service; until
    // then the storefront silently shows Cash on Delivery only.
    ['payment', 'payment.enabledMethods', ['COD', 'RAZORPAY'], 'Enabled payment methods'],
    ['shipping', 'shipping.freeShippingThreshold', 999, 'Free shipping above'],
    ['shipping', 'shipping.defaultProvider', 'shiprocket', 'Default courier aggregator'],
    ['tax', 'tax.pricesIncludeTax', true, 'Displayed prices include tax'],
    ['seo', 'seo.defaultTitleTemplate', '%s | Velor House', 'Title template'],
    ['seo', 'seo.defaultMetaDescription', 'Shop premium denim and fashion at Velor House.', 'Default meta description'],
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
    { type: 'INSTAGRAM', title: '@velorhouse', position: 10 },
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

  // Hero slider — one Banner row per slide, ordered by `position`.
  // Desktop (imageUrl) shows above 768px, mobile (imageMobileUrl) below.
  // Slide artwork lives in apps/web/public so it deploys with the storefront
  // (no external host / object storage needed).
  const heroSlides = [
    {
      title: 'Everyday Essentials',
      headline: 'Made for the Way You Move',
      subheadline:
        'Thoughtfully designed essentials for everyday living — refined in detail, effortless in style.',
      ctaLabel: 'Shop Shirts',
      ctaUrl: '/c/men-shirts',
      imageUrl: '/hero-1.jpg',
      imageMobileUrl: '/hero-1-mobile.jpg',
    },
  ];

  // Retire the old single "Autumn Denim Drop" hero if it's still the only slide.
  await prisma.banner.deleteMany({
    where: { placement: 'HOME_HERO', OR: [{ title: 'Autumn Drop' }, { headline: 'The Autumn Denim Drop' }] },
  });

  const heroCount = await prisma.banner.count({ where: { placement: 'HOME_HERO' } });
  if (heroCount === 0) {
    for (const [i, slide] of heroSlides.entries()) {
      await prisma.banner.create({
        data: { placement: 'HOME_HERO', ...slide, isActive: true, position: i },
      });
    }
  }
  console.log(`  Homepage: ${sections.length} sections + ${Math.max(heroCount, heroSlides.length)} hero slide(s)`);
}

/* =========================================================================
 * Full catalogue — realistic products across every Men / Women / Kids
 * category so no navigation link lands on an empty page.
 * ======================================================================= */

const IMG2 = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Verified editorial / product imagery, grouped by product type. */
const POOL = {
  jeansM: ['1542272604-787c3835535d', '1548883354-7622d03aca27', '1602293589930-45aad59ba3ab', '1624378439575-d8705ad7ae80'],
  jeansW: ['1475178626620-a4d074967452', '1598554747436-c9293d6a588f', '1544022613-e87ca75a784a', '1541099649105-f69ad21f3246'],
  shirtM: ['1596755094514-f87e34085b2c', '1602810318383-e386cc2a3ccf', '1607345366928-199ea26cfe3e', '1621072156002-e2fccdc0b176', '1620012253295-c15cc3e65df4'],
  teeM: ['1503341504253-dff4815485f1', '1618354691373-d851c5c3a990', '1622470953794-aa9c70b0fb9d'],
  jacketM: ['1591047139829-d91aecb6caea', '1520975954732-35dd22299614', '1551028719-00167b16eac5', '1544923246-77307dd654cb'],
  trouserM: ['1473966968600-fa801b869a1a', '1624378439575-d8705ad7ae80', '1594633312681-425c7b97ccd1'],
  watch: ['1523275335684-37898b6baf30', '1547996160-81dfa63595aa', '1508057198894-247b23fe5ade', '1524805444758-089113d48a6d'],
  shoe: ['1600185365483-26d7a4cc7519', '1595950653106-6c9ebd614d3a', '1560769629-975ec94e6a86', '1549298916-b41d501d3772', '1595341888016-a392ef81b7de', '1542291026-7eec264c27ff'],
  bag: ['1584917865442-de89df76afd3', '1590874103328-eac38a683ce7', '1553062407-98eeb64c6a62'],
  sunglass: ['1511499767150-a48a237f0083', '1572635196237-14b3f281503f'],
  belt: ['1490114538077-0a7f8cb49891', '1624222247344-550fb60583dc'],
  wallet: ['1627123424574-724758594e93', '1490114538077-0a7f8cb49891'],
  topW: ['1515372039744-b8f02a3ae446', '1566174053879-31528523f8ae', '1595777457583-95e059d581b8', '1594633313593-bab3825d0caf'],
  shirtW: ['1595777457583-95e059d581b8', '1583496661160-fb5886a0aaaa', '1566174053879-31528523f8ae', '1515372039744-b8f02a3ae446'],
  kurti: ['1612722432474-b971cdcea546', '1594633313593-bab3825d0caf', '1566174053879-31528523f8ae'],
  dress: ['1583496661160-fb5886a0aaaa', '1594633313593-bab3825d0caf', '1612722432474-b971cdcea546', '1595777457583-95e059d581b8'],
  kids: ['1503919545889-aef636e10ad4', '1476234251651-f353703a034d', '1471286174890-9c112ffca5b4', '1518831959646-742c3a14ebf7'],
} as const;

const SZ = {
  top: ['S', 'M', 'L', 'XL', 'XXL'],
  bottom: ['28', '30', '32', '34', '36'],
  shoeM: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  shoeW: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8'],
  kids: ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y'],
  none: [] as string[],
};

type Col = [string, string];
const CL = {
  black: ['Black', '#171717'] as Col,
  white: ['White', '#f2f1ed'] as Col,
  offwhite: ['Off White', '#e8e2d4'] as Col,
  navy: ['Navy', '#22304d'] as Col,
  midblue: ['Mid Blue', '#4a6b93'] as Col,
  indigo: ['Indigo', '#2b3a67'] as Col,
  stone: ['Stone', '#c8bda6'] as Col,
  olive: ['Olive', '#5c5f43'] as Col,
  brown: ['Brown', '#6b4a32'] as Col,
  tan: ['Tan', '#c99a63'] as Col,
  grey: ['Grey', '#8b8f95'] as Col,
  charcoal: ['Charcoal', '#3a3d42'] as Col,
  ecru: ['Ecru', '#e6ddca'] as Col,
  rust: ['Rust', '#9c4a2e'] as Col,
  sky: ['Sky', '#bcd4e6'] as Col,
  pink: ['Pink', '#e6bfc6'] as Col,
  blush: ['Blush', '#e8c4c0'] as Col,
  maroon: ['Maroon', '#6a2230'] as Col,
  mustard: ['Mustard', '#c99a2e'] as Col,
  sage: ['Sage', '#9aa886'] as Col,
  red: ['Red', '#b83232'] as Col,
  green: ['Bottle Green', '#26443a'] as Col,
  rosegold: ['Rose Gold', '#c9a0a0'] as Col,
  silver: ['Silver', '#c7ccd1'] as Col,
  gold: ['Gold', '#b0894e'] as Col,
  cream: ['Cream', '#e8dfc8'] as Col,
};

interface CatItem {
  name: string;
  cat: string;
  gender: Gender;
  age?: AgeGroup;
  brand: number;
  mrp: number;
  sale: number;
  sizes: string[];
  colors: Col[];
  imgs: readonly string[];
  short: string;
  long: string;
  fabric: string;
  care: string;
  tax?: string;
  flags?: Partial<Record<'isBestSeller' | 'isFeatured' | 'isNewArrival' | 'isTrending' | 'isHot' | 'isStaffPick' | 'isExclusive', boolean>>;
}

const APPAREL_CARE = 'Machine wash cold with like colours. Do not bleach. Tumble dry low.';
const DENIM_CARE = 'Machine wash cold, inside out. Wash sparingly. Line dry.';

function mk(o: Partial<CatItem> & Pick<CatItem, 'name' | 'cat' | 'gender' | 'mrp' | 'sale' | 'sizes' | 'colors' | 'imgs' | 'short'>): CatItem {
  return { brand: 0, long: `<p>${o.short}</p>`, fabric: 'Cotton-rich blend', care: APPAREL_CARE, ...o };
}

const CATALOG: CatItem[] = [
  /* MEN JEANS */
  mk({ name: 'Slim Fit Stretch Jeans - Rinse Wash', cat: 'men-jeans', gender: Gender.MEN, brand: 0, mrp: 3499, sale: 2099, sizes: SZ.bottom, colors: [CL.midblue, CL.black], imgs: POOL.jeansM, fabric: '98% Cotton, 2% Elastane', care: DENIM_CARE, flags: { isBestSeller: true, isFeatured: true }, short: 'Our everyday slim — mid-weight stretch denim in a clean rinse wash.', long: '<p>The one you reach for on repeat. Cut close through the thigh with a touch of stretch so it moves with you, finished in a deep rinse wash with tonal stitching and branded hardware.</p>' }),
  mk({ name: 'Tapered Selvedge Jeans - Raw Indigo', cat: 'men-jeans', gender: Gender.MEN, brand: 1, mrp: 5999, sale: 4499, sizes: SZ.bottom, colors: [CL.indigo, CL.midblue], imgs: POOL.jeansM, fabric: '100% Cotton, 13.5 oz selvedge', care: DENIM_CARE, flags: { isNewArrival: true, isExclusive: true }, short: 'Japanese selvedge denim, tapered leg, raw indigo that fades to your life.', long: '<p>Woven on shuttle looms for a dense, characterful hand-feel. Left raw so the indigo breaks in around the knees and pockets over time. Expect ~1" shrink on first wash.</p>' }),
  mk({ name: 'Relaxed Straight Jeans - Mid Blue', cat: 'men-jeans', gender: Gender.MEN, brand: 2, mrp: 3299, sale: 1899, sizes: SZ.bottom, colors: [CL.midblue, CL.stone], imgs: POOL.jeansM, fabric: '99% Cotton, 1% Elastane', care: DENIM_CARE, flags: { isTrending: true }, short: 'A roomy straight leg in a soft mid-blue wash. Easy all day.', long: '<p>Sits at the natural waist with a relaxed thigh and a straight, unbroken line to the hem. Garment-washed for a lived-in softness from the first wear.</p>' }),
  mk({ name: 'Skinny Fit Jeans - Jet Black', cat: 'men-jeans', gender: Gender.MEN, brand: 0, mrp: 2999, sale: 1799, sizes: SZ.bottom, colors: [CL.black, CL.charcoal], imgs: POOL.jeansM, fabric: '92% Cotton, 6% Poly, 2% Elastane', care: DENIM_CARE, short: 'High-stretch skinny in a true, colour-locked black.', long: '<p>Power-stretch denim that holds its shape all day and never goes green. A skinny leg that tucks cleanly into boots.</p>' }),
  mk({ name: 'Carpenter Loose Jeans - Stone Wash', cat: 'men-jeans', gender: Gender.MEN, brand: 3, mrp: 3799, sale: 2499, sizes: SZ.bottom, colors: [CL.stone, CL.midblue], imgs: POOL.jeansM, fabric: '100% Cotton, 12 oz', care: DENIM_CARE, flags: { isNewArrival: true }, short: 'Utility carpenter jeans with a loose leg and a hammer loop.', long: '<p>Rigid 12 oz denim in a washed-down stone, cut loose through the leg with a utility pocket and a tonal hammer loop.</p>' }),

  /* MEN SHIRTS */
  mk({ name: 'Oxford Button-Down Shirt', cat: 'men-shirts', gender: Gender.MEN, brand: 0, mrp: 2799, sale: 1999, sizes: SZ.top, colors: [CL.white, CL.sky, CL.pink], imgs: POOL.shirtM, fabric: '100% Cotton oxford, 120 gsm', flags: { isBestSeller: true }, short: 'A refined button-down in soft-washed oxford cotton.', long: '<p>Structured collar, a tailored-not-tight fit and a button-down collar that sits right with or without a tie.</p>' }),
  mk({ name: 'Linen-Blend Casual Shirt', cat: 'men-shirts', gender: Gender.MEN, brand: 1, mrp: 2499, sale: 1699, sizes: SZ.top, colors: [CL.sky, CL.offwhite, CL.sage], imgs: POOL.shirtM, fabric: '55% Linen, 45% Cotton', flags: { isNewArrival: true, isTrending: true }, short: 'Breathable linen-cotton with a relaxed camp collar. Made for heat.', long: '<p>A lightweight linen blend with a soft camp collar and a straight hem you can wear out. Gets better with every wash.</p>' }),
  mk({ name: 'Checked Flannel Overshirt', cat: 'men-shirts', gender: Gender.MEN, brand: 2, mrp: 3299, sale: 2299, sizes: SZ.top, colors: [CL.rust, CL.olive], imgs: POOL.shirtM, fabric: '100% Brushed cotton flannel', short: 'A mid-weight brushed flannel — wear it as a shirt or a light layer.', long: '<p>Yarn-dyed check in a soft brushed cotton, with chest pockets and corozo buttons. Sized to layer over a tee.</p>' }),
  mk({ name: 'Cuban Collar Print Shirt', cat: 'men-shirts', gender: Gender.MEN, brand: 3, mrp: 2699, sale: 1899, sizes: SZ.top, colors: [CL.ecru, CL.navy], imgs: POOL.shirtM, fabric: '100% Viscose', flags: { isStaffPick: true }, short: 'A drapey short-sleeve shirt with an all-over tonal print.', long: '<p>Soft viscose with a relaxed Cuban collar and a subtle tonal print. The one for warm evenings.</p>' }),
  mk({ name: 'Formal Twill Shirt', cat: 'men-shirts', gender: Gender.MEN, brand: 0, mrp: 2599, sale: 1799, sizes: SZ.top, colors: [CL.white, CL.navy], imgs: POOL.shirtM, fabric: '100% Cotton twill, easy-iron', short: 'A crisp twill shirt with an easy-iron finish for the office.', long: '<p>A slim-regular fit in a fine cotton twill with a cutaway collar and an easy-iron finish.</p>' }),

  /* MEN T-SHIRTS */
  mk({ name: 'Heavyweight Crew Tee', cat: 'men-t-shirts', gender: Gender.MEN, brand: 0, mrp: 1499, sale: 999, sizes: SZ.top, colors: [CL.black, CL.offwhite, CL.olive], imgs: POOL.teeM, fabric: '100% Combed cotton, 240 gsm', flags: { isBestSeller: true }, short: 'A dense 240 gsm cotton tee that holds its shape. Boxy modern cut.', long: '<p>Structured heavyweight jersey with a ribbed collar and a clean boxy cut. The tee that survives the wash pile.</p>' }),
  mk({ name: 'Pima Cotton Slim Tee', cat: 'men-t-shirts', gender: Gender.MEN, brand: 1, mrp: 1299, sale: 899, sizes: SZ.top, colors: [CL.white, CL.navy, CL.grey], imgs: POOL.teeM, fabric: '100% Pima cotton, 160 gsm', short: 'A soft, lightweight everyday tee in long-staple Pima cotton.', long: '<p>A closer fit in a fine Pima jersey — smooth hand-feel, minimal shrinkage, ideal for layering.</p>' }),
  mk({ name: 'Breton Stripe Tee', cat: 'men-t-shirts', gender: Gender.MEN, brand: 2, mrp: 1599, sale: 1099, sizes: SZ.top, colors: [CL.navy, CL.charcoal], imgs: POOL.teeM, fabric: '100% Cotton, 180 gsm', flags: { isNewArrival: true }, short: 'The classic French stripe in a mid-weight cotton.', long: '<p>Yarn-dyed Breton stripes on a slightly heavier jersey, with a set-in sleeve and a straight hem.</p>' }),
  mk({ name: 'Piqué Polo T-Shirt', cat: 'men-t-shirts', gender: Gender.MEN, brand: 0, mrp: 1799, sale: 1249, sizes: SZ.top, colors: [CL.green, CL.navy, CL.white], imgs: POOL.teeM, fabric: '100% Cotton piqué, 200 gsm', flags: { isTrending: true }, short: 'A classic piqué polo with a two-button placket and tipped collar.', long: '<p>Structured cotton piqué with a ribbed collar and cuffs. Smart enough for the office, easy enough for the weekend.</p>' }),

  /* MEN JACKETS */
  mk({ name: 'MA-1 Bomber Jacket', cat: 'men-jackets', gender: Gender.MEN, brand: 3, mrp: 4999, sale: 3499, sizes: SZ.top, colors: [CL.olive, CL.black], imgs: POOL.jacketM, fabric: 'Shell: 100% Nylon; Lining: 100% Poly', flags: { isBestSeller: true, isNewArrival: true }, short: 'The classic MA-1 bomber with a ribbed collar and utility pocket.', long: '<p>A lightweight nylon shell with a warm quilted lining, ribbed trims and the signature arm pocket.</p>' }),
  mk({ name: 'Trucker Denim Jacket - Mid Wash', cat: 'men-jackets', gender: Gender.MEN, brand: 1, mrp: 4299, sale: 2999, sizes: SZ.top, colors: [CL.midblue, CL.black], imgs: POOL.jacketM, fabric: '100% Cotton denim, 11 oz', care: DENIM_CARE, short: 'The everyday trucker in a mid-wash rigid denim.', long: '<p>A true trucker cut — chest flap pockets, adjustable waist tabs, and an 11 oz denim that breaks in beautifully.</p>' }),
  mk({ name: 'Biker Leather Jacket - Black', cat: 'men-jackets', gender: Gender.MEN, brand: 0, mrp: 8999, sale: 6499, sizes: SZ.top, colors: [CL.black, CL.brown], imgs: POOL.jacketM, fabric: '100% Genuine leather', care: 'Wipe clean with a damp cloth. Condition twice a year.', flags: { isExclusive: true }, short: 'An asymmetric-zip biker jacket in supple genuine leather.', long: '<p>A classic moto silhouette with an asymmetric zip, zipped cuffs and a quilted shoulder. Softens and shines with wear.</p>' }),
  mk({ name: 'Sherpa-Lined Denim Jacket', cat: 'men-jackets', gender: Gender.MEN, brand: 2, mrp: 4799, sale: 3299, sizes: SZ.top, colors: [CL.indigo, CL.stone], imgs: POOL.jacketM, fabric: 'Shell: 100% Cotton; Lining: Sherpa fleece', care: DENIM_CARE, flags: { isHot: true }, short: 'A trucker jacket lined edge-to-edge with warm sherpa.', long: '<p>The winter trucker — rigid cotton denim outside, a plush sherpa lining and collar inside.</p>' }),

  /* MEN TROUSERS */
  mk({ name: 'Tapered Chino Trouser', cat: 'men-trousers', gender: Gender.MEN, brand: 0, mrp: 3199, sale: 2199, sizes: SZ.bottom, colors: [CL.stone, CL.charcoal, CL.olive], imgs: POOL.trouserM, fabric: '97% Cotton, 3% Elastane twill', flags: { isBestSeller: true }, short: 'A slim-tapered chino in brushed cotton twill. Clean lines, zero fuss.', long: '<p>A modern taper with a hint of stretch, a clean waistband and a trouser hem you can wear cropped or full.</p>' }),
  mk({ name: 'Slim Formal Trouser - Charcoal', cat: 'men-trousers', gender: Gender.MEN, brand: 1, mrp: 3499, sale: 2399, sizes: SZ.bottom, colors: [CL.charcoal, CL.navy], imgs: POOL.trouserM, fabric: 'Poly-viscose blend, wrinkle-resistant', short: 'A sharp slim-fit trouser in a wrinkle-resistant blend.', long: '<p>A tailored slim fit with a crease-hold finish, a hook-and-bar closure and a clean flat front.</p>' }),
  mk({ name: 'Cargo Jogger - Black', cat: 'men-trousers', gender: Gender.MEN, brand: 3, mrp: 3299, sale: 2299, sizes: SZ.bottom, colors: [CL.black, CL.olive], imgs: POOL.trouserM, fabric: '100% Cotton ripstop', flags: { isNewArrival: true, isTrending: true }, short: 'A tapered cargo jogger with bellowed pockets and a ribbed hem.', long: '<p>Street-ready, travel-friendly. Ripstop cotton with utility pockets, a drawcord waist and an elasticated cuff.</p>' }),
  mk({ name: 'Pleated Wide Trouser - Sand', cat: 'men-trousers', gender: Gender.MEN, brand: 2, mrp: 3599, sale: 2499, sizes: SZ.bottom, colors: [CL.stone, CL.charcoal], imgs: POOL.trouserM, fabric: '100% Cotton, garment-dyed', flags: { isStaffPick: true }, short: 'A single-pleat wide trouser with a relaxed, elegant drape.', long: '<p>A high-rise, single-pleat wide leg in a garment-dyed cotton. Drapes long and clean over a loafer.</p>' }),

  /* MEN WATCHES */
  mk({ name: 'Minimalist Leather-Strap Watch', cat: 'men-watches', gender: Gender.MEN, brand: 0, mrp: 5999, sale: 3999, sizes: SZ.none, colors: [CL.tan, CL.black], imgs: POOL.watch, fabric: 'Stainless steel case; genuine leather strap', care: 'Keep dry. Not for swimming.', tax: 'Accessories 18%', flags: { isBestSeller: true }, short: 'A clean 40mm dial on a supple leather strap. Quiet, considered.', long: '<p>A 40mm brushed-steel case, a minimal index dial and a hand-finished leather strap. 3 ATM water-resistant.</p>' }),
  mk({ name: 'Chronograph Steel Watch', cat: 'men-watches', gender: Gender.MEN, brand: 1, mrp: 8999, sale: 6499, sizes: SZ.none, colors: [CL.silver, CL.black], imgs: POOL.watch, fabric: 'Stainless steel case + bracelet', care: 'Keep dry. Not for swimming.', tax: 'Accessories 18%', flags: { isFeatured: true }, short: 'A three-eye chronograph on a solid steel bracelet.', long: '<p>A 42mm case with a tachymeter bezel, three sub-dials and a date window, on a brushed steel bracelet.</p>' }),
  mk({ name: 'Field Watch - Olive NATO', cat: 'men-watches', gender: Gender.MEN, brand: 3, mrp: 4999, sale: 3299, sizes: SZ.none, colors: [CL.olive, CL.black], imgs: POOL.watch, fabric: 'Steel case; nylon NATO strap', care: 'Keep dry.', tax: 'Accessories 18%', flags: { isNewArrival: true }, short: 'A rugged 38mm field watch on an interchangeable NATO strap.', long: '<p>A high-legibility field dial with luminous hands and a hard-wearing woven NATO strap. 5 ATM.</p>' }),

  /* MEN SHOES */
  mk({ name: 'Low-Top Leather Sneaker - White', cat: 'men-shoes', gender: Gender.MEN, brand: 0, mrp: 4999, sale: 3499, sizes: SZ.shoeM, colors: [CL.white, CL.black], imgs: POOL.shoe, fabric: 'Full-grain leather upper; rubber cupsole', care: 'Wipe clean. Use a shoe tree.', tax: 'Footwear 18%', flags: { isBestSeller: true, isNewArrival: true }, short: 'A minimal leather court sneaker on a slim cupsole. Everyday, everywhere.', long: '<p>A clean low-top in full-grain leather with tonal laces and a slim rubber cupsole. Goes with everything.</p>' }),
  mk({ name: 'Retro Court Sneaker - Navy', cat: 'men-shoes', gender: Gender.MEN, brand: 2, mrp: 4499, sale: 2999, sizes: SZ.shoeM, colors: [CL.navy, CL.grey], imgs: POOL.shoe, fabric: 'Suede + mesh upper; EVA midsole', care: 'Brush clean. Protect with spray.', tax: 'Footwear 18%', flags: { isTrending: true }, short: "A '70s-inspired runner in suede and mesh with a gum sole.", long: '<p>A low-profile retro runner with a suede mudguard, breathable mesh panels and a cushioned EVA midsole.</p>' }),
  mk({ name: 'Chunky Trail Sneaker - Grey', cat: 'men-shoes', gender: Gender.MEN, brand: 3, mrp: 5499, sale: 3999, sizes: SZ.shoeM, colors: [CL.grey, CL.black], imgs: POOL.shoe, fabric: 'Ripstop + suede upper; rubber lug sole', care: 'Brush clean.', tax: 'Footwear 18%', short: 'A trail-ready sneaker on a chunky lugged sole.', long: '<p>A layered upper in ripstop and suede on a grippy lug sole with a moulded heel clip.</p>' }),
  mk({ name: 'Suede Desert Boot - Sand', cat: 'men-shoes', gender: Gender.MEN, brand: 1, mrp: 5999, sale: 4299, sizes: SZ.shoeM, colors: [CL.tan, CL.brown], imgs: POOL.shoe, fabric: 'Suede upper; crepe sole', care: 'Brush with a suede brush.', tax: 'Footwear 18%', flags: { isStaffPick: true }, short: 'The classic two-eyelet desert boot in soft suede on a crepe sole.', long: '<p>A timeless chukka in premium suede with a natural crepe sole and a clean welt.</p>' }),

  /* MEN ACCESSORIES */
  mk({ name: 'Reversible Leather Belt', cat: 'men-accessories', gender: Gender.MEN, brand: 0, mrp: 1999, sale: 1299, sizes: SZ.none, colors: [CL.black, CL.brown], imgs: POOL.belt, fabric: '100% Genuine leather; metal buckle', care: 'Wipe clean.', tax: 'Accessories 18%', flags: { isBestSeller: true }, short: 'One belt, two colours — flip the strap, rotate the buckle.', long: '<p>A 35mm reversible strap in genuine leather with a rotating pin buckle. Black on one side, brown on the other.</p>' }),
  mk({ name: 'Bifold Leather Wallet', cat: 'men-accessories', gender: Gender.MEN, brand: 1, mrp: 1799, sale: 1199, sizes: SZ.none, colors: [CL.brown, CL.black], imgs: POOL.wallet, fabric: '100% Full-grain leather', care: 'Wipe clean.', tax: 'Accessories 18%', short: 'A slim bifold in full-grain leather with six card slots.', long: '<p>A compact bifold with six card slots, two hidden pockets and a full-length note compartment. RFID-blocking lining.</p>' }),
  mk({ name: 'Round-Frame Sunglasses - Gold', cat: 'men-accessories', gender: Gender.MEN, brand: 2, mrp: 2299, sale: 1499, sizes: SZ.none, colors: [CL.gold, CL.black], imgs: POOL.sunglass, fabric: 'Metal frame; CR-39 lens', care: 'Store in the case provided.', tax: 'Accessories 18%', flags: { isNewArrival: true }, short: 'Slim round metal frames with UV400 gradient lenses.', long: '<p>A lightweight metal frame with adjustable nose pads, spring hinges and 100% UV400 protection.</p>' }),
  mk({ name: 'Wayfarer Sunglasses - Matte Black', cat: 'men-accessories', gender: Gender.MEN, brand: 3, mrp: 2199, sale: 1399, sizes: SZ.none, colors: [CL.black, CL.brown], imgs: POOL.sunglass, fabric: 'Acetate frame; CR-39 lens', care: 'Store in the case provided.', tax: 'Accessories 18%', short: 'The classic wayfarer in a matte acetate with polarised lenses.', long: '<p>A durable acetate frame with polarised, 100% UV400 lenses and a keyhole bridge.</p>' }),

  /* WOMEN JEANS */
  mk({ name: 'High-Rise Skinny Jeans - Black', cat: 'women-jeans', gender: Gender.WOMEN, brand: 0, mrp: 3199, sale: 1999, sizes: SZ.bottom, colors: [CL.black, CL.charcoal], imgs: POOL.jeansW, fabric: '90% Cotton, 8% Poly, 2% Elastane', care: DENIM_CARE, flags: { isBestSeller: true }, short: 'Sculpting high-rise skinny in a true, non-fade black.', long: '<p>High-stretch power denim that holds its shape from morning to midnight. A high rise smooths the waist; a skinny leg tucks into boots.</p>' }),
  mk({ name: 'Wide-Leg Cropped Jeans - Ecru', cat: 'women-jeans', gender: Gender.WOMEN, brand: 1, mrp: 3799, sale: 2499, sizes: SZ.bottom, colors: [CL.ecru, CL.midblue], imgs: POOL.jeansW, fabric: '100% Cotton, non-stretch', care: DENIM_CARE, flags: { isNewArrival: true, isStaffPick: true }, short: 'Rigid ecru denim, cropped wide leg, a clean raw hem.', long: '<p>Architectural and elevated. A firm non-stretch denim in warm ecru holds a wide cropped column that hits just above the ankle.</p>' }),
  mk({ name: 'Mom Fit Jeans - Vintage Wash', cat: 'women-jeans', gender: Gender.WOMEN, brand: 2, mrp: 3599, sale: 2299, sizes: SZ.bottom, colors: [CL.midblue, CL.stone], imgs: POOL.jeansW, fabric: '100% Cotton', care: DENIM_CARE, flags: { isTrending: true, isHot: true }, short: "The '90s mom fit — tapered, high-waisted, softly faded.", long: '<p>A nostalgic high waist and a relaxed hip taper to a slightly cropped ankle. Authentic vintage-wash denim with subtle whiskering.</p>' }),
  mk({ name: 'Straight-Leg Jeans - Mid Blue', cat: 'women-jeans', gender: Gender.WOMEN, brand: 3, mrp: 3299, sale: 2099, sizes: SZ.bottom, colors: [CL.midblue, CL.black], imgs: POOL.jeansW, fabric: '99% Cotton, 1% Elastane', care: DENIM_CARE, flags: { isNewArrival: true }, short: 'A clean full-length straight leg with a mid rise.', long: '<p>A versatile straight leg that sits at the mid waist and falls in an unbroken line. A wash-and-wear everyday denim.</p>' }),

  /* WOMEN TOPS */
  mk({ name: 'Ribbed Fitted Top - White', cat: 'women-tops', gender: Gender.WOMEN, brand: 0, mrp: 1299, sale: 799, sizes: SZ.top, colors: [CL.white, CL.black, CL.sage], imgs: POOL.topW, fabric: '95% Cotton, 5% Elastane rib', flags: { isBestSeller: true }, short: 'A second-skin ribbed top with a scoop neck. A layering staple.', long: '<p>A close-fitting cotton rib with a clean scoop neckline and a fitted long sleeve. Wears solo or under everything.</p>' }),
  mk({ name: 'Puff-Sleeve Blouse - Blush', cat: 'women-tops', gender: Gender.WOMEN, brand: 1, mrp: 1999, sale: 1399, sizes: SZ.top, colors: [CL.blush, CL.white], imgs: POOL.topW, fabric: '100% Viscose', flags: { isNewArrival: true, isTrending: true }, short: 'A soft blouse with a gathered puff sleeve and a tie neck.', long: '<p>A fluid viscose blouse with a volume puff sleeve, a neat elasticated cuff and a removable neck tie.</p>' }),
  mk({ name: 'Satin Cami Top - Champagne', cat: 'women-tops', gender: Gender.WOMEN, brand: 2, mrp: 1499, sale: 999, sizes: SZ.top, colors: [CL.cream, CL.black], imgs: POOL.topW, fabric: '100% Poly satin', flags: { isStaffPick: true }, short: 'A bias-cut satin cami with adjustable straps.', long: '<p>A liquid satin camisole cut on the bias for drape, with a v-neck and fine adjustable straps.</p>' }),
  mk({ name: 'Cropped Knit Top - Sage', cat: 'women-tops', gender: Gender.WOMEN, brand: 3, mrp: 1799, sale: 1249, sizes: SZ.top, colors: [CL.sage, CL.cream], imgs: POOL.topW, fabric: '80% Cotton, 20% Nylon knit', short: 'A fine-gauge knit top with a boat neck and a cropped hem.', long: '<p>A soft cotton-blend knit with a wide boat neckline and a hem that sits at the high waist.</p>' }),

  /* WOMEN SHIRTS */
  mk({ name: 'Boyfriend Poplin Shirt - White', cat: 'women-shirts', gender: Gender.WOMEN, brand: 0, mrp: 2199, sale: 1499, sizes: SZ.top, colors: [CL.white, CL.sky], imgs: POOL.shirtW, fabric: '100% Cotton poplin', flags: { isBestSeller: true }, short: 'A crisp oversized shirt in a fine cotton poplin.', long: '<p>A relaxed boyfriend fit with a classic collar, a chest pocket and a curved shirt-tail hem.</p>' }),
  mk({ name: 'Striped Cotton Shirt - Blue', cat: 'women-shirts', gender: Gender.WOMEN, brand: 1, mrp: 2299, sale: 1599, sizes: SZ.top, colors: [CL.midblue, CL.white], imgs: POOL.shirtW, fabric: '100% Cotton', flags: { isNewArrival: true }, short: 'A yarn-dyed stripe shirt with a slightly relaxed fit.', long: '<p>A woven stripe on a soft cotton, cut with a gentle drape and finished with a stand collar.</p>' }),
  mk({ name: 'Oversized Linen Shirt - Sand', cat: 'women-shirts', gender: Gender.WOMEN, brand: 2, mrp: 2599, sale: 1799, sizes: SZ.top, colors: [CL.stone, CL.white], imgs: POOL.shirtW, fabric: '100% Linen', flags: { isTrending: true }, short: 'A breezy oversized linen shirt for warm days.', long: '<p>Pure linen in a generous cut, with a camp collar and a dropped shoulder. Throw it over a swimsuit or a cami.</p>' }),

  /* WOMEN KURTIS */
  mk({ name: 'Straight A-Line Kurti - Indigo Block Print', cat: 'women-kurtis', gender: Gender.WOMEN, brand: 0, mrp: 2299, sale: 1499, sizes: SZ.top, colors: [CL.indigo, CL.white], imgs: POOL.kurti, fabric: '100% Cotton, hand block print', flags: { isBestSeller: true, isNewArrival: true }, short: 'A straight-cut cotton kurti with a hand block print and side slits.', long: '<p>A knee-length straight kurti in a breathable cotton, with a traditional indigo block print, a mandarin collar and comfortable side slits.</p>' }),
  mk({ name: 'Anarkali Kurti - Maroon', cat: 'women-kurtis', gender: Gender.WOMEN, brand: 1, mrp: 3299, sale: 2199, sizes: SZ.top, colors: [CL.maroon, CL.navy], imgs: POOL.kurti, fabric: 'Rayon with zari detail', flags: { isFeatured: true }, short: 'A flared floor-grazing Anarkali with subtle zari at the yoke.', long: '<p>A festive Anarkali in a fluid rayon with a fitted bodice, a gathered flare and a delicate zari-worked neckline.</p>' }),
  mk({ name: 'Chikankari Kurti - White', cat: 'women-kurtis', gender: Gender.WOMEN, brand: 2, mrp: 2799, sale: 1899, sizes: SZ.top, colors: [CL.white, CL.cream], imgs: POOL.kurti, fabric: '100% Cotton, hand chikankari embroidery', flags: { isStaffPick: true }, short: 'A hand-embroidered chikankari kurti in soft white cotton.', long: '<p>Delicate Lucknowi chikankari hand embroidery on a lightweight cotton, with a straight cut and a keyhole neck.</p>' }),
  mk({ name: 'Cotton Printed Kurti - Mustard', cat: 'women-kurtis', gender: Gender.WOMEN, brand: 3, mrp: 1999, sale: 1299, sizes: SZ.top, colors: [CL.mustard, CL.green], imgs: POOL.kurti, fabric: '100% Cotton', flags: { isTrending: true }, short: 'An easy everyday kurti with an all-over floral print.', long: '<p>A daily-wear straight kurti in a breathable printed cotton, with three-quarter sleeves and a V-neck.</p>' }),

  /* WOMEN DRESSES */
  mk({ name: 'Off-Shoulder Tiered Dress - White', cat: 'women-dresses', gender: Gender.WOMEN, brand: 0, mrp: 2999, sale: 1999, sizes: SZ.top, colors: [CL.white, CL.blush], imgs: POOL.dress, fabric: '100% Cotton', flags: { isBestSeller: true, isNewArrival: true }, short: 'A breezy off-shoulder mini with tiered ruffles.', long: '<p>A summer mini in crisp cotton with an elasticated off-shoulder neckline and three tiers of soft ruffle.</p>' }),
  mk({ name: 'Wrap Midi Dress - Mustard', cat: 'women-dresses', gender: Gender.WOMEN, brand: 1, mrp: 3299, sale: 2299, sizes: SZ.top, colors: [CL.mustard, CL.maroon], imgs: POOL.dress, fabric: '100% Viscose', flags: { isTrending: true }, short: 'A true wrap dress in fluid viscose with a self-tie waist.', long: '<p>A flattering wrap with a deep V, a three-quarter sleeve and a midi length that moves. Adjustable self-tie waist.</p>' }),
  mk({ name: 'Fit & Flare Dress - Red', cat: 'women-dresses', gender: Gender.WOMEN, brand: 2, mrp: 3499, sale: 2399, sizes: SZ.top, colors: [CL.red, CL.black], imgs: POOL.dress, fabric: 'Poly crepe with lining', flags: { isFeatured: true }, short: 'A fitted bodice and a full flared skirt — the party dress.', long: '<p>A structured crepe with a fitted, darted bodice and a circle skirt that hits just above the knee. Fully lined.</p>' }),
  mk({ name: 'Slip Dress - Champagne', cat: 'women-dresses', gender: Gender.WOMEN, brand: 3, mrp: 2799, sale: 1899, sizes: SZ.top, colors: [CL.cream, CL.black], imgs: POOL.dress, fabric: '100% Poly satin', flags: { isStaffPick: true }, short: 'A bias-cut satin slip that layers over a tee or wears alone.', long: '<p>A minimal cowl-neck slip cut on the bias, with fine adjustable straps and a midi length.</p>' }),

  /* WOMEN BAGS */
  mk({ name: 'Structured Top-Handle Bag - Red', cat: 'women-bags', gender: Gender.WOMEN, brand: 0, mrp: 3999, sale: 2799, sizes: SZ.none, colors: [CL.red, CL.black], imgs: POOL.bag, fabric: 'Vegan leather; gold-tone hardware', care: 'Wipe with a soft dry cloth.', tax: 'Accessories 18%', flags: { isBestSeller: true, isNewArrival: true }, short: 'A structured top-handle bag with a detachable cross-body strap.', long: '<p>A clean trapeze shape in a smooth vegan leather, with a twist-lock closure, a top handle and a removable long strap.</p>' }),
  mk({ name: 'Quilted Cross-Body Bag - Black', cat: 'women-bags', gender: Gender.WOMEN, brand: 1, mrp: 3499, sale: 2399, sizes: SZ.none, colors: [CL.black, CL.tan], imgs: POOL.bag, fabric: 'Vegan leather; chain strap', care: 'Wipe with a soft dry cloth.', tax: 'Accessories 18%', flags: { isTrending: true }, short: 'A compact quilted cross-body on an adjustable chain strap.', long: '<p>A diamond-quilted flap bag with a magnetic closure, an interior card slot and a chain-and-leather strap.</p>' }),
  mk({ name: 'Woven Tote Bag - Tan', cat: 'women-bags', gender: Gender.WOMEN, brand: 2, mrp: 2999, sale: 1999, sizes: SZ.none, colors: [CL.tan, CL.cream], imgs: POOL.bag, fabric: 'Paper straw weave; cotton lining', care: 'Spot clean only.', tax: 'Accessories 18%', flags: { isStaffPick: true }, short: 'A roomy woven tote with a lined interior and a zip pouch.', long: '<p>A hand-woven straw tote with sturdy top handles, a full cotton lining and a detachable zip pouch.</p>' }),
  mk({ name: 'Mini Backpack - Navy', cat: 'women-bags', gender: Gender.WOMEN, brand: 3, mrp: 3299, sale: 2199, sizes: SZ.none, colors: [CL.navy, CL.black], imgs: POOL.bag, fabric: 'Water-resistant nylon', care: 'Wipe clean.', tax: 'Accessories 18%', short: 'A compact everyday backpack with a padded sleeve.', long: '<p>A neat mini backpack in water-resistant nylon with a padded tablet sleeve, a front zip pocket and adjustable straps.</p>' }),

  /* WOMEN WATCHES */
  mk({ name: 'Slim Mesh-Strap Watch - Rose Gold', cat: 'women-watches', gender: Gender.WOMEN, brand: 0, mrp: 5499, sale: 3699, sizes: SZ.none, colors: [CL.rosegold, CL.silver], imgs: POOL.watch, fabric: 'Steel case; Milanese mesh strap', care: 'Keep dry.', tax: 'Accessories 18%', flags: { isBestSeller: true }, short: 'A slim 32mm dial on a woven Milanese mesh strap.', long: '<p>A delicate 32mm case with a minimal dial and a magnetic-clasp mesh strap that adjusts to any wrist.</p>' }),
  mk({ name: 'Ceramic Bracelet Watch - White', cat: 'women-watches', gender: Gender.WOMEN, brand: 1, mrp: 7999, sale: 5499, sizes: SZ.none, colors: [CL.white, CL.rosegold], imgs: POOL.watch, fabric: 'Ceramic bracelet; sapphire glass', care: 'Keep dry.', tax: 'Accessories 18%', flags: { isFeatured: true }, short: 'A polished ceramic-link bracelet watch with a scratch-resistant crystal.', long: '<p>A 34mm case on a smooth ceramic bracelet, with a mother-of-pearl dial and a sapphire-coated crystal.</p>' }),
  mk({ name: 'Petite Leather Watch - Blush', cat: 'women-watches', gender: Gender.WOMEN, brand: 2, mrp: 4499, sale: 2999, sizes: SZ.none, colors: [CL.blush, CL.tan], imgs: POOL.watch, fabric: 'Steel case; leather strap', care: 'Keep dry.', tax: 'Accessories 18%', flags: { isNewArrival: true }, short: 'A petite 28mm watch on a slim pastel leather strap.', long: '<p>A dainty 28mm case with a clean two-hand dial and a soft 12mm leather strap.</p>' }),

  /* WOMEN SHOES */
  mk({ name: 'Platform Sneaker - White', cat: 'women-shoes', gender: Gender.WOMEN, brand: 0, mrp: 4499, sale: 2999, sizes: SZ.shoeW, colors: [CL.white, CL.cream], imgs: POOL.shoe, fabric: 'Leather upper; rubber platform sole', care: 'Wipe clean.', tax: 'Footwear 18%', flags: { isBestSeller: true, isTrending: true }, short: 'A chunky platform court sneaker in tonal white leather.', long: '<p>A low court silhouette lifted on a 4cm rubber platform, in a soft leather with a padded collar.</p>' }),
  mk({ name: 'Pointed Flat Mule - Nude', cat: 'women-shoes', gender: Gender.WOMEN, brand: 1, mrp: 3499, sale: 2299, sizes: SZ.shoeW, colors: [CL.cream, CL.black], imgs: POOL.shoe, fabric: 'Faux-suede upper; leather sole', care: 'Brush clean.', tax: 'Footwear 18%', flags: { isStaffPick: true }, short: 'A sleek pointed-toe flat mule that goes with everything.', long: '<p>A minimal backless mule with a fine point, a low-cut vamp and a cushioned leather sole.</p>' }),
  mk({ name: 'Block-Heel Sandal - Tan', cat: 'women-shoes', gender: Gender.WOMEN, brand: 2, mrp: 3999, sale: 2699, sizes: SZ.shoeW, colors: [CL.tan, CL.black], imgs: POOL.shoe, fabric: 'Leather upper; wrapped block heel', care: 'Wipe clean.', tax: 'Footwear 18%', flags: { isNewArrival: true }, short: 'A strappy sandal on a walkable 6cm wrapped block heel.', long: '<p>Two soft leather straps and an adjustable ankle buckle on a stable, wrapped 6cm block heel.</p>' }),

  /* WOMEN ACCESSORIES */
  mk({ name: 'Skinny Waist Belt - Black', cat: 'women-accessories', gender: Gender.WOMEN, brand: 0, mrp: 1299, sale: 799, sizes: SZ.none, colors: [CL.black, CL.tan], imgs: POOL.belt, fabric: 'Leather; gold-tone buckle', care: 'Wipe clean.', tax: 'Accessories 18%', short: 'A 20mm skinny belt to cinch a dress or a blazer.', long: '<p>A fine 20mm leather strap with a slim rectangular buckle and five sizing holes.</p>' }),
  mk({ name: 'Cat-Eye Sunglasses - Tortoise', cat: 'women-accessories', gender: Gender.WOMEN, brand: 1, mrp: 2199, sale: 1399, sizes: SZ.none, colors: [CL.brown, CL.black], imgs: POOL.sunglass, fabric: 'Acetate frame; CR-39 lens', care: 'Store in the case provided.', tax: 'Accessories 18%', flags: { isNewArrival: true }, short: 'An angular cat-eye in a warm tortoiseshell acetate.', long: '<p>A sculpted acetate frame with a sharp upsweep, gradient lenses and 100% UV400 protection.</p>' }),
  mk({ name: 'Printed Silk Hair Scarf', cat: 'women-accessories', gender: Gender.WOMEN, brand: 2, mrp: 1499, sale: 999, sizes: SZ.none, colors: [CL.maroon, CL.navy], imgs: POOL.topW, fabric: '100% Mulberry silk', care: 'Dry clean only.', tax: 'Accessories 18%', flags: { isStaffPick: true }, short: 'A pure silk square — tie it in your hair, on a bag, at the neck.', long: '<p>A 55cm mulberry silk square with a hand-rolled hem and an all-over foulard print.</p>' }),

  /* KIDS */
  mk({ name: 'Boys Graphic Tee - Blue', cat: 'kids-boys-t-shirts', gender: Gender.BOYS, age: AgeGroup.KIDS, brand: 0, mrp: 899, sale: 599, sizes: SZ.kids, colors: [CL.midblue, CL.white], imgs: POOL.kids, fabric: '100% Cotton', flags: { isBestSeller: true }, short: 'A soft cotton tee with a fun front print.', long: '<p>A durable everyday tee in breathable cotton with a ribbed neck and a playful chest print.</p>' }),
  mk({ name: 'Boys Cotton Tee - White', cat: 'kids-boys-t-shirts', gender: Gender.BOYS, age: AgeGroup.KIDS, brand: 1, mrp: 799, sale: 499, sizes: SZ.kids, colors: [CL.white, CL.navy], imgs: POOL.kids, fabric: '100% Cotton', short: 'The plain white tee — a wardrobe basic in kids sizes.', long: '<p>A soft combed-cotton crew with a taped neck and a straight hem. Buy two.</p>' }),
  mk({ name: 'Boys Slim Jeans - Mid Wash', cat: 'kids-boys-jeans', gender: Gender.BOYS, age: AgeGroup.KIDS, brand: 2, mrp: 1499, sale: 999, sizes: SZ.kids, colors: [CL.midblue, CL.black], imgs: POOL.kids, fabric: '98% Cotton, 2% Elastane', care: DENIM_CARE, flags: { isNewArrival: true }, short: 'Comfortable slim jeans with an adjustable elasticated waist.', long: '<p>A slim-fit stretch denim with an inside elastic waist adjuster and reinforced knees.</p>' }),
  mk({ name: 'Girls Floral Dress - Pink', cat: 'kids-girls-dresses', gender: Gender.GIRLS, age: AgeGroup.KIDS, brand: 0, mrp: 1299, sale: 849, sizes: SZ.kids, colors: [CL.pink, CL.white], imgs: POOL.kids, fabric: '100% Cotton', flags: { isBestSeller: true, isNewArrival: true }, short: 'A twirl-worthy floral dress with a full skirt.', long: '<p>A sleeveless cotton dress with a smocked bodice, a gathered skirt and a back tie bow.</p>' }),
  mk({ name: 'Girls Frill Top - White', cat: 'kids-girls-tops', gender: Gender.GIRLS, age: AgeGroup.KIDS, brand: 1, mrp: 899, sale: 599, sizes: SZ.kids, colors: [CL.white, CL.blush], imgs: POOL.kids, fabric: '100% Cotton', short: 'A soft everyday top with frill sleeves.', long: '<p>A lightweight cotton top with a round neck and pretty frill-trimmed short sleeves.</p>' }),
  mk({ name: 'Girls Denim Pinafore - Blue', cat: 'kids-girls-dresses', gender: Gender.GIRLS, age: AgeGroup.KIDS, brand: 3, mrp: 1599, sale: 1099, sizes: SZ.kids, colors: [CL.midblue, CL.indigo], imgs: POOL.kids, fabric: '100% Cotton denim', care: DENIM_CARE, flags: { isTrending: true }, short: 'A classic denim pinafore with adjustable straps.', long: '<p>A pinafore dress in soft cotton denim with cross-back adjustable straps and a front patch pocket.</p>' }),
];

async function seedCatalog() {
  const brands = ['Velor Originals', 'Indigo Lab', 'Metro Ave', 'Northbound'];
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
  const taxClasses = await prisma.taxClass.findMany();
  const taxByName = new Map(taxClasses.map((t) => [t.name, t.id]));
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const cols = await prisma.collection.findMany({ select: { id: true, slug: true } });
  const colBySlug = new Map(cols.map((c) => [c.slug, c.id]));

  // Carts reference variants; clear them so we can rebuild the variant set cleanly.
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});

  const buildOne = async (item: CatItem, idx: number) => {
    const slug = slugify(item.name);
    const categoryId = catBySlug.get(item.cat);
    if (!categoryId) {
      console.warn(`\n  ! category not found: ${item.cat} (${item.name})`);
      return;
    }
    const taxId = taxByName.get(item.tax ?? 'Apparel 5%') ?? taxByName.get('Apparel 5%') ?? null;
    const rating = Math.round((41 + ((idx * 7) % 9)) / 10 * 10) / 10;

    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        name: item.name, slug, status: ProductStatus.ACTIVE, publishedAt: new Date(),
        brandId: brandRecords[item.brand % brandRecords.length]!.id,
        gender: item.gender, ageGroup: item.age ?? AgeGroup.ADULT,
        shortDescription: item.short, description: item.long,
        mrp: item.mrp, salePrice: item.sale, costPrice: Math.round(item.sale * 0.45),
        taxClassId: taxId,
        fabricDetails: item.fabric, careInstructions: item.care,
        originCountry: 'IN', weightGrams: 400,
        ratingAverage: rating, ratingCount: 8 + ((idx * 13) % 90),
        soldCount: 20 + ((idx * 17) % 180), viewCount: 150 + ((idx * 29) % 700),
        ...item.flags,
      },
      update: {
        name: item.name, status: ProductStatus.ACTIVE, publishedAt: new Date(),
        brandId: brandRecords[item.brand % brandRecords.length]!.id,
        gender: item.gender, ageGroup: item.age ?? AgeGroup.ADULT,
        shortDescription: item.short, description: item.long,
        mrp: item.mrp, salePrice: item.sale, taxClassId: taxId,
        fabricDetails: item.fabric, careInstructions: item.care,
        ...item.flags,
      },
    });

    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId } },
      create: { productId: product.id, categoryId, isPrimary: true },
      update: { isPrimary: true },
    });

    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    // Rotate the type pool by catalog index so neighbouring products in the same
    // category don't all share the same photo.
    const pool = item.imgs;
    const start = pool.length ? idx % pool.length : 0;
    const rotated = [...pool.slice(start), ...pool.slice(0, start)];
    const gallery = [...new Set(rotated)].slice(0, Math.min(3, pool.length || 1));
    await prisma.productMedia.createMany({
      data: gallery.map((id, position) => ({
        productId: product.id, url: IMG2(id),
        alt: `${item.name} — view ${position + 1}`, position, type: 'IMAGE' as const,
      })),
    });

    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.productOption.deleteMany({ where: { productId: product.id } });

    const optionDefs: { name: string; values: [string, string | null][] }[] = [];
    if (item.sizes.length) optionDefs.push({ name: 'Size', values: item.sizes.map((s) => [s, null]) });
    optionDefs.push({ name: 'Color', values: item.colors.map(([n, hex]) => [n, hex]) });

    const valueId = new Map<string, string>();
    for (const [oi, od] of optionDefs.entries()) {
      const opt = await prisma.productOption.create({ data: { productId: product.id, name: od.name, position: oi } });
      for (const [vi, [value, hex]] of od.values.entries()) {
        const ov = await prisma.productOptionValue.create({
          data: { optionId: opt.id, value, hexColor: hex ?? undefined, position: vi },
        });
        valueId.set(`${od.name}:${value}`, ov.id);
      }
    }

    const sizeVals: (string | null)[] = item.sizes.length ? item.sizes : [null];
    let vpos = 0;
    for (const size of sizeVals) {
      for (const [cname] of item.colors) {
        const ovIds: string[] = [];
        if (size) ovIds.push(valueId.get(`Size:${size}`)!);
        ovIds.push(valueId.get(`Color:${cname}`)!);
        const sku = [
          slug.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 14),
          (size ?? 'OS').replace(/[^A-Z0-9]+/gi, ''),
          cname.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
        ].join('-');
        const onHand = (idx + vpos) % 8 === 0 ? 0 : 6 + ((idx * 5 + vpos * 3) % 22);
        await prisma.productVariant.create({
          data: {
            productId: product.id, sku, position: vpos++,
            optionValues: { create: ovIds.map((optionValueId) => ({ optionValueId })) },
            inventory: { create: { warehouseId: warehouse.id, onHand, reserved: 0 } },
          },
        });
      }
    }

    const want = new Set<string>();
    if (item.flags?.isNewArrival) want.add('new-arrivals');
    if (item.sale < item.mrp) want.add('sale');
    if (item.mrp >= 4000 || item.flags?.isExclusive || item.flags?.isFeatured) want.add('premium-collection');
    if (idx % 3 === 0) want.add('summer-edit');
    for (const cslug of want) {
      const cid = colBySlug.get(cslug);
      if (cid) {
        await prisma.productCollection.upsert({
          where: { productId_collectionId: { productId: product.id, collectionId: cid } },
          create: { productId: product.id, collectionId: cid },
          update: {},
        });
      }
    }
  };

  const CONCURRENCY = 3;
  for (let i = 0; i < CATALOG.length; i += CONCURRENCY) {
    await Promise.all(CATALOG.slice(i, i + CONCURRENCY).map((it, j) => buildOne(it, i + j)));
    process.stdout.write(`  catalog ${Math.min(i + CONCURRENCY, CATALOG.length)}/${CATALOG.length}\r`);
  }
  console.log(`\n  Catalog: ${brands.length} brands, ${CATALOG.length} products across all categories`);
}

/**
 * Hide categories with no products in their subtree from the storefront menu so
 * navigation never lands on an empty listing. Men / Women / Kids stay visible.
 */
async function syncMenuVisibility() {
  const all = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true, path: true, showInMenu: true },
  });
  const counts = await prisma.productCategory.groupBy({
    by: ['categoryId'],
    _count: { productId: true },
  });
  const directCount = new Map(counts.map((c) => [c.categoryId, c._count.productId]));
  const pathOf = new Map(all.map((c) => [c.id, c.path ?? c.slug]));

  const anchors = new Set(['men', 'women', 'kids']);
  let hidden = 0;
  let shown = 0;
  for (const cat of all) {
    if (anchors.has(cat.slug)) {
      if (!cat.showInMenu) await prisma.category.update({ where: { id: cat.id }, data: { showInMenu: true } });
      continue;
    }
    const prefix = pathOf.get(cat.id) ?? cat.slug;
    // Any product filed on this category or a descendant?
    const hasProducts = all.some(
      (other) =>
        (directCount.get(other.id) ?? 0) > 0 &&
        (other.path === prefix || (other.path ?? '').startsWith(`${prefix}/`)),
    );
    const nextVisible = hasProducts;
    if (cat.showInMenu !== nextVisible) {
      await prisma.category.update({ where: { id: cat.id }, data: { showInMenu: nextVisible } });
      nextVisible ? (shown += 1) : (hidden += 1);
    }
  }
  console.log(`  Menu visibility: hid ${hidden} empty, showed ${shown}`);
}

async function seedTestimonials() {
  const items = [
    { authorName: 'Aarav S.', authorRole: 'Menswear', quote: 'Best-fitting jeans I have owned. The wash looks even better in person.' },
    { authorName: 'Priya N.', authorRole: 'Womenswear', quote: 'The wrap dress is beautifully cut and the fabric feels expensive. My new favourite.' },
    { authorName: 'Meera K.', authorRole: 'Kids', quote: 'Ordered for both my kids — soft cotton, held up through a dozen washes. Delivery was quick too.' },
    { authorName: 'Rohan D.', authorRole: 'Shirts', quote: 'The linen shirts are exactly right for the weather — breathable, and they still look sharp.' },
    { authorName: 'Ananya R.', authorRole: 'Shoes', quote: 'Comfortable straight out of the box and they go with everything. Sizing was accurate.' },
    { authorName: 'Kabir M.', authorRole: 'Accessories', quote: 'The leather belt and wallet feel genuinely premium for the price. Easy returns made it low-risk.' },
  ];
  for (const [i, t] of items.entries()) {
    const existing = await prisma.testimonial.findFirst({ where: { authorName: t.authorName } });
    if (!existing) await prisma.testimonial.create({ data: { ...t, position: i } });
    else await prisma.testimonial.update({ where: { id: existing.id }, data: { authorRole: t.authorRole, quote: t.quote, position: i } });
  }
  console.log(`  Testimonials: ${items.length}`);
}

async function main() {
  console.log('Seeding Velor House...');
  await seedRbac();
  await seedSuperAdmin();
  await seedCatalogStructure();
  await seedSettings();
  await seedNavigation();
  await seedHomepage();
  await seedCatalog();
  await syncMenuVisibility();
  await seedTestimonials();
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => baseClient.$disconnect());
