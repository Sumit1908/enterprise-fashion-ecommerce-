import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @IsString() @MaxLength(120) fullName!: string;
  @IsString() @MaxLength(20) phone!: string;
  @IsString() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(120) landmark?: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(80) state!: string;
  @IsString() @MinLength(4) @MaxLength(12) pincode!: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
}

export class QuoteDto {
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() shippingRateId?: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() paymentMethod?: string;
}

export class PlaceOrderDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  @ValidateNested() @Type(() => AddressDto) shippingAddress!: AddressDto;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) billingAddress?: AddressDto;

  @IsString() shippingRateId!: string;
  @IsIn(['COD', 'CARD', 'UPI', 'NETBANKING', 'RAZORPAY', 'WALLET'])
  paymentMethod!: 'COD' | 'CARD' | 'UPI' | 'NETBANKING' | 'RAZORPAY' | 'WALLET';

  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() @MaxLength(500) customerNote?: string;
  @IsOptional() @Type(() => Boolean) saveAddress?: boolean;
}

export class VerifyPaymentDto {
  @IsString() orderNumber!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() providerOrderId?: string;
  @IsOptional() @IsString() providerPaymentId?: string;
  @IsOptional() @IsString() signature?: string;
  @IsOptional() @IsIn(['success', 'failure']) mockOutcome?: 'success' | 'failure';
}

export class RetryPaymentDto {
  @IsString() orderNumber!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(['COD', 'CARD', 'UPI', 'NETBANKING', 'RAZORPAY'])
  paymentMethod!: 'COD' | 'CARD' | 'UPI' | 'NETBANKING' | 'RAZORPAY';
}

export class GuestLookupDto {
  @IsOptional() @IsEmail() email?: string;
}
