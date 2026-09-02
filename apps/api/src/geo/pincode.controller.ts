import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators.js';
import { PincodeService } from './pincode.service.js';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly pincode: PincodeService) {}

  /**
   * City / state / serviceability for an Indian PIN code.
   *   200 → resolved (check `serviceable`)
   *   404 → not a real PIN
   *   503 → upstream lookup unavailable, nothing cached (client should retry)
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('pincode/:pincode')
  async lookup(@Param('pincode') pincode: string) {
    const resolved = await this.pincode.resolve(pincode);
    if (!resolved) {
      throw new NotFoundException('Please enter a valid PIN code.');
    }
    return {
      pincode: resolved.pincode,
      city: resolved.city,
      district: resolved.district,
      state: resolved.state,
      area: resolved.area,
      serviceable: resolved.serviceable,
      codAvailable: resolved.codAvailable,
      etaMinDays: resolved.etaMinDays,
      etaMaxDays: resolved.etaMaxDays,
    };
  }
}
