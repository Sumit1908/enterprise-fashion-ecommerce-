import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions, CurrentUser } from '../common/decorators.js';
import { AuditInterceptor } from '../common/audit.interceptor.js';
import { InventoryAdminService } from './inventory-admin.service.js';
import { InventoryQueryDto, MovementQueryDto, StockAdjustDto } from './dto.js';

@ApiTags('admin-inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin/inventory')
export class InventoryAdminController {
  constructor(private readonly service: InventoryAdminService) {}

  @Get('warehouses')
  @RequirePermissions('inventory:read')
  warehouses() {
    return this.service.listWarehouses();
  }

  @Get('summary')
  @RequirePermissions('inventory:read')
  summary() {
    return this.service.summary();
  }

  @Get('movements')
  @RequirePermissions('inventory:read')
  movements(@Query() query: MovementQueryDto) {
    return this.service.listMovements(query);
  }

  @Get()
  @RequirePermissions('inventory:read')
  levels(@Query() query: InventoryQueryDto) {
    return this.service.listLevels(query);
  }

  @Post('adjust')
  @RequirePermissions('inventory:update')
  adjust(@Body() dto: StockAdjustDto, @CurrentUser('id') userId: string) {
    return this.service.adjust(dto, userId);
  }
}
