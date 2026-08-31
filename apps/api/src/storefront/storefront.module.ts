import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@slay/db';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Public } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchService } from '../search/search.service.js';

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  mrp: true,
  salePrice: true,
  currency: true,
  ratingAverage: true,
  ratingCount: true,
  media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 1 },
} satisfies Prisma.ProductSelect;

const AUTO_FILTERS: Record<string, Prisma.ProductWhereInput> = {
  FEATURED: { isFeatured: true },
  BEST_SELLERS: { isBestSeller: true },
  NEW_ARRIVALS: { isNewArrival: true },
  TRENDING: { isTrending: true },
  HOT: { isHot: true },
  STAFF_PICKS: { isStaffPick: true },
  TOP_RATED: { ratingAverage: { gte: 4 } },
  RECENTLY_ADDED: {},
};

const AUTO_ORDER: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  BEST_SELLERS: { soldCount: 'desc' },
  MOST_VIEWED: { viewCount: 'desc' },
  TOP_RATED: { ratingAverage: 'desc' },
  RECENTLY_ADDED: { createdAt: 'desc' },
  NEW_ARRIVALS: { publishedAt: 'desc' },
};

@ApiTags('storefront')
@UseGuards(JwtAuthGuard)
@Controller('storefront')
class StorefrontController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @Get('home')
  async home() {
    const now = new Date();
    const [sections, banners, testimonials, collections, instagram, lookbooks, menuCategories] = await Promise.all([
      this.prisma.homeSection.findMany({
        where: {
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { position: 'asc' },
        include: { items: { orderBy: { position: 'asc' }, include: { product: { select: CARD_SELECT } } } },
      }),
      this.prisma.banner.findMany({
        where: { isActive: true, placement: { in: ['HOME_HERO', 'HOME_STRIP', 'PROMO_BAR'] } },
        orderBy: { position: 'asc' },
      }),
      this.prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { position: 'asc' }, take: 12 }),
      this.prisma.collection.findMany({
        where: { isActive: true, isFeatured: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      }),
      this.prisma.instagramPost.findMany({ where: { isActive: true }, orderBy: { position: 'asc' }, take: 12 }),
      this.prisma.lookbook.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        take: 4,
        include: { looks: { take: 1, include: { items: { include: { product: { select: CARD_SELECT } } } } } },
      }),
      // Live top-level categories power the "Shop by Category" grid so the
      // images stay editable from the admin without re-seeding.
      this.prisma.category.findMany({
        where: { parentId: null, isActive: true, showInMenu: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
        select: { name: true, slug: true, imageUrl: true, bannerUrl: true },
      }),
    ]);

    const liveCategoryTiles = menuCategories.map((c) => ({
      label: c.name,
      imageUrl: c.imageUrl ?? c.bannerUrl,
      url: `/c/${c.slug}`,
    }));

    const resolved = await Promise.all(
      sections.map(async (section) => {
        let products: unknown[] = [];
        const cfg = (section.config ?? {}) as { limit?: number; categorySlug?: string; collectionSlug?: string };
        const limit = Math.min(24, cfg.limit ?? 12);

        if (
          section.source === 'manual' ||
          section.items.some((i) => i.productId)
        ) {
          products = section.items.filter((i) => i.product).map((i) => i.product);
        } else if (AUTO_FILTERS[section.type]) {
          products = await this.prisma.product.findMany({
            where: {
              status: 'ACTIVE',
              deletedAt: null,
              publishedAt: { lte: now },
              ...AUTO_FILTERS[section.type],
              ...(cfg.categorySlug
                ? { categories: { some: { category: { slug: cfg.categorySlug } } } }
                : {}),
              ...(cfg.collectionSlug
                ? { collections: { some: { collection: { slug: cfg.collectionSlug } } } }
                : {}),
            },
            select: CARD_SELECT,
            orderBy: AUTO_ORDER[section.type] ?? { publishedAt: 'desc' },
            take: limit,
          });
        }

        const storedTiles = section.items
          .filter((i) => !i.productId)
          .map((i) => ({ label: i.label, imageUrl: i.imageUrl, url: i.url }));

        return {
          id: section.id,
          type: section.type,
          title: section.title,
          subtitle: section.subtitle,
          ctaLabel: section.ctaLabel,
          ctaUrl: section.ctaUrl,
          products,
          tiles:
            section.type === 'CATEGORY_GRID' && liveCategoryTiles.length
              ? liveCategoryTiles
              : storedTiles,
        };
      }),
    );

    return { sections: resolved, banners, testimonials, collections, instagram, lookbooks };
  }

  @Public()
  @Get('search')
  async search(@Query('q') q?: string) {
    const term = (q ?? '').trim();
    if (term.length < 2) {
      const trending = await this.prisma.searchTerm.findMany({
        where: { isTrending: true },
        orderBy: { position: 'asc' },
        take: 8,
      });
      return { term, suggestions: [], products: [], trending: trending.map((t) => t.term) };
    }

    const esHits = await this.searchService.query(term, { limit: 12 });

    const products =
      esHits ??
      (await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { shortDescription: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { sku: { contains: term, mode: 'insensitive' } },
            { brand: { name: { contains: term, mode: 'insensitive' } } },
            { tags: { some: { tag: { name: { contains: term, mode: 'insensitive' } } } } },
            { categories: { some: { category: { name: { contains: term, mode: 'insensitive' } } } } },
            { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
          ],
        },
        select: CARD_SELECT,
        take: 24,
        orderBy: { soldCount: 'desc' },
      }));

    void this.prisma.searchQuery
      .create({
        data: {
          term,
          normalizedTerm: term.toLowerCase(),
          resultCount: products.length,
        },
      })
      .catch(() => undefined);

    return {
      term,
      engine: esHits ? 'elasticsearch' : 'postgres',
      suggestions: products.slice(0, 6).map((p) => p.name),
      products,
    };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [StorefrontController],
})
export class StorefrontModule {}
