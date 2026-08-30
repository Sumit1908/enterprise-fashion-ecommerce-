import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SOURCES = ['footer', 'popup', 'checkout', 'homepage', 'unknown'] as const;

export class SubscribeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsIn(SOURCES as unknown as string[])
  source?: (typeof SOURCES)[number];
}

export class UnsubscribeDto {
  @IsEmail()
  email!: string;

  @IsString()
  token!: string;
}
