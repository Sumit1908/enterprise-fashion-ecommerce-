import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { Public, RequirePermissions } from '../common/decorators.js';
import { NewsletterService } from './newsletter.service.js';
import { SubscribeDto, UnsubscribeDto } from './newsletter.dto.js';

@ApiTags('newsletter')
@Controller()
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('newsletter/subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletter.subscribe(dto);
  }

  @Public()
  @Post('newsletter/unsubscribe')
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.newsletter.unsubscribe(dto.email, dto.token);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('promotion:read')
  @Get('admin/newsletter')
  adminList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.newsletter.adminList({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
      q,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('promotion:read')
  @Get('admin/newsletter/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="slay-newsletter.csv"')
  adminExport() {
    return this.newsletter.adminExportCsv();
  }
}
