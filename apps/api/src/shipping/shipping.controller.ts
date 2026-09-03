import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { AuditInterceptor } from '../common/audit.interceptor.js';
import { CurrentUser, RequirePermissions, type AuthUser } from '../common/decorators.js';
import { ShippingService } from './shipping.service.js';

class DimsDto {
  @Type(() => Number) @IsPositive() length!: number;
  @Type(() => Number) @IsPositive() breadth!: number;
  @Type(() => Number) @IsPositive() height!: number;
}

class CreateShipmentDto {
  @IsOptional() @Type(() => Number) @IsInt() courierId?: number;
  @IsOptional() @Type(() => Number) @IsPositive() weightKg?: number;
  @IsOptional() @ValidateNested() @Type(() => DimsDto) dimensionsCm?: DimsDto;
  @IsOptional() @IsBoolean() assignAwb?: boolean;
  @IsOptional() @IsBoolean() schedulePickup?: boolean;
}

class AssignAwbDto {
  @IsOptional() @Type(() => Number) @IsInt() courierId?: number;
}

@ApiTags('admin-shipping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class ShippingAdminController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('shipping/status')
  @RequirePermissions('order:read')
  status() {
    return this.shipping.status();
  }

  /** Recent hits on the public Shiprocket webhook URL — diagnostics only. */
  @Get('shipping/webhook-log')
  @RequirePermissions('order:read')
  webhookLog() {
    return this.shipping.getWebhookProbes();
  }

  @Get('orders/:orderId/serviceability')
  @RequirePermissions('order:read')
  serviceability(@Param('orderId') orderId: string) {
    return this.shipping.serviceabilityForOrder(orderId);
  }

  @Get('orders/:orderId/shipments')
  @RequirePermissions('order:read')
  listForOrder(@Param('orderId') orderId: string) {
    return this.shipping.listForOrder(orderId);
  }

  @Post('orders/:orderId/shipment')
  @RequirePermissions('order:update')
  create(
    @Param('orderId') orderId: string,
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shipping.createShipment(orderId, { ...dto, actorId: user?.id });
  }

  @Get('shipments/:id')
  @RequirePermissions('order:read')
  get(@Param('id') id: string) {
    return this.shipping.getShipmentForAdmin(id);
  }

  @Post('shipments/:id/awb')
  @RequirePermissions('order:update')
  assignAwb(
    @Param('id') id: string,
    @Body() dto: AssignAwbDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shipping.assignAwb(id, dto.courierId, user?.id);
  }

  @Post('shipments/:id/pickup')
  @RequirePermissions('order:update')
  pickup(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shipping.schedulePickup(id, user?.id);
  }

  @Post('shipments/:id/label')
  @RequirePermissions('order:update')
  label(@Param('id') id: string, @Query('force') force?: string) {
    return this.shipping.getLabel(id, force === 'true');
  }

  @Post('shipments/:id/invoice')
  @RequirePermissions('order:update')
  invoice(@Param('id') id: string, @Query('force') force?: string) {
    return this.shipping.getInvoice(id, force === 'true');
  }

  @Post('shipments/:id/manifest')
  @RequirePermissions('order:update')
  manifest(@Param('id') id: string) {
    return this.shipping.getManifest(id);
  }

  @Get('shipments/:id/track')
  @RequirePermissions('order:read')
  track(@Param('id') id: string) {
    return this.shipping.refreshTracking(id);
  }

  @Post('shipments/:id/cancel')
  @RequirePermissions('order:update')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shipping.cancel(id, user?.id);
  }
}
