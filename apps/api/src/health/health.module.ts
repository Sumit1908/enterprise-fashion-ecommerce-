import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators.js';

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, uptime: process.uptime() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
