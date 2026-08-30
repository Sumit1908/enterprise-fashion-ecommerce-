import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser, type AuthUser } from '../common/decorators.js';
import { WishlistService } from './wishlist.service.js';
import { AddWishlistDto, MergeWishlistDto } from './wishlist.dto.js';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.wishlist.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: AddWishlistDto) {
    return this.wishlist.add(user.id, dto);
  }

  @Post('merge')
  merge(@CurrentUser() user: AuthUser, @Body() dto: MergeWishlistDto) {
    return this.wishlist.merge(user.id, dto.slugs);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.wishlist.remove(user.id, productId);
  }
}
