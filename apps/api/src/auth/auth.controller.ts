import {
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
import type { Request, Response } from 'express';
import { loadEnv } from '@slay/config';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto, RegisterDto } from './dto.js';
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
  constructor(private readonly auth: AuthService) {}

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
