import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/decorators.js';
import { AuditInterceptor } from '../common/audit.interceptor.js';
import { PrismaService } from '../prisma/prisma.service.js';

class HeroDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(160) headline?: string;
  @IsOptional() @IsString() @MaxLength(240) subheadline?: string;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaUrl?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageMobileUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class SectionDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
}

class TestimonialDto {
  @IsOptional() @IsString() @MaxLength(80) authorName?: string;
  @IsOptional() @IsString() @MaxLength(80) authorRole?: string;
  @IsOptional() @IsString() @MaxLength(600) quote?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
}

const blank = (v: string | undefined) => (v?.trim() ? v.trim() : null);

@Injectable()
class HomepageAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [hero, sections, testimonials] = await Promise.all([
      this.prisma.banner.findFirst({ where: { placement: 'HOME_HERO' }, orderBy: { position: 'asc' } }),
      this.prisma.homeSection.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.testimonial.findMany({ orderBy: { position: 'asc' } }),
    ]);
    return { hero, sections, testimonials };
  }

  async saveHero(dto: HeroDto) {
    const existing = await this.prisma.banner.findFirst({ where: { placement: 'HOME_HERO' } });
    const fields = {
      headline: dto.headline === undefined ? undefined : blank(dto.headline),
      subheadline: dto.subheadline === undefined ? undefined : blank(dto.subheadline),
      ctaLabel: dto.ctaLabel === undefined ? undefined : blank(dto.ctaLabel),
      ctaUrl: dto.ctaUrl === undefined ? undefined : blank(dto.ctaUrl),
      imageUrl: dto.imageUrl === undefined ? undefined : blank(dto.imageUrl),
      imageMobileUrl: dto.imageMobileUrl === undefined ? undefined : blank(dto.imageMobileUrl),
      isActive: dto.isActive,
    };
    return existing
      ? this.prisma.banner.update({
          where: { id: existing.id },
          data: { ...fields, title: dto.title?.trim() || undefined },
        })
      : this.prisma.banner.create({
          data: {
            placement: 'HOME_HERO',
            title: dto.title?.trim() || 'Hero',
            ...fields,
            isActive: dto.isActive ?? true,
          },
        });
  }

  async saveSection(id: string, dto: SectionDto) {
    return this.prisma.homeSection.update({
      where: { id },
      data: {
        title: dto.title === undefined ? undefined : blank(dto.title),
        subtitle: dto.subtitle === undefined ? undefined : blank(dto.subtitle),
        ctaLabel: dto.ctaLabel === undefined ? undefined : blank(dto.ctaLabel),
        ctaUrl: dto.ctaUrl === undefined ? undefined : blank(dto.ctaUrl),
        isActive: dto.isActive,
        position: dto.position,
      },
    });
  }

  createTestimonial(dto: TestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        authorName: dto.authorName?.trim() || 'Customer',
        authorRole: blank(dto.authorRole),
        quote: dto.quote?.trim() || '',
        rating: dto.rating ?? 5,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });
  }

  updateTestimonial(id: string, dto: TestimonialDto) {
    return this.prisma.testimonial.update({
      where: { id },
      data: {
        authorName: dto.authorName?.trim() || undefined,
        authorRole: dto.authorRole === undefined ? undefined : blank(dto.authorRole),
        quote: dto.quote?.trim() || undefined,
        rating: dto.rating,
        isActive: dto.isActive,
        position: dto.position,
      },
    });
  }

  async deleteTestimonial(id: string) {
    await this.prisma.testimonial.delete({ where: { id } });
    return { id, deleted: true };
  }
}

@ApiTags('admin-homepage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin/homepage')
class HomepageAdminController {
  constructor(private readonly service: HomepageAdminService) {}

  @Get()
  @RequirePermissions('homeSection:read')
  overview() {
    return this.service.overview();
  }

  @Patch('hero')
  @RequirePermissions('homeSection:update')
  saveHero(@Body() dto: HeroDto) {
    return this.service.saveHero(dto);
  }

  @Patch('sections/:id')
  @RequirePermissions('homeSection:update')
  saveSection(@Param('id') id: string, @Body() dto: SectionDto) {
    return this.service.saveSection(id, dto);
  }

  @Post('testimonials')
  @RequirePermissions('homeSection:update')
  createTestimonial(@Body() dto: TestimonialDto) {
    return this.service.createTestimonial(dto);
  }

  @Patch('testimonials/:id')
  @RequirePermissions('homeSection:update')
  updateTestimonial(@Param('id') id: string, @Body() dto: TestimonialDto) {
    return this.service.updateTestimonial(id, dto);
  }

  @Delete('testimonials/:id')
  @RequirePermissions('homeSection:update')
  deleteTestimonial(@Param('id') id: string) {
    return this.service.deleteTestimonial(id);
  }
}

export { HomepageAdminController, HomepageAdminService };
