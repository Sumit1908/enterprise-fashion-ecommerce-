import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, ProductStatus, OrderStatus } from '@slay/db';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  @RequirePermissions('report:read')
  async overview() {
    const since = new Date(Date.now() - 30 * 864e5);
    const [products, activeProducts, orders, revenueAgg, customers, lowStock, pendingReviews, openReturns] =
      await this.prisma.$transaction([
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: 'ACTIVE' } }),
        this.prisma.order.count({ where: { placedAt: { gte: since } } }),
        this.prisma.order.aggregate({
          _sum: { grandTotal: true },
          where: { placedAt: { gte: since }, paymentStatus: 'PAID' },
        }),
        this.prisma.user.count({ where: { kind: 'CUSTOMER' } }),
        this.prisma.inventoryLevel.count({ where: { onHand: { lte: 5 } } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
        this.prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
      ]);

    const recentDaily = await this.prisma.dailyMetric.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    });

    return {
      kpis: {
        revenue30d: revenueAgg._sum.grandTotal ?? 0,
        orders30d: orders,
        totalProducts: products,
        activeProducts,
        totalCustomers: customers,
        lowStockVariants: lowStock,
        pendingReviews,
        openReturns,
      },
      dailyMetrics: recentDaily.reverse(),
    };
  }

  @Get('products')
  @RequirePermissions('product:read')
  async products(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
  ) {
    const take = 25;
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(status && status in ProductStatus ? { status: status as ProductStatus } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
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
    return { items, total, page: Number(page), pageSize: take };
  }

  @Patch('products/:id/status')
  @RequirePermissions('product:update')
  async setStatus(@Param('id') id: string, @Body('status') status: string) {
    if (!(status in ProductStatus)) {
      return { error: 'Invalid status' };
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        status: status as ProductStatus,
        publishedAt: status === 'ACTIVE' ? new Date() : undefined,
      },
      select: { id: true, status: true },
    });
  }

  @Get('orders')
  @RequirePermissions('order:read')
  async orders(@Query('status') status?: string, @Query('page') page = '1') {
    const take = 25;
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const where: Prisma.OrderWhereInput =
      status && status in OrderStatus ? { status: status as OrderStatus } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          currency: true,
          placedAt: true,
          user: { select: { email: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: Number(page), pageSize: take };
  }

  @Get('customers')
  @RequirePermissions('customer:read')
  async customers(@Query('q') q?: string, @Query('page') page = '1') {
    const take = 25;
    const skip = (Math.max(1, Number(page)) - 1) * take;
    const where: Prisma.UserWhereInput = {
      kind: 'CUSTOMER',
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { firstName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: Number(page), pageSize: take };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
