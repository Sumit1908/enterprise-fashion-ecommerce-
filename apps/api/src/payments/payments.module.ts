import { Global, Module } from '@nestjs/common';
import { CodProvider } from './cod.provider.js';
import { MockProvider } from './mock.provider.js';
import { RazorpayProvider } from './razorpay.provider.js';
import { PaymentsService } from './payments.service.js';

@Global()
@Module({
  providers: [CodProvider, MockProvider, RazorpayProvider, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
