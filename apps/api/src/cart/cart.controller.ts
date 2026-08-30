import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import { CartService, type CartContext } from './cart.service.js';
import { CouponError } from '../pricing/pricing.service.js';
import { AddItemDto, CouponDto, UpdateItemDto } from './cart.dto.js';

@ApiTags('cart')
@Public()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  private ctx(user: AuthUser | undefined, token: string | undefined): CartContext {
    return { userId: user?.id, cartToken: token || undefined };
  }

  @Get()
  get(@CurrentUser() user: AuthUser, @Headers('x-cart-token') token: string) {
    return this.cart.view(this.ctx(user, token));
  }

  @Post('items')
  add(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: AddItemDto,
  ) {
    return this.cart.addItem(this.ctx(user, token), dto.variantId, dto.quantity);
  }

  @Patch('items/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItem(this.ctx(user, token), id, dto.quantity);
  }

  @Delete('items/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Param('id') id: string,
  ) {
    return this.cart.removeItem(this.ctx(user, token), id);
  }

  @Post('coupon')
  async applyCoupon(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: CouponDto,
  ) {
    try {
      return await this.cart.setCoupon(this.ctx(user, token), dto.code);
    } catch (err) {
      if (err instanceof CouponError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser() user: AuthUser, @Headers('x-cart-token') token: string) {
    return this.cart.setCoupon(this.ctx(user, token), null);
  }
}
