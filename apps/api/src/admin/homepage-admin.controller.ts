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

class HeroSlideDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(160) headline?: string;
  @IsOptional() @IsString() @MaxLength(240) subheadline?: string;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaUrl?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageMobileUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
}

class HeroMoveDto {
  @IsString() direction!: 'up' | 'down';
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
    const [heroSlides, sections, testimonials] = await Promise.all([
      this.prisma.banner.findMany({
        where: { placement: 'HOME_HERO' },
        orderBy: { position: 'asc' },
      }),
      this.prisma.homeSection.findMany({ orderBy: { position: 'asc' } }),
      this.prisma.testimonial.findMany({ orderBy: { position: 'asc' } }),
    ]);
    return { heroSlides, sections, testimonials };
  }

  private heroFields(dto: HeroSlideDto) {
    return {
      headline: dto.headline === undefined ? undefined : blank(dto.headline),
      subheadline: dto.subheadline === undefined ? undefined : blank(dto.subheadline),
      ctaLabel: dto.ctaLabel === undefined ? undefined : blank(dto.ctaLabel),
      ctaUrl: dto.ctaUrl === undefined ? undefined : blank(dto.ctaUrl),
      imageUrl: dto.imageUrl === undefined ? undefined : blank(dto.imageUrl),
      imageMobileUrl: dto.imageMobileUrl === undefined ? undefined : blank(dto.imageMobileUrl),
      isActive: dto.isActive,
      position: dto.position,
    };
  }

  async createHeroSlide(dto: HeroSlideDto) {
    const count = await this.prisma.banner.count({ where: { placement: 'HOME_HERO' } });
    return this.prisma.banner.create({
      data: {
        placement: 'HOME_HERO',
        title: dto.title?.trim() || `Slide ${count + 1}`,
        ...this.heroFields(dto),
        isActive: dto.isActive ?? true,
        position: dto.position ?? count,
      },
    });
  }

  async updateHeroSlide(id: string, dto: HeroSlideDto) {
    return this.prisma.banner.update({
      where: { id },
      data: { ...this.heroFields(dto), title: dto.title?.trim() || undefined },
    });
  }

  async deleteHeroSlide(id: string) {
    await this.prisma.banner.delete({ where: { id } });
    // Compact positions so the remaining slides stay 0..n-1.
    const rest = await this.prisma.banner.findMany({
      where: { placement: 'HOME_HERO' },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await Promise.all(
      rest.map((b, i) => this.prisma.banner.update({ where: { id: b.id }, data: { position: i } })),
    );
    return { id, deleted: true };
  }

  async moveHeroSlide(id: string, direction: 'up' | 'down') {
    const slides = await this.prisma.banner.findMany({
      where: { placement: 'HOME_HERO' },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    const idx = slides.findIndex((s) => s.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const a = slides[idx];
    const b = slides[swapIdx];
    if (!a || !b) return { moved: false };
    await this.prisma.$transaction([
      this.prisma.banner.update({ where: { id: a.id }, data: { position: b.position } }),
      this.prisma.banner.update({ where: { id: b.id }, data: { position: a.position } }),
    ]);
    return { moved: true };
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

  @Post('hero')
  @RequirePermissions('homeSection:update')
  createHeroSlide(@Body() dto: HeroSlideDto) {
    return this.service.createHeroSlide(dto);
  }

  @Patch('hero/:id')
  @RequirePermissions('homeSection:update')
  updateHeroSlide(@Param('id') id: string, @Body() dto: HeroSlideDto) {
    return this.service.updateHeroSlide(id, dto);
  }

  @Patch('hero/:id/move')
  @RequirePermissions('homeSection:update')
  moveHeroSlide(@Param('id') id: string, @Body() dto: HeroMoveDto) {
    return this.service.moveHeroSlide(id, dto.direction);
  }

  @Delete('hero/:id')
  @RequirePermissions('homeSection:update')
  deleteHeroSlide(@Param('id') id: string) {
    return this.service.deleteHeroSlide(id);
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
