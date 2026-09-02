import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loadEnv } from '@slay/config';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { Msg91WidgetService } from './msg91-widget.service.js';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestOtpDto,
  VerifyOtpDto,
  VerifyWidgetOtpDto,
} from './dto.js';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';

const env = loadEnv();
const isProd = env.NODE_ENV === 'production';

function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
) {
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
  res.cookie('sj_access', tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('sj_refresh', tokens.refreshToken, {
    ...base,
    expires: tokens.refreshExpiresAt,
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly msg91Widget: Msg91WidgetService,
  ) {}

  /* ----------------------------- mobile OTP (customers) ---------------------- */

  /** Tells the storefront which OTP transport is live (+ the browser-safe widget
   *  params), without exposing the authkey. */
  @Public()
  @Get('otp/config')
  otpConfig() {
    return { ...this.msg91Widget.publicConfig(), sms: true };
  }

  @Public()
  @Post('otp/request')
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.otp.request(dto.phone, req.ip);
  }

  @Public()
  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { phone } = await this.otp.verify(dto.phone, dto.otp);
    const { tokens, isNew } = await this.auth.authByVerifiedPhone(phone, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, { firstName: dto.firstName });
    setAuthCookies(res, tokens);
    return { ...tokens, isNew };
  }

  /**
   * MSG91 Secure OTP widget path — the browser has already verified the code.
   * We validate the widget's access token with MSG91, then sign the customer in
   * (creating the account on first use) through the same session machinery.
   */
  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('otp/widget/verify')
  async verifyWidgetOtp(
    @Body() dto: VerifyWidgetOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const claimed = this.otp.normalisePhone(dto.phone);
    const verified = await this.msg91Widget.verifyAccessToken(dto.accessToken);
    if (verified.phone && verified.phone !== claimed) {
      throw new BadRequestException(
        'The verified number does not match. Please start again.',
      );
    }
    const { tokens, isNew } = await this.auth.authByVerifiedPhone(
      verified.phone ?? claimed,
      { userAgent: req.headers['user-agent'], ip: req.ip },
      { firstName: dto.firstName },
    );
    setAuthCookies(res, tokens);
    return { ...tokens, isNew };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = dto.refreshToken ?? (req as unknown as { cookies?: Record<string, string> }).cookies?.sj_refresh;
    if (!raw) throw new UnauthorizedException('No refresh token supplied');
    const tokens = await this.auth.refresh(raw, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req as unknown as { cookies?: Record<string, string> }).cookies?.sj_refresh;
    await this.auth.logout(raw);
    res.clearCookie('sj_access', { path: '/' });
    res.clearCookie('sj_refresh', { path: '/' });
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
