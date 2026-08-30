import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgeGroup, Gender, Prisma, ProductStatus } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { parseCsvRecords, toCsv } from '../common/csv.js';
import type {
  BrandUpsertDto,
  BulkProductActionDto,
  CategoryUpsertDto,
  CollectionUpsertDto,
  ListQueryDto,
  ProductCreateDto,
  ProductUpdateDto,
  ReorderDto,
} from './dto.js';

const MERCH_FLAGS = [
  'isFeatured',
  'isBestSeller',
  'isNewArrival',
  'isTrending',
  'isHot',
  'isStaffPick',
  'isExclusive',
] as const;
type MerchFlag = (typeof MERCH_FLAGS)[number];

const GENDER_VALUES = Object.values(Gender);
const AGE_GROUP_VALUES = Object.values(AgeGroup);

/** Split a "a|b, c" style cell into trimmed, non-empty tokens. */
function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PRODUCT_DETAIL_INCLUDE = {
  brand: { select: { id: true, name: true } },
  categories: { select: { categoryId: true, isPrimary: true } },
  collections: { select: { collectionId: true } },
  tags: { select: { tag: { select: { name: true } } } },
  media: { orderBy: { position: 'asc' } },
  options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
  variants: {
    orderBy: { position: 'asc' },
    include: {
      optionValues: { include: { optionValue: { select: { value: true } } } },
      inventory: { select: { onHand: true, reserved: true, warehouseId: true } },
    },
  },
  seo: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------------------------------------------- products */

  async listProducts(query: ListQueryDto) {
    const pageSize = Math.min(100, query.pageSize ?? 25);
    const page = Math.max(1, query.page ?? 1);
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status && query.status in ProductStatus
        ? { status: query.status as ProductStatus }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          status: true,
          mrp: true,
          salePrice: true,
          ratingAverage: true,
          soldCount: true,
          updatedAt: true,
          brand: { select: { name: true } },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: ProductCreateDto) {
    if (dto.salePrice > dto.mrp) {
      throw new BadRequestException('Sale price cannot exceed MRP');
    }
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.product.findFirst({ where: { slug: s } }).then(Boolean),
    );

    const product = await this.prisma.product.create({
      data: {
        ...(this.scalarData(dto) as Prisma.ProductCreateInput),
        name: dto.name,
        slug,
        mrp: dto.mrp,
        salePrice: dto.salePrice,
        status: dto.status ?? ProductStatus.DRAFT,
        publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : null,
      },
    });

    await this.applyRelations(product.id, dto, { replace: true });
    return this.getProduct(product.id);
  }

  async updateProduct(id: string, dto: ProductUpdateDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, mrp: true, salePrice: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const nextMrp = dto.mrp ?? Number(existing.mrp);
    const nextSale = dto.salePrice ?? Number(existing.salePrice);
    if (nextSale > nextMrp) throw new BadRequestException('Sale price cannot exceed MRP');

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await uniqueSlug(dto.slug, (s) =>
        this.prisma.product
          .findFirst({ where: { slug: s, NOT: { id } } })
          .then(Boolean),
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        ...(this.scalarData(dto) as Prisma.ProductUpdateInput),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        slug,
        ...(dto.mrp !== undefined ? { mrp: dto.mrp } : {}),
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : undefined,
            }
          : {}),
      },
    });

    await this.applyRelations(id, dto, { replace: false });
    return this.getProduct(id);
  }

  async deleteProduct(id: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Product not found');
    // Soft delete — keeps order history intact.
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });
    return { id, deleted: true };
  }

  async bulkProduct(dto: BulkProductActionDto) {
    if (dto.ids.length === 0) return { updated: 0 };
    const where: Prisma.ProductWhereInput = { id: { in: dto.ids }, deletedAt: null };

    switch (dto.action) {
      case 'setStatus': {
        if (!dto.value || !(dto.value in ProductStatus)) {
          throw new BadRequestException('Invalid status');
        }
        const status = dto.value as ProductStatus;
        const res = await this.prisma.product.updateMany({
          where,
          data: {
            status,
            ...(status === ProductStatus.ACTIVE ? { publishedAt: new Date() } : {}),
          },
        });
        return { updated: res.count };
      }
      case 'setFlag':
      case 'clearFlag': {
        const flag = dto.value as MerchFlag;
        if (!MERCH_FLAGS.includes(flag)) throw new BadRequestException('Unknown flag');
        const res = await this.prisma.product.updateMany({
          where,
          data: { [flag]: dto.action === 'setFlag' },
        });
        return { updated: res.count };
      }
      case 'setSalePrice': {
        if (dto.numberValue == null || dto.numberValue < 0) {
          throw new BadRequestException('numberValue required');
        }
        const res = await this.prisma.product.updateMany({
          where,
          data: { salePrice: dto.numberValue },
        });
        return { updated: res.count };
      }
      case 'delete': {
        const res = await this.prisma.product.updateMany({
          where,
          data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
        });
        return { updated: res.count };
      }
      default:
        throw new BadRequestException('Unknown action');
    }
  }

  /* ------------------------------------------------------ product relations */

  private scalarData(dto: ProductCreateDto | ProductUpdateDto): Record<string, unknown> {
    const pick = <K extends keyof (ProductCreateDto & ProductUpdateDto)>(k: K) =>
      (dto as Record<string, unknown>)[k as string];
    const data: Record<string, unknown> = {};
    for (const key of [
      'sku',
      'barcode',
      'shortDescription',
      'description',
      'gender',
      'ageGroup',
      'currency',
      'costPrice',
      'fabricDetails',
      'careInstructions',
      'originCountry',
      'weightGrams',
      ...MERCH_FLAGS,
    ] as const) {
      const value = pick(key as never);
      if (value !== undefined) data[key] = value;
    }
    if (dto.brandId !== undefined) {
      data.brand = dto.brandId ? { connect: { id: dto.brandId } } : { disconnect: true };
    }
    if (dto.taxClassId !== undefined) {
      data.taxClass = dto.taxClassId
        ? { connect: { id: dto.taxClassId } }
        : { disconnect: true };
    }
    if (dto.sizeGuideId !== undefined) {
      data.sizeGuide = dto.sizeGuideId
        ? { connect: { id: dto.sizeGuideId } }
        : { disconnect: true };
    }
    return data;
  }

  private async applyRelations(
    productId: string,
    dto: ProductCreateDto | ProductUpdateDto,
    { replace }: { replace: boolean },
  ): Promise<void> {
    if (dto.categoryIds) {
      await this.prisma.productCategory.deleteMany({ where: { productId } });
      if (dto.categoryIds.length) {
        await this.prisma.productCategory.createMany({
          data: dto.categoryIds.map((categoryId, i) => ({
            productId,
            categoryId,
            isPrimary: i === 0,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (dto.collectionIds) {
      await this.prisma.productCollection.deleteMany({ where: { productId } });
      if (dto.collectionIds.length) {
        await this.prisma.productCollection.createMany({
          data: dto.collectionIds.map((collectionId) => ({ productId, collectionId })),
          skipDuplicates: true,
        });
      }
    }

    if (dto.tags) {
      await this.prisma.productTag.deleteMany({ where: { productId } });
      for (const name of dto.tags) {
        const tag = await this.prisma.tag.upsert({
          where: { slug: slugify(name) },
          create: { name, slug: slugify(name) },
          update: {},
        });
        await this.prisma.productTag.create({ data: { productId, tagId: tag.id } });
      }
    }

    if (dto.media) {
      await this.prisma.productMedia.deleteMany({ where: { productId } });
      if (dto.media.length) {
        await this.prisma.productMedia.createMany({
          data: dto.media.map((m, i) => ({
            productId,
            url: m.url,
            type: m.type ?? 'IMAGE',
            alt: m.alt ?? null,
            position: m.position ?? i,
          })),
        });
      }
    }

    if (dto.options || dto.variants) {
      await this.rebuildVariants(productId, dto, replace);
    }
  }

  private async rebuildVariants(
    productId: string,
    dto: ProductCreateDto | ProductUpdateDto,
    replace: boolean,
  ): Promise<void> {
    // Full replace of the option/variant set — the editor always sends the
    // complete list, so this keeps state predictable.
    if (!replace) {
      await this.prisma.productVariant.deleteMany({ where: { productId } });
      await this.prisma.productOption.deleteMany({ where: { productId } });
    }

    const valueIdByKey = new Map<string, string>();
    for (const [i, opt] of (dto.options ?? []).entries()) {
      const option = await this.prisma.productOption.create({
        data: { productId, name: opt.name, position: i },
      });
      for (const [j, val] of opt.values.entries()) {
        const created = await this.prisma.productOptionValue.create({
          data: {
            optionId: option.id,
            value: val.value,
            hexColor: val.hexColor ?? null,
            position: j,
          },
        });
        valueIdByKey.set(val.value, created.id);
      }
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      orderBy: { priority: 'desc' },
      select: { id: true },
    });

    for (const [i, v] of (dto.variants ?? []).entries()) {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: v.sku,
          mrp: v.mrp ?? null,
          salePrice: v.salePrice ?? null,
          costPrice: v.costPrice ?? null,
          weightGrams: v.weightGrams ?? null,
          isActive: v.isActive ?? true,
          position: i,
          optionValues: {
            create: (v.optionValues ?? [])
              .map((val) => valueIdByKey.get(val))
              .filter((id): id is string => Boolean(id))
              .map((optionValueId) => ({ optionValueId })),
          },
        },
      });

      if (warehouse && v.stock != null) {
        await this.prisma.inventoryLevel.upsert({
          where: {
            variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id },
          },
          create: { variantId: variant.id, warehouseId: warehouse.id, onHand: v.stock },
          update: { onHand: v.stock },
        });
      }
    }
  }

  /* --------------------------------------------------------------- categories */

  async listCategories() {
    const all = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        gender: true,
        ageGroup: true,
        isActive: true,
        isFeatured: true,
        showInMenu: true,
        sortOrder: true,
        imageUrl: true,
        _count: { select: { products: true, children: true } },
      },
    });
    return all;
  }

  async createCategory(dto: CategoryUpsertDto) {
    if (!dto.name) throw new BadRequestException('name is required');
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.category.findFirst({ where: { slug: s } }).then(Boolean),
    );
    const path = await this.computePath(dto.parentId ?? null, slug);
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parentId: dto.parentId || null,
        gender: dto.gender,
        ageGroup: dto.ageGroup,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        seoContent: dto.seoContent,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        showInMenu: dto.showInMenu ?? true,
        sortOrder: dto.sortOrder ?? 0,
        path,
      },
    });
  }

  async updateCategory(id: string, dto: CategoryUpsertDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await uniqueSlug(dto.slug, (s) =>
        this.prisma.category.findFirst({ where: { slug: s, NOT: { id } } }).then(Boolean),
      );
    }
    const parentId = dto.parentId === undefined ? existing.parentId : dto.parentId || null;
    const path = await this.computePath(parentId, slug);

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug,
        description: dto.description,
        parentId,
        gender: dto.gender,
        ageGroup: dto.ageGroup,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        seoContent: dto.seoContent,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
        showInMenu: dto.showInMenu,
        sortOrder: dto.sortOrder,
        path,
      },
    });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat._count.children > 0) {
      throw new BadRequestException('Move or delete sub-categories first');
    }
    await this.prisma.productCategory.deleteMany({ where: { categoryId: id } });
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  async reorderCategories(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((it) =>
        this.prisma.category.update({
          where: { id: it.id },
          data: {
            sortOrder: it.sortOrder,
            ...(it.parentId !== undefined ? { parentId: it.parentId || null } : {}),
          },
        }),
      ),
    );
    return { updated: dto.items.length };
  }

  private async computePath(parentId: string | null, slug: string): Promise<string> {
    if (!parentId) return slug;
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { path: true, slug: true },
    });
    const parentPath = parent?.path ?? parent?.slug ?? '';
    return parentPath ? `${parentPath}/${slug}` : slug;
  }

  /* -------------------------------------------------------------------- brands */

  async listBrands() {
    return this.prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        isFeatured: true,
        sortOrder: true,
        _count: { select: { products: true } },
      },
    });
  }

  async createBrand(dto: BrandUpsertDto) {
    if (!dto.name) throw new BadRequestException('name is required');
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.brand.findFirst({ where: { slug: s } }).then(Boolean),
    );
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl,
        description: dto.description,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateBrand(id: string, dto: BrandUpsertDto) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');
    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await uniqueSlug(dto.slug, (s) =>
        this.prisma.brand.findFirst({ where: { slug: s, NOT: { id } } }).then(Boolean),
      );
    }
    return this.prisma.brand.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug,
        logoUrl: dto.logoUrl,
        description: dto.description,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deleteBrand(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand._count.products > 0) {
      throw new BadRequestException('Reassign this brand’s products first');
    }
    await this.prisma.brand.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* --------------------------------------------------------------- collections */

  async listCollections() {
    return this.prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        isActive: true,
        isFeatured: true,
        isPremium: true,
        isSeasonal: true,
        sortOrder: true,
        imageUrl: true,
        _count: { select: { products: true } },
      },
    });
  }

  async createCollection(dto: CollectionUpsertDto) {
    if (!dto.name) throw new BadRequestException('name is required');
    const slug = await uniqueSlug(dto.slug || dto.name, (s) =>
      this.prisma.collection.findFirst({ where: { slug: s } }).then(Boolean),
    );
    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type ?? 'MANUAL',
        description: dto.description,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        rules: (dto.rules as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        isPremium: dto.isPremium ?? false,
        isSeasonal: dto.isSeasonal ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.syncCollectionProducts(collection.id, dto.productIds);
    return collection;
  }

  async updateCollection(id: string, dto: CollectionUpsertDto) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Collection not found');
    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await uniqueSlug(dto.slug, (s) =>
        this.prisma.collection.findFirst({ where: { slug: s, NOT: { id } } }).then(Boolean),
      );
    }
    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        slug,
        type: dto.type,
        description: dto.description,
        imageUrl: dto.imageUrl,
        bannerUrl: dto.bannerUrl,
        ...(dto.rules !== undefined
          ? { rules: (dto.rules as Prisma.InputJsonValue) ?? Prisma.JsonNull }
          : {}),
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
        isPremium: dto.isPremium,
        isSeasonal: dto.isSeasonal,
        sortOrder: dto.sortOrder,
      },
    });
    await this.syncCollectionProducts(id, dto.productIds);
    return collection;
  }

  async deleteCollection(id: string) {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Collection not found');
    await this.prisma.productCollection.deleteMany({ where: { collectionId: id } });
    await this.prisma.collection.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* --------------------------------------------------------- CSV import/export */

  private static readonly CSV_HEADERS = [
    'slug',
    'name',
    'status',
    'brand',
    'gender',
    'ageGroup',
    'mrp',
    'salePrice',
    'costPrice',
    'categories',
    'tags',
    'option',
    'optionValue',
    'sku',
    'stock',
    'shortDescription',
  ];

  async exportProductsCsv(): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        brand: { select: { name: true } },
        categories: { select: { category: { select: { slug: true } } } },
        tags: { select: { tag: { select: { name: true } } } },
        options: { select: { name: true } },
        variants: {
          include: {
            optionValues: { select: { optionValue: { select: { value: true } } } },
            inventory: { select: { onHand: true } },
          },
        },
      },
    });

    const rows: Array<Record<string, unknown>> = [];
    for (const p of products) {
      const shared = {
        slug: p.slug,
        name: p.name,
        status: p.status,
        brand: p.brand?.name ?? '',
        gender: p.gender ?? '',
        ageGroup: p.ageGroup ?? '',
        mrp: p.mrp,
        salePrice: p.salePrice,
        costPrice: p.costPrice ?? '',
        categories: p.categories.map((c) => c.category.slug).join('|'),
        tags: p.tags.map((t) => t.tag.name).join('|'),
        option: p.options[0]?.name ?? '',
        shortDescription: p.shortDescription ?? '',
      };
      if (p.variants.length === 0) {
        rows.push({ ...shared, optionValue: '', sku: '', stock: '' });
        continue;
      }
      for (const v of p.variants) {
        rows.push({
          ...shared,
          optionValue: v.optionValues.map((o) => o.optionValue.value).join('/'),
          sku: v.sku,
          stock: v.inventory.reduce((sum, i) => sum + i.onHand, 0),
        });
      }
    }

    return toCsv(CatalogAdminService.CSV_HEADERS, rows);
  }

  async importProductsCsv(csv: string) {
    const records = parseCsvRecords(csv);
    if (records.length === 0) throw new BadRequestException('CSV has no data rows');

    // Group rows by product (slug, falling back to a slug from the name).
    const groups = new Map<string, Record<string, string>[]>();
    records.forEach((r) => {
      const key = (r.slug || slugify(r.name || '')).trim();
      if (!key) return;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    });

    const warehouse = await this.prisma.warehouse.findFirst({
      orderBy: { priority: 'desc' },
      select: { id: true },
    });

    const report = {
      productsProcessed: 0,
      created: 0,
      updated: 0,
      variantsUpserted: 0,
      errors: [] as { slug: string; message: string }[],
    };

    for (const [slug, rows] of groups) {
      const first = rows[0]!;
      try {
        if (!first.name) throw new Error('name is required');
        const mrp = Number(first.mrp);
        const salePrice = Number(first.salePrice || first.mrp);
        if (!Number.isFinite(mrp) || mrp <= 0) throw new Error('mrp must be a positive number');
        if (salePrice > mrp) throw new Error('salePrice cannot exceed mrp');

        const brandId = first.brand ? await this.resolveBrandId(first.brand) : null;
        const categoryIds = await this.resolveCategoryIds(first.categories);

        const existing = await this.prisma.product.findFirst({
          where: { slug },
          select: { id: true },
        });

        const scalar = {
          name: first.name,
          status: this.parseEnum(first.status, ProductStatus, ProductStatus.DRAFT),
          gender: this.parseEnum(first.gender, GENDER_VALUES),
          ageGroup: this.parseEnum(first.ageGroup, AGE_GROUP_VALUES),
          mrp,
          salePrice,
          costPrice: first.costPrice ? Number(first.costPrice) : null,
          shortDescription: first.shortDescription || null,
          brandId,
        };

        const product = existing
          ? await this.prisma.product.update({ where: { id: existing.id }, data: scalar })
          : await this.prisma.product.create({
              data: {
                ...scalar,
                slug,
                publishedAt: scalar.status === ProductStatus.ACTIVE ? new Date() : null,
              },
            });
        existing ? (report.updated += 1) : (report.created += 1);
        report.productsProcessed += 1;

        // categories
        await this.prisma.productCategory.deleteMany({ where: { productId: product.id } });
        if (categoryIds.length) {
          await this.prisma.productCategory.createMany({
            data: categoryIds.map((categoryId, i) => ({
              productId: product.id,
              categoryId,
              isPrimary: i === 0,
            })),
            skipDuplicates: true,
          });
        }

        // tags
        await this.prisma.productTag.deleteMany({ where: { productId: product.id } });
        for (const tagName of splitList(first.tags)) {
          const tag = await this.prisma.tag.upsert({
            where: { slug: slugify(tagName) },
            create: { name: tagName, slug: slugify(tagName) },
            update: {},
          });
          await this.prisma.productTag.create({
            data: { productId: product.id, tagId: tag.id },
          });
        }

        // options + variants — rebuilt from the CSV rows
        const variantRows = rows
          .filter((r) => r.sku)
          .map((r) => ({ sku: r.sku ?? '', optionValue: r.optionValue ?? '', stock: r.stock ?? '' }));
        await this.prisma.productVariant.deleteMany({ where: { productId: product.id } });
        await this.prisma.productOption.deleteMany({ where: { productId: product.id } });

        if (variantRows.length) {
          const optionName = first.option || 'Size';
          const distinctValues = [
            ...new Set(variantRows.map((r) => r.optionValue).filter((v) => v !== '')),
          ];
          const option = await this.prisma.productOption.create({
            data: { productId: product.id, name: optionName, position: 0 },
          });
          const valueId = new Map<string, string>();
          for (const [i, value] of distinctValues.entries()) {
            const created = await this.prisma.productOptionValue.create({
              data: { optionId: option.id, value, position: i },
            });
            valueId.set(value, created.id);
          }

          for (const [i, vr] of variantRows.entries()) {
            const variant = await this.prisma.productVariant.create({
              data: {
                productId: product.id,
                sku: vr.sku,
                position: i,
                optionValues: vr.optionValue && valueId.has(vr.optionValue)
                  ? { create: [{ optionValueId: valueId.get(vr.optionValue)! }] }
                  : undefined,
              },
            });
            report.variantsUpserted += 1;
            const stock = Number(vr.stock);
            if (warehouse && Number.isFinite(stock)) {
              await this.prisma.inventoryLevel.upsert({
                where: {
                  variantId_warehouseId: {
                    variantId: variant.id,
                    warehouseId: warehouse.id,
                  },
                },
                create: {
                  variantId: variant.id,
                  warehouseId: warehouse.id,
                  onHand: Math.max(0, stock),
                },
                update: { onHand: Math.max(0, stock) },
              });
            }
          }
        }
      } catch (err) {
        report.errors.push({ slug, message: (err as Error).message });
      }
    }

    return report;
  }

  private async resolveBrandId(name: string): Promise<string> {
    const found = await this.prisma.brand.findFirst({
      where: { OR: [{ name }, { slug: slugify(name) }] },
      select: { id: true },
    });
    if (found) return found.id;
    const created = await this.prisma.brand.create({
      data: { name, slug: await uniqueSlug(name, (s) =>
        this.prisma.brand.findFirst({ where: { slug: s } }).then(Boolean),
      ) },
    });
    return created.id;
  }

  private async resolveCategoryIds(raw: string | undefined): Promise<string[]> {
    const wanted = splitList(raw);
    if (wanted.length === 0) return [];
    const found = await this.prisma.category.findMany({
      where: {
        OR: [
          { slug: { in: wanted } },
          { name: { in: wanted } },
        ],
      },
      select: { id: true },
    });
    return found.map((c) => c.id);
  }

  private parseEnum<T extends string>(
    value: string | undefined,
    allowed: Record<string, T> | readonly T[],
    fallback?: T,
  ): T | undefined {
    if (!value) return fallback;
    const upper = value.toUpperCase();
    const values = Array.isArray(allowed) ? allowed : Object.values(allowed);
    return (values as readonly string[]).includes(upper) ? (upper as T) : fallback;
  }

  private async syncCollectionProducts(collectionId: string, productIds?: string[]): Promise<void> {
    if (!productIds) return;
    await this.prisma.productCollection.deleteMany({ where: { collectionId } });
    if (productIds.length) {
      await this.prisma.productCollection.createMany({
        data: productIds.map((productId, i) => ({ collectionId, productId, sortOrder: i })),
        skipDuplicates: true,
      });
    }
  }
}
