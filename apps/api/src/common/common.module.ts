import { Global, Module } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor.js';

/** Cross-cutting providers available to every module (audit logging, …). */
@Global()
@Module({
  providers: [AuditInterceptor],
  exports: [AuditInterceptor],
})
export class CommonModule {}
