import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductQueryDto } from './dto.js';

const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  mrp: true,
  salePrice: true,
  currency: true,
  ratingAverage: true,
  ratingCount: true,
  isNewArrival: true,
  brand: { select: { name: true, slug: true } },
  media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 2 },
} satisfies Prisma.ProductSelect;

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  latest: { publishedAt: 'desc' },
  popular: { viewCount: 'desc' },
  bestselling: { soldCount: 'desc' },
  price_asc: { salePrice: 'asc' },
  price_desc: { salePrice: 'desc' },
  rating: { ratingAverage: 'desc' },
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private csv(v?: string): string[] {
    return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  /** Category itself + every descendant, by materialised path. */
  private async categoryScopeIds(slug: string): Promise<string[]> {
    const target = await this.prisma.category.findUnique({
      where: { slug },
      select: { path: true },
    });
    if (!target?.path) return [];
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ path: target.path }, { path: { startsWith: `${target.path}/` } }] },
      select: { id: true },
    });
    return rows.map((c) => c.id);
  }

  private async buildProductWhere(query: ProductQueryDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      publishedAt: { lte: new Date() },
    };

    const subs = this.csv(query.sub);
    if (subs.length) {
      // Narrowed to one or more subcategories (their subtrees).
      const idSets = await Promise.all(subs.map((s) => this.categoryScopeIds(s)));
      const ids = [...new Set(idSets.flat())];
      where.categories = {
        some: { category: ids.length ? { id: { in: ids } } : { slug: { in: subs } } },
      };
    } else if (query.category) {
      const ids = await this.categoryScopeIds(query.category);
      where.categories = {
        some: { category: ids.length ? { id: { in: ids } } : { slug: query.category } },
      };
    }
    if (query.collection) {
      where.collections = { some: { collection: { slug: query.collection } } };
    }
    if (query.brand) {
      where.brand = { slug: { in: this.csv(query.brand) } };
    }
    if (query.gender) where.gender = query.gender;
    if (query.minPrice != null || query.maxPrice != null) {
      where.salePrice = { gte: query.minPrice ?? undefined, lte: query.maxPrice ?? undefined };
    }
    if (query.minRating != null) where.ratingAverage = { gte: query.minRating };
    if (query.inStock) {
      where.variants = { some: { inventory: { some: { onHand: { gt: 0 } } } } };
    }

    // Size / colour facets — "has a variant with size X" AND "has a variant with
    // colour Y" (standard faceted behaviour; not necessarily the same variant).
    const and: Prisma.ProductWhereInput[] = [];
    const sizes = this.csv(query.size);
    const colors = this.csv(query.color);
    if (sizes.length) {
      and.push({ variants: { some: { optionValues: { some: { optionValue: { value: { in: sizes } } } } } } });
    }
    if (colors.length) {
      and.push({ variants: { some: { optionValues: { some: { optionValue: { value: { in: colors } } } } } } });
    }
    if (and.length) where.AND = and;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { tags: { some: { tag: { name: { contains: query.search, mode: 'insensitive' } } } } },
      ];
    }
    return where;
  }

  async listProducts(query: ProductQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));
    const where = await this.buildProductWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_CARD_SELECT,
        orderBy: SORT_MAP[query.sort ?? 'latest'] ?? SORT_MAP.latest,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Available filter values for the current scope (category / collection /
   * gender / search). Powers the storefront filter bar.
   */
  async getFacets(query: ProductQueryDto) {
    // Facets describe what's available *before* size / colour / subcategory /
    // price narrowing — so those controls stay usable.
    const scoped = await this.buildProductWhere({
      ...query,
      sub: undefined,
      size: undefined,
      color: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    });

    const products = await this.prisma.product.findMany({
      where: scoped,
      select: {
        salePrice: true,
        brand: { select: { name: true, slug: true } },
        categories: {
          select: { category: { select: { name: true, slug: true, parentId: true } } },
        },
        options: { select: { name: true, values: { select: { value: true, hexColor: true } } } },
      },
    });

    const sizes = new Set<string>();
    const colors = new Map<string, string | null>();
    const brands = new Map<string, string>();
    const subcats = new Map<string, string>();
    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    for (const p of products) {
      const price = Number(p.salePrice);
      if (Number.isFinite(price)) {
        min = Math.min(min, price);
        max = Math.max(max, price);
      }
      if (p.brand) brands.set(p.brand.slug, p.brand.name);
      for (const o of p.options) {
        if (o.name.toLowerCase() === 'size') o.values.forEach((v) => sizes.add(v.value));
        if (o.name.toLowerCase() === 'color' || o.name.toLowerCase() === 'colour') {
          o.values.forEach((v) => colors.set(v.value, v.hexColor));
        }
      }
      for (const pc of p.categories) {
        if (pc.category.parentId) subcats.set(pc.category.slug, pc.category.name);
      }
    }

    // Keep size order sensible: alpha sizes first in S→XXL order, then numeric.
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const sizeList = [...sizes].sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    return {
      total: products.length,
      sizes: sizeList,
      colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })),
      brands: [...brands.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      subcategories: [...subcats.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      price: { min: min === Number.POSITIVE_INFINITY ? 0 : Math.floor(min), max: Math.ceil(max) },
    };
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        brand: true,
        taxClass: true,
        sizeGuide: true,
        seo: true,
        categories: { include: { category: { select: { name: true, slug: true, path: true } } } },
        media: { orderBy: { position: 'asc' } },
        options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        variants: {
          where: { isActive: true },
          include: {
            optionValues: { include: { optionValue: true } },
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
        attributes: { include: { attribute: true } },
        relatedFrom: {
          include: { target: { select: PRODUCT_CARD_SELECT } },
          orderBy: { position: 'asc' },
        },
        _count: { select: { reviews: { where: { status: 'PUBLISHED' } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Fire-and-forget view counter.
    void this.prisma.product
      .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return product;
  }

  async categoryTree() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        imageUrl: true,
        showInMenu: true,
      },
    });
    type Node = (typeof categories)[number] & { children: Node[] };
    const byId = new Map<string, Node>(categories.map((c) => [c.id, { ...c, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { seo: true, parent: { select: { name: true, slug: true } } },
    });
    if (!category || !category.isActive) throw new NotFoundException('Category not found');
    return category;
  }

  async listBrands() {
    return this.prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, logoUrl: true, isFeatured: true },
    });
  }

  async listCollections() {
    return this.prisma.collection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        bannerUrl: true,
        isFeatured: true,
        isPremium: true,
        isSeasonal: true,
      },
    });
  }

  async getCollectionBySlug(slug: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        bannerUrl: true,
        bannerMobileUrl: true,
        _count: { select: { products: true } },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}
