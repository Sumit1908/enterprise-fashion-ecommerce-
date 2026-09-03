import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/decorators.js';
import { AuditInterceptor } from '../common/audit.interceptor.js';
import { IsString, MaxLength } from 'class-validator';
import { CatalogAdminService } from './catalog-admin.service.js';
import { AiSuggestService } from './ai-suggest.service.js';
import {
  BrandUpsertDto,
  BulkProductActionDto,
  CategoryUpsertDto,
  CollectionUpsertDto,
  ImportCsvDto,
  ListQueryDto,
  ProductCreateDto,
  ProductUpdateDto,
  ReorderDto,
} from './dto.js';

class AiSuggestDto {
  @IsString() @MaxLength(2048) imageUrl!: string;
}

@ApiTags('admin-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class CatalogAdminController {
  constructor(
    private readonly service: CatalogAdminService,
    private readonly ai: AiSuggestService,
  ) {}

  /* -------------------------------------------------------- AI suggestions */

  @Get('products/ai-suggest/config')
  @RequirePermissions('product:read')
  aiConfig() {
    return { available: this.ai.available };
  }

  /** Advisory product attributes from a product image. Suggestions only. */
  @Post('products/ai-suggest')
  @RequirePermissions('product:update')
  aiSuggest(@Body() dto: AiSuggestDto) {
    return this.ai.suggestFromImageUrl(dto.imageUrl);
  }

  /* -------------------------------------------------------------- products */

  @Get('catalog/products')
  @RequirePermissions('product:read')
  listProducts(@Query() query: ListQueryDto) {
    return this.service.listProducts(query);
  }

  @Get('products/export.csv')
  @RequirePermissions('product:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="velorhouse-products.csv"')
  exportCsv() {
    return this.service.exportProductsCsv();
  }

  @Post('products/import')
  @RequirePermissions('product:create')
  importCsv(@Body() dto: ImportCsvDto) {
    return this.service.importProductsCsv(dto.csv);
  }

  @Get('products/:id')
  @RequirePermissions('product:read')
  getProduct(@Param('id') id: string) {
    return this.service.getProduct(id);
  }

  @Post('products')
  @RequirePermissions('product:create')
  createProduct(@Body() dto: ProductCreateDto) {
    return this.service.createProduct(dto);
  }

  @Post('products/bulk')
  @RequirePermissions('product:update')
  bulkProduct(@Body() dto: BulkProductActionDto) {
    return this.service.bulkProduct(dto);
  }

  @Patch('products/:id')
  @RequirePermissions('product:update')
  updateProduct(@Param('id') id: string, @Body() dto: ProductUpdateDto) {
    return this.service.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @RequirePermissions('product:delete')
  deleteProduct(@Param('id') id: string) {
    return this.service.deleteProduct(id);
  }

  /* ------------------------------------------------------------ categories */

  @Get('categories')
  @RequirePermissions('category:read')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('categories/:id')
  @RequirePermissions('category:read')
  getCategory(@Param('id') id: string) {
    return this.service.getCategory(id);
  }

  @Post('categories')
  @RequirePermissions('category:create')
  createCategory(@Body() dto: CategoryUpsertDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/reorder')
  @RequirePermissions('category:update')
  reorderCategories(@Body() dto: ReorderDto) {
    return this.service.reorderCategories(dto);
  }

  @Patch('categories/:id')
  @RequirePermissions('category:update')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryUpsertDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions('category:delete')
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }

  /* ---------------------------------------------------------------- brands */

  @Get('brands')
  @RequirePermissions('brand:read')
  listBrands() {
    return this.service.listBrands();
  }

  @Post('brands')
  @RequirePermissions('brand:create')
  createBrand(@Body() dto: BrandUpsertDto) {
    return this.service.createBrand(dto);
  }

  @Patch('brands/:id')
  @RequirePermissions('brand:update')
  updateBrand(@Param('id') id: string, @Body() dto: BrandUpsertDto) {
    return this.service.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @RequirePermissions('brand:delete')
  deleteBrand(@Param('id') id: string) {
    return this.service.deleteBrand(id);
  }

  /* ----------------------------------------------------------- collections */

  @Get('collections')
  @RequirePermissions('collection:read')
  listCollections() {
    return this.service.listCollections();
  }

  @Post('collections')
  @RequirePermissions('collection:create')
  createCollection(@Body() dto: CollectionUpsertDto) {
    return this.service.createCollection(dto);
  }

  @Patch('collections/:id')
  @RequirePermissions('collection:update')
  updateCollection(@Param('id') id: string, @Body() dto: CollectionUpsertDto) {
    return this.service.updateCollection(id, dto);
  }

  @Delete('collections/:id')
  @RequirePermissions('collection:delete')
  deleteCollection(@Param('id') id: string) {
    return this.service.deleteCollection(id);
  }
}
