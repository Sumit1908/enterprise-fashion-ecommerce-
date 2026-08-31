import { Controller, Get, Module, Param, Query, UseGuards } from '@nestjs/common';
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

  @Public()
  @Get('products')
  listProducts(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query);
  }

  // Must be declared before `products/:slug` so it isn't captured as a slug.
  @Public()
  @Get('products/facets')
  facets(@Query() query: ProductQueryDto) {
    return this.catalog.getFacets(query);
  }

  @Public()
  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getProductBySlug(slug);
  }

  @Public()
  @Get('categories')
  categories() {
    return this.catalog.categoryTree();
  }

  @Public()
  @Get('categories/:slug')
  category(@Param('slug') slug: string) {
    return this.catalog.getCategoryBySlug(slug);
  }

  @Public()
  @Get('brands')
  brands() {
    return this.catalog.listBrands();
  }

  @Public()
  @Get('collections')
  collections() {
    return this.catalog.listCollections();
  }

  @Public()
  @Get('collections/:slug')
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
