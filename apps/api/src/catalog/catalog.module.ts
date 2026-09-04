import { Controller, Get, Header, Module, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { Public } from '../common/decorators.js';
import { CatalogService } from './catalog.service.js';
import { ProductQueryDto } from './dto.js';

@ApiTags('catalog')
@UseGuards(JwtAuthGuard)
@Controller()
class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Cache-Control values mirror the Next.js `revalidate` seconds already used
  // to fetch these (apps/web/src/lib/api.ts) — public, non-personalized catalog
  // data only. Never applied to cart/checkout/orders/auth/admin routes.
  @Public()
  @Get('products')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  listProducts(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query);
  }

  // Must be declared before `products/:slug` so it isn't captured as a slug.
  @Public()
  @Get('products/facets')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  facets(@Query() query: ProductQueryDto) {
    return this.catalog.getFacets(query);
  }

  @Public()
  @Get('products/:slug')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getProductBySlug(slug);
  }

  @Public()
  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  categories() {
    return this.catalog.categoryTree();
  }

  @Public()
  @Get('categories/:slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  category(@Param('slug') slug: string) {
    return this.catalog.getCategoryBySlug(slug);
  }

  @Public()
  @Get('brands')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  brands() {
    return this.catalog.listBrands();
  }

  @Public()
  @Get('collections')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  collections() {
    return this.catalog.listCollections();
  }

  @Public()
  @Get('collections/:slug')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  collection(@Param('slug') slug: string) {
    return this.catalog.getCollectionBySlug(slug);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
