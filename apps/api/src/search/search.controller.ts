import { Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/decorators.js';
import { AuditInterceptor } from '../common/audit.interceptor.js';
import { SearchService } from './search.service.js';

@ApiTags('admin-search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('status')
  @RequirePermissions('product:read')
  status() {
    return this.search.status();
  }

  @Post('reindex')
  @RequirePermissions('product:update')
  reindex() {
    return this.search.reindexAll();
  }
}
