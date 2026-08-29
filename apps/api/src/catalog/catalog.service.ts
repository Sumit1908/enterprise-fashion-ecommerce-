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

  async listProducts(query: ProductQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));

    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      publishedAt: { lte: new Date() },
    };

    if (query.category) {
      where.categories = { some: { category: { slug: query.category } } };
    }
    if (query.collection) {
      where.collections = { some: { collection: { slug: query.collection } } };
    }
    if (query.brand) {
      where.brand = { slug: { in: query.brand.split(',') } };
    }
    if (query.gender) where.gender = query.gender;
    if (query.minPrice != null || query.maxPrice != null) {
      where.salePrice = {
        gte: query.minPrice ?? undefined,
        lte: query.maxPrice ?? undefined,
      };
    }
    if (query.minRating != null) where.ratingAverage = { gte: query.minRating };
    if (query.inStock) {
      where.variants = {
        some: { inventory: { some: { onHand: { gt: 0 } } } },
      };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { tags: { some: { tag: { name: { contains: query.search, mode: 'insensitive' } } } } },
      ];
    }

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

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        brand: true,
        taxClass: true,
        sizeGuide: true,
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
}
