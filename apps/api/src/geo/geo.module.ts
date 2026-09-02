import { Global, Module } from '@nestjs/common';
import { GeoController } from './pincode.controller.js';
import { PincodeService } from './pincode.service.js';

@Global()
@Module({
  controllers: [GeoController],
  providers: [PincodeService],
  exports: [PincodeService],
})
export class GeoModule {}
