import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddItemDto {
  @IsString() variantId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) quantity: number = 1;
}

export class UpdateItemDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(20) quantity!: number;
}

export class CouponDto {
  @IsString() code!: string;
}
