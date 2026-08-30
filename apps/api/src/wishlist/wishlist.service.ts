import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  mrp: true,
  salePrice: true,
  currency: true,
  ratingAverage: true,
  ratingCount: true,
  isNewArrival: true,
  status: true,
  deletedAt: true,
  brand: { select: { name: true, slug: true } },
  media: { select: { url: true, alt: true }, orderBy: { position: 'asc' }, take: 2 },
} satisfies Prisma.ProductSelect;

/**
 * Account-backed wishlist. Product-level only (no per-variant rows) so it maps
 * cleanly onto the guest localStorage wishlist, which stores product slugs.
 */
@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId, variantId: null },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: CARD_SELECT } },
    });
    return {
      items: items
        .filter((i) => i.product.status === 'ACTIVE' && !i.product.deletedAt)
        .map((i) => ({ id: i.id, addedAt: i.createdAt, product: stripInternal(i.product) })),
    };
  }

  async add(userId: string, input: { productId?: string; slug?: string }) {
    const product = await this.resolveProduct(input);
    const existing = await this.prisma.wishlistItem.findFirst({
      where: { userId, productId: product.id, variantId: null },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.wishlistItem.create({
        data: { userId, productId: product.id },
      });
      void this.prisma.product
        .update({ where: { id: product.id }, data: { wishlistCount: { increment: 1 } } })
        .catch(() => undefined);
    }
    return this.list(userId);
  }

  async remove(userId: string, productId: string) {
    const deleted = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId, variantId: null },
    });
    if (deleted.count > 0) {
      void this.prisma.product
        .update({ where: { id: productId }, data: { wishlistCount: { decrement: deleted.count } } })
        .catch(() => undefined);
    }
    return this.list(userId);
  }

  /** Fold a guest wishlist (list of product slugs) into the user's saved items. */
  async merge(userId: string, slugs: string[]) {
    const clean = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(0, 200);
    if (clean.length === 0) return this.list(userId);

    const products = await this.prisma.product.findMany({
      where: { slug: { in: clean }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (products.length) {
      const existing = new Set(
        (
          await this.prisma.wishlistItem.findMany({
            where: { userId, variantId: null, productId: { in: products.map((p) => p.id) } },
            select: { productId: true },
          })
        ).map((r) => r.productId),
      );
      const toAdd = products.filter((p) => !existing.has(p.id));
      if (toAdd.length) {
        await this.prisma.wishlistItem.createMany({
          data: toAdd.map((p) => ({ userId, productId: p.id })),
        });
      }
    }
    return this.list(userId);
  }

  private async resolveProduct(input: { productId?: string; slug?: string }) {
    if (!input.productId && !input.slug) {
      throw new BadRequestException('productId or slug is required');
    }
    const product = await this.prisma.product.findFirst({
      where: {
        ...(input.productId ? { id: input.productId } : { slug: input.slug }),
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}

function stripInternal<T extends { status?: unknown; deletedAt?: unknown }>(p: T) {
  const { status: _s, deletedAt: _d, ...rest } = p;
  return rest;
}
