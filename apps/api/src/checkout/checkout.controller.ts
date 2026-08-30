import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import type { CartContext } from '../cart/cart.service.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersService } from '../orders/orders.service.js';
import {
  PlaceOrderDto,
  QuoteDto,
  RetryPaymentDto,
  VerifyPaymentDto,
} from '../orders/orders.dto.js';

@ApiTags('checkout')
@Public()
@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  private ctx(user: AuthUser | undefined, token: string | undefined): CartContext {
    return { userId: user?.id, cartToken: token || undefined };
  }

  @Get()
  summary(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Query('pincode') pincode?: string,
  ) {
    return this.checkout.summary(this.ctx(user, token), pincode);
  }

  @Post('quote')
  quote(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: QuoteDto,
  ) {
    return this.checkout.quote(this.ctx(user, token), dto);
  }

  @Post()
  place(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: PlaceOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.placeOrder(this.ctx(user, token), dto, { ip: req.ip });
  }

  @Post('verify')
  verify(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.orders.verifyFromClient(this.ctx(user, token), {
      orderNumber: dto.orderNumber,
      providerOrderId: dto.providerOrderId,
      providerPaymentId: dto.providerPaymentId,
      signature: dto.signature,
      mockOutcome: dto.mockOutcome,
    });
  }

  @Post('retry')
  retry(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Body() dto: RetryPaymentDto,
  ) {
    return this.orders.retryPayment(this.ctx(user, token), dto.orderNumber, dto.paymentMethod);
  }
}
