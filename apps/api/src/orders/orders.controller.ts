import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    if (!user) throw new UnauthorizedException('Sign in to view your orders');
    return this.orders.listForCustomer(user.id);
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @Get(':orderNumber')
  get(
    @CurrentUser() user: AuthUser,
    @Headers('x-cart-token') token: string,
    @Param('orderNumber') orderNumber: string,
    @Query('email') email?: string,
  ) {
    return this.orders.getForCustomer(orderNumber, {
      userId: user?.id,
      cartToken: token || undefined,
      email,
    });
  }
}
