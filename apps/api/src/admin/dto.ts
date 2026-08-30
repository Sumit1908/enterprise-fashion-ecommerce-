import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AgeGroup, Gender, MediaType, ProductStatus } from '@slay/db';

/* -------------------------------------------------------------------------- */
/*  Products                                                                   */
/* -------------------------------------------------------------------------- */

class MediaInput {
  @IsString() url!: string;
  @IsOptional() @IsEnum(MediaType) type?: MediaType;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() variantSku?: string;
  @IsOptional() @Type(() => Number) @IsInt() position?: number;
}

class OptionValueInput {
  @IsString() value!: string;
  @IsOptional() @IsHexColor() hexColor?: string;
}

class OptionInput {
  @IsString() name!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OptionValueInput)
  values!: OptionValueInput[];
}

class VariantInput {
  @IsString() sku!: string;
  /** option value strings that identify this variant, e.g. ["32", "Indigo"] */
  @IsOptional() @IsArray() @IsString({ each: true }) optionValues?: string[];
  @IsOptional() @Type(() => Number) @IsNumber() mrp?: number;
  @IsOptional() @Type(() => Number) @IsNumber() salePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() costPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() weightGrams?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class SeoInput {
  @IsOptional() @IsString() @MaxLength(180) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) metaDescription?: string;
  @IsOptional() @IsString() metaKeywords?: string;
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
  @IsOptional() @IsBoolean() noindex?: boolean;
}

export class ProductCreateDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(AgeGroup) ageGroup?: AgeGroup;

  @IsOptional() @IsString() currency?: string;
  @Type(() => Number) @IsNumber() @Min(0) mrp!: number;
  @Type(() => Number) @IsNumber() @Min(0) salePrice!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsString() taxClassId?: string;

  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isBestSeller?: boolean;
  @IsOptional() @IsBoolean() isNewArrival?: boolean;
  @IsOptional() @IsBoolean() isTrending?: boolean;
  @IsOptional() @IsBoolean() isHot?: boolean;
  @IsOptional() @IsBoolean() isStaffPick?: boolean;
  @IsOptional() @IsBoolean() isExclusive?: boolean;

  @IsOptional() @IsString() fabricDetails?: string;
  @IsOptional() @IsString() careInstructions?: string;
  @IsOptional() @IsString() originCountry?: string;
  @IsOptional() @Type(() => Number) @IsInt() weightGrams?: number;
  @IsOptional() @IsString() sizeGuideId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) categoryIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) collectionIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaInput)
  media?: MediaInput[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OptionInput)
  options?: OptionInput[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantInput)
  variants?: VariantInput[];

  @IsOptional() @ValidateNested() @Type(() => SeoInput) seo?: SeoInput;
}

/** Every field optional; only what's sent is changed. */
export class ProductUpdateDto extends PartialType(ProductCreateDto) {}

export class ImportCsvDto {
  @IsString() csv!: string;
}

export class BulkProductActionDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
  @IsIn(['setStatus', 'setFlag', 'clearFlag', 'setSalePrice', 'delete'])
  action!: 'setStatus' | 'setFlag' | 'clearFlag' | 'setSalePrice' | 'delete';
  @IsOptional() @IsString() value?: string;
  @IsOptional() @Type(() => Number) @IsNumber() numberValue?: number;
}

/* -------------------------------------------------------------------------- */
/*  Categories / Brands / Collections                                          */
/* -------------------------------------------------------------------------- */

export class CategoryUpsertDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsEnum(AgeGroup) ageGroup?: AgeGroup;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
  @IsOptional() @IsString() seoContent?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() showInMenu?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class ReorderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderItem)
  items!: ReorderItem[];
}
class ReorderItem {
  @IsString() id!: string;
  @Type(() => Number) @IsInt() sortOrder!: number;
  @IsOptional() @IsString() parentId?: string | null;
}

export class BrandUpsertDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class CollectionUpsertDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsIn(['MANUAL', 'AUTOMATED']) type?: 'MANUAL' | 'AUTOMATED';
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
  @IsOptional() rules?: unknown;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsBoolean() isSeasonal?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) productIds?: string[];
}

export class ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/* -------------------------------------------------------------------------- */
/*  Inventory                                                                  */
/* -------------------------------------------------------------------------- */

export class InventoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ description: 'low | out | all' })
  @IsOptional() @IsIn(['low', 'out', 'all']) filter?: 'low' | 'out' | 'all';
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class MovementQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() variantId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

export class StockAdjustDto {
  @IsString() variantId!: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsIn(['set', 'delta']) mode!: 'set' | 'delta';
  @Type(() => Number) @IsInt() quantity!: number;
  @IsOptional()
  @IsIn(['PURCHASE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'TRANSFER'])
  type?: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'DAMAGE' | 'TRANSFER';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
}
