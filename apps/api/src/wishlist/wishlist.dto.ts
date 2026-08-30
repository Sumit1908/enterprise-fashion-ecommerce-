import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class AddWishlistDto {
  @IsOptional()
  @IsString()
  productId?: string;

  /** Alternative to productId — resolve by product slug (storefront convenience). */
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class MergeWishlistDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  slugs!: string[];
}
