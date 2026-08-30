import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { InventoryQueryDto, MovementQueryDto, StockAdjustDto } from './dto.js';

@Injectable()
export class InventoryAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: { priority: 'desc' },
      select: { id: true, name: true, code: true, isActive: true, priority: true },
    });
  }

  async summary() {
    const [outOfStock, low, tracked] = await this.prisma.$transaction([
      this.prisma.inventoryLevel.count({ where: { onHand: { lte: 0 } } }),
      this.prisma.inventoryLevel.count({
        where: { onHand: { gt: 0, lte: this.prisma.inventoryLevel.fields.lowStockThreshold } },
      }),
      this.prisma.inventoryLevel.count(),
    ]);
    return { outOfStock, low, tracked };
  }

  async listLevels(query: InventoryQueryDto) {
    const pageSize = Math.min(200, query.pageSize ?? 50);
    const page = Math.max(1, query.page ?? 1);

    const where: Prisma.InventoryLevelWhereInput = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.filter === 'out' ? { onHand: { lte: 0 } } : {}),
      ...(query.filter === 'low'
        ? { onHand: { gt: 0, lte: this.prisma.inventoryLevel.fields.lowStockThreshold } }
        : {}),
      ...(query.q
        ? {
            variant: {
              OR: [
                { sku: { contains: query.q, mode: 'insensitive' } },
                { product: { name: { contains: query.q, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryLevel.findMany({
        where,
        orderBy: [{ onHand: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          onHand: true,
          reserved: true,
          lowStockThreshold: true,
          updatedAt: true,
          warehouse: { select: { id: true, name: true, code: true } },
          variant: {
            select: {
              id: true,
              sku: true,
              product: { select: { id: true, name: true, slug: true } },
              optionValues: { select: { optionValue: { select: { value: true } } } },
            },
          },
        },
      }),
      this.prisma.inventoryLevel.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        id: l.id,
        onHand: l.onHand,
        reserved: l.reserved,
        available: l.onHand - l.reserved,
        lowStockThreshold: l.lowStockThreshold,
        updatedAt: l.updatedAt,
        warehouse: l.warehouse,
        variantId: l.variant.id,
        sku: l.variant.sku,
        variantLabel: l.variant.optionValues.map((o) => o.optionValue.value).join(' / '),
        product: l.variant.product,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listMovements(query: MovementQueryDto) {
    const pageSize = Math.min(200, query.pageSize ?? 50);
    const page = Math.max(1, query.page ?? 1);
    const where: Prisma.StockMovementWhereInput = {
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.type && query.type in StockMovementType
        ? { type: query.type as StockMovementType }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          quantity: true,
          reason: true,
          reference: true,
          createdAt: true,
          variant: {
            select: { sku: true, product: { select: { name: true } } },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async adjust(dto: StockAdjustDto, actorId?: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: { id: true, sku: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const warehouse = dto.warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
      : await this.prisma.warehouse.findFirst({ orderBy: { priority: 'desc' } });
    if (!warehouse) throw new BadRequestException('No warehouse configured');

    const current = await this.prisma.inventoryLevel.findUnique({
      where: { variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });
    const currentOnHand = current?.onHand ?? 0;

    const nextOnHand =
      dto.mode === 'set' ? dto.quantity : Math.max(0, currentOnHand + dto.quantity);
    const delta = nextOnHand - currentOnHand;

    if (delta === 0 && dto.lowStockThreshold == null) {
      return { unchanged: true, onHand: currentOnHand };
    }

    const [level] = await this.prisma.$transaction([
      this.prisma.inventoryLevel.upsert({
        where: {
          variantId_warehouseId: { variantId: variant.id, warehouseId: warehouse.id },
        },
        create: {
          variantId: variant.id,
          warehouseId: warehouse.id,
          onHand: nextOnHand,
          ...(dto.lowStockThreshold != null ? { lowStockThreshold: dto.lowStockThreshold } : {}),
        },
        update: {
          onHand: nextOnHand,
          ...(dto.lowStockThreshold != null ? { lowStockThreshold: dto.lowStockThreshold } : {}),
        },
        select: { onHand: true, reserved: true, lowStockThreshold: true },
      }),
      ...(delta !== 0
        ? [
            this.prisma.stockMovement.create({
              data: {
                variantId: variant.id,
                warehouseId: warehouse.id,
                type: (dto.type as StockMovementType) ?? StockMovementType.ADJUSTMENT,
                quantity: delta,
                reason: dto.reason ?? null,
                reference: `manual:${actorId ?? 'system'}`,
                createdById: actorId ?? null,
              },
            }),
          ]
        : []),
    ]);

    return {
      variantId: variant.id,
      sku: variant.sku,
      warehouseId: warehouse.id,
      onHand: level.onHand,
      available: level.onHand - level.reserved,
      lowStockThreshold: level.lowStockThreshold,
      delta,
    };
  }
}
