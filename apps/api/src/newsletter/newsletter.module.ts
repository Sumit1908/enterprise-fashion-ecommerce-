import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

@Module({
  imports: [AuthModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
