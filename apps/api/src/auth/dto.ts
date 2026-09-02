import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiProperty({ required: false, example: '+919000000000' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePass!' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ required: false, description: 'Falls back to the sj_refresh cookie.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

/** Step 1 of mobile-number customer auth — send a one-time code. */
export class RequestOtpDto {
  @ApiProperty({ example: '+919000000000' })
  @IsString()
  @MaxLength(20)
  phone!: string;
}

/** Step 2 — verify the code; creates or signs in the customer. */
export class VerifyOtpDto {
  @ApiProperty({ example: '+919000000000' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{4,8}$/)
  otp!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;
}

/**
 * MSG91 Secure OTP widget — the browser has already sent + verified the code and
 * returns an access token. The server validates it with MSG91 and issues its own
 * session, so this replaces the phone/otp pair when the widget is in use.
 */
export class VerifyWidgetOtpDto {
  @ApiProperty({ description: 'access-token returned by the MSG91 OTP widget' })
  @IsString()
  @MaxLength(8192)
  accessToken!: string;

  @ApiProperty({ example: '+919000000000', description: 'the number the shopper entered' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;
}
