import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Gender } from '@slay/db';

export class ProductQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ description: 'Comma-separated subcategory slugs to narrow within `category`' })
  @IsOptional() @IsString() sub?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() collection?: string;
  @ApiPropertyOptional({ description: 'Comma-separated brand slugs' })
  @IsOptional() @IsString() brand?: string;

  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minRating?: number;

  @ApiPropertyOptional({ description: 'Comma-separated size values, e.g. "M,L"' })
  @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional({ description: 'Comma-separated colour names, e.g. "Black,Navy"' })
  @IsOptional() @IsString() color?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() inStock?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({
    enum: ['latest', 'popular', 'bestselling', 'price_asc', 'price_desc', 'rating'],
  })
  @IsOptional() @IsString() sort?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
